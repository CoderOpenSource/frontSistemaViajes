// services/audit.ts
import { api } from "./api";

// ---- Tipos que devuelve tu AuditLogSerializer ----
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "LOGOUT";

export type AuditLog = {
    id: number | string;
    created_at: string;            // ISO
    user: number | null;           // id del usuario (o null)
    user_username?: string | null; // nombre de usuario (read-only)
    action: AuditAction;
    entity: string;
    record_id?: string | null;
    extra: unknown;                // puede ser objeto/array/string/etc
};

// Página DRF
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type ListAuditParams = {
    q?: string;          // SearchFilter (acción, entidad, usuario, etc.)
    page?: number;
    pageSize?: number;

    // filtros opcionales (si los habilitaste en el ViewSet)
    action?: AuditAction;          // ?action=CREATE
    entity?: string;               // ?entity__icontains=Ticket
    user?: number | string | null; // ?user=<id>
    dateFrom?: string;             // ISO -> ?created_at__gte
    dateTo?: string;               // ISO -> ?created_at__lte

    ordering?: string;             // p.ej. "-created_at"
    parseExtra?: boolean;          // si true, intenta JSON.parse si viene string
};

// ---- Helpers ----
const BASE = "/audit/"; // ajusta si tu prefix es distinto

// ---- Listado ----
export async function listAudit(params: ListAuditParams = {}) {
    const qs = new URLSearchParams();

    if (params.q) qs.set("search", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));

    if (params.action) qs.set("action", params.action);
    if (params.user != null) qs.set("user", String(params.user));
    if (params.entity) qs.set("entity__icontains", params.entity);

    if (params.dateFrom) qs.set("created_at__gte", params.dateFrom);
    if (params.dateTo) qs.set("created_at__lte", params.dateTo);

    if (params.ordering) qs.set("ordering", params.ordering);

    // cache-bust opcional
    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<AuditLog> | AuditLog[]>(url);

    const parseExtraIfNeeded = (rows: AuditLog[]) => {
        if (!params.parseExtra) return rows;
        return rows.map((r) => {
            if (typeof r.extra === "string") {
                try {
                    return { ...r, extra: JSON.parse(r.extra as string) };
                } catch {
                    return r; // si no parsea, lo dejamos tal cual
                }
            }
            return r;
        });
    };

    if (Array.isArray(data)) {
        return { items: parseExtraIfNeeded(data), total: data.length };
    } else {
        const items = data.results ?? [];
        return { items: parseExtraIfNeeded(items), total: Number(data.count ?? 0) };
    }
}
