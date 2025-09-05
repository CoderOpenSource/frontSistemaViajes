// services/payments.ts
import { api } from "./api";

/* ====================== Tipos ====================== */
export type PaymentStatus =
    | "PENDING"
    | "CONFIRMED"
    | "FAILED"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";

export type PaymentMethod = {
    id: string | number;
    code: string;
    name: string;
    active: boolean;
    notes?: string;
};

export type MiniOffice = { id: string | number; code: string; name: string } | null;
export type MiniUser = { id: string | number; username: string; full_name?: string } | null;

export type PaymentRead = {
    id: string | number;
    order: string | number; // PK
    method: PaymentMethod;
    amount: string;         // DRF Decimal -> string
    currency: string;       // p.ej. "BOB"
    transaction_id?: string;
    status: PaymentStatus;
    office: MiniOffice;
    cashier: MiniUser;
    paid_at?: string | null;
    created_at: string;
};

export type PaymentCreateBody = {
    order: string | number;           // Order ID
    method: string | number;          // PaymentMethod ID
    amount: string | number;
    currency?: string;                // default "BOB"
    office?: string | number | null;  // Office ID (opcional)
    transaction_id?: string;          // opcional
    confirm?: boolean;                // si true, confirma en el mismo POST
};

/* =================== Paginación DRF =================== */
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

type Normalized<T> = { items: T[]; total: number };

/* ====================== Constantes ====================== */
const BASE = "/ventas/payments/";
const METHODS_BASE = "/ventas/payment-methods/";

/* ====================== Helpers ====================== */
function normalize<T>(data: DRFPage<T> | T[]): Normalized<T> {
    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data.results ?? [], total: Number(data.count ?? 0) };
}

/* ======================== API ======================== */
// ---- Métodos de pago ----
export async function listPaymentMethods(): Promise<PaymentMethod[]> {
    const data = await api.get<PaymentMethod[] | DRFPage<PaymentMethod>>(METHODS_BASE);
    return Array.isArray(data) ? data : data.results ?? [];
}

// ---- Pagos ----
export async function createPayment(body: PaymentCreateBody): Promise<PaymentRead> {
    return api.post<PaymentRead>(BASE, body);
}

export async function confirmPayment(payment_id: string): Promise<PaymentRead> {
    // coincide con @action(detail=false, methods=["post"]) -> /ventas/payments/confirm/
    return api.post<PaymentRead>(`${BASE}confirm/`, { payment_id });
}

export async function getPayment(id: string | number): Promise<PaymentRead> {
    return api.get<PaymentRead>(`${BASE}${id}/`);
}

export type ListPaymentsParams = {
    status?: PaymentStatus;
    method?: string | number;
    order?: string | number;
    search?: string;      // transaction_id
    page?: number;
    pageSize?: number;
    ordering?: string;    // "-created_at", "amount", etc.
    created_from?: string; // yyyy-mm-dd
    created_to?: string;   // yyyy-mm-dd
};

export async function listPayments(
    params: ListPaymentsParams = {}
): Promise<Normalized<PaymentRead>> {
    const qs = new URLSearchParams();
    if (params.status) qs.set("status", params.status);
    if (params.method != null) qs.set("method", String(params.method));
    if (params.order != null) qs.set("order", String(params.order));
    if (params.search) qs.set("search", params.search);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));
    if (params.ordering) qs.set("ordering", params.ordering);
    // filtros por fecha creados acorde a filterset (created_at__date__gte/lte y gte/lte)
    if (params.created_from) qs.set("created_at__date__gte", params.created_from);
    if (params.created_to) qs.set("created_at__date__lte", params.created_to);

    // anti-cache
    qs.set("_", String(Date.now()));

    const data = await api.get<DRFPage<PaymentRead> | PaymentRead[]>(`${BASE}?${qs.toString()}`);
    return normalize<PaymentRead>(data);
}
