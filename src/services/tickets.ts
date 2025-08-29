// services/tickets.ts
import { api } from "./api";
import type { Id as DepartureId } from "./departures";
import type { Passenger } from "./passengers";

/* =========================================
 * Tipos
 * ========================================= */

export type TicketStatus = "RESERVED" | "PAID" | "CANCELLED" | "NO_SHOW";

export type TicketRead = {
    id: string;
    status: TicketStatus;
    price: string;            // viene como string decimal desde DRF
    paid_at: string | null;
    created_at: string;

    // campos anidados (según TicketReadSerializer)
    passenger: {
        id: string;
        document?: string | null;
        full_name?: string | null;
    };
    departure: {
        id: string;
        date?: string | null;
        time?: string | null;
        route?: string | null;
        bus?: string | null;
    };
    seat: { id: number | string; number: number; floor?: number | null };
    origin: { id: number | string; code: string; name: string };
    destination: { id: number | string; code: string; name: string };
    office_sold: { id: number | string; code: string; name: string };
    seller: { id: number | string; username: string; full_name?: string };
};

export type TicketWrite = {
    // IDs crudos en escritura (TicketWriteSerializer)
    passenger: Passenger["id"];
    departure: DepartureId;
    seat: number | string;
    origin: number | string;       // Office id
    destination: number | string;  // Office id
    office_sold: number | string;  // Office id
    // seller: se infiere en backend desde request.user (recomendado)
    status?: TicketStatus;         // por defecto RESERVED
    price: number | string;        // decimal
    paid_at?: string | null;       // backend lo setea si status=PAID
};

export type DRFPage<T> = { count: number; next: string | null; previous: string | null; results: T[] };

// Filtros de lista (match con tu ViewSet)
export type ListTicketsParams = {
    departure?: string | number;
    status?: TicketStatus;
    seat?: string | number;
    origin?: string | number;
    destination?: string | number;
    office_sold?: string | number;
    seller?: string | number;
    search?: string;
    page?: number;
    pageSize?: number;
    ordering?: string; // "-created_at", etc.
};

const BASE = "/ventas/tickets/"; // ajusta si tu include es /api/tickets/ => entonces BASE = "/tickets/"
/* Si en urls.py lo montaste como path("api/", include("apps.ventas.urls")),
   y en apps.ventas.urls router.register("tickets", ...),
   entonces desde api base sería "/tickets/". Ajusta BASE a "/tickets/". */

/* =========================================
 * Utils
 * ========================================= */
function normalizeList<T>(data: DRFPage<T> | T[]) {
    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data.results ?? [], total: Number(data.count ?? 0) };
}

function qsFromParams(params: ListTicketsParams) {
    const qs = new URLSearchParams();
    if (params.departure != null) qs.set("departure", String(params.departure));
    if (params.status) qs.set("status", params.status);
    if (params.seat != null) qs.set("seat", String(params.seat));
    if (params.origin != null) qs.set("origin", String(params.origin));
    if (params.destination != null) qs.set("destination", String(params.destination));
    if (params.office_sold != null) qs.set("office_sold", String(params.office_sold));
    if (params.seller != null) qs.set("seller", String(params.seller));
    if (params.search) qs.set("search", params.search);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));
    if (params.ordering) qs.set("ordering", params.ordering);
    qs.set("_", String(Date.now()));
    return qs;
}

/* =========================================
 * Endpoints principales
 * ========================================= */

// Listar
export async function listTickets(params: ListTicketsParams = {}) {
    const qs = qsFromParams(params);
    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<TicketRead> | TicketRead[]>(url);
    return normalizeList<TicketRead>(data);
}

// Obtener uno
export async function getTicket(id: string) {
    return api.get<TicketRead>(`${BASE}${id}/`);
}

// Crear
export async function createTicket(body: TicketWrite) {
    // TIP: no envíes seller, que lo infiera el backend del usuario autenticado
    return api.post<TicketRead>(BASE, body);
}

// Actualizar (por si dejas editar precio/origen/destino/seat)
export async function updateTicket(id: string, body: Partial<TicketWrite>, opts?: { partial?: boolean }) {
    const method = opts?.partial ? api.patch : api.put;
    return method<TicketRead>(`${BASE}${id}/`, body as any);
}

// Eliminar (si tu ViewSet lo permite)
export async function deleteTicket(id: string) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}

/* =========================================
 * Acciones de negocio (@action)
 * ========================================= */

export async function payTicket(id: string) {
    return api.post<TicketRead>(`${BASE}${id}/pay/`, {});
}

export async function cancelTicket(id: string) {
    return api.post<TicketRead>(`${BASE}${id}/cancel/`, {});
}

export async function markNoShow(id: string) {
    return api.post<TicketRead>(`${BASE}${id}/no_show/`, {});
}

/* =========================================
 * Helpers de “venta” (orquestación)
 * ========================================= */

/**
 * Crea una venta (ticket) usando un pasajero existente.
 * - departure: salida
 * - seat: asiento físico
 * - origin/destination: oficinas (tramo)
 * - office_sold: oficina donde vendes
 * - price: precio
 * - status: "RESERVED" (default) o "PAID"
 */
export async function createSaleFromExistingPassenger(args: {
    passengerId: Passenger["id"];
    departureId: DepartureId;
    seatId: number | string;
    originId: number | string;
    destinationId: number | string;
    officeSoldId: number | string;
    price: number | string;
    status?: TicketStatus; // default RESERVED
}) {
    const payload: TicketWrite = {
        passenger: args.passengerId,
        departure: args.departureId,
        seat: args.seatId,
        origin: args.originId,
        destination: args.destinationId,
        office_sold: args.officeSoldId,
        price: args.price,
        status: args.status ?? "RESERVED",
    };
    return createTicket(payload);
}

/**
 * Crea o actualiza (opcional) un pasajero y luego emite la venta.
 * Útil para caja/venta rápida cuando el pasajero no existe aún.
 * Pasa un callback para "ensurePassengerId" que resuelva el UUID (p. ej.:
 *  - buscar por nro_doc; si no existe, crearlo con createPassenger(...))
 */
export async function createSaleWithPassengerUpsert(args: {
    ensurePassengerId: () => Promise<Passenger["id"]>;
    departureId: DepartureId;
    seatId: number | string;
    originId: number | string;
    destinationId: number | string;
    officeSoldId: number | string;
    price: number | string;
    status?: TicketStatus;
}) {
    const passengerId = await args.ensurePassengerId();
    return createSaleFromExistingPassenger({
        passengerId,
        departureId: args.departureId,
        seatId: args.seatId,
        originId: args.originId,
        destinationId: args.destinationId,
        officeSoldId: args.officeSoldId,
        price: args.price,
        status: args.status,
    });
}

/* =========================================
 * Utilidades para UI
 * ========================================= */

/**
 * Devuelve IDs de asientos ocupados para una departure.
 * NOTA: Sin un endpoint de “disponibilidad por tramos” en backend,
 * esto marca ocupación solo por coincidencia exacta de tramo (O->D).
 * Si necesitas evitar traslapes (O1-D1 vs O2-D2), conviene un endpoint
 * dedicado que calcule traslape en servidor.
 */
export async function listOccupiedSeatIds(departureId: DepartureId, originId?: number | string, destinationId?: number | string) {
    const { items } = await listTickets({ departure: departureId, pageSize: 1000 });
    const set = new Set<string | number>();
    for (const t of items) {
        // si origin/destination se pasan, filtrar por tramo exacto
        const sameTramo =
            originId != null &&
            destinationId != null &&
            String(t.origin.id) === String(originId) &&
            String(t.destination.id) === String(destinationId);

        if (originId != null && destinationId != null) {
            if (sameTramo) set.add(t.seat.id);
        } else {
            // sin tramo, marca cualquiera como ocupado (rudo)
            set.add(t.seat.id);
        }
    }
    return Array.from(set);
}

/** Etiquetas de estado para UI */
export function ticketStatusLabel(s: TicketStatus) {
    switch (s) {
        case "RESERVED": return "Reservado";
        case "PAID": return "Pagado";
        case "CANCELLED": return "Anulado";
        case "NO_SHOW": return "No se presentó";
        default: return s;
    }
}

/** Atajo de “pagar ahora” que asegura estado */
export async function payIfReservado(ticket: TicketRead) {
    if (ticket.status === "RESERVED") {
        return payTicket(ticket.id);
    }
    return ticket;
}
