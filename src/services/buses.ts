// services/buses.ts
import { api } from "./api";

// ---- Tipos del backend (BusSerializer) ----
export type Bus = {
    id: number | string;
    code: string;            // generado por el backend
    model: string;           // ej. "Marcopolo G7"
    year: number;            // 1980..2100
    plate: string;           // placa (única)
    chassis_number: string;  // chasis (único)
    capacity: number;        // asientos
    active: boolean;
    notes?: string;
    created_at?: string;     // ISO
};

// Página DRF por defecto
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type ListBusesParams = {
    q?: string;          // SearchFilter (code, model, plate, chassis_number)
    page?: number;
    pageSize?: number;

    active?: boolean;    // filterset: exact
    // filtros por campo (icontains por defecto)
    code?: string;
    model?: string;
    plate?: string;
    chassis?: string;    // chassis_number

    // rangos numéricos
    yearFrom?: number;    // year__gte
    yearTo?: number;      // year__lte
    capacityMin?: number; // capacity__gte
    capacityMax?: number; // capacity__lte

    ordering?: string;   // "code" | "-year" | "model" | "plate" | "capacity" | "created_at" ...
};

// ---- Helpers ----
const BASE = "/catalog/buses/";

// ---- Listado ----
export async function listBuses(params: ListBusesParams = {}) {
    const qs = new URLSearchParams();

    if (params.q) qs.set("search", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));

    if (typeof params.active === "boolean") qs.set("active", String(params.active));

    if (params.code) qs.set("code__icontains", params.code);
    if (params.model) qs.set("model__icontains", params.model);
    if (params.plate) qs.set("plate__icontains", params.plate);
    if (params.chassis) qs.set("chassis_number__icontains", params.chassis);

    if (params.yearFrom != null) qs.set("year__gte", String(params.yearFrom));
    if (params.yearTo != null) qs.set("year__lte", String(params.yearTo));
    if (params.capacityMin != null) qs.set("capacity__gte", String(params.capacityMin));
    if (params.capacityMax != null) qs.set("capacity__lte", String(params.capacityMax));

    if (params.ordering) qs.set("ordering", params.ordering);

    // cache-bust opcional
    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<Bus> | Bus[]>(url);

    if (Array.isArray(data)) {
        return { items: data, total: data.length };
    } else {
        return { items: data.results ?? [], total: Number(data.count ?? 0) };
    }
}

// ---- Obtener uno ----
export async function getBus(id: Bus["id"]) {
    return api.get<Bus>(`${BASE}${id}/`);
}

// ---- Crear / Actualizar ----
// NOTA: `code` es generado por el backend => no se envía desde el cliente
export type UpsertBusBody = Partial<
    Pick<
        Bus,
        | "model"
        | "year"
        | "plate"
        | "chassis_number"
        | "capacity"
        | "active"
        | "notes"
    >
>;

export async function createBus(body: UpsertBusBody) {
    const res = await api.post<Bus>(BASE, body);
    return res;
}

export async function updateBus(
    id: Bus["id"],
    body: UpsertBusBody,
    opts?: { partial?: boolean }
) {
    const method = opts?.partial ? api.patch : api.put;
    const res = await method<Bus>(`${BASE}${id}/`, body as any);
    return res;
}

// ---- Eliminar ----
export async function deleteBus(id: Bus["id"]) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}
