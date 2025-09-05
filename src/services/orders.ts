// services/orders.ts
import { api } from "./api";
import type { Passenger } from "./passengers";

/* ====================== Tipos ====================== */
export type OrderStatus = "OPEN" | "PAID" | "CANCELLED";

export type OrderRead = {
    id: string | number;
    status: OrderStatus;
    total_amount: string; // DRF Decimal -> string
    paid_amount: string;
    created_at: string;

    buyer_name: string;
    buyer_doc?: string | null;

    departure: { id: string | number; scheduled_at?: string | null };
    origin?: { id: string | number; code: string; name: string } | null;
    destination?: { id: string | number; code: string; name: string } | null;
    office_sold: { id: string | number; code: string; name: string } | null;
    seller: { id: string | number; username: string; full_name?: string } | null;

    tickets?: Array<{
        id: string | number;
        status: "RESERVED" | "PAID" | "CANCELLED" | "NO_SHOW";
        price: string;
        passenger: { id: string | number; full_name: string };
        seat: { id: string | number; number: number; deck?: number | null };
    }>;
};

/** Bloque agrupado para datos de menor (frontend) */
export type MinorBlock = {
    guardian: Passenger["id"];
    guardian_relation: string;
    defensoria_form_number: string;
};

/** Payload de ticket (creación) */
export type TicketInput = {
    passenger: Passenger["id"];     // ID pasajero
    seat: number | string;          // ID asiento
    price: string | number;         // precio

    /** Nuevo (frontend): bloque agrupado para menores */
    minor?: MinorBlock;

    /** Legacy: compat con backend actual; se rellenan desde `minor` al enviar */
    guardian?: Passenger["id"] | null;
    guardian_relation?: string;
    defensoria_form_number?: string;
};

export type OrderCreateBody = {
    buyer_name: string;
    buyer_doc?: string;
    departure: number | string;
    office_sold: number | string;
    tickets: TicketInput[];
};

/* =================== Paginación DRF =================== */
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};
type Normalized<T> = { items: T[]; total: number };

const BASE = "/ventas/orders/";

/* ====================== Helpers ====================== */
function normalize<T>(data: DRFPage<T> | T[]): Normalized<T> {
    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data.results ?? [], total: Number(data.count ?? 0) };
}

/**
 * ¿El pasajero es menor a la fecha/hora de salida?
 * - `departureISO` debe ser un ISO string (p.ej. `scheduled_at`)
 */
export function isMinor(passenger: Passenger, departureISO?: string | null): boolean {
    if (!passenger?.fecha_nac || !departureISO) return false;
    const birth = new Date(passenger.fecha_nac);
    const ref = new Date(departureISO);
    let edad = ref.getFullYear() - birth.getFullYear();
    const m = ref.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && ref.getDate() < birth.getDate())) edad--;
    return edad < 18;
}

/**
 * Helper sencillo: construye tickets a partir de una lista de asientos.
 * Mantiene compatibilidad con tu código existente.
 */
export function buildTickets(
    seatIds: Array<number | string>,
    opts:
        | { samePassenger: Passenger["id"]; price: number | string }
        | { perSeatPassenger: Record<string, Passenger["id"]>; price: number | string }
): TicketInput[] {
    const price = opts.price;
    if ("samePassenger" in opts) {
        return seatIds.map((seat) => ({ seat, passenger: opts.samePassenger, price }));
    }
    return seatIds.map((seat) => {
        const key = String(seat);
        const passenger = opts.perSeatPassenger[key];
        if (passenger == null) throw new Error(`Falta pasajero para el asiento ${key}`);
        return { seat, passenger, price };
    });
}

/**
 * Helper avanzado: define tickets por asiento con validación de menores.
 * - `perSeat` => { "<seatId>": { passenger, price, minor? } }
 * - Si el pasajero es menor en la fecha de salida, `minor` es obligatorio.
 */
export function buildTicketsFlexible(
    perSeat: Record<
        string,
        {
            passenger: Passenger;
            price: number | string;
            minor?: MinorBlock;
        }
    >,
    departureISO?: string | null
): TicketInput[] {
    return Object.entries(perSeat).map(([seat, cfg]) => {
        const base: TicketInput = {
            seat,
            passenger: cfg.passenger.id,
            price: cfg.price,
        };
        if (isMinor(cfg.passenger, departureISO)) {
            if (!cfg.minor) {
                throw new Error(
                    `El asiento ${seat} corresponde a un menor y requiere responsable, parentesco y N° de formulario.`
                );
            }
            base.minor = cfg.minor;
        }
        return base;
    });
}

/** Aplana `minor` → { guardian, guardian_relation, defensoria_form_number } (compat backend) */
function flattenMinorBlock(t: TicketInput): TicketInput {
    if (!t.minor) return t;
    const { guardian, guardian_relation, defensoria_form_number } = t.minor;
    return {
        ...t,
        guardian,
        guardian_relation,
        defensoria_form_number,
    };
}

/* ======================== API ======================== */
export async function createOrder(body: OrderCreateBody): Promise<OrderRead> {
    // Compatibilidad con backend actual: aplanar bloque `minor`
    const payload: OrderCreateBody = {
        ...body,
        tickets: body.tickets.map(flattenMinorBlock),
    };
    return api.post<OrderRead>(BASE, payload);
}

export async function getOrder(id: string | number): Promise<OrderRead> {
    return api.get<OrderRead>(`${BASE}${id}/`);
}

export type ListOrdersParams = {
    status?: OrderStatus;
    departure?: string | number;
    buyer_name?: string;
    buyer_doc?: string;
    search?: string;
    page?: number;
    pageSize?: number;
    ordering?: string; // ej: "-created_at"
};

export async function listOrders(
    params: ListOrdersParams = {}
): Promise<Normalized<OrderRead>> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.departure != null) qs.set("departure", String(params.departure));
    if (params.buyer_name) qs.set("buyer_name", params.buyer_name);
    if (params.buyer_doc) qs.set("buyer_doc", params.buyer_doc);
    if (params.search) qs.set("search", params.search);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));
    if (params.ordering) qs.set("ordering", params.ordering);
    qs.set("_", String(Date.now())); // anti-cache

    const data = await api.get<DRFPage<OrderRead> | OrderRead[]>(
        `${BASE}?${qs.toString()}`
    );
    return normalize<OrderRead>(data);
}

export async function cancelOrder(id: string | number): Promise<OrderRead> {
    return api.post<OrderRead>(`${BASE}${id}/cancel/`, {});
}

/* ================== Helpers extra pagos ================== */

/** Retorna el saldo de una orden (total - pagado) como number. */
export function getOrderBalance(o: OrderRead): number {
    return Number(o.total_amount) - Number(o.paid_amount);
}

/**
 * Busca la *última* orden ABIERTA por buyer_name (y opcional buyer_doc).
 * Si existe, retorna la orden; si no, null.
 */
export async function findLatestOpenOrderByBuyer(
    buyer_name: string,
    buyer_doc?: string
): Promise<OrderRead | null> {
    const { items } = await listOrders({
        status: "OPEN",
        buyer_name,
        ...(buyer_doc ? { buyer_doc } : {}),
        ordering: "-created_at",
        pageSize: 1,
    });
    return items[0] ?? null;
}

/**
 * Autocomplete de órdenes por buyer_name (ABIERTO por defecto), útil para modal de pagos.
 * Devuelve top N coincidencias ordenadas por más recientes.
 */
export async function searchOpenOrdersByBuyer(
    buyer_name: string,
    opts: { limit?: number; includePaid?: boolean } = {}
): Promise<OrderRead[]> {
    const { limit = 5, includePaid = false } = opts;

    const statuses = includePaid ? undefined : "OPEN";
    const { items } = await listOrders({
        ...(statuses ? { status: statuses as any } : {}),
        buyer_name,
        ordering: "-created_at",
        pageSize: limit,
    });
    return items;
}
