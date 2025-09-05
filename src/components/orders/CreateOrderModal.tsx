// src/components/orders/CreateOrderModal.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createOrder, buildTicketsFlexible, isMinor } from "../../services/orders";
import { listUpcomingDeparturesLite, getDeparture, type Id as DepartureId } from "../../services/departures";
import { listBusSeats, type SeatSummary } from "../../services/buses";
import { searchPassengers, type Passenger } from "../../services/passengers";
import { api } from "../../services/api";

/* ------------------------------ types ------------------------------ */
type Id = string | number;
type Deck = 1 | 2;
type OfficeLite = { id: Id; code: string; name: string };

type Props = {
    open: boolean;
    onClose: () => void;
    onSaved?: () => void;
};

/* ------------------------------ ui bits ------------------------------ */
const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

/* ----------------------------- helpers ----------------------------- */
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

/* --------------------------- SeatGrid --------------------------- */
function SeatGrid({
                      seats,
                      occupied,
                      selected,
                      onToggle,
                      title,
                  }: {
    seats: SeatSummary[];
    occupied: Set<string>;
    selected: Set<string>;
    onToggle: (seat: SeatSummary) => void;
    title?: string;
}) {
    const rows = useMemo(() => groupByRow(seats), [seats]);
    return (
        <div className="w-full">
            {title && <div className="mb-2 text-xs font-medium text-gray-700">{title}</div>}
            <div className="overflow-x-auto">
                <div className="inline-block min-w-[20rem]">
                    <div className="flex flex-col gap-1">
                        {rows.map(([rowNumber, cols]) => (
                            <div key={`r-${rowNumber}`} className="flex items-center gap-1">
                                <div className="w-6 shrink-0 text-[10px] text-gray-500 text-right">{rowNumber}</div>
                                <div className="flex gap-1">
                                    {cols.map((s) => {
                                        const idStr = String(s.id);
                                        const isOccupied = occupied.has(idStr) || !s.active;
                                        const isSelected = selected.has(idStr);
                                        return (
                                            <div key={idStr} className="flex items-center gap-1">
                                                {isOccupied ? (
                                                    <button disabled className="h-8 w-8 sm:h-9 sm:w-9 rounded-md bg-gray-200 text-gray-400">
                                                        {s.number}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => onToggle(s)}
                                                        className={[
                                                            "h-8 w-8 sm:h-9 sm:w-9 rounded-md text-[11px] sm:text-xs font-medium",
                                                            "flex items-center justify-center select-none",
                                                            isSelected ? "bg-black text-white" : "bg-white text-gray-800 border hover:bg-gray-50",
                                                        ].join(" ")}
                                                    >
                                                        {s.number}
                                                    </button>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}
                        {rows.length === 0 && (
                            <div className="rounded-xl border border-dashed p-4 text-sm text-gray-600">No hay asientos para este piso.</div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ---------------------- Bloque UI: datos menor ---------------------- */
function MinorFields({
                         value,
                         onChange,
                         guardianQuery,
                         setGuardianQuery,
                         guardianOptions,
                         setGuardianOptions,
                     }: {
    value: { guardian?: Passenger | null; guardian_relation?: string; defensoria_form_number?: string };
    onChange: (v: { guardian?: Passenger | null; guardian_relation?: string; defensoria_form_number?: string }) => void;
    guardianQuery: string;
    setGuardianQuery: (v: string) => void;
    guardianOptions: Passenger[];
    setGuardianOptions: (opts: Passenger[]) => void;
}) {
    // buscar tutores
    useEffect(() => {
        const run = async () => {
            if (!guardianQuery?.trim()) return setGuardianOptions([]);
            try {
                const res = await searchPassengers(guardianQuery.trim(), 10);
                setGuardianOptions(res);
            } catch {
                setGuardianOptions([]);
            }
        };
        run();
    }, [guardianQuery, setGuardianOptions]);

    return (
        <section className="mt-2 rounded-xl border p-3 sm:p-4">
            <p className="text-[11px] sm:text-xs text-rose-600 font-medium">
                Requerido para menores de edad
            </p>

            <div className="mt-2 grid gap-3 sm:gap-4">
                {/* Responsable */}
                <div>
                    <label className="text-xs text-gray-700">Responsable (tutor)</label>

                    <div className="relative mt-1">
                        <input
                            className="w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                            placeholder="Buscar por CI / nombres…"
                            value={guardianQuery}
                            onChange={(e) => setGuardianQuery(e.target.value)}
                            autoComplete="off"
                            inputMode="search"
                        />

                        {!!guardianOptions.length && (
                            <div
                                className="
                absolute inset-x-0 top-full z-50 mt-1
                max-h-64 sm:max-h-80 overflow-auto overscroll-contain
                rounded-xl border bg-white shadow-lg ring-1 ring-black/5
              "
                            >
                                {guardianOptions.map((p) => (
                                    <button
                                        type="button"
                                        key={String(p.id)}
                                        className="block w-full px-3 py-3 text-left text-sm hover:bg-gray-50"
                                        onClick={() => {
                                            onChange({ ...value, guardian: p });
                                            setGuardianQuery(
                                                `${p.nombres} ${p.apellidos ?? ""} (${p.nro_doc})`.trim()
                                            );
                                            setGuardianOptions([]);
                                        }}
                                    >
                                        <div className="font-medium">
                                            {p.nombres} {p.apellidos ?? ""}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {p.tipo_doc} {p.nro_doc}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <p className="mt-1 text-[11px] text-gray-500">
                        {value.guardian ? "Responsable seleccionado." : "Selecciona el responsable del menor."}
                    </p>
                </div>

                {/* Parentesco + Nº Defensoría (stack en móvil, 2 columnas en md+) */}
                <div className="grid gap-3 sm:grid-cols-2">
                    {/* Parentesco */}
                    <div>
                        <label className="text-xs text-gray-700">Parentesco</label>
                        <select
                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                            value={value.guardian_relation ?? ""}
                            onChange={(e) => onChange({ ...value, guardian_relation: e.target.value })}
                        >
                            <option value="">(Seleccionar)</option>
                            <option value="Padre">Padre</option>
                            <option value="Madre">Madre</option>
                            <option value="Tío">Tío</option>
                            <option value="Tía">Tía</option>
                            <option value="Hermano">Hermano</option>
                            <option value="Hermana">Hermana</option>
                            <option value="Tutor legal">Tutor legal</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>

                    {/* N° Formulario Defensoría */}
                    <div>
                        <label className="text-xs text-gray-700">N° de formulario (Defensoría)</label>
                        <input
                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/10"
                            placeholder="Ej: 2025-ABC-123"
                            value={value.defensoria_form_number ?? ""}
                            onChange={(e) => onChange({ ...value, defensoria_form_number: e.target.value })}
                            inputMode="text"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
    }

    /* =============================== MODAL =============================== */
export default function CreateOrderModal({ open, onClose, onSaved }: Props) {
    // combos
    const [departuresLite, setDeparturesLite] = useState<{ id: Id; label: string; status: string }[]>([]);
    const [offices, setOffices] = useState<OfficeLite[]>([]);

    // form state
    const [saving, setSaving] = useState(false);

    const [departureId, setDepartureId] = useState<Id | "">("");
    const [departureISO, setDepartureISO] = useState<string | null>(null);

    const [routeId, setRouteId] = useState<Id | null>(null);
    const [originId, setOriginId] = useState<Id | null>(null);
    const [destinationId, setDestinationId] = useState<Id | null>(null);

    const [seats, setSeats] = useState<SeatSummary[]>([]);
    const [occupiedIds, setOccupiedIds] = useState<Id[]>([]);
    const [selectedIds, setSelectedIds] = useState<Id[]>([]);
    const [activeDeck, setActiveDeck] = useState<Deck>(1);
    const [priceEach, setPriceEach] = useState<string>("");

    // comprador
    const [buyerName, setBuyerName] = useState<string>("");
    const [buyerDoc, setBuyerDoc] = useState<string>("");

    // modo pasajeros
    const [useSamePassengerForAll, setUseSamePassengerForAll] = useState<boolean>(true);

    // pasajero global (objeto completo)
    const [passengerQuery, setPassengerQuery] = useState("");
    const [passengerOptions, setPassengerOptions] = useState<Passenger[]>([]);
    const [globalPassenger, setGlobalPassenger] = useState<Passenger | null>(null);

    // bloque menor global
    const [globalMinor, setGlobalMinor] = useState<{
        guardian?: Passenger | null;
        guardian_relation?: string;
        defensoria_form_number?: string;
    }>({});

    const [globalGuardianQuery, setGlobalGuardianQuery] = useState("");
    const [globalGuardianOptions, setGlobalGuardianOptions] = useState<Passenger[]>([]);

    // por asiento: pasajero OBJ, queries y opciones
    const [perSeatPassenger, setPerSeatPassenger] = useState<Record<string, Passenger | null>>({});
    const [perSeatQuery, setPerSeatQuery] = useState<Record<string, string>>({});
    const [perSeatOptions, setPerSeatOptions] = useState<Record<string, Passenger[]>>({});

    // por asiento: bloque menor
    const [perSeatMinor, setPerSeatMinor] = useState<
        Record<
            string,
            { guardian?: Passenger | null; guardian_relation?: string; defensoria_form_number?: string }
        >
    >({});
    const [perSeatGuardianQuery, setPerSeatGuardianQuery] = useState<Record<string, string>>({});
    const [perSeatGuardianOptions, setPerSeatGuardianOptions] = useState<Record<string, Passenger[]>>({});

    const [officeSoldId, setOfficeSoldId] = useState<Id | "">("");

    // helpers memo
    const occupiedSet = useMemo(() => new Set(occupiedIds.map(String)), [occupiedIds]);
    const selectedSet = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);
    const seatsDeck1 = useMemo(() => seats.filter((s) => (s.deck ?? 1) === 1), [seats]);
    const seatsDeck2 = useMemo(() => seats.filter((s) => (s.deck ?? 1) === 2), [seats]);

    // reset form
    const resetFormState = useCallback(() => {
        setDepartureId(""); setDepartureISO(null);
        setRouteId(null); setOriginId(null); setDestinationId(null);
        setSeats([]); setOccupiedIds([]); setSelectedIds([]); setActiveDeck(1);
        setPriceEach("");
        setBuyerName(""); setBuyerDoc("");
        setUseSamePassengerForAll(true);
        setPassengerQuery(""); setPassengerOptions([]); setGlobalPassenger(null);
        setGlobalMinor({}); setGlobalGuardianQuery(""); setGlobalGuardianOptions([]);
        setPerSeatPassenger({}); setPerSeatQuery({}); setPerSeatOptions({});
        setPerSeatMinor({}); setPerSeatGuardianQuery({}); setPerSeatGuardianOptions({});
        setOfficeSoldId("");
    }, []);

    // cargar combos al abrir
    useEffect(() => {
        if (!open) return;
        (async () => {
            try {
                const deps = await listUpcomingDeparturesLite(150);
                setDeparturesLite(deps);
                setOffices(await fetchOfficesLite());
            } catch (e: any) {
                toast.error(e?.message || "No se pudieron cargar combos.");
            }
        })();
        resetFormState();
    }, [open, resetFormState]);

    const onChangeDeparture = async (id: Id | "") => {
        setDepartureId(id);
        setSeats([]); setOccupiedIds([]); setSelectedIds([]); setActiveDeck(1);
        setRouteId(null); setOriginId(null); setDestinationId(null);
        setPerSeatPassenger({}); setPerSeatQuery({}); setPerSeatOptions({});
        setPerSeatMinor({}); setPerSeatGuardianQuery({}); setPerSeatGuardianOptions({});
        setGlobalMinor({});
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
            setDepartureISO((dep as any)?.scheduled_departure_at ?? null);
        } catch (e: any) {
            toast.error(e?.message || "No se pudo cargar la salida.");
        }
    };

    const toggleSeat = (s: SeatSummary) => {
        const idStr = String(s.id);
        if (occupiedSet.has(idStr) || !s.active) return;
        setSelectedIds((prev) => {
            const exists = prev.map(String).includes(idStr);
            if (exists) {
                // limpiar asignaciones asociadas
                const next = prev.filter((x) => String(x) !== idStr);
                setPerSeatPassenger((ps) => {
                    const c = { ...ps }; delete c[idStr]; return c;
                });
                setPerSeatQuery((ps) => { const c = { ...ps }; delete c[idStr]; return c; });
                setPerSeatOptions((ps) => { const c = { ...ps }; delete c[idStr]; return c; });
                setPerSeatMinor((ps) => { const c = { ...ps }; delete c[idStr]; return c; });
                setPerSeatGuardianQuery((ps) => { const c = { ...ps }; delete c[idStr]; return c; });
                setPerSeatGuardianOptions((ps) => { const c = { ...ps }; delete c[idStr]; return c; });
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
            } catch {
                toast.error("Error al buscar pasajeros");
            }
        })();
    }, [passengerQuery]);

    // buscar por asiento (pasajero)
    useEffect(() => {
        const run = async () => {
            const entries = Object.entries(perSeatQuery);
            await Promise.all(entries.map(async ([seatId, q]) => {
                if (!q?.trim()) { setPerSeatOptions(prev => ({ ...prev, [seatId]: [] })); return; }
                try {
                    const res = await searchPassengers(q.trim(), 10);
                    setPerSeatOptions(prev => ({ ...prev, [seatId]: res }));
                } catch { /* noop */ }
            }));
        };
        run();
    }, [perSeatQuery]);

    // buscar por asiento (tutor)
    useEffect(() => {
        const run = async () => {
            const entries = Object.entries(perSeatGuardianQuery);
            await Promise.all(entries.map(async ([seatId, q]) => {
                if (!q?.trim()) { setPerSeatGuardianOptions(prev => ({ ...prev, [seatId]: [] })); return; }
                try {
                    const res = await searchPassengers(q.trim(), 10);
                    setPerSeatGuardianOptions(prev => ({ ...prev, [seatId]: res }));
                } catch { /* noop */ }
            }));
        };
        run();
    }, [perSeatGuardianQuery]);

    // submit
    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!departureId) return toast.error("Selecciona una salida.");
        if (!officeSoldId) return toast.error("Selecciona la oficina de venta.");
        if (!buyerName.trim()) return toast.error("Ingresa el nombre del comprador.");
        if (!selectedIds.length) return toast.error("Selecciona al menos un asiento.");
        const price = Number(priceEach);
        if (!price || price <= 0) return toast.error("Ingresa un precio válido por asiento.");

        try {
            // construir perSeat para buildTicketsFlexible
            const perSeat: Record<
                string,
                { passenger: Passenger; price: number | string; minor?: { guardian: Passenger["id"]; guardian_relation: string; defensoria_form_number: string } }
            > = {};

            if (useSamePassengerForAll) {
                if (!globalPassenger) return toast.error("Selecciona el pasajero para los boletos.");
                for (const seat of selectedIds) {
                    const seatKey = String(seat);
                    const cfg: any = { passenger: globalPassenger, price };
                    if (departureISO && isMinor(globalPassenger, departureISO)) {
                        const gm = globalMinor || {};
                        if (!gm.guardian || !gm.guardian_relation?.trim() || !gm.defensoria_form_number?.trim()) {
                            return toast.error("Completa los datos de Defensoría para el menor (responsable, parentesco, N° formulario).");
                        }
                        cfg.minor = {
                            guardian: gm.guardian.id,
                            guardian_relation: gm.guardian_relation.trim(),
                            defensoria_form_number: gm.defensoria_form_number.trim(),
                        };
                    }
                    perSeat[seatKey] = cfg;
                }
            } else {
                // por asiento
                const faltantes = selectedIds.filter((seat) => !perSeatPassenger[String(seat)]);
                if (faltantes.length) {
                    return toast.error(`Asigna pasajero en todos los asientos. Faltan: ${faltantes.map(String).join(", ")}`);
                }
                for (const seat of selectedIds) {
                    const seatKey = String(seat);
                    const pax = perSeatPassenger[seatKey]!;
                    const cfg: any = { passenger: pax, price };
                    if (departureISO && isMinor(pax, departureISO)) {
                        const m = perSeatMinor[seatKey] || {};
                        if (!m.guardian || !m.guardian_relation?.trim() || !m.defensoria_form_number?.trim()) {
                            return toast.error(`Completa datos de Defensoría para el asiento ${seatKey} (responsable, parentesco, N° formulario).`);
                        }
                        cfg.minor = {
                            guardian: m.guardian.id,
                            guardian_relation: m.guardian_relation.trim(),
                            defensoria_form_number: m.defensoria_form_number.trim(),
                        };
                    }
                    perSeat[seatKey] = cfg;
                }
            }

            const tickets = buildTicketsFlexible(perSeat, departureISO);

            setSaving(true);
            await createOrder({
                buyer_name: buyerName.trim(),
                buyer_doc: buyerDoc.trim() || undefined,
                departure: departureId,
                office_sold: officeSoldId,
                tickets,
            });
            toast.success("Venta creada");
            resetFormState();
            onSaved?.();
        } catch (err: any) {
            toast.error(err?.message || "No se pudo crear la venta");
        } finally {
            setSaving(false);
        }
    };

    if (!open) return null;

    const selectedCount = selectedIds.length;
    const total = (Number(priceEach || 0) * selectedCount) || 0;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-4xl max-h-[90vh] rounded-2xl bg-white shadow-lg flex flex-col">
                {/* Header */}
                <div className="flex-none flex items-center justify-between border-b px-5 py-3">
                    <h3 className="text-lg font-semibold">Nueva venta (Orden)</h3>
                    <button
                        className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                        onClick={() => { resetFormState(); onClose(); }}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* Body */}
                <form className="flex-1 overflow-y-auto px-5 py-4 space-y-4" onSubmit={onSubmit}>
                    {/* Salida */}
                    <div>
                        <label className="text-sm text-gray-700">Salida</label>
                        <select
                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                            value={departureId}
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
                        {!!departureISO && (
                            <p className="mt-1 text-[11px] text-gray-500">
                                Fecha/hora referencia para mayoría de edad: <span className="font-medium">{departureISO}</span>
                            </p>
                        )}
                    </div>

                    {/* selector de pisos */}
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setActiveDeck(1)}
                            className={`rounded-full border px-3 py-1 text-xs ${activeDeck === 1 ? "bg-black text-white" : "hover:bg-gray-50"}`}
                        >
                            Piso 1
                        </button>
                        {seatsDeck2.length > 0 && (
                            <button
                                type="button"
                                onClick={() => setActiveDeck(2)}
                                className={`rounded-full border px-3 py-1 text-xs ${activeDeck === 2 ? "bg-black text-white" : "hover:bg-gray-50"}`}
                            >
                                Piso 2
                            </button>
                        )}
                        <div className="ml-auto text-xs text-gray-600">
                            Seleccionados: {selectedCount} / 20 · Total: <span className="font-semibold">Bs {total.toFixed(2)}</span>
                        </div>
                    </div>

                    {/* SeatGrid */}
                    {(!seatsDeck1.length && !seatsDeck2.length) ? (
                        <div className="rounded-xl border border-dashed p-4 text-sm text-gray-600">Selecciona una salida para ver los asientos.</div>
                    ) : (
                        <SeatGrid
                            seats={activeDeck === 1 ? seatsDeck1 : seatsDeck2}
                            occupied={occupiedSet}
                            selected={selectedSet}
                            onToggle={toggleSeat}
                            title={`Asientos — Piso ${activeDeck}`}
                        />
                    )}

                    {/* Comprador */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-sm text-gray-700">Comprador (nombre)</label>
                            <input
                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                value={buyerName}
                                onChange={(e) => setBuyerName(e.target.value)}
                                placeholder="Nombre y apellidos"
                                required
                            />
                        </div>
                        <div>
                            <label className="text-sm text-gray-700">Documento (opcional)</label>
                            <input
                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                value={buyerDoc}
                                onChange={(e) => setBuyerDoc(e.target.value)}
                                placeholder="CI / Pasaporte"
                            />
                        </div>
                    </div>

                    {/* Oficina + Precio */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div>
                            <label className="text-sm text-gray-700">Oficina de venta</label>
                            <select
                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                value={officeSoldId}
                                onChange={(e) => setOfficeSoldId(e.target.value as Id)}
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
                            <label className="text-sm text-gray-700">Precio por asiento (Bs)</label>
                            <input
                                type="number" min={0} step="0.01"
                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                value={priceEach}
                                onChange={(e) => setPriceEach(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    {/* ======= Pasajeros ======= */}
                    <div className="rounded-2xl border p-3">
                        <div className="flex items-center gap-2">
                            <label className="text-sm font-medium text-gray-800">Pasajeros</label>
                            <label className="ml-auto inline-flex items-center gap-2 text-xs">
                                <input
                                    type="checkbox"
                                    className="rounded border-gray-300"
                                    checked={useSamePassengerForAll}
                                    onChange={(e) => setUseSamePassengerForAll(e.target.checked)}
                                />
                                Usar el mismo pasajero para todos
                            </label>
                        </div>

                        {useSamePassengerForAll ? (
                            <>
                                {/* Selección pasajero global */}
                                <div className="relative mt-2">
                                    <input
                                        value={passengerQuery}
                                        onChange={(e) => setPassengerQuery(e.target.value)}
                                        placeholder="Buscar por CI / nombres…"
                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    />
                                    {!!passengerOptions.length && (
                                        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow max-h-60 overflow-auto">
                                            {passengerOptions.map((p) => (
                                                <button
                                                    key={String(p.id)}
                                                    type="button"
                                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                                    onClick={() => {
                                                        setGlobalPassenger(p);
                                                        setPassengerQuery(`${p.nombres} ${p.apellidos ?? ""} (${p.nro_doc})`.trim());
                                                        if (!buyerName) setBuyerName(`${p.nombres} ${p.apellidos ?? ""}`.trim());
                                                        if (!buyerDoc && p.nro_doc) setBuyerDoc(String(p.nro_doc));
                                                        setPassengerOptions([]);
                                                    }}
                                                >
                                                    {p.nombres} {p.apellidos ?? ""} · {p.tipo_doc} {p.nro_doc}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                {!!globalPassenger && departureISO && isMinor(globalPassenger, departureISO) && (
                                    <MinorFields
                                        value={globalMinor}
                                        onChange={setGlobalMinor}
                                        guardianQuery={globalGuardianQuery}
                                        setGuardianQuery={setGlobalGuardianQuery}
                                        guardianOptions={globalGuardianOptions}
                                        setGuardianOptions={setGlobalGuardianOptions}
                                    />
                                )}
                                <p className="mt-1 text-xs text-gray-500">
                                    {globalPassenger ? "Pasajero seleccionado." : "Selecciona un pasajero para emitir los boletos."}
                                </p>
                            </>
                        ) : (
                            <>
                                {/* Asignación por asiento */}
                                <div className="mt-3 grid gap-3">
                                    {selectedIds.length === 0 && (
                                        <div className="rounded-xl border border-dashed p-3 text-sm text-gray-600">
                                            Selecciona asientos para asignar pasajeros.
                                        </div>
                                    )}
                                    {selectedIds.map((seat) => {
                                        const seatKey = String(seat);
                                        const options = perSeatOptions[seatKey] ?? [];
                                        const pax = perSeatPassenger[seatKey] ?? null;
                                        const isMinorSeat = !!(pax && departureISO && isMinor(pax, departureISO));
                                        return (
                                            <div key={seatKey} className="rounded-xl border p-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="text-xs text-gray-600">Asiento <span className="font-medium">{seatKey}</span></div>
                                                    {pax && isMinorSeat && <span className="text-[11px] rounded-full bg-rose-50 text-rose-700 px-2 py-0.5">Menor</span>}
                                                </div>

                                                {/* buscador pasajero */}
                                                <div className="relative mt-2">
                                                    <input
                                                        value={perSeatQuery[seatKey] ?? ""}
                                                        onChange={(e) => setPerSeatQuery((prev) => ({ ...prev, [seatKey]: e.target.value }))}
                                                        placeholder="Buscar por CI / nombres…"
                                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                    />
                                                    {!!options.length && (
                                                        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow max-h-60 overflow-auto">
                                                            {options.map((p) => (
                                                                <button
                                                                    key={String(p.id)}
                                                                    type="button"
                                                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                                                    onClick={() => {
                                                                        setPerSeatPassenger((prev) => ({ ...prev, [seatKey]: p }));
                                                                        setPerSeatQuery((prev) => ({
                                                                            ...prev,
                                                                            [seatKey]: `${p.nombres} ${p.apellidos ?? ""} (${p.nro_doc})`.trim(),
                                                                        }));
                                                                        setPerSeatOptions((prev) => ({ ...prev, [seatKey]: [] }));
                                                                    }}
                                                                >
                                                                    {p.nombres} {p.apellidos ?? ""} · {p.tipo_doc} {p.nro_doc}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>

                                                {/* bloque menor (si aplica) */}
                                                {pax && isMinorSeat && (
                                                    <MinorFields
                                                        value={perSeatMinor[seatKey] || {}}
                                                        onChange={(v) => setPerSeatMinor((prev) => ({ ...prev, [seatKey]: v }))}
                                                        guardianQuery={perSeatGuardianQuery[seatKey] ?? ""}
                                                        setGuardianQuery={(q) => setPerSeatGuardianQuery((prev) => ({ ...prev, [seatKey]: q }))}
                                                        guardianOptions={perSeatGuardianOptions[seatKey] ?? []}
                                                        setGuardianOptions={(opts) => setPerSeatGuardianOptions((prev) => ({ ...prev, [seatKey]: opts }))}
                                                    />
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* acción rápida */}
                                <div className="mt-2 flex items-center justify-end gap-2">
                                    {!!globalPassenger && (
                                        <button
                                            type="button"
                                            className="text-xs rounded-full border px-3 py-1 hover:bg-gray-50"
                                            onClick={() => {
                                                const label = String(`${globalPassenger.nombres} ${globalPassenger.apellidos ?? ""} (${globalPassenger.nro_doc})`).trim();
                                                const mapPax: Record<string, Passenger> = {};
                                                const mapQ: Record<string, string> = {};
                                                selectedIds.forEach((seat) => {
                                                    const k = String(seat);
                                                    mapPax[k] = globalPassenger;
                                                    mapQ[k] = label;
                                                });
                                                setPerSeatPassenger(mapPax);
                                                setPerSeatQuery(mapQ);
                                            }}
                                        >
                                            Copiar pasajero global a todos
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Submit */}
                    <div className="flex justify-end gap-2 border-t pt-3">
                        <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => { resetFormState(); onClose(); }}>
                            Cancelar
                        </button>
                        <button
                            disabled={saving}
                            className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                        >
                            {saving && <Spinner />} Guardar
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
