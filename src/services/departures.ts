// services/departures.ts
import { api } from "./api";

// -----------------------------------------------------------------------------
// Tipos (según DepartureSerializer / DepartureWithCrewSerializer)
// -----------------------------------------------------------------------------
export type Id = number | string;

export type DepartureStatus =
    | "SCHEDULED"
    | "BOARDING"
    | "DEPARTED"
    | "CLOSED"
    | "CANCELLED";

export type SimpleCrewMember = {
    id: Id;
    code: string;
    first_name: string;
    last_name: string;
    full_name?: string;
    role?: "DRIVER" | "ASSISTANT";
    role_display?: string;
    phone?: string;
    photo?: string | null;
};

export type Departure = {
    id: Id;
    route: Id;
    route_name?: string;
    bus: Id;
    bus_code?: string;
    bus_plate?: string;

    // (deprecated en backend, se mantiene por compat)
    driver?: Id | null;
    driver_username?: string | null;

    scheduled_departure_at: string; // ISO
    actual_departure_at?: string | null;

    status: DepartureStatus;
    capacity_snapshot?: number | null;
    notes?: string;

    created_at?: string;
};

// Con tripulación embebida (?embed_crew=true)
export type DepartureWithCrew = Departure & {
    drivers: SimpleCrewMember[];
    assistants: SimpleCrewMember[];
};

// ----- DRF page -----
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

// -----------------------------------------------------------------------------
// Listado y filtros
// -----------------------------------------------------------------------------
export type ListDeparturesParams = {
    q?: string; // SearchFilter (route__name, bus__code/plate, driver__username, notes)
    page?: number;
    pageSize?: number;
    ordering?: string; // "-scheduled_departure_at", "status", etc.
    embedCrew?: boolean; // si true usa DepartureWithCrewSerializer

    // Filtros del ViewSet
    status?: DepartureStatus;
    route?: Id;
    bus?: Id;
    driver?: Id;
    scheduled_gte?: string; // ISO datetime o date
    scheduled_lte?: string; // ISO datetime o date
};

export type ListDeparturesResult<T extends Departure = Departure> = {
    items: T[];
    total: number;
};

const BASE = "/catalog/departures/";

// Utils
function normalizeList<T>(data: DRFPage<T> | T[]) {
    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data.results ?? [], total: Number(data.count ?? 0) };
}

function qsFromParams(params: ListDeparturesParams) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("search", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));
    if (params.ordering) qs.set("ordering", params.ordering);
    if (params.embedCrew) qs.set("embed_crew", "true");

    if (params.status) qs.set("status", params.status);
    if (params.route != null) qs.set("route", String(params.route));
    if (params.bus != null) qs.set("bus", String(params.bus));
    if (params.driver != null) qs.set("driver", String(params.driver));
    if (params.scheduled_gte) qs.set("scheduled_departure_at__gte", params.scheduled_gte);
    if (params.scheduled_lte) qs.set("scheduled_departure_at__lte", params.scheduled_lte);

    // cache-bust
    qs.set("_", String(Date.now()));
    return qs;
}

// -----------------------------------------------------------------------------
// Endpoints principales
// -----------------------------------------------------------------------------

// Listar
export async function listDepartures<T extends Departure = Departure>(
    params: ListDeparturesParams = {}
): Promise<ListDeparturesResult<T>> {
    const qs = qsFromParams(params);
    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<T> | T[]>(url);
    return normalizeList<T>(data);
}

// Obtener una
export async function getDeparture<T extends Departure = Departure>(
    id: Id,
    opts?: { embedCrew?: boolean }
) {
    const qs = new URLSearchParams();
    if (opts?.embedCrew) qs.set("embed_crew", "true");
    const suf = qs.toString() ? `?${qs.toString()}` : "";
    return api.get<T>(`${BASE}${id}/${suf}`);
}

// Crear / actualizar / borrar
export type CreateDepartureBody = {
    route: Id;
    bus: Id;
    driver?: Id | null; // legacy opcional
    scheduled_departure_at: string; // ISO
    actual_departure_at?: string | null;
    status?: DepartureStatus;
    notes?: string;
};

export type UpdateDepartureBody = Partial<CreateDepartureBody> & {
    // permitir cerrar o registrar hora real
    capacity_snapshot?: number | null;
};

export async function createDeparture(body: CreateDepartureBody) {
    return api.post<Departure>(BASE, body);
}

export async function updateDeparture(
    id: Id,
    body: UpdateDepartureBody,
    opts?: { partial?: boolean }
) {
    const method = opts?.partial ? api.patch : api.put;
    return method<Departure>(`${BASE}${id}/`, body as any);
}

export async function deleteDeparture(id: Id) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}

// -----------------------------------------------------------------------------
// Tripulación (endpoints @action del ViewSet)
// -----------------------------------------------------------------------------

// GET /catalog/departures/:id/crew/
export type DepartureCrewResponse = {
    drivers: SimpleCrewMember[];
    assistants: SimpleCrewMember[];
};

export async function getDepartureCrew(id: Id) {
    return api.get<DepartureCrewResponse>(`${BASE}${id}/crew/`);
}

// POST /catalog/departures/:id/assign/
export type AssignCrewBody = {
    crew_member: Id;
    role: "DRIVER" | "ASSISTANT";
    slot: 1 | 2;
    notes?: string;
};

export type Assignment = {
    id: Id;
    departure: Id;
    crew_member: Id;
    crew_code?: string;
    crew_name?: string;
    crew_role?: "DRIVER" | "ASSISTANT";
    role: "DRIVER" | "ASSISTANT";
    slot: 1 | 2;
    assigned_at: string;
    unassigned_at?: string | null;
    notes?: string;
    departure_info?: {
        id: Id;
        route?: string | null;
        bus?: string | null;
        scheduled?: string;
        status?: DepartureStatus;
    };
};

export async function assignCrew(departureId: Id, body: AssignCrewBody) {
    return api.post<Assignment>(`${BASE}${departureId}/assign/`, body);
}

// POST /catalog/departures/:id/unassign/
export type UnassignCrewBody =
    | { assignment_id: Id }
    | { crew_member: Id; role: "DRIVER" | "ASSISTANT"; slot?: 1 | 2 };

export async function unassignCrew(departureId: Id, body: UnassignCrewBody) {
    return api.post<{ detail: string; assignment: Assignment }>(
        `${BASE}${departureId}/unassign/`,
        body as any
    );
}

// -----------------------------------------------------------------------------
// Azúcar ergonómico (crew)
// -----------------------------------------------------------------------------

/** Alias más expresivo para asignar tripulación */
export async function assignCrewToDeparture(
    departureId: Id,
    body: AssignCrewBody
) {
    return assignCrew(departureId, body);
}

/** Alias más expresivo para desasignar tripulación */
export async function unassignCrewFromDeparture(
    departureId: Id,
    body: UnassignCrewBody
) {
    return unassignCrew(departureId, body);
}

/** Lee una departure con tripulación embebida de una */
export async function getDepartureWithCrew(id: Id) {
    return getDeparture<DepartureWithCrew>(id, { embedCrew: true });
}

// -----------------------------------------------------------------------------
// Azúcar ergonómico (cambios de estado)
// -----------------------------------------------------------------------------

export const STATUS_FLOW: Record<DepartureStatus, DepartureStatus[]> = {
    SCHEDULED: ["BOARDING", "CANCELLED"],
    BOARDING: ["DEPARTED", "CANCELLED"],
    DEPARTED: ["CLOSED"],
    CLOSED: [],
    CANCELLED: [],
};

/** Cambia el estado (valida flujo permitido en cliente) */
export async function setDepartureStatus(
    id: Id,
    current: DepartureStatus,
    next: DepartureStatus,
    extra?: Partial<UpdateDepartureBody>
) {
    const allowed = STATUS_FLOW[current] || [];
    if (!allowed.includes(next)) {
        throw new Error(`Transición inválida ${current} → ${next}`);
    }
    return updateDeparture(id, { status: next, ...extra }, { partial: true });
}

/** Marcar "Embarcando" */
export async function startBoarding(id: Id, current: DepartureStatus) {
    return setDepartureStatus(id, current, "BOARDING");
}

/** Marcar "Partió" (si no mandas hora, usa ahora) */
export async function markDeparted(
    id: Id,
    current: DepartureStatus,
    whenISO?: string
) {
    const ts = whenISO ?? new Date().toISOString();
    return setDepartureStatus(id, current, "DEPARTED", {
        actual_departure_at: ts,
    });
}

/** Marcar "Cerrada" */
export async function closeDeparture(id: Id, current: DepartureStatus) {
    return setDepartureStatus(id, current, "CLOSED");
}

/** Marcar "Cancelada" */
export async function cancelDeparture(id: Id, current: DepartureStatus) {
    return setDepartureStatus(id, current, "CANCELLED");
}

// -----------------------------------------------------------------------------
// Helpers de UI
// -----------------------------------------------------------------------------

/** Etiqueta amigable de estado */
export function statusLabel(s: DepartureStatus) {
    switch (s) {
        case "SCHEDULED":
            return "Programada";
        case "BOARDING":
            return "Embarcando";
        case "DEPARTED":
            return "Partió";
        case "CLOSED":
            return "Cerrada";
        case "CANCELLED":
            return "Cancelada";
        default:
            return s;
    }
}

/** Opciones para select de estado (label + value) */
export function statusOptions(): Array<{ value: DepartureStatus; label: string }> {
    return [
        { value: "SCHEDULED", label: "Programada" },
        { value: "BOARDING", label: "Embarcando" },
        { value: "DEPARTED", label: "Partió" },
        { value: "CLOSED", label: "Cerrada" },
        { value: "CANCELLED", label: "Cancelada" },
    ];
}

/** Título compacto para headers/modales */
export function formatDepartureTitle(
    d: Pick<Departure, "route_name" | "scheduled_departure_at" | "bus_code">
) {
    const dt = new Date(d.scheduled_departure_at).toLocaleString();
    return `${d.route_name ?? "Ruta"} — ${dt}${d.bus_code ? ` · ${d.bus_code}` : ""}`;
}

/** Sugerencias para selects (próximas N salidas) */
export async function listUpcomingDeparturesLite(limit = 100) {
    const nowIso = new Date().toISOString();
    const { items } = await listDepartures<Departure>({
        scheduled_gte: nowIso,
        ordering: "scheduled_departure_at",
        pageSize: limit,
    });
    return items.map((d) => ({
        id: d.id,
        label: `${d.route_name ?? "Ruta"} — ${new Date(
            d.scheduled_departure_at
        ).toLocaleString()} · ${d.bus_code ?? ""}`,
        status: d.status,
    }));
}
/** Convierte una fecha YYYY-MM-DD a rango ISO [00:00 local, +1 día) */
function dayRangeISO(dateISO: string) {
    // JS crea Date en local. toISOString() -> UTC (el backend suele guardar TZ-aware/UTC).
    // Para La Paz (UTC-4), esto cubre exactamente el día local.
    const startLocal = new Date(`${dateISO}T00:00:00`);
    const endLocal = new Date(startLocal.getTime() + 24 * 60 * 60 * 1000);

    return {
        gte: startLocal.toISOString(),
        lt: endLocal.toISOString(),
    };
}

/** Lista salidas por fecha local exacta (todas las de ese día) */
export async function listDeparturesByDate(
    dateISO: string,
    opts?: {
        pageSize?: number;
        includeStatuses?: DepartureStatus[]; // si quieres filtrar por estado en front
        ordering?: string; // por defecto: "scheduled_departure_at"
    }
) {
    const { gte, lt } = dayRangeISO(dateISO);
    const { items, total } = await listDepartures<Departure>({
        scheduled_gte: gte,
        scheduled_lte: lt,
        ordering: opts?.ordering ?? "scheduled_departure_at",
        pageSize: opts?.pageSize ?? 500,
        // NOTA: NO mandamos 'status' para no excluir salidas por estado.
    });

    let filtered = items;
    if (opts?.includeStatuses?.length) {
        const set = new Set(opts.includeStatuses);
        filtered = items.filter((d) => set.has(d.status));
    }
    return { items: filtered, total: filtered.length };
}

/** Versión “lite” para selects (mapea a {id,label,...}) */
export async function listDeparturesByDateLite(
    dateISO: string,
    limit = 500
) {
    const { items } = await listDeparturesByDate(dateISO, { pageSize: limit });
    return items.map((d) => ({
        id: d.id,
        label: formatDepartureTitle({
            route_name: d.route_name,
            scheduled_departure_at: d.scheduled_departure_at,
            bus_code: d.bus_code,
        }),
        status: d.status,
        scheduled_at: d.scheduled_departure_at,
        bus_code: d.bus_code,
    }));
}
