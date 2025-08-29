// src/views/catalog/DeparturesView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    listDepartures,
    createDeparture,
    updateDeparture,
    deleteDeparture,
    type Departure,
    type DepartureStatus,
    formatDepartureTitle,
} from "../../services/departures";
import { listActiveRoutesLite, getRoute } from "../../services/routes";
import { listActiveBusesLite } from "../../services/buses";
import DepartureCrewDrawer from "./DepartureCrewDrawer";

const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

const Badge = ({
                   children,
                   variant = "muted",
               }: {
    children: React.ReactNode;
    variant?: "success" | "warning" | "danger" | "muted";
}) => {
    const cls =
        variant === "success"
            ? "bg-green-100 text-green-700"
            : variant === "warning"
                ? "bg-amber-100 text-amber-700"
                : variant === "danger"
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-700";
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
};

function useDebouncedValue<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

type Id = number | string;

// ---- Select options ----
type LiteOption = { id: Id; label: string };
type RouteLite = LiteOption & { origin_code?: string | null; destination_code?: string | null };
type BusLite = LiteOption & { plate?: string | null };

// ---- Form ----
type FormDeparture = {
    id?: Id;
    route: Id | "";
    bus: Id | "";
    driver?: Id | null; // legacy opcional
    scheduled_departure_at: string; // datetime-local string
    actual_departure_at: string; // datetime-local string
    status: DepartureStatus;
    notes: string;
};

// ---- Utils fecha ----
function toLocalInputValue(iso?: string | null) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, "0");
    const yyyy = d.getFullYear();
    const mm = pad(d.getMonth() + 1);
    const dd = pad(d.getDate());
    const hh = pad(d.getHours());
    const mi = pad(d.getMinutes());
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}
function fromLocalInputValue(v: string) {
    return v ? new Date(v).toISOString() : null;
}

// ---- Badges de estado ----
function statusBadge(status: DepartureStatus) {
    switch (status) {
        case "SCHEDULED":
            return <Badge variant="muted">Programada</Badge>;
        case "BOARDING":
            return <Badge variant="warning">Embarcando</Badge>;
        case "DEPARTED":
            return <Badge variant="success">Salida</Badge>;
        case "CLOSED":
            return <Badge variant="muted">Cerrada</Badge>;
        case "CANCELLED":
            return <Badge variant="danger">Cancelada</Badge>;
        default:
            return <Badge variant="muted">{status}</Badge>;
    }
}

export default function DeparturesView() {
    // filtros/búsqueda
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);
    const [status, setStatus] = useState<DepartureStatus | "">("");
    const [dateFrom, setDateFrom] = useState<string>(""); // YYYY-MM-DD
    const [dateTo, setDateTo] = useState<string>("");

    // lista
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<Departure[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const reqSeqRef = useRef(0);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

    // combos
    const [routes, setRoutes] = useState<RouteLite[]>([]);
    const [buses, setBuses] = useState<BusLite[]>([]);
    const [loadingCombos, setLoadingCombos] = useState(true);

    // edición
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormDeparture | null>(null);
    const [saving, setSaving] = useState(false);

    // eliminar
    const [confirmId, setConfirmId] = useState<Id | null>(null);
    const [deleting, setDeleting] = useState(false);

    // preview (ojito)
    type PreviewStop = { label: string; offset: number | null; order: number };
    const [showPreview, setShowPreview] = useState(false);
    const [previewTitle, setPreviewTitle] = useState<string>("");
    const [previewStops, setPreviewStops] = useState<PreviewStop[]>([]);

    // drawer tripulación
    const [crewOpen, setCrewOpen] = useState(false);
    const [crewDepId, setCrewDepId] = useState<Id | null>(null);
    const [crewTitle, setCrewTitle] = useState<string>("");

    const openCrew = (d: Departure) => {
        setCrewDepId(d.id);
        setCrewTitle(
            formatDepartureTitle({
                route_name: d.route_name,
                scheduled_departure_at: d.scheduled_departure_at,
                bus_code: d.bus_code,
            })
        );
        setCrewOpen(true);
    };

    // ======= cargar combos =======
    useEffect(() => {
        (async () => {
            try {
                setLoadingCombos(true);
                const [rs, bs] = await Promise.all([listActiveRoutesLite(), listActiveBusesLite()]);
                setRoutes(rs);
                setBuses(bs);
            } catch (e: any) {
                toast.error(e?.message || "Error cargando combos");
            } finally {
                setLoadingCombos(false);
            }
        })();
    }, []);

    // ======= listar =======
    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const { items, total } = await listDepartures({
                q: qDebounced,
                status: (status || undefined) as any,
                // ✅ nombres correctos de filtros en el service:
                scheduled_gte: dateFrom || undefined,
                scheduled_lte: dateTo || undefined,
                embedCrew: true,
                page,
                pageSize,
                ordering: "-scheduled_departure_at",
            });
            if (reqSeqRef.current !== mySeq) return;
            setItems(items ?? []);
            setTotal(Number(total ?? 0));
            setError(null);
        } catch (e: any) {
            if (reqSeqRef.current !== mySeq) return;
            const msg = e?.message || "Error cargando salidas";
            setError(msg);
            toast.error(msg);
        } finally {
            if (reqSeqRef.current === mySeq) setLoading(false);
        }
    }, [qDebounced, status, dateFrom, dateTo, page, pageSize]);

    useEffect(() => setPage(1), [qDebounced, status, dateFrom, dateTo]);
    useEffect(() => void fetchList(), [fetchList]);

    // ======= helpers =======
    const routeLabel = (id: Id) => routes.find((r) => String(r.id) === String(id))?.label ?? String(id);
    const busLabel = (id: Id) => buses.find((b) => String(b.id) === String(id))?.label ?? String(id);

    // ======= abrir modales =======
    const openCreate = () => {
        setEditing({
            route: "",
            bus: "",
            driver: null,
            scheduled_departure_at: "",
            actual_departure_at: "",
            status: "SCHEDULED",
            notes: "",
        });
        setShowForm(true);
    };

    const openEdit = (d: Departure) => {
        setEditing({
            id: d.id,
            route: d.route,
            bus: d.bus,
            driver: d.driver ?? null,
            scheduled_departure_at: toLocalInputValue(d.scheduled_departure_at),
            actual_departure_at: toLocalInputValue(d.actual_departure_at ?? undefined),
            status: d.status,
            notes: d.notes ?? "",
        });
        setShowForm(true);
    };

    // ======= preview (ojito) =======
    const openPreview = async (d: Departure) => {
        try {
            setPreviewTitle(`${d.route_name ?? "Ruta"} — ${new Date(d.scheduled_departure_at).toLocaleString()}`);
            const route = await getRoute(d.route);
            const ordered = [...(route.stops ?? [])].sort((a, b) => a.order - b.order);
            setPreviewStops(
                ordered.map((s) => ({
                    label: (s.office_name || s.office_code || s.office) as any,
                    offset: s.scheduled_offset_min ?? null,
                    order: s.order,
                }))
            );
            setShowPreview(true);
        } catch (e: any) {
            toast.error(e?.message || "No se pudo cargar la ruta de la salida.");
        }
    };

    // ======= submit =======
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        if (!editing.route || !editing.bus || !editing.scheduled_departure_at) {
            toast.error("Completa ruta, bus y fecha/hora programada.");
            return;
        }
        setSaving(true);
        try {
            const body = {
                route: editing.route,
                bus: editing.bus,
                driver: editing.driver ?? null,
                scheduled_departure_at: fromLocalInputValue(editing.scheduled_departure_at),
                actual_departure_at: editing.actual_departure_at ? fromLocalInputValue(editing.actual_departure_at) : null,
                status: editing.status,
                notes: editing.notes,
            };

            if (editing.id) {
                const p = updateDeparture(editing.id, body);
                toast.promise(p, {
                    loading: "Actualizando…",
                    success: "Salida actualizada",
                    error: (err) => err?.message || "Error al actualizar",
                });
                await p;
            } else {
                const p = createDeparture(body as any);
                toast.promise(p, {
                    loading: "Creando salida…",
                    success: "Salida creada",
                    error: (err) => err?.message || "Error al crear",
                });
                await p;
                setTotal((t) => t + 1);
            }
            setShowForm(false);
            await fetchList();
        } finally {
            setSaving(false);
        }
    };

    // ======= eliminar =======
    const onDelete = async () => {
        if (!confirmId) return;
        setDeleting(true);
        try {
            const p = deleteDeparture(confirmId);
            toast.promise(p, {
                loading: "Eliminando…",
                success: "Salida eliminada",
                error: (err) => err?.message || "Error al eliminar",
            });
            await p;
            setItems((prev) => prev.filter((it) => it.id !== confirmId));
            setTotal((t) => Math.max(0, t - 1));
            setConfirmId(null);
            await fetchList();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="mt-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                    <div className="relative w-full sm:w-80">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="11" cy="11" r="7" strokeWidth="1.5" />
                <path d="M21 21l-3.6-3.6" strokeWidth="1.5" />
              </svg>
            </span>
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder="Buscar por ruta, bus, chofer…"
                            className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>
                    <select
                        className="rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as any)}
                    >
                        <option value="">Todos</option>
                        <option value="SCHEDULED">Programada</option>
                        <option value="BOARDING">Embarcando</option>
                        <option value="DEPARTED">Salida</option>
                        <option value="CLOSED">Cerrada</option>
                        <option value="CANCELLED">Cancelada</option>
                    </select>
                    <div className="flex items-center gap-2">
                        <input
                            type="date"
                            className="rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            placeholder="Desde"
                        />
                        <span className="text-xs text-gray-500">→</span>
                        <input
                            type="date"
                            className="rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            placeholder="Hasta"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Badge>{total} salidas</Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nueva salida
                    </button>
                </div>
            </div>

            {/* Tabla / Cards */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando salidas…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay salidas.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden rounded-2xl border md:block">
                            <div
                                className="max-h-[60vh] overflow-y-auto overflow-x-auto overscroll-contain"
                                style={{ scrollbarGutter: "stable both-edges" }}
                            >
                                <table className="w-full min-w-[1000px] table-fixed text-sm">
                                    <colgroup>
                                        <col className="w-56" /> {/* Ruta */}
                                        <col className="w-36" /> {/* Bus */}
                                        <col className="w-40" /> {/* Programada */}
                                        <col className="w-24" /> {/* Estado */}
                                        <col className="w-[420px]" /> {/* Tripulación + acciones */}
                                    </colgroup>
                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2">Ruta</th>
                                        <th className="px-3 py-2">Bus</th>
                                        <th className="px-3 py-2">Programada</th>
                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.map((d) => (
                                        <tr key={d.id} className="border-t align-top">
                                            <td className="px-3 py-1.5">
                                                <div className="truncate font-medium text-gray-900" title={d.route_name}>
                                                    {d.route_name}
                                                </div>
                                                <div className="text-xs text-gray-500">{d.notes || "—"}</div>
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">{d.bus_code || d.bus_plate || d.bus}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                                {new Date(d.scheduled_departure_at).toLocaleString()}
                                            </td>
                                            <td className="px-3 py-1.5">{statusBadge(d.status)}</td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Tripulación */}
                                                    <button
                                                        title="Tripulación"
                                                        className="rounded p-1 hover:bg-gray-100"
                                                        onClick={() => openCrew(d)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path
                                                                d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5v1h18v-1c0-2.5-4-5-9-5Z"
                                                                strokeWidth="1.5"
                                                            />
                                                        </svg>
                                                    </button>
                                                    {/* Ojito */}
                                                    <button
                                                        title="Ver"
                                                        className="rounded p-1 hover:bg-gray-100"
                                                        onClick={() => openPreview(d)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                                        </svg>
                                                    </button>
                                                    {/* Editar */}
                                                    <button title="Editar" className="rounded p-1 hover:bg-gray-100" onClick={() => openEdit(d)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z"
                                                            />
                                                        </svg>
                                                    </button>
                                                    {/* Eliminar */}
                                                    <button
                                                        title="Eliminar"
                                                        className="rounded p-1 text-red-600 hover:bg-red-50"
                                                        onClick={() => setConfirmId(d.id)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7"
                                                            />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile */}
                        <div className="grid gap-2 md:hidden">
                            {items.map((d) => (
                                <div key={d.id} className="rounded-2xl border p-3">
                                    <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Ruta</dt>
                                        <dd className="col-span-2 truncate text-gray-900">{d.route_name}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Bus</dt>
                                        <dd className="col-span-2 truncate text-gray-700">{d.bus_code || d.bus_plate || d.bus}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Programada</dt>
                                        <dd className="col-span-2 truncate text-gray-700">
                                            {new Date(d.scheduled_departure_at).toLocaleString()}
                                        </dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Estado</dt>
                                        <dd className="col-span-2">{statusBadge(d.status)}</dd>
                                    </dl>

                                    <div className="mt-3 flex justify-end gap-4 text-xs">
                                        <button
                                            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                            onClick={() => openCrew(d)}
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path
                                                    d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Zm0 2c-5 0-9 2.5-9 5v1h18v-1c0-2.5-4-5-9-5Z"
                                                    strokeWidth="1.5"
                                                />
                                            </svg>
                                            <span>Tripulación</span>
                                        </button>

                                        <button
                                            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                            onClick={() => openPreview(d)}
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                            </svg>
                                            <span>Ver</span>
                                        </button>

                                        <button
                                            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                            onClick={() => openEdit(d)}
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z"
                                                />
                                            </svg>
                                            <span>Editar</span>
                                        </button>

                                        <button
                                            className="inline-flex items-center gap-1.5 text-red-600 hover:underline"
                                            onClick={() => setConfirmId(d.id)}
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path
                                                    strokeWidth="1.5"
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7"
                                                />
                                            </svg>
                                            <span>Eliminar</span>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                        className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ←
                    </button>
                    <span className="text-sm text-gray-600">
            Página <b>{page}</b> / {totalPages}
          </span>
                    <button
                        className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        →
                    </button>
                </div>
            )}

            {/* Modal PREVIEW (ojito) */}
            {showPreview && (
                <div
                    className="fixed inset-0 z-50 flex items-end sm:items-center bg-black/40"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setShowPreview(false)}
                >
                    <div
                        className="w-full sm:max-w-3xl sm:mx-auto bg-white shadow-lg
                 rounded-t-2xl sm:rounded-2xl
                 h-[85vh] sm:h-auto
                 grid grid-rows-[auto_1fr_auto] overflow-hidden"
                        style={{ paddingBottom: "env(safe-area-inset-bottom)" }} // iOS safe-area
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b">
                            <div className="min-w-0">
                                <h3 className="text-base sm:text-lg font-semibold truncate">{previewTitle}</h3>
                                <p className="text-[11px] sm:text-xs text-gray-600">Secuencia de paradas (origen → destino)</p>
                            </div>
                            <button
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => setShowPreview(false)}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content (scrollable) */}
                        <div className="px-3 sm:px-5 py-3 overflow-y-auto">
                            <div className="rounded-xl border p-2 sm:p-3">
                                {/* carrusel horizontal (mobile-first) */}
                                <div
                                    className="flex items-stretch gap-2 overflow-x-auto pb-2"
                                    style={{ scrollbarGutter: "stable both-edges" }}
                                >
                                    {previewStops.map((s, i) => (
                                        <div key={`${s.label}-${i}`} className="flex items-center gap-2 shrink-0">
                                            <div className="min-w-[7.5rem] sm:min-w-[9rem] rounded-xl border px-3 py-2">
                                                <div className="text-[12px] sm:text-xs font-medium text-gray-900 truncate" title={s.label}>
                                                    {i === 0 ? "Origen: " : i === previewStops.length - 1 ? "Destino: " : ""}
                                                    {s.label}
                                                </div>
                                                <div className="text-[10px] sm:text-[11px] text-gray-500">
                                                    {s.offset != null ? `+${s.offset} min` : "—"}
                                                </div>
                                            </div>
                                            {i < previewStops.length - 1 && (
                                                <div className="flex h-full items-center">
                                                    <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                        <path d="M5 12h14M13 5l7 7-7 7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                    </svg>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                {/* timeline solo en md+ */}
                                <div className="mt-4 hidden md:block">
                                    <ol className="grid grid-cols-12 gap-2">
                                        {previewStops.map((s, i) => (
                                            <li key={`row-${i}`} className="col-span-12">
                                                <div className="flex items-center gap-3">
                                                    <div
                                                        className={`h-2 w-2 rounded-full ${
                                                            i === 0 ? "bg-green-500" : i === previewStops.length - 1 ? "bg-blue-500" : "bg-gray-400"
                                                        }`}
                                                    />
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium text-gray-900">{s.label}</div>
                                                        <div className="text-xs text-gray-500">
                                                            {s.offset != null ? `Offset +${s.offset} min` : "Offset —"}
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="flex justify-end px-4 py-3 border-t">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowPreview(false)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear/Editar */}
            {showForm && editing && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}
                >
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editing.id ? "Editar salida" : "Nueva salida"}</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>

                        <form className="mt-3 space-y-4" onSubmit={onSubmit}>
                            {/* Ruta / Bus */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Ruta</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.route}
                                        onChange={(e) => setEditing((s) => ({ ...s!, route: e.target.value }))}
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {routes.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Bus</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.bus}
                                        onChange={(e) => setEditing((s) => ({ ...s!, bus: e.target.value }))}
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {buses.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Fechas */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Programada</label>
                                    <input
                                        type="datetime-local"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.scheduled_departure_at}
                                        onChange={(e) => setEditing((s) => ({ ...s!, scheduled_departure_at: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Salida real (opcional)</label>
                                    <input
                                        type="datetime-local"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.actual_departure_at}
                                        onChange={(e) => setEditing((s) => ({ ...s!, actual_departure_at: e.target.value }))}
                                    />
                                </div>
                            </div>

                            {/* Estado + notas */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Estado</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.status}
                                        onChange={(e) => setEditing((s) => ({ ...s!, status: e.target.value as DepartureStatus }))}
                                        required
                                    >
                                        <option value="SCHEDULED">Programada</option>
                                        <option value="BOARDING">Embarcando</option>
                                        <option value="DEPARTED">Salida</option>
                                        <option value="CLOSED">Cerrada</option>
                                        <option value="CANCELLED">Cancelada</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Notas</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.notes}
                                        onChange={(e) => setEditing((s) => ({ ...s!, notes: e.target.value }))}
                                        placeholder="Opcional"
                                    />
                                </div>
                            </div>

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>
                                    Cancelar
                                </button>
                                <button
                                    disabled={saving || !editing.route || !editing.bus || !editing.scheduled_departure_at}
                                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50"
                                >
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirmación eliminar */}
            {confirmId !== null && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Eliminar salida</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">¿Seguro que deseas eliminar esta salida? Esta acción no se puede deshacer.</p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setConfirmId(null)}>
                                Cancelar
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                onClick={onDelete}
                                disabled={deleting}
                            >
                                {deleting && <Spinner />} Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Drawer de tripulación */}
            {crewOpen && crewDepId != null && (
                <DepartureCrewDrawer open={crewOpen} onClose={() => setCrewOpen(false)} departureId={crewDepId} title={crewTitle} />
            )}
        </div>
    );
}
