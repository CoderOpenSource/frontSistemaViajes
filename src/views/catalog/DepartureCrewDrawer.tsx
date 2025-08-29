import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
    getDepartureCrew,
    assignCrewToDeparture,
    unassignCrewFromDeparture,
    type AssignCrewBody,
} from "../../services/departures";
import { listCrew, type CrewMember, type CrewRole } from "../../services/crew";

type Props = {
    open: boolean;
    onClose: () => void;
    departureId: number | string;
    // opcional: info para el encabezado
    title?: string; // ej: "LPZ → SCZ — 28/08/2025 12:00"
};

/** Slots que manejaremos por rol */
const DRIVER_SLOTS = [1, 2] as const;
const ASSISTANT_SLOTS = [1, 2] as const;

export default function DepartureCrewDrawer({ open, onClose, departureId, title }: Props) {
    // === estado remoto ===
    const [loading, setLoading] = useState(false);
    const [drivers, setDrivers] = useState<CrewMember[]>([]);
    const [assistants, setAssistants] = useState<CrewMember[]>([]);

    // === búsqueda de candidatos ===
    const [q, setQ] = useState("");
    const [roleTab, setRoleTab] = useState<CrewRole>("DRIVER");
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [candidates, setCandidates] = useState<CrewMember[]>([]);

    // ====== helpers ======
    const hasSlot = (role: CrewRole, slot: 1 | 2) =>
        (role === "DRIVER" ? drivers : assistants).some((c: any) => (c as any)._slot === slot);

    const occupant = (role: CrewRole, slot: 1 | 2): CrewMember | undefined =>
        (role === "DRIVER" ? drivers : assistants).find((c: any) => (c as any)._slot === slot);

    // ====== efectos ======
    useEffect(() => {
        if (!open) return;
        void refreshCrew();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, departureId]);

    // buscar candidatos cada que cambia tab o query
    useEffect(() => {
        if (!open) return;
        void searchCandidates();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleTab, q, open]);

    // ====== api ======
    async function refreshCrew() {
        try {
            setLoading(true);
            const data = await getDepartureCrew(departureId);
            // el endpoint devuelve { drivers: CrewMember[], assistants: CrewMember[] }
            // ↳ nosotros admitimos meta local _slot si lo contiene; si no, asumimos 1..N
            const withSlots = (arr: any[]) =>
                arr.map((c, i) => ({ ...c, _slot: (c._slot as 1 | 2) ?? ((i + 1) as 1 | 2) }));
            setDrivers(withSlots(data.drivers || []));
            setAssistants(withSlots(data.assistants || []));
        } catch (e: any) {
            toast.error(e?.message || "No se pudo cargar tripulación");
        } finally {
            setLoading(false);
        }
    }

    async function searchCandidates() {
        try {
            setLoadingSearch(true);
            const { items } = await listCrew({
                role: roleTab,
                q,
                page: 1,
                pageSize: 20,
                active: true,
                ordering: "code",
            });
            setCandidates(items);
        } catch (e: any) {
            toast.error(e?.message || "Error buscando candidatos");
        } finally {
            setLoadingSearch(false);
        }
    }

    async function assign(role: CrewRole, slot: 1 | 2, crew_member: CrewMember["id"]) {
        const body: AssignCrewBody = { crew_member, role, slot };
        const p = assignCrewToDeparture(departureId, body);
        toast.promise(p, {
            loading: "Asignando…",
            success: "Asignado",
            error: (err) => err?.message || "No se pudo asignar",
        });
        await p;
        await refreshCrew();
    }

    async function unassign(role: CrewRole, slot: 1 | 2) {
        const occ = occupant(role, slot);
        if (!occ) return;
        const p = unassignCrewFromDeparture(departureId, { crew_member: occ.id, role, slot });
        toast.promise(p, {
            loading: "Quitando…",
            success: "Quitado",
            error: (err) => err?.message || "No se pudo quitar",
        });
        await p;
        await refreshCrew();
    }

    // ====== render ======
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-end bg-black/30">
            <div className="h-full w-full max-w-xl overflow-hidden rounded-l-2xl bg-white shadow-xl">
                {/* header */}
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <div>
                        <h3 className="text-lg font-semibold">Asignar tripulación</h3>
                        {title && <p className="text-xs text-gray-600">{title}</p>}
                    </div>
                    <button
                        className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                        onClick={onClose}
                        aria-label="Cerrar"
                    >
                        ✕
                    </button>
                </div>

                {/* contenido */}
                <div className="grid grid-rows-[auto_auto_1fr] gap-3 p-4">
                    {/* slots actuales */}
                    <section aria-label="Slots actuales" className="space-y-3">
                        <RoleSlots
                            role="DRIVER"
                            title="Choferes"
                            slots={DRIVER_SLOTS}
                            occupants={drivers}
                            onUnassign={(slot) => void unassign("DRIVER", slot)}
                        />
                        <RoleSlots
                            role="ASSISTANT"
                            title="Ayudantes"
                            slots={ASSISTANT_SLOTS}
                            occupants={assistants}
                            onUnassign={(slot) => void unassign("ASSISTANT", slot)}
                        />
                    </section>

                    {/* pestañas de búsqueda */}
                    <div className="flex items-center justify-between">
                        <div className="inline-flex rounded-lg border p-0.5">
                            <TabButton active={roleTab === "DRIVER"} onClick={() => setRoleTab("DRIVER")}>
                                Chofer
                            </TabButton>
                            <TabButton active={roleTab === "ASSISTANT"} onClick={() => setRoleTab("ASSISTANT")}>
                                Ayudante
                            </TabButton>
                        </div>

                        <div className="relative w-60">
                            <input
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                placeholder="Buscar por código/nombre…"
                                className="w-full rounded-xl border px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-black/10"
                            />
                        </div>
                    </div>

                    {/* lista de candidatos */}
                    <section className="min-h-0 overflow-y-auto rounded-xl border">
                        {loading || loadingSearch ? (
                            <div className="p-4 text-sm text-gray-500">Cargando…</div>
                        ) : candidates.length === 0 ? (
                            <div className="p-4 text-sm text-gray-500">Sin resultados.</div>
                        ) : (
                            <ul className="divide-y">
                                {candidates.map((c) => {
                                    const freeSlots =
                                        roleTab === "DRIVER" ? DRIVER_SLOTS : ASSISTANT_SLOTS;
                                    return (
                                        <li key={c.id} className="flex items-center gap-3 p-3">
                                            <div className="flex-1">
                                                <div className="font-medium">{c.code} — {c.first_name} {c.last_name}</div>
                                                <div className="text-xs text-gray-500">{c.phone || "sin teléfono"}</div>
                                            </div>
                                            {/* botones de asignar por slot */}
                                            <div className="flex items-center gap-2">
                                                {freeSlots.map((slot) => (
                                                    <button
                                                        key={slot}
                                                        className="rounded-lg border px-3 py-1 text-xs hover:bg-black hover:text-white disabled:opacity-50"
                                                        onClick={() => assign(roleTab, slot, c.id)}
                                                        disabled={hasSlot(roleTab, slot)}
                                                    >
                                                        Asignar S{slot}
                                                    </button>
                                                ))}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}

/* -------------------- subcomponentes -------------------- */

function RoleSlots({
                       role,
                       title,
                       slots,
                       occupants,
                       onUnassign,
                   }: {
    role: CrewRole;
    title: string;
    slots: ReadonlyArray<1 | 2>;
    occupants: (CrewMember & { _slot?: 1 | 2 })[];
    onUnassign: (slot: 1 | 2) => void;
}) {
    const bySlot = useMemo(() => {
        const map = new Map<number, CrewMember & { _slot?: 1 | 2 }>();
        occupants.forEach((c: any) => map.set(c._slot ?? 1, c));
        return map;
    }, [occupants]);

    return (
        <div>
            <div className="mb-1 text-sm font-medium">{title}</div>
            <div className="grid grid-cols-2 gap-2">
                {slots.map((slot) => {
                    const occ = bySlot.get(slot);
                    return (
                        <div key={slot} className="flex items-center justify-between rounded-xl border p-2">
                            <div className="min-w-0">
                                <div className="text-xs text-gray-500">Slot {slot}</div>
                                {occ ? (
                                    <div className="truncate text-sm">
                                        {occ.code} — {occ.first_name} {occ.last_name}
                                    </div>
                                ) : (
                                    <div className="text-sm text-gray-400">Vacío</div>
                                )}
                            </div>
                            {occ && (
                                <button
                                    className="rounded-lg border px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                                    onClick={() => onUnassign(slot)}
                                >
                                    Quitar
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function TabButton({
                       active,
                       children,
                       onClick,
                   }: {
    active: boolean;
    children: React.ReactNode;
    onClick: () => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className={[
                "rounded-md px-3 py-1 text-sm transition",
                active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100",
            ].join(" ")}
        >
            {children}
        </button>
    );
}
