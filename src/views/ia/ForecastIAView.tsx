// src/views/ai/ForecastIAView.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Brain, LineChart, CalendarClock, Route, Download, X } from "lucide-react";
import { forecastNextDays, forecastRoute, type ForecastRow } from "../../services/ai";
import { api, type ApiError } from "../../services/api";

/* ------------------------------ tipos ------------------------------ */
type Mode = "next-days" | "by-route";
type RouteLite = { id: string | number; name: string };

/* ------------------------------ ui bits ------------------------------ */
const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

/* ----------------------------- helpers ----------------------------- */
function errMsg(e: unknown, fallback: string) {
    const ae = e as ApiError;
    return ae?.data?.["detail"] || ae?.message || fallback;
}

function isValidISO(d?: string) {
    if (!d) return false;
    const x = new Date(d);
    return !Number.isNaN(x.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

/** (Opcional) trae rutas para el selector. Ajusta el endpoint si tu API es distinta. */
async function fetchRoutesLite(): Promise<RouteLite[]> {
    const res = await api.get<any>("/catalog/routes/?page_size=500&ordering=name");
    const arr = Array.isArray(res) ? res : res?.results ?? [];
    return arr.map((r: any) => ({ id: r.id, name: r.name }));
}

/* ------------------------------ Modal ------------------------------ */
type ModalProps = {
    open: boolean;
    title?: string;
    onClose: () => void;
    children: React.ReactNode;
    footer?: React.ReactNode;
};
function Modal({ open, title, onClose, children, footer }: ModalProps) {
    if (!open) return null;
    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black/40" onClick={onClose} />
            <div className="relative z-10 w-[min(90vw,1000px)] max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h3 className="text-base font-semibold">{title ?? "Detalles"}</h3>
                    <button
                        type="button"
                        onClick={onClose}
                        className="rounded-full p-2 hover:bg-gray-100"
                        aria-label="Cerrar"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>
                <div className="max-h-[65vh] overflow-auto p-4">{children}</div>
                {footer && <div className="border-t p-3">{footer}</div>}
            </div>
        </div>
    );
}

/* =============================== VIEW =============================== */
export default function ForecastIAView() {
    const [mode, setMode] = useState<Mode>("next-days");

    // NEXT-DAYS
    const [days, setDays] = useState<number>(14);

    // BY-ROUTE
    const [routes, setRoutes] = useState<RouteLite[]>([]);
    const [fetchingRoutes, setFetchingRoutes] = useState(false);
    const [routeName, setRouteName] = useState<string>("");
    const [dateA, setDateA] = useState<string>(""); // una o varias fechas
    const [dateB, setDateB] = useState<string>(""); // opcional: 2da fecha para rango

    // RESULTADOS
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<ForecastRow[]>([]);

    // MODAL
    const [modalOpen, setModalOpen] = useState(false);

    // precarga de rutas (opcional)
    useEffect(() => {
        (async () => {
            try {
                setFetchingRoutes(true);
                const rs = await fetchRoutesLite();
                setRoutes(rs);
            } catch {
                // no es crítico; igual permitimos escribir manualmente
            } finally {
                setFetchingRoutes(false);
            }
        })();
    }, []);

    const canRequest = useMemo(() => {
        if (mode === "next-days") {
            return days > 0 && days <= 90; // límite razonable
        }
        // by-route
        const hasRoute = routeName.trim().length > 0;
        const one = isValidISO(dateA);
        const two = isValidISO(dateB);
        return hasRoute && (one || (one && two));
    }, [mode, days, routeName, dateA, dateB]);

    function buildDateList(): string[] {
        // Si hay dos fechas válidas, expandir rango inclusivo; si no, usar la primera como única
        if (isValidISO(dateA) && isValidISO(dateB)) {
            const start = new Date(dateA);
            const end = new Date(dateB);
            let s = new Date(start);
            let e = new Date(end);
            if (s > e) {
                const t = s;
                s = e;
                e = t;
            }
            const out: string[] = [];
            const cur = new Date(s);
            while (cur <= e) {
                out.push(cur.toISOString().slice(0, 10));
                cur.setDate(cur.getDate() + 1);
            }
            return out;
        }
        return isValidISO(dateA) ? [dateA] : [];
    }

    async function onPredict() {
        if (!canRequest) {
            toast.info(mode === "next-days" ? "Elige un número de días (1-90)." : "Completa ruta y fecha(s).");
            return;
        }
        setLoading(true);
        try {
            if (mode === "next-days") {
                const data = await forecastNextDays(days);
                setRows(data);
                if (data.length === 0) toast.message("No hay resultados de predicción.");
            } else {
                const dates = buildDateList();
                const data = await forecastRoute(routeName.trim(), dates);
                setRows(data);
                if (data.length === 0) toast.message("No hay resultados para esa ruta/fechas.");
            }
            // abrir modal automáticamente cuando hay resultados
            // (si no te gusta automático, comenta la siguiente línea)
            setModalOpen(true);
        } catch (e) {
            toast.error(errMsg(e, "No se pudo obtener la predicción."));
        } finally {
            setLoading(false);
        }
    }

    function onDownloadCsv() {
        if (rows.length === 0) {
            toast.info("No hay datos para descargar.");
            return;
        }
        const header = "route,date,yhat,capacity";
        const lines = rows.map((r) => `${r.route},${r.date},${r.yhat},${r.capacity}`);
        const csv = [header, ...lines].join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const suffix = mode === "next-days" ? `next_${days}d` : `route_${routeName || "NA"}`;
        a.href = url;
        a.download = `forecast_${suffix}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // resumen para el modal
    const summary = useMemo(() => {
        if (rows.length === 0) return null;
        const routes = Array.from(new Set(rows.map((r) => r.route))).sort();
        const dates = rows.map((r) => r.date).sort();
        return {
            routes,
            start: dates[0],
            end: dates[dates.length - 1],
            n: rows.length,
        };
    }, [rows]);

    return (
        <div className="mt-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl border bg-white p-2 shadow-sm">
                        <Brain className="h-5 w-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">Predicción (IA)</h2>
                        <p className="text-sm text-gray-600">Forecast de ocupación por ruta y fecha</p>
                    </div>
                </div>
            </div>

            {/* Modo */}
            <div className="mt-4 rounded-2xl border p-3">
                <label className="text-xs text-gray-600">Modo</label>
                <div className="mt-2 grid grid-cols-2 sm:max-w-sm gap-2">
                    <button
                        type="button"
                        onClick={() => setMode("next-days")}
                        className={`rounded-xl border px-3 py-2 text-sm ${mode === "next-days" ? "bg-black text-white" : "hover:bg-gray-50"}`}
                    >
                        Próximos N días
                    </button>
                    <button
                        type="button"
                        onClick={() => setMode("by-route")}
                        className={`rounded-xl border px-3 py-2 text-sm ${mode === "by-route" ? "bg-black text-white" : "hover:bg-gray-50"}`}
                    >
                        Por ruta + fechas
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="mt-4 rounded-2xl border p-4">
                {mode === "next-days" ? (
                    <div className="grid gap-4 sm:max-w-sm">
                        <div className="rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <LineChart className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">Horizonte (días)</span>
                            </div>
                            <div className="mt-3">
                                <input
                                    type="number"
                                    min={1}
                                    max={90}
                                    value={days}
                                    onChange={(e) => setDays(Number(e.target.value))}
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                />
                                <p className="mt-1 text-[11px] text-gray-500">Rango sugerido: 7–30 días.</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Ruta */}
                        <div className="rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <Route className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">Ruta</span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div>
                                    <label className="text-xs text-gray-600">Elegir de la lista</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={routeName}
                                        onChange={(e) => setRouteName(e.target.value)}
                                    >
                                        <option value="">{fetchingRoutes ? "Cargando…" : "(Seleccionar ruta)"}</option>
                                        {routes.map((r) => (
                                            <option key={String(r.id)} value={r.name}>
                                                {r.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-gray-600">O escribir ruta</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        placeholder="Ej: SCZ-LPZ"
                                        value={routeName}
                                        onChange={(e) => setRouteName(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Fechas */}
                        <div className="rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">Fechas</span>
                            </div>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                <div>
                                    <label className="text-xs text-gray-600">Fecha (obligatoria)</label>
                                    <input
                                        type="date"
                                        value={dateA}
                                        onChange={(e) => setDateA(e.target.value)}
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-gray-600">Hasta (opcional, rango)</label>
                                    <input
                                        type="date"
                                        value={dateB}
                                        onChange={(e) => setDateB(e.target.value)}
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                    />
                                </div>
                            </div>
                            <p className="mt-1 text-[11px] text-gray-500">
                                Puedes elegir una sola fecha o un rango (se generará una lista).
                            </p>
                        </div>
                    </div>
                )}

                {/* Acciones */}
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div />
                    <div className="grid gap-3 sm:grid-cols-3">
                        <button
                            type="button"
                            disabled={!canRequest || loading}
                            onClick={onPredict}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                        >
                            {loading ? <Spinner /> : <LineChart className="h-4 w-4" />}
                            Predecir
                        </button>
                        <button
                            type="button"
                            disabled={rows.length === 0}
                            onClick={() => setModalOpen(true)}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                            title="Ver resultados en modal"
                        >
                            <Brain className="h-4 w-4" />
                            Ver en modal
                        </button>
                        <button
                            type="button"
                            disabled={rows.length === 0}
                            onClick={onDownloadCsv}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                            title="Descargar CSV"
                        >
                            <Download className="h-4 w-4" />
                            Descargar CSV
                        </button>
                    </div>
                </div>
            </div>

            {/* Resultados inline (opcional si usas modal) */}
            <div className="mt-4 rounded-2xl border overflow-x-auto">
                <table className="w-full text-sm">
                    <thead>
                    <tr className="bg-gray-50 text-left">
                        <th className="p-2 border">Ruta</th>
                        <th className="p-2 border">Fecha</th>
                        <th className="p-2 border">Predicción</th>
                        <th className="p-2 border">Capacidad</th>
                        <th className="p-2 border">Ocupación (%)</th>
                    </tr>
                    </thead>
                    <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td className="p-3 text-center text-gray-500" colSpan={5}>
                                {loading ? "Calculando predicción…" : "Sin datos"}
                            </td>
                        </tr>
                    ) : (
                        rows.map((r, i) => {
                            const pct = r.capacity > 0 ? Math.round((r.yhat / r.capacity) * 100) : 0;
                            return (
                                <tr key={`${r.route}-${r.date}-${i}`}>
                                    <td className="p-2 border">{r.route}</td>
                                    <td className="p-2 border">{r.date}</td>
                                    <td className="p-2 border font-semibold">{r.yhat}</td>
                                    <td className="p-2 border">{r.capacity}</td>
                                    <td className="p-2 border">{pct}%</td>
                                </tr>
                            );
                        })
                    )}
                    </tbody>
                </table>
            </div>

            {/* Modal de resultados */}
            <Modal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                title="Predicción (IA) – Resultados"
                footer={
                    <div className="flex items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={onDownloadCsv}
                            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                        >
                            <Download className="h-4 w-4" />
                            Descargar CSV
                        </button>
                        <button
                            type="button"
                            onClick={() => setModalOpen(false)}
                            className="rounded-xl bg-black px-3 py-2 text-sm text-white"
                        >
                            Cerrar
                        </button>
                    </div>
                }
            >
                {rows.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">Sin datos</div>
                ) : (
                    <>
                        {/* Resumen */}
                        {summary && (
                            <div className="mb-3 rounded-xl border p-3 text-sm">
                                <div className="grid gap-2 sm:grid-cols-3">
                                    <div>
                                        <div className="text-gray-500">Rutas</div>
                                        <div className="font-medium">{summary.routes.join(", ")}</div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500">Rango</div>
                                        <div className="font-medium">
                                            {summary.start} → {summary.end}
                                        </div>
                                    </div>
                                    <div>
                                        <div className="text-gray-500">Filas</div>
                                        <div className="font-medium">{summary.n}</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tabla dentro del modal */}
                        <div className="rounded-xl border overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                <tr className="bg-gray-50 text-left">
                                    <th className="p-2 border">Ruta</th>
                                    <th className="p-2 border">Fecha</th>
                                    <th className="p-2 border">Predicción</th>
                                    <th className="p-2 border">Capacidad</th>
                                    <th className="p-2 border">Ocupación (%)</th>
                                </tr>
                                </thead>
                                <tbody>
                                {rows.map((r, i) => {
                                    const pct = r.capacity > 0 ? Math.round((r.yhat / r.capacity) * 100) : 0;
                                    return (
                                        <tr key={`${r.route}-${r.date}-${i}`}>
                                            <td className="p-2 border">{r.route}</td>
                                            <td className="p-2 border">{r.date}</td>
                                            <td className="p-2 border font-semibold">{r.yhat}</td>
                                            <td className="p-2 border">{r.capacity}</td>
                                            <td className="p-2 border">{pct}%</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </Modal>

            {/* Ayuda */}
            <div className="mt-3 text-xs text-gray-600">
                <ul className="list-disc pl-5 space-y-1">
                    <li>
                        <b>Próximos N días</b>: usa el modelo entrenado para todas las rutas.
                    </li>
                    <li>
                        <b>Por ruta + fechas</b>: predice solo para la ruta/fechas elegidas.
                    </li>
                    <li>
                        El CSV contiene columnas: <code>route,date,yhat,capacity</code>.
                    </li>
                </ul>
            </div>
        </div>
    );
}
