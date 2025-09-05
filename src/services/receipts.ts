// services/receipts.ts
import { api } from "./api";

/* ====================== Tipos ====================== */
export type ReceiptStatus = "ISSUED" | "VOID";

export type MiniOffice = { id: string | number; code: string; name: string } | null;
export type MiniUser = { id: string | number; username: string; full_name?: string } | null;

export type ReceiptRead = {
    id: string;                     // UUID
    number: string;                 // p.ej. SR-20250101-1704061234
    payment: string;                // Payment PK (o id)
    total_amount: string;           // DRF Decimal -> string
    currency: string;               // p.ej. "BOB"
    status: ReceiptStatus;          // ISSUED | VOID
    notes?: string | null;

    issuer_office: MiniOffice;      // { id, code, name } | null
    issuer: MiniUser;               // { id, username, full_name? } | null

    issued_at: string;              // ISO
    receipt_pdf_url?: string | null;    // URL segura en Cloudinary (si existe)
};

export type ReceiptCreateBody = {
    // Backend: services.issue_receipt_safe(...)
    payment: string;                  // payment_id (UUID)
    number?: string | null;           // si no mandas, backend genera
    issuer_office: number | string;   // office id
    total_amount?: string | number;   // por defecto: payment.amount
    currency?: string;                // por defecto: "BOB" o la del pago
    notes?: string;
    // issuer lo toma el backend desde request.user
};

/* =================== Paginación DRF =================== */
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

type Normalized<T> = { items: T[]; total: number };

/* ====================== Helpers ====================== */
function normalize<T>(data: DRFPage<T> | T[]): Normalized<T> {
    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data.results ?? [], total: Number(data.count ?? 0) };
}

/* ====================== Constantes ====================== */
const BASE = "/ventas/receipts/";

/* ======================== API ======================== */

// Crear / emitir un recibo para un pago confirmado
export async function createReceipt(body: ReceiptCreateBody): Promise<ReceiptRead> {
    return api.post<ReceiptRead>(BASE, body);
}

// Obtener un recibo por id
export async function getReceipt(id: string): Promise<ReceiptRead> {
    return api.get<ReceiptRead>(`${BASE}${id}/`);
}

export type ListReceiptsParams = {
    status?: ReceiptStatus;             // filterset: "status"
    issuer_office?: string | number;    // filterset: "issuer_office"
    search?: string;                    // search_fields: number, notes
    ordering?: string;                  // "issued_at" | "number" | "total_amount" | "-issued_at" ...
    page?: number;
    pageSize?: number;

    // Filtros de fecha definidos en la vista:
    issued_from?: string;               // yyyy-mm-dd -> issued_at__date__gte
    issued_to?: string;                 // yyyy-mm-dd -> issued_at__date__lte
    created_from?: string;              // por si usas created_at en filtros (lo tienes en filterset)
    created_to?: string;
};

export async function listReceipts(
    params: ListReceiptsParams = {}
): Promise<Normalized<ReceiptRead>> {
    const qs = new URLSearchParams();

    if (params.status) qs.set("status", params.status);
    if (params.issuer_office != null) qs.set("issuer_office", String(params.issuer_office));
    if (params.search) qs.set("search", params.search);
    if (params.ordering) qs.set("ordering", params.ordering);

    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));

    // filtros por fecha (coinciden con tu filterset de la vista)
    if (params.issued_from) qs.set("issued_at__date__gte", params.issued_from);
    if (params.issued_to) qs.set("issued_at__date__lte", params.issued_to);
    if (params.created_from) qs.set("created_at__date__gte", params.created_from);
    if (params.created_to) qs.set("created_at__date__lte", params.created_to);

    // anti-cache
    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<ReceiptRead> | ReceiptRead[]>(url);
    return normalize<ReceiptRead>(data);
}
