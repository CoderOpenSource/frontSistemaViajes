// services/offices.ts
import { api } from "./api";

// ---- Tipos del backend (OfficeSerializer) ----
export type Office = {
    id: number | string;
    code: string;
    name: string;
    department?: string;
    province?: string;
    municipality?: string;
    locality?: string;
    address?: string;
    location_url?: string;
    phone?: string;
    active: boolean;
    created_at?: string;
    updated_at?: string;
};


// Página DRF por defecto
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type ListOfficesParams = {
    q?: string;           // SearchFilter
    page?: number;
    pageSize?: number;
    active?: boolean;     // filterset: exact

    // filtros jerárquicos (icontains por defecto)
    department?: string;
    province?: string;
    municipality?: string;
    locality?: string;

    // si mantienes city:
    city?: string;

    code?: string;        // icontains por defecto
    ordering?: string;    // "code" | "-code" | "name" | "department" | ...
};

// ---- Helpers ----
const BASE = "/catalog/offices/";

// ---- Listado ----
export async function listOffices(params: ListOfficesParams = {}) {
    const qs = new URLSearchParams();

    if (params.q) qs.set("search", params.q);                 // DRF SearchFilter
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));

    // filtros exactos / icontains según ViewSet
    if (typeof params.active === "boolean") qs.set("active", String(params.active));

    if (params.department)   qs.set("department__icontains", params.department);
    if (params.province)     qs.set("province__icontains", params.province);
    if (params.municipality) qs.set("municipality__icontains", params.municipality);
    if (params.locality)     qs.set("locality__icontains", params.locality);

    if (params.city) qs.set("city__icontains", params.city); // si existe
    if (params.code) qs.set("code__icontains", params.code);

    if (params.ordering) qs.set("ordering", params.ordering);

    // cache-bust opcional
    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<Office> | Office[]>(url);

    if (Array.isArray(data)) {
        return { items: data, total: data.length };
    } else {
        return { items: data.results ?? [], total: Number(data.count ?? 0) };
    }
}

// ---- Obtener uno ----
export async function getOffice(id: Office["id"]) {
    return api.get<Office>(`${BASE}${id}/`);
}

// ---- Crear / Actualizar ----
// NOTA: no incluimos `code` porque lo genera el backend
export type UpsertOfficeBody = Partial<
    Pick<
        Office,
        | "name"
        | "department"
        | "province"
        | "municipality"
        | "locality"
        | "address"
        | "location_url"
        | "phone"
        | "active"
    >
>;

const toServer = (body: UpsertOfficeBody) => {
    // Por si acaso, eliminamos code si llegó por error
    const { /* code, */ ...rest } = body as any;
    return rest as UpsertOfficeBody;
};

export async function createOffice(body: UpsertOfficeBody) {
    const payload = toServer(body);
    const res = await api.post<Office>(BASE, payload);
    return res;
}

export async function updateOffice(
    id: Office["id"],
    body: UpsertOfficeBody,
    opts?: { partial?: boolean }
) {
    const method = opts?.partial ? api.patch : api.put;
    const payload = toServer(body);
    const res = await method<Office>(`${BASE}${id}/`, payload as any);
    return res;
}

// ---- Eliminar ----
export async function deleteOffice(id: Office["id"]) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}
// Conveniencia para combos: oficinas activas ordenadas por code
export async function listActiveOfficesLite() {
    const { items } = await listOffices({ active: true, ordering: "code", pageSize: 200 });
    // Devuelve lo justo para un select
    return items.map(o => ({ id: o.id, label: `${o.code} — ${o.name}` }));
}
