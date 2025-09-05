import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { listOrders, createOrder, getOrder, type OrderRead } from "../../services/orders";

import { listUpcomingDeparturesLite, getDeparture, type Id as DepartureId } from "../../services/departures";
import { listBusSeats, type SeatSummary } from "../../services/buses";
import { searchPassengers, type Passenger } from "../../services/passengers";
import { api } from "../../services/api";
import CreateOrderModal from "../../components/orders/CreateOrderModal.tsx";

/* ------------------------------ types ------------------------------ */
type Id = string | number;
type OfficeLite = { id: Id; code: string; name: string };
type Deck = 1 | 2;

/* ------------------------------ ui bits ------------------------------ */
const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

/* ----------------------------- helpers ----------------------------- */
const formatBs = (v: string | number) => `Bs ${Number(v ?? 0).toFixed(2)}`;

async function fetchOfficesLite(): Promise<OfficeLite[]> {
    const data = await api.get<any>(`/catalog/offices/?page_size=500`);
    const arr = Array.isArray(data) ? data : data?.results ?? [];
    return arr.map((o: any) => ({ id: o.id, code: o.code, name: o.name }));
}

async function listOccupiedSeatIds(departureId: Id): Promise<Id[]> {
    const data = await api.get<any>(`/ventas/tickets/?departure=${departureId}&page_size=1000&_=${Date.now()}`);
    const items = Array.isArray(data) ? data : data?.results ?? [];
    const s = new Set<Id>();
    for (const t of items) s.add(t.seat.id);
    return Array.from(s);
}

async function fetchRouteEnds(routeId: Id): Promise<{ originId: Id; destinationId: Id }> {
    const route = await api.get<any>(`/catalog/routes/${routeId}/`);
    return { originId: route.origin.id, destinationId: route.destination.id };
}

/* ------------------------- seat utilities (grid) ------------------------- */
type SeatCell = {
    id: Id;
    number: number | string;
    row: number;
    col: number;
    deck: Deck;
    active: boolean;
};

function autoDetectAisle(seats: SeatSummary[]): number {
    if (!seats.length) return 2;
    const byRow: Record<number, number[]> = {};
    for (const s of seats) {
        const r = (s.row ?? 1) as number, c = (s.col ?? 1) as number;
        (byRow[r] ??= []).push(c);
    }
    const score: Record<number, number> = {};
    for (const cols of Object.values(byRow)) {
        cols.sort((a, b) => a - b);
        for (let i = 0; i < cols.length - 1; i++) {
            const left = cols[i];
            const gap = cols[i + 1] - left;
            if (gap > 1) score[left] = (score[left] ?? 0) + 1;
        }
    }
    const top = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return top ? Number(top[0]) : 2;
}

function groupByRow(seats: SeatSummary[]) {
    const rows = new Map<number, SeatSummary[]>();
    for (const s of seats) {
        const r = (s.row ?? 1) as number;
        if (!rows.has(r)) rows.set(r, []);
        rows.get(r)!.push(s);
    }
    for (const arr of rows.values()) arr.sort((a, b) => (a.col ?? 1) - (b.col ?? 1));
    return Array.from(rows.entries()).sort((a, b) => a[0] - b[0]); // [rowNumber, seats[]]
}


/* =============================== VIEW =============================== */
export default function OrdersView() {
    const [items, setItems] = useState<OrderRead[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const [departuresLite, setDeparturesLite] = useState<{ id: Id; label: string; status: string }[]>([]);
    const [offices, setOffices] = useState<OfficeLite[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);

    const [departureId, setDepartureId] = useState<Id | "">("");
    const [routeId, setRouteId] = useState<Id | null>(null);
    const [originId, setOriginId] = useState<Id | null>(null);
    const [destinationId, setDestinationId] = useState<Id | null>(null);

    const [seats, setSeats] = useState<SeatSummary[]>([]);
    const [occupiedIds, setOccupiedIds] = useState<Id[]>([]);
    const [selectedIds, setSelectedIds] = useState<Id[]>([]);
    const [activeDeck, setActiveDeck] = useState<Deck>(1);
    const [priceEach, setPriceEach] = useState<string>("");

    // 🔁 deja esto cerca de los useState:
    const resetFormState = () => {
        setDepartureId("");
        setRouteId(null);
        setOriginId(null);
        setDestinationId(null);

        setSeats([]);
        setOccupiedIds([]);
        setSelectedIds([]);
        setActiveDeck(1);

        setPriceEach("");

        // comprador
        setBuyerName("");
        setBuyerDoc("");

        // modo pasajeros
        setUseSamePassengerForAll(true);

        // pasajero global
        setPassengerQuery("");
        setPassengerOptions([]);
        setPassengerId("");

        // por asiento
        setPerSeatPassenger({});
        setPerSeatQuery({});
        setPerSeatOptions({});

        setOfficeSoldId("");
    };

    // helper fecha
    const formatDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

    // estado detalles
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [details, setDetails] = useState<OrderRead | null>(null);

    const openDetails = async (id: Id) => {
        setDetailsOpen(true);
        setDetails(null);
        setDetailsLoading(true);
        try {
            const data = await getOrder(id);
            setDetails(data);
        } catch (e: any) {
            toast.error(e?.message || "No se pudieron cargar los detalles");
            setDetailsOpen(false);
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetails = () => {
        setDetailsOpen(false);
        setDetails(null);
    };

    // comprador
    const [buyerName, setBuyerName] = useState<string>("");
    const [buyerDoc, setBuyerDoc] = useState<string>("");

    // MODO de pasajeros por asiento
    const [useSamePassengerForAll, setUseSamePassengerForAll] = useState<boolean>(true);

    // pasajero global (si useSamePassengerForAll === true)
    const [passengerQuery, setPassengerQuery] = useState("");
    const [passengerOptions, setPassengerOptions] = useState<Passenger[]>([]);
    const [passengerId, setPassengerId] = useState<Id | "">("");

    // asignación por asiento (si useSamePassengerForAll === false)
    const [perSeatPassenger, setPerSeatPassenger] = useState<Record<string, Id>>({});
    const [perSeatQuery, setPerSeatQuery] = useState<Record<string, string>>({});
    const [perSeatOptions, setPerSeatOptions] = useState<Record<string, Passenger[]>>({});

    const [officeSoldId, setOfficeSoldId] = useState<Id | "">("");

    // primer load
    useEffect(() => {
        (async () => {
            try {
                const deps = await listUpcomingDeparturesLite(150);
                setDeparturesLite(deps);
                setOffices(await fetchOfficesLite());
            } catch (e: any) {
                toast.error(e?.message || "No se pudieron cargar combos.");
            }
        })();
    }, []);

    const fetchOrders = useCallback(async () => {
        setLoading(true);
        try {
            const { items, total } = await listOrders({ ordering: "-created_at", pageSize: 50 });
            setItems(items);
            setTotal(total);
        } catch (e: any) {
            toast.error(e?.message || "Error cargando ventas");
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { fetchOrders(); }, [fetchOrders]);

    const onChangeDeparture = async (id: Id | "") => {
        setDepartureId(id);
        setSeats([]); setOccupiedIds([]); setSelectedIds([]);
        setRouteId(null); setOriginId(null); setDestinationId(null);
        setActiveDeck(1);
        // limpiar asignaciones por asiento
        setPerSeatPassenger({});
        setPerSeatQuery({});
        setPerSeatOptions({});

        if (!id) return;

        try {
            const dep = await getDeparture(id as DepartureId, { embedCrew: false });
            const theSeats = await listBusSeats((dep as any).bus);
            const occ = await listOccupiedSeatIds(id);
            const { originId, destinationId } = await fetchRouteEnds((dep as any).route);
            setSeats(theSeats);
            setOccupiedIds(occ);
            setRouteId((dep as any).route);
            setOriginId(originId);
            setDestinationId(destinationId);
        } catch (e: any) {
            toast.error(e?.message || "No se pudo cargar la salida.");
        }
    };

    const occupiedSet = useMemo(() => new Set(occupiedIds.map(String)), [occupiedIds]);
    const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

    const seatsDeck1 = useMemo(() => seats.filter(s => (s.deck ?? 1) === 1), [seats]);
    const seatsDeck2 = useMemo(() => seats.filter(s => (s.deck ?? 1) === 2), [seats]);

    const toggleSeat = (s: SeatSummary) => {
        const idStr = String(s.id);
        if (occupiedSet.has(idStr) || !s.active) return;
        setSelectedIds(prev => {
            const exists = prev.map(String).includes(idStr);
            if (exists) {
                // si se deselecciona, limpia asignación individual
                const next = prev.filter(x => String(x) !== idStr);
                setPerSeatPassenger(ps => {
                    const c = { ...ps }; delete c[idStr]; return c;
                });
                setPerSeatQuery(ps => {
                    const c = { ...ps }; delete c[idStr]; return c;
                });
                setPerSeatOptions(ps => {
                    const c = { ...ps }; delete c[idStr]; return c;
                });
                return next;
            }
            if (prev.length >= 20) { toast.warning("Máximo 20 asientos por orden."); return prev; }
            return [...prev, s.id as Id];
        });
    };

    // buscar pasajero global
    useEffect(() => {
        (async () => {
            if (!passengerQuery.trim()) { setPassengerOptions([]); return; }
            try {
                const passengers = await searchPassengers(passengerQuery.trim(), 10);
                setPassengerOptions(passengers);
            } catch (e) {
                console.error("Error buscando pasajeros:", e);
                toast.error("Error al buscar pasajeros");
            }
        })();
    }, [passengerQuery]);

    // buscar por asiento (cada query independiente)
    useEffect(() => {
        const controller = new AbortController();
        const run = async () => {
            const entries = Object.entries(perSeatQuery);
            await Promise.all(entries.map(async ([seatId, q]) => {
                if (!q?.trim()) { setPerSeatOptions(prev => ({ ...prev, [seatId]: [] })); return; }
                try {
                    const res = await searchPassengers(q.trim(), 10);
                    setPerSeatOptions(prev => ({ ...prev, [seatId]: res }));
                } catch {
                    // silenciar
                }
            }));
        };
        run();
        return () => controller.abort();
    }, [perSeatQuery]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!departureId) return toast.error("Selecciona una salida.");
        if (!officeSoldId) return toast.error("Selecciona la oficina de venta.");
        if (!buyerName.trim()) return toast.error("Ingresa el nombre del comprador.");
        if (!selectedIds.length) return toast.error("Selecciona al menos un asiento.");

        const price = Number(priceEach);
        if (!price || price <= 0) return toast.error("Ingresa un precio válido por asiento.");

        // construir tickets según modo
        let tickets: { passenger: Id; seat: Id; price: number }[] = [];

        if (useSamePassengerForAll) {
            if (!passengerId) return toast.error("Selecciona el pasajero para los boletos.");
            tickets = selectedIds.map((seat) => ({ passenger: passengerId as Id, seat, price }));
        } else {
            // validar que cada asiento tenga pasajero
            const faltantes = selectedIds.filter(seat => !perSeatPassenger[String(seat)]);
            if (faltantes.length) {
                return toast.error(`Asigna pasajero en todos los asientos. Faltan: ${faltantes.map(String).join(", ")}`);
            }
            tickets = selectedIds.map((seat) => ({
                passenger: perSeatPassenger[String(seat)],
                seat,
                price,
            }));
        }

        setSaving(true);
        try {
            await createOrder({
                buyer_name: buyerName.trim(),
                buyer_doc: buyerDoc.trim() || undefined,
                departure: departureId,
                office_sold: officeSoldId,
                tickets,
            });
            toast.success("Venta creada");
            setShowForm(false);
            resetFormState();
            await fetchOrders();
        } catch (e: any) {
            toast.error(e?.message || "No se pudo crear la venta");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="mt-6">
            {/* Toolbar compacta */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-700">{loading ? "Cargando…" : `${total} ventas`}</div>
                <button
                    onClick={() => {
                        resetFormState();
                        setShowForm(true);
                    }}
                    className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm hover:bg-black hover:text-white"
                >
                    + Nueva venta
                </button>
            </div>

            {/* listado básico (responsive) */}
            <div className="mt-4">
                {loading ? (
                    <div className="p-4 text-sm text-gray-600 flex items-center gap-2">
                        <Spinner /> Cargando…
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-4 text-sm text-gray-600">No hay ventas.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden md:block rounded-2xl border">
                            <div className="max-h-[60vh] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0 text-gray-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconReceipt className="h-4 w-4 text-gray-500"/>
                                                <span>Orden</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconUser className="h-4 w-4 text-gray-500"/>
                                                <span>Comprador</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconCalendarClock className="h-4 w-4 text-gray-500"/>
                                                <span>Salida</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconMoney className="h-4 w-4 text-gray-500"/>
                                                <span>Total</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconCheckCircle className="h-4 w-4 text-gray-500"/>
                                                <span>Pagado</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconBalance className="h-4 w-4 text-gray-500"/>
                                                <span>Saldo</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconCircle className="h-4 w-4 text-gray-500"/>
                                                <span>Estado</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <span className="sr-only">Ver</span>
                                        </th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {items.map(o => {
                                        const total = Number(o.total_amount);
                                        const paid = Number(o.paid_amount);
                                        const due = total - paid;
                                        return (
                                            <tr key={String(o.id)} className="border-t">
                                                <td className="px-3 py-2">{String(o.id).slice(0, 8)}…</td>
                                                <td className="px-3 py-2">{o.buyer_name}</td>
                                                <td className="px-3 py-2">{formatDateTime(o.departure?.scheduled_at) ?? "—"}</td>
                                                <td className="px-3 py-2">{formatBs(total)}</td>
                                                <td className="px-3 py-2">{formatBs(paid)}</td>
                                                <td className="px-3 py-2">{formatBs(due)}</td>
                                                <td className="px-3 py-2">
                                                    {o.status === "PAID" ? "Pagada" : o.status === "OPEN" ? "Abierta" : "Cancelada"}
                                                </td>
                                                <td className="px-3 py-2">
                                                    <button
                                                        onClick={() => openDetails(o.id)}
                                                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                                    >
                                                        <IconEye className="h-4 w-4 text-gray-600"/> Ver
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile cards */}
                        <div className="grid gap-2 md:hidden">
                            {items.map(o => {
                                const total = Number(o.total_amount);
                                const paid = Number(o.paid_amount);
                                const due = total - paid;
                                return (
                                    <div key={String(o.id)} className="rounded-2xl border p-3">
                                        <div className="flex items-center justify-between">
                                            <div className="text-sm font-semibold">{o.buyer_name}</div>
                                            <span className="text-xs text-gray-600">
                        {o.status === "PAID" ? "Pagada" : o.status === "OPEN" ? "Abierta" : "Cancelada"}
                      </span>
                                        </div>
                                        <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                            <dt className="text-[10px] uppercase tracking-wide text-gray-500">Orden</dt>
                                            <dd className="col-span-2 truncate">{String(o.id)}</dd>

                                            <dt className="text-[10px] uppercase tracking-wide text-gray-500">Salida</dt>
                                            <dd className="col-span-2 truncate">{formatDateTime(o.departure?.scheduled_at?? "-")}</dd>

                                            <dt className="text-[10px] uppercase tracking-wide text-gray-500">Total</dt>
                                            <dd className="col-span-2">{formatBs(total)}</dd>

                                            <dt className="text-[10px] uppercase tracking-wide text-gray-500">Pagado</dt>
                                            <dd className="col-span-2">{formatBs(paid)}</dd>

                                            <dt className="text-[10px] uppercase tracking-wide text-gray-500">Saldo</dt>
                                            <dd className="col-span-2">{formatBs(due)}</dd>
                                        </dl>
                                        <div className="mt-2 flex justify-end">
                                            <button
                                                onClick={() => openDetails(o.id)}
                                                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <IconEye className="h-4 w-4" /> Ver
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Modal crear (nuevo componente) */}
            <CreateOrderModal
                open={showForm}
                onClose={() => setShowForm(false)}
                onSaved={async () => {
                    setShowForm(false);
                    await fetchOrders();
                }}
            />

            {/* Modal de detalles (OJITO) */}
            {detailsOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/40 sm:grid sm:place-items-center p-0 sm:p-4"
                    role="dialog"
                    aria-modal="true"
                >
                    {/* contenedor: full-screen en mobile, modal centrado en >=sm */}
                    <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white shadow-lg flex flex-col rounded-none sm:rounded-2xl">
                        {/* Header — sticky para que siempre esté visible en mobile */}
                        <div className="flex items-center justify-between border-b px-4 sm:px-5 py-3 sticky top-0 bg-white z-10">
                            <h3 className="text-base sm:text-lg font-semibold">Detalle de venta</h3>
                            <button
                                onClick={closeDetails}
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body con scroll */}
                        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
                            {detailsLoading ? (
                                <div className="flex items-center gap-2 text-sm text-gray-600">
                                    <Spinner /> Cargando…
                                </div>
                            ) : !details ? (
                                <div className="text-sm text-gray-600">No se encontraron datos.</div>
                            ) : (
                                <>
                                    {/* Resumen */}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Orden</div>
                                            <div className="text-sm font-medium break-all">{String(details.id)}</div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                Creada: {formatDateTime(details.created_at)}
                                            </div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Estado</div>
                                            <div className="text-sm font-medium">
                                                {details.status === "PAID"
                                                    ? "Pagada"
                                                    : details.status === "OPEN"
                                                        ? "Abierta"
                                                        : "Cancelada"}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                Salida: {formatDateTime(details.departure?.scheduled_at)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Comprador / Oficina */}
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Comprador</div>
                                            <div className="text-sm font-medium">{details.buyer_name}</div>
                                            {!!details.buyer_doc && (
                                                <div className="text-xs text-gray-500">Doc: {details.buyer_doc}</div>
                                            )}
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Oficina / Vendedor</div>
                                            <div className="text-sm">
                                                {details.office_sold
                                                    ? `${details.office_sold.code} · ${details.office_sold.name}`
                                                    : "—"}
                                            </div>
                                            <div className="text-xs text-gray-500">{details.seller?.username ?? "—"}</div>
                                        </div>
                                    </div>

                                    {/* Totales */}
                                    <div className="mt-3 grid gap-3 sm:grid-cols-3">
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Total</div>
                                            <div className="text-sm font-semibold">{formatBs(details.total_amount)}</div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Pagado</div>
                                            <div className="text-sm font-semibold">{formatBs(details.paid_amount)}</div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Saldo</div>
                                            <div className="text-sm font-semibold">
                                                {formatBs(
                                                    (Number(details.total_amount) - Number(details.paid_amount)).toFixed(2)
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Tickets */}
                                    <div className="mt-4">
                                        <div className="mb-1 text-sm font-semibold">Boletos</div>
                                        {!details.tickets || details.tickets.length === 0 ? (
                                            <div className="rounded-xl border border-dashed p-3 text-sm text-gray-600">
                                                Sin boletos.
                                            </div>
                                        ) : (
                                            <>
                                                {/* Tabla (desktop) */}
                                                <div className="hidden md:block rounded-2xl border overflow-hidden">
                                                    <div className="max-h-[40vh] overflow-auto">
                                                        <table className="w-full text-sm">
                                                            <thead className="bg-gray-50 text-gray-700 sticky top-0">
                                                            <tr>
                                                                <th className="px-3 py-2 text-left">Ticket</th>
                                                                <th className="px-3 py-2 text-left">Pasajero</th>
                                                                <th className="px-3 py-2 text-left">Asiento</th>
                                                                <th className="px-3 py-2 text-left">Precio</th>
                                                                <th className="px-3 py-2 text-left">Estado</th>
                                                            </tr>
                                                            </thead>
                                                            <tbody>
                                                            {details.tickets.map((t) => (
                                                                <tr key={String(t.id)} className="border-t">
                                                                    <td className="px-3 py-2">{String(t.id).slice(0, 8)}…</td>
                                                                    <td className="px-3 py-2">{t.passenger.full_name}</td>
                                                                    <td className="px-3 py-2">#{t.seat.number}</td>
                                                                    <td className="px-3 py-2">{formatBs(t.price)}</td>
                                                                    <td className="px-3 py-2">
                                                                        {t.status === "PAID"
                                                                            ? "Pagado"
                                                                            : t.status === "RESERVED"
                                                                                ? "Reservado"
                                                                                : t.status === "CANCELLED"
                                                                                    ? "Anulado"
                                                                                    : "No show"}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>

                                                {/* Cards (mobile) */}
                                                <div className="md:hidden grid gap-2">
                                                    {details.tickets.map((t) => (
                                                        <div key={String(t.id)} className="rounded-xl border p-3">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="text-xs text-gray-600">
                                                                    Ticket <span className="font-medium">{String(t.id).slice(0, 8)}…</span>
                                                                </div>
                                                                <span
                                                                    className={[
                                                                        "text-[10px] px-2 py-0.5 rounded-full border",
                                                                        t.status === "PAID"
                                                                            ? "border-green-200 bg-green-50 text-green-700"
                                                                            : t.status === "RESERVED"
                                                                                ? "border-amber-200 bg-amber-50 text-amber-700"
                                                                                : t.status === "CANCELLED"
                                                                                    ? "border-red-200 bg-red-50 text-red-700"
                                                                                    : "border-gray-200 bg-gray-50 text-gray-700",
                                                                    ].join(" ")}
                                                                >
                            {t.status === "PAID"
                                ? "Pagado"
                                : t.status === "RESERVED"
                                    ? "Reservado"
                                    : t.status === "CANCELLED"
                                        ? "Anulado"
                                        : "No show"}
                          </span>
                                                            </div>
                                                            <div className="mt-2 text-sm font-medium">{t.passenger.full_name}</div>
                                                            <dl className="mt-1 grid grid-cols-2 gap-y-1 text-xs">
                                                                <dt className="text-gray-500">Asiento</dt>
                                                                <dd className="text-gray-800">#{t.seat.number}</dd>

                                                                <dt className="text-gray-500">Precio</dt>
                                                                <dd className="text-gray-800">{formatBs(t.price)}</dd>
                                                            </dl>
                                                        </div>
                                                    ))}
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        {/* Footer — sticky en mobile para tener el botón siempre a mano */}
                        <div className="flex-none border-t px-4 sm:px-5 py-3 sticky bottom-0 bg-white">
                            <div className="flex justify-end">
                                <button
                                    onClick={closeDetails}
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );


}
/* ============================= ICONOS ============================= */
function IconReceipt(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
            <path strokeWidth="1.5" d="M9 7h6M9 11h6M9 15h4" />
        </svg>
    );
}
function IconUser(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="8" r="4" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M4 20a8 8 0 0 1 16 0" />
        </svg>
    );
}
function IconCalendarClock(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M16 3v4M8 3v4M3 9h18" />
            <circle cx="12" cy="15" r="3.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" strokeLinecap="round" d="M12 14v2l1.5 1" />
        </svg>
    );
}
function IconMoney(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="2.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M3 10c2 0 3-2 3-2m12 0s1 2 3 2M3 14c2 0 3 2 3 2m12 0s1-2 3-2" />
        </svg>
    );
}
function IconCheckCircle(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M8 12l3 3 5-6" />
        </svg>
    );
}
function IconBalance(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M12 3v18M5 7h14" />
            <path strokeWidth="1.5" d="M7 7l-3 6a4 4 0 1 0 8 0L9 7M17 7l-3 6a4 4 0 1 0 8 0l-3-6" />
        </svg>
    );
}
function IconCircle(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
        </svg>
    );
}
function IconEye(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
        </svg>
    );
}
