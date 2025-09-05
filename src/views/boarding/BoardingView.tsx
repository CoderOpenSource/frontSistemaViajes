// src/views/boarding/BoardingView.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    listTicketsForDeparture,
    markPresent,
    markBoarded,
    closeBoarding,
    markPresentBulk,
    markBoardedBulk,
    type TicketWithAttendance,
    type AttendanceOutcome,
    attendanceLabel,
    shortTime,
} from "../../services/boarding";
import { listUpcomingDeparturesLite } from "../../services/departures";

type Id = string | number;

const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

const Pill = ({
                  children,
                  tone = "muted",
                  className = "",
              }: {
    children: React.ReactNode;
    tone?: "muted" | "ok" | "warn" | "bad";
    className?: string;
}) => {
    const cls =
        tone === "ok"
            ? "bg-green-100 text-green-700"
            : tone === "warn"
                ? "bg-amber-100 text-amber-700"
                : tone === "bad"
                    ? "bg-rose-100 text-rose-700"
                    : "bg-gray-100 text-gray-700";
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] sm:text-xs ${cls} ${className}`}>{children}</span>;
};

function outcomeTone(o?: AttendanceOutcome | null): "muted" | "ok" | "warn" | "bad" {
    switch (o) {
        case "PRESENT": return "warn";
        case "BOARDED": return "ok";
        case "NO_SHOW": return "bad";
        default: return "muted";
    }
}

type FilterKey = "ALL" | "PENDING" | "PRESENT" | "BOARDED" | "NO_SHOW";

export default function BoardingView() {
    // -------- state --------
    const [depId, setDepId] = useState<Id | "">("");
    const [depLabel, setDepLabel] = useState<string>("");
    const [depOptions, setDepOptions] = useState<Array<{ id: Id; label: string; status: string }>>([]);
    const [loadingDeps, setLoadingDeps] = useState(true);

    const [items, setItems] = useState<TicketWithAttendance[]>([]);
    const [loading, setLoading] = useState(false);

    // selección
    const [selected, setSelected] = useState<Record<string, boolean>>({});
    const selectedIds = useMemo(() => Object.keys(selected).filter((k) => selected[k]), [selected]);

    // filtros
    const [filter, setFilter] = useState<FilterKey>("ALL");
    const filtered = useMemo(() => {
        if (filter === "ALL") return items;
        return items.filter((t) => (t.attendance?.outcome || "PENDING") === filter);
    }, [items, filter]);

    // -------- salidas --------
    useEffect(() => {
        (async () => {
            try {
                setLoadingDeps(true);
                const opts = await listUpcomingDeparturesLite(150);
                setDepOptions(opts);
            } catch (e: any) {
                toast.error(e?.message || "Error cargando salidas");
            } finally {
                setLoadingDeps(false);
            }
        })();
    }, []);

    // -------- tickets --------
    async function fetchTickets() {
        if (!depId) { setItems([]); return; }
        try {
            setLoading(true);
            const data = await listTicketsForDeparture(depId);
            setItems(data);
            setSelected({});
            const found = depOptions.find((o) => String(o.id) === String(depId));
            if (found) setDepLabel(found.label);
        } catch (e: any) {
            toast.error(e?.message || "No se pudieron cargar los tickets");
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => { void fetchTickets(); /* eslint-disable-next-line */ }, [depId]);

    // -------- acciones --------
    const onPresentOne = async (id: Id) => {
        const p = markPresent(id);
        toast.promise(p, { loading: "Marcando presente…", success: "Presente", error: "No se pudo marcar" });
        await p; await fetchTickets();
    };
    const onBoardOne = async (id: Id) => {
        const p = markBoarded(id);
        toast.promise(p, { loading: "Marcando embarcado…", success: "Embarcado", error: "No se pudo marcar" });
        await p; await fetchTickets();
    };
    const onPresentBulk = async () => {
        if (selectedIds.length === 0) return;
        const p = markPresentBulk(selectedIds);
        toast.promise(p, { loading: `Marcando ${selectedIds.length}…`, success: ({ ok }) => `Marcados ${ok}`, error: "No se pudo marcar" });
        await p; await fetchTickets();
    };
    const onBoardBulk = async () => {
        if (selectedIds.length === 0) return;
        const p = markBoardedBulk(selectedIds);
        toast.promise(p, { loading: `Marcando ${selectedIds.length}…`, success: ({ ok }) => `Marcados ${ok}`, error: "No se pudo marcar" });
        await p; await fetchTickets();
    };
    const onCloseBoarding = async () => {
        if (!depId) return toast.info("Selecciona una salida.");
        const p = closeBoarding(depId);
        toast.promise(p, { loading: "Cerrando…", success: ({ no_show_marked }) => `No-show: ${no_show_marked}`, error: "No se pudo cerrar" });
        await p; await fetchTickets();
    };

    // -------- helpers UI --------
    const toggleAll = (checked: boolean) => {
        const next: Record<string, boolean> = {};
        for (const it of filtered) next[String(it.id)] = checked;
        setSelected(next);
    };
    const toggleOne = (id: Id, checked: boolean) => setSelected((s) => ({ ...s, [String(id)]: checked }));

    return (
        <div className="mt-4 sm:mt-6">
            {/* Header compacto */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl border bg-white p-1.5 sm:p-2 shadow-sm">
                        <IconBoarding className="h-4 w-4 sm:h-5 sm:w-5" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-semibold leading-tight">Embarque</h2>
                        <p className="text-[11px] sm:text-sm text-gray-600">Control de asistencia por salida</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Pill className="hidden sm:inline-flex">{items.length} tickets</Pill>
                    <button
                        onClick={onCloseBoarding}
                        disabled={!depId}
                        className="inline-flex items-center gap-1.5 rounded-2xl border px-3 py-1.5 text-xs sm:text-sm hover:bg-black hover:text-white disabled:opacity-50"
                    >
                        Cerrar embarque
                    </button>
                </div>
            </div>

            {/* Selector */}
            <div className="sticky top-14 sm:static z-10 mt-3 sm:mt-4 rounded-2xl border bg-white/70 backdrop-blur p-3">
                <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                        <label className="text-[11px] sm:text-xs text-gray-700">Salida</label>
                        <select
                            value={depId}
                            onChange={(e) => setDepId(e.target.value)}
                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                        >
                            <option value="">(Seleccionar)</option>
                            {loadingDeps ? (
                                <option value="" disabled>Cargando…</option>
                            ) : (
                                depOptions.map((o) => (
                                    <option key={String(o.id)} value={o.id}>{o.label}</option>
                                ))
                            )}
                        </select>
                        {depId && (
                            <p className="mt-1 text-[10px] sm:text-[11px] text-gray-500 truncate" title={depLabel}>
                                {depLabel || "Salida seleccionada"}
                            </p>
                        )}
                    </div>

                    {!!depId && (
                        <button
                            onClick={() => fetchTickets()}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white"
                        >
                            <IconRefresh className="h-4 w-4" /> Refrescar
                        </button>
                    )}
                </div>
            </div>

            {/* Filtros + lote */}
            {!!depId && (
                <div className="mt-2 sm:mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <FilterButton active={filter === "ALL"} onClick={() => setFilter("ALL")} label="Todos" />
                        <FilterButton active={filter === "PENDING"} onClick={() => setFilter("PENDING")} label="Pendientes" />
                        <FilterButton active={filter === "PRESENT"} onClick={() => setFilter("PRESENT")} label="Presentes" />
                        <FilterButton active={filter === "BOARDED"} onClick={() => setFilter("BOARDED")} label="Embarcados" />
                        <FilterButton active={filter === "NO_SHOW"} onClick={() => setFilter("NO_SHOW")} label="No-show" />
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <button onClick={() => toggleAll(true)} className="rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50">
                            Seleccionar visibles
                        </button>
                        <button onClick={() => toggleAll(false)} className="rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50">
                            Limpiar selección
                        </button>
                        <span className="text-[11px] text-gray-500">{selectedIds.length} seleccionados</span>
                        <div className="hidden sm:block h-4 w-px bg-gray-200" />
                        <button
                            disabled={selectedIds.length === 0}
                            onClick={onPresentBulk}
                            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs hover:bg-black hover:text-white disabled:opacity-50"
                        >
                            Marcar presentes
                        </button>
                        <button
                            disabled={selectedIds.length === 0}
                            onClick={onBoardBulk}
                            className="inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs hover:bg-black hover:text-white disabled:opacity-50"
                        >
                            Marcar embarcados
                        </button>
                    </div>
                </div>
            )}

            {/* Tabla / Cards */}
            <div className="mt-3 sm:mt-4">
                {!depId ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">Selecciona una salida para ver sus tickets.</div>
                ) : loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando tickets…
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay tickets para mostrar.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden rounded-2xl border md:block">
                            <div
                                className="max-h-[64vh] overflow-y-auto overflow-x-auto overscroll-contain"
                                style={{ scrollbarGutter: "stable both-edges" }}
                            >
                                <table className="w-full min-w-[860px] table-fixed text-sm">
                                    <colgroup>
                                        <col className="w-8" />
                                        <col className="w-14" /> {/* Seat */}
                                        <col className="w-64" /> {/* Pasajero */}
                                        <col className="w-28" /> {/* Doc */}
                                        <col className="w-28" /> {/* Origen */}
                                        <col className="w-28" /> {/* Destino */}
                                        <col className="w-44" /> {/* Asistencia */}
                                        <col className="w-52" /> {/* Acciones */}
                                    </colgroup>
                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2">
                                            <input
                                                type="checkbox"
                                                checked={filtered.length > 0 && filtered.every((t) => selected[String(t.id)])}
                                                onChange={(e) => toggleAll(e.target.checked)}
                                            />
                                        </th>
                                        <th className="px-3 py-2">Seat</th>
                                        <th className="px-3 py-2">Pasajero</th>
                                        <th className="px-3 py-2">Documento</th>
                                        <th className="px-3 py-2">Origen</th>
                                        <th className="px-3 py-2">Destino</th>
                                        <th className="px-3 py-2">Asistencia</th>
                                        <th className="px-3 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {filtered.map((t) => {
                                        const outcome = t.attendance?.outcome || "PENDING";
                                        return (
                                            <tr key={String(t.id)} className="border-t align-top">
                                                <td className="px-3 py-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!selected[String(t.id)]}
                                                        onChange={(e) => toggleOne(t.id, e.target.checked)}
                                                    />
                                                </td>
                                                <td className="px-3 py-2">{t.seat?.number ?? "—"}</td>
                                                <td className="px-3 py-2">
                                                    <div className="truncate font-medium text-gray-900">{t.passenger.full_name}</div>
                                                </td>
                                                <td className="px-3 py-2">{t.passenger.document || "—"}</td>
                                                <td className="px-3 py-2">{t.origin?.code || "—"}</td>
                                                <td className="px-3 py-2">{t.destination?.code || "—"}</td>
                                                <td className="px-3 py-2">
                                                    <div className="flex flex-col gap-1">
                                                        <Pill tone={outcomeTone(outcome)}>{attendanceLabel(outcome)}</Pill>
                                                        <div className="text-[11px] text-gray-500">
                                                            <span className="inline-block min-w-[86px]">Check-in: {shortTime(t.attendance?.presented_at)}</span>{" "}
                                                            <span className="inline-block min-w-[86px]">Abordó: {shortTime(t.attendance?.boarded_at)}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        <ActionButton
                                                            title="Marcar presente"
                                                            disabled={outcome === "BOARDED"}
                                                            onClick={() => onPresentOne(t.id)}
                                                        >
                                                            Presente
                                                        </ActionButton>
                                                        <ActionButton
                                                            title="Marcar embarcado"
                                                            disabled={outcome === "BOARDED"}
                                                            onClick={() => onBoardOne(t.id)}
                                                        >
                                                            Embarcó
                                                        </ActionButton>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile (≤ md) */}
                        <div className="grid gap-2 md:hidden">
                            {filtered.map((t) => {
                                const outcome = t.attendance?.outcome || "PENDING";
                                return (
                                    <div key={String(t.id)} className="rounded-2xl border p-3">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!selected[String(t.id)]}
                                                        onChange={(e) => toggleOne(t.id, e.target.checked)}
                                                    />
                                                    <div className="text-sm font-medium text-gray-900 truncate">{t.passenger.full_name}</div>
                                                    <span className="text-[11px] text-gray-500">· Seat {t.seat?.number ?? "—"}</span>
                                                </div>
                                                <div className="mt-1 grid grid-cols-3 gap-x-2 gap-y-0.5 text-[11px] text-gray-600">
                                                    <div className="col-span-1">Doc</div>
                                                    <div className="col-span-2 truncate">{t.passenger.document || "—"}</div>
                                                    <div className="col-span-1">Origen</div>
                                                    <div className="col-span-2">{t.origin?.code || "—"}</div>
                                                    <div className="col-span-1">Destino</div>
                                                    <div className="col-span-2">{t.destination?.code || "—"}</div>
                                                </div>
                                            </div>
                                            <Pill tone={outcomeTone(outcome)}>{attendanceLabel(outcome)}</Pill>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-[11px] text-gray-500">
                                            <span>Check-in: {shortTime(t.attendance?.presented_at)}</span>
                                            <span>Abordó: {shortTime(t.attendance?.boarded_at)}</span>
                                        </div>

                                        <div className="mt-3 flex justify-end gap-2">
                                            <ActionButton
                                                small
                                                disabled={outcome === "BOARDED"}
                                                onClick={() => onPresentOne(t.id)}
                                            >
                                                Presente
                                            </ActionButton>
                                            <ActionButton
                                                small
                                                disabled={outcome === "BOARDED"}
                                                onClick={() => onBoardOne(t.id)}
                                            >
                                                Embarcó
                                            </ActionButton>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Nota */}
            {depId && (
                <div className="mt-3 text-[11px] sm:text-xs text-gray-600">
                    La salida seleccionada es: <b className="truncate">{depLabel || "—"}</b>
                </div>
            )}
        </div>
    );
}

function ActionButton({
                          children,
                          onClick,
                          disabled,
                          title,
                          small,
                      }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    title?: string;
    small?: boolean;
}) {
    return (
        <button
            title={title}
            disabled={disabled}
            onClick={onClick}
            className={`rounded-xl border transition hover:bg-gray-50 disabled:opacity-50 ${
                small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-xs"
            }`}
        >
            {children}
        </button>
    );
}

function IconBoarding(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M3 21h18M6 18V6a3 3 0 0 1 3-3h3" />
            <path strokeWidth="1.5" d="M9 7h5a2 2 0 0 1 2 2v9" />
            <path strokeWidth="1.5" d="M12 3v4m-6 11h12" />
        </svg>
    );
}
function IconRefresh(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M20 12a8 8 0 1 1-2.34-5.66M20 4v6h-6" />
        </svg>
    );
}
function FilterButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
    return (
        <button
            onClick={onClick}
            className={`rounded-full px-3 py-1.5 text-[11px] sm:text-xs border ${
                active ? "bg-black text-white border-black" : "hover:bg-gray-50"
            }`}
        >
            {label}
        </button>
    );
}
