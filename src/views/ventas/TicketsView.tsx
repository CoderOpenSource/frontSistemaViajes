// src/views/ventas/TicketsView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import BusSeatPicker from "../../components/bus/BusSeatPicker";

import {
    listTickets,
    getTicket,
    createTicket,
    updateTicket,
    deleteTicket,
    payTicket,
    cancelTicket,
    markNoShow,
    listOccupiedSeatIds,
    type ListTicketsParams,
    type TicketRead,
    type TicketStatus,
} from "../../services/tickets";
import {
    listUpcomingDeparturesLite,
    getDeparture,
    type Departure,
    type Id as DepartureId,
    statusLabel as depStatusLabel,
} from "../../services/departures";
import { listBusSeats, type SeatSummary } from "../../services/buses";
import { searchPassengers, type Passenger } from "../../services/passengers";
import { api } from "../../services/api";

/* -------------------------------- UI -------------------------------- */

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

/* ----------------------------- tipos locales ----------------------------- */

type Id = string | number;
type OfficeLite = { id: Id; code: string; name: string };

type FormTicket = {
    id?: string;

    // selección
    departureId: Id | "";
    routeId?: Id | null;
    busId?: Id | null;

    // tramo (oculto, se completa automáticamente con los extremos de la ruta)
    originId: Id | null;
    destinationId: Id | null;

    // asiento
    seatId: Id | null;
    seats: SeatSummary[];
    occupied: Array<Id>;

    // oficina
    officeSoldId: Id | "";

    // pasajero (solo existente)
    passengerId: string | "";

    // precio/estado
    price: string;
    status: TicketStatus; // RESERVED | PAID
};

/* ----------------------------- fetchers auxiliares ----------------------------- */

async function fetchOfficesLite(): Promise<OfficeLite[]> {
    const data = await api.get<any>(`/catalog/offices/?page_size=500`);
    const arr = Array.isArray(data) ? data : data?.results ?? [];
    return arr.map((o: any) => ({ id: o.id, code: o.code, name: o.name }));
}

// lee extremos de la ruta (origen/destino)
async function fetchRouteEnds(routeId: Id): Promise<{ originId: Id; destinationId: Id }> {
    const route = await api.get<any>(`/catalog/routes/${routeId}/`);
    // asumiendo serializer con origin/destination como objetos {id, code, name}
    return { originId: route.origin.id, destinationId: route.destination.id };
}

/* =============================== VISTA PRINCIPAL =============================== */

export default function TicketsView() {
    /* --------- filtros / listado --------- */
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);

    const [statusFilter, setStatusFilter] = useState<"" | TicketStatus>("");
    const [departureFilter, setDepartureFilter] = useState<Id | "">("");
    const [departuresLite, setDeparturesLite] = useState<{ id: Id; label: string; status: string }[]>([]);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<TicketRead[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const reqSeqRef = useRef(0);

    /* --------- modales --------- */
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormTicket | null>(null);
    const [saving, setSaving] = useState(false);

    const [viewing, setViewing] = useState<TicketRead | null>(null);

    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    /* --------- carga inicial de combos --------- */
    useEffect(() => {
        (async () => {
            try {
                const deps = await listUpcomingDeparturesLite(150);
                setDeparturesLite(deps);
            } catch (e: any) {
                toast.error(e?.message || "No se pudieron cargar salidas.");
            }
        })();
    }, []);

    /* --------- listar con filtros --------- */
    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const params: ListTicketsParams = {
                page,
                pageSize,
                ordering: "-created_at",
            };
            if (qDebounced) params.search = qDebounced;
            if (statusFilter) params.status = statusFilter;
            if (departureFilter) params.departure = departureFilter;

            const { items, total } = await listTickets(params);
            if (reqSeqRef.current !== mySeq) return;
            setItems(items ?? []);
            setTotal(Number(total ?? 0));
            setError(null);
        } catch (e: any) {
            if (reqSeqRef.current !== mySeq) return;
            const msg = e?.message || "Error cargando ventas";
            setError(msg);
            toast.error(msg);
        } finally {
            if (reqSeqRef.current === mySeq) setLoading(false);
        }
    }, [qDebounced, statusFilter, departureFilter, page, pageSize]);

    useEffect(() => {
        setPage(1);
    }, [qDebounced, statusFilter, departureFilter]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    /* =================== Crear / Editar =================== */

    const openCreate = async () => {
        setEditing({
            departureId: "",
            routeId: null,
            busId: null,
            originId: null,
            destinationId: null,
            seatId: null,
            seats: [],
            occupied: [],
            officeSoldId: "",
            passengerId: "",
            price: "",
            status: "RESERVED",
        });
        setShowForm(true);
    };

    const openEdit = async (t: TicketRead) => {
        try {
            const full = await getTicket(t.id);
            const dep = await getDeparture(full.departure.id, { embedCrew: false });
            const seats = dep?.bus ? await listBusSeats(dep.bus) : [];
            const occ = await listOccupiedSeatIds(full.departure.id);

            setEditing({
                id: full.id,
                departureId: full.departure.id,
                routeId: (dep as any)?.route ?? null,
                busId: (dep as any)?.bus ?? null,
                originId: full.origin.id,
                destinationId: full.destination.id,
                seatId: full.seat.id,
                seats,
                occupied: occ,
                officeSoldId: full.office_sold.id,
                passengerId: full.passenger.id,
                price: full.price,
                status: full.status,
            });
            setShowForm(true);
        } catch (e: any) {
            toast.error(e?.message || "No se pudo abrir la edición.");
        }
    };

    /* ---- combos dinámicos dentro del modal ---- */
    const [offices, setOffices] = useState<OfficeLite[]>([]);
    const [paxQuery, setPaxQuery] = useState("");
    const [paxOptions, setPaxOptions] = useState<Passenger[]>([]);
    const paxDebounced = useDebouncedValue(paxQuery, 350);

    // cargar oficinas una vez que abre el form
    useEffect(() => {
        if (!showForm) return;
        (async () => {
            try {
                const ofs = await fetchOfficesLite();
                setOffices(ofs);
            } catch (e: any) {
                toast.error(e?.message || "No se pudieron cargar oficinas.");
            }
        })();
    }, [showForm]);

    // cuando elige una departure -> autocompletar extremos de ruta, seats y ocupados
    const onChangeDeparture = async (depId: Id | "") => {
        if (!editing) return;
        if (!depId) {
            setEditing({
                ...editing,
                departureId: "",
                routeId: null,
                busId: null,
                seats: [],
                occupied: [],
                seatId: null,
                originId: null,
                destinationId: null,
            });
            return;
        }
        try {
            const dep = await getDeparture(depId as DepartureId, { embedCrew: false });
            const seats = await listBusSeats((dep as any).bus);
            const occ = await listOccupiedSeatIds(depId);
            const { originId, destinationId } = await fetchRouteEnds((dep as any).route);

            setEditing({
                ...editing,
                departureId: depId,
                routeId: (dep as any).route,
                busId: (dep as any).bus,
                seats,
                occupied: occ,
                originId,
                destinationId,
                // reset selección dependiente
                seatId: null,
            });
        } catch (e: any) {
            toast.error(e?.message || "No se pudo cargar info de la salida.");
        }
    };

    /* ---- búsqueda de pasajeros (solo existentes) ---- */
    useEffect(() => {
        (async () => {
            if (!showForm) return;
            if (!paxDebounced) {
                setPaxOptions([]);
                return;
            }
            try {
                const found = await searchPassengers(paxDebounced, 10);
                setPaxOptions(found);
            } catch {
                // silencioso
            }
        })();
    }, [paxDebounced, showForm]);

    /* ---- Guardar ---- */
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        // validaciones mínimas
        if (!editing.departureId) return toast.error("Selecciona una salida.");
        if (!editing.originId || !editing.destinationId)
            return toast.error("No se pudieron resolver origen/destino de la ruta.");
        if (!editing.seatId) return toast.error("Selecciona un asiento.");
        if (!editing.officeSoldId) return toast.error("Selecciona la oficina de venta.");
        if (!editing.passengerId) return toast.error("Selecciona un pasajero.");
        if (!editing.price || Number(editing.price) <= 0) return toast.error("Ingresa un precio válido.");

        setSaving(true);
        try {
            const payload = {
                passenger: editing.passengerId,
                departure: editing.departureId,
                seat: editing.seatId,
                origin: editing.originId,
                destination: editing.destinationId,
                office_sold: editing.officeSoldId,
                price: Number(editing.price),
                status: editing.status || "RESERVED",
            } as const;

            if (editing.id) {
                const p = updateTicket(editing.id, payload, { partial: true });
                toast.promise(p, { loading: "Actualizando venta…", success: "Venta actualizada", error: (err) => err?.message || "Error al actualizar" });
                const updated = await p;
                replaceItem(updated);
            } else {
                const p = createTicket(payload as any);
                toast.promise(p, { loading: "Creando venta…", success: "Venta creada", error: (err) => err?.message || "Error al crear" });
                const created = await p;
                addItem(created);
                setTotal((t) => t + 1);
            }

            setShowForm(false);
            await fetchList();
        } finally {
            setSaving(false);
        }
    };

    /* ---- helpers lista optimista ---- */
    const replaceItem = useCallback((updated: TicketRead) => {
        setItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    }, []);
    const addItem = useCallback((created: TicketRead) => {
        setItems((prev) => [created, ...prev]);
    }, []);
    const removeItem = useCallback((id: string) => {
        setItems((prev) => prev.filter((o) => o.id !== id));
    }, []);

    /* ---- acciones: pagar / cancelar / no_show ---- */
    const doPay = async (id: string) => {
        try {
            const p = payTicket(id);
            toast.promise(p, { loading: "Registrando pago…", success: "Ticket pagado", error: (err) => err?.message || "No se pudo pagar" });
            const t = await p;
            replaceItem(t);
        } catch {}
    };
    const doCancel = async (id: string) => {
        try {
            const p = cancelTicket(id);
            toast.promise(p, { loading: "Anulando…", success: "Ticket anulado", error: (err) => err?.message || "No se pudo anular" });
            const t = await p;
            replaceItem(t);
        } catch {}
    };
    const doNoShow = async (id: string) => {
        try {
            const p = markNoShow(id);
            toast.promise(p, { loading: "Marcando no presentado…", success: "Marcado como No Show", error: (err) => err?.message || "No se pudo marcar" });
            const t = await p;
            replaceItem(t);
        } catch {}
    };

    const onDelete = async () => {
        if (!confirmId) return;
        const id = confirmId;
        setDeleting(true);
        try {
            const p = deleteTicket(id);
            toast.promise(p, { loading: "Eliminando…", success: "Venta eliminada", error: (err) => err?.message || "Error al eliminar" });
            await p;
            removeItem(id);
            setTotal((t) => Math.max(0, t - 1));
            setConfirmId(null);
            await fetchList();
        } finally {
            setDeleting(false);
        }
    };

    /* --------------------------------- RENDER --------------------------------- */

    return (
        <div className="mt-6">
            {/* Toolbar de filtros */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
                            placeholder="Buscar por pasajero/documento…"
                            className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value as TicketStatus | "")}
                        className="rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    >
                        <option value="">Todos</option>
                        <option value="RESERVED">Reservado</option>
                        <option value="PAID">Pagado</option>
                        <option value="CANCELLED">Anulado</option>
                        <option value="NO_SHOW">No se presentó</option>
                    </select>

                    <select
                        value={departureFilter}
                        onChange={(e) => setDepartureFilter(e.target.value as Id | "")}
                        className="rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 w-full sm:w-[22rem]"
                    >
                        <option value="">Todas las salidas</option>
                        {departuresLite.map((d) => (
                            <option key={String(d.id)} value={String(d.id)}>
                                {d.label} {d.status ? `· ${depStatusLabel(d.status as any)}` : ""}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Badge>
            <span className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="4" y="3" width="16" height="13" rx="2" strokeWidth="1.5" />
                <path d="M6 16v2M18 16v2M4 11h16" strokeWidth="1.5" />
              </svg>
                {total} ventas
            </span>
                    </Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nueva venta
                    </button>
                </div>
            </div>

            {/* Tabla / Cards */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando ventas…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay ventas.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden rounded-2xl border md:block">
                            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto overscroll-contain" style={{ scrollbarGutter: "stable both-edges" }}>
                                <table className="w-full text-sm table-fixed min-w-[1100px]">
                                    <colgroup>
                                        <col className="w-[12rem]" />
                                        <col className="w-[10rem]" />
                                        <col className="w-[12rem]" />
                                        <col className="w-[8rem]" />
                                        <col className="w-[8rem]" />
                                        <col className="w-[7rem]" />
                                        <col className="w-[7rem]" />
                                        <col className="w-[10rem]" />
                                    </colgroup>
                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2">Pasajero</th>
                                        <th className="px-3 py-2">Doc</th>
                                        <th className="px-3 py-2">Salida (ruta/bus)</th>
                                        <th className="px-3 py-2">Tramo</th>
                                        <th className="px-3 py-2">Asiento</th>
                                        <th className="px-3 py-2">Precio</th>
                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.map((t) => (
                                        <tr key={t.id} className="border-t align-top">
                                            <td className="px-3 py-2">
                                                <div className="font-medium text-gray-900">{t.passenger.full_name ?? "—"}</div>
                                            </td>
                                            <td className="px-3 py-2">{t.passenger.document ?? "—"}</td>
                                            <td className="px-3 py-2">
                                                <div className="truncate" title={`${t.departure.route ?? ""} · ${t.departure.bus ?? ""}`}>
                                                    {t.departure.route ?? "—"} · {t.departure.bus ?? "—"}
                                                </div>
                                            </td>
                                            <td className="px-3 py-2">
                                                {t.origin.code} → {t.destination.code}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">
                                                {t.seat.number}
                                                {t.seat.floor ? ` (${t.seat.floor}º)` : ""}
                                            </td>
                                            <td className="px-3 py-2 whitespace-nowrap">Bs {Number(t.price).toFixed(2)}</td>
                                            <td className="px-3 py-2">
                                                {t.status === "PAID" && <Badge variant="success">Pagado</Badge>}
                                                {t.status === "RESERVED" && <Badge variant="warning">Reservado</Badge>}
                                                {t.status === "CANCELLED" && <Badge variant="danger">Anulado</Badge>}
                                                {t.status === "NO_SHOW" && <Badge variant="muted">No se presentó</Badge>}
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button title="Ver" className="rounded p-1 hover:bg-gray-100" onClick={() => setViewing(t)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                                        </svg>
                                                    </button>
                                                    <button title="Editar" className="rounded p-1 hover:bg-gray-100" onClick={() => openEdit(t)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                                        </svg>
                                                    </button>
                                                    {t.status === "RESERVED" && (
                                                        <button title="Pagar" className="rounded p-1 text-green-700 hover:bg-green-50" onClick={() => doPay(t.id)}>
                                                            $$
                                                        </button>
                                                    )}
                                                    {t.status !== "CANCELLED" && (
                                                        <button title="Anular" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => doCancel(t.id)}>
                                                            ✕
                                                        </button>
                                                    )}
                                                    {t.status !== "NO_SHOW" && (
                                                        <button title="No Show" className="rounded p-1 hover:bg-gray-100" onClick={() => doNoShow(t.id)}>
                                                            NS
                                                        </button>
                                                    )}
                                                    <button title="Eliminar" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => setConfirmId(t.id)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7" />
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

                        {/* Mobile cards */}
                        <div className="grid gap-2 md:hidden">
                            {items.map((t) => (
                                <div key={t.id} className="rounded-2xl border p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">{t.passenger.full_name ?? "Pasajero"}</div>
                                        <Badge
                                            variant={
                                                t.status === "PAID" ? "success" : t.status === "RESERVED" ? "warning" : t.status === "CANCELLED" ? "danger" : "muted"
                                            }
                                        >
                                            {t.status === "PAID" ? "Pagado" : t.status === "RESERVED" ? "Reservado" : t.status === "CANCELLED" ? "Anulado" : "No show"}
                                        </Badge>
                                    </div>
                                    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Doc</dt>
                                        <dd className="col-span-2 truncate">{t.passenger.document ?? "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Ruta/Bus</dt>
                                        <dd className="col-span-2 truncate">
                                            {t.departure.route ?? "—"} · {t.departure.bus ?? "—"}
                                        </dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Tramo</dt>
                                        <dd className="col-span-2 truncate">
                                            {t.origin.code} → {t.destination.code}
                                        </dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Asiento</dt>
                                        <dd className="col-span-2 truncate">
                                            {t.seat.number}
                                            {t.seat.floor ? ` (${t.seat.floor}º)` : ""}
                                        </dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Precio</dt>
                                        <dd className="col-span-2 truncate">Bs {Number(t.price).toFixed(2)}</dd>
                                    </dl>

                                    <div className="mt-3 flex justify-end gap-3 text-xs">
                                        <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => setViewing(t)}>
                                            Ver
                                        </button>
                                        <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => openEdit(t)}>
                                            Editar
                                        </button>
                                        {t.status === "RESERVED" && (
                                            <button className="inline-flex items-center gap-1.5 text-green-700 hover:underline" onClick={() => doPay(t.id)}>
                                                Pagar
                                            </button>
                                        )}
                                        {t.status !== "CANCELLED" && (
                                            <button className="inline-flex items-center gap-1.5 text-red-600 hover:underline" onClick={() => doCancel(t.id)}>
                                                Anular
                                            </button>
                                        )}
                                        {t.status !== "NO_SHOW" && (
                                            <button className="inline-flex items-center gap-1.5 text-gray-700 hover:underline" onClick={() => doNoShow(t.id)}>
                                                No Show
                                            </button>
                                        )}
                                        <button className="inline-flex items-center gap-1.5 text-red-600 hover:underline" onClick={() => setConfirmId(t.id)}>
                                            Eliminar
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
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        ←
                    </button>
                    <span className="text-sm text-gray-600">
            Página <b>{page}</b> / {totalPages}
          </span>
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        →
                    </button>
                </div>
            )}

            {/* Modal Crear/Editar */}
            {showForm && editing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}>
                    <div className="w-full max-w-3xl rounded-2xl bg-white shadow-lg flex max-h-[90vh]">
                        <div className="flex w-full flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b">
                                <h3 className="text-lg font-semibold">{editing.id ? "Editar venta" : "Nueva venta"}</h3>
                                <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">
                                    ✕
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-5">
                                <form id="ticketForm" className="mt-3 space-y-4" onSubmit={onSubmit}>
                                    {/* Salida */}
                                    <div>
                                        <label className="text-sm text-gray-700">Salida</label>
                                        <select
                                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                            value={editing.departureId}
                                            onChange={(e) => onChangeDeparture(e.target.value as Id | "")}
                                            required
                                        >
                                            <option value="">Selecciona salida…</option>
                                            {departuresLite.map((d) => (
                                                <option key={String(d.id)} value={String(d.id)}>
                                                    {d.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Asiento */}
                                    <div>
                                        <label className="text-sm text-gray-700">Asiento</label>
                                        <BusSeatPicker
                                            seats={editing.seats}
                                            occupied={editing.occupied}
                                            selected={editing.seatId}
                                            onSelect={(id) => setEditing((s) => (s ? { ...s, seatId: id } : s))}
                                            // aisleAfterCol={2} // opcional: si no lo pones, se autodetecta
                                        />
                                    </div>


                                    {/* Oficina y Precio */}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm text-gray-700">Oficina de venta</label>
                                            <select
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.officeSoldId}
                                                onChange={(e) => setEditing((s) => (s ? { ...s, officeSoldId: e.target.value as Id } : s))}
                                                required
                                            >
                                                <option value="">Selecciona oficina…</option>
                                                {offices.map((o) => (
                                                    <option key={String(o.id)} value={String(o.id)}>
                                                        {o.code} · {o.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-700">Precio (Bs)</label>
                                            <input
                                                type="number"
                                                min={0}
                                                step="0.01"
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.price}
                                                onChange={(e) => setEditing((s) => (s ? { ...s, price: e.target.value } : s))}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* Pasajero (SOLO existente) */}
                                    <div className="rounded-2xl border p-3">
                                        <div className="mb-2 text-sm font-medium text-gray-800">Pasajero</div>
                                        <div className="relative">
                                            <input
                                                value={paxQuery}
                                                onChange={(e) => setPaxQuery(e.target.value)}
                                                placeholder="Buscar por CI / nombres…"
                                                className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                            />
                                            {!!paxOptions.length && (
                                                <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow">
                                                    {paxOptions.map((p) => (
                                                        <button
                                                            key={p.id}
                                                            type="button"
                                                            className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                                            onClick={() => {
                                                                setEditing((s) => (s ? { ...s, passengerId: p.id } : s));
                                                                setPaxQuery(`${p.nombres} ${p.apellidos ?? ""} (${p.nro_doc})`.trim());
                                                                setPaxOptions([]);
                                                            }}
                                                        >
                                                            {p.nombres} {p.apellidos ?? ""} · {p.tipo_doc} {p.nro_doc}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">{editing.passengerId ? "Pasajero seleccionado." : "Selecciona un pasajero."}</p>
                                    </div>

                                    {/* Estado inicial */}
                                    <div>
                                        <label className="text-sm text-gray-700">Estado</label>
                                        <select
                                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                            value={editing.status}
                                            onChange={(e) => setEditing((s) => (s ? { ...s, status: e.target.value as TicketStatus } : s))}
                                        >
                                            <option value="RESERVED">Reservado</option>
                                            <option value="PAID">Pagado</option>
                                        </select>
                                    </div>
                                </form>
                            </div>

                            {/* Footer */}
                            <div className="border-t px-5 py-3 flex justify-end gap-2 bg-white">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>
                                    Cancelar
                                </button>
                                <button
                                    form="ticketForm"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50"
                                >
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal VER */}
            {viewing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setViewing(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Detalle de venta</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setViewing(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>

                        <div className="mt-3 space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Pasajero" value={viewing.passenger.full_name ?? "—"} />
                                <Field label="Documento" value={viewing.passenger.document ?? "—"} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Ruta" value={viewing.departure.route ?? "—"} />
                                <Field label="Bus" value={viewing.departure.bus ?? "—"} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Tramo" value={`${viewing.origin.code} → ${viewing.destination.code}`} />
                                <Field label="Asiento" value={`${viewing.seat.number}${viewing.seat.floor ? ` (${viewing.seat.floor}º)` : ""}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Oficina" value={`${viewing.office_sold.code} · ${viewing.office_sold.name}`} />
                                <Field label="Precio" value={`Bs ${Number(viewing.price).toFixed(2)}`} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field
                                    label="Estado"
                                    value={
                                        viewing.status === "PAID" ? (
                                            <Badge variant="success">Pagado</Badge>
                                        ) : viewing.status === "RESERVED" ? (
                                            <Badge variant="warning">Reservado</Badge>
                                        ) : viewing.status === "CANCELLED" ? (
                                            <Badge variant="danger">Anulado</Badge>
                                        ) : (
                                            <Badge variant="muted">No show</Badge>
                                        )
                                    }
                                />
                                <Field label="Creado" value={new Date(viewing.created_at).toLocaleString()} />
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setViewing(null)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmación eliminar */}
            {confirmId !== null && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Eliminar venta</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">¿Seguro que deseas eliminar esta venta? Esta acción no se puede deshacer.</p>
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
        </div>
    );

    /* -------------------------- subcomponentes -------------------------- */

    function Field({ label, value }: { label: string; value: React.ReactNode }) {
        return (
            <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
                <div className="mt-0.5 text-gray-800">{value}</div>
            </div>
        );
    }

}
