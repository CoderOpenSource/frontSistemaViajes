// services/buses.ts
import { api } from "./api";

/* ================================
 * Tipos
 * ================================ */

export type SeatKind = "NORMAL" | "SEMI_CAMA" | "CAMA" | "LEITO" | "ESPECIAL";
export const KIND_OPTIONS: SeatKind[] = ["NORMAL", "SEMI_CAMA", "CAMA", "LEITO", "ESPECIAL"];

export type SeatBlock = {
    deck: 1 | 2;
    kind: SeatKind;
    count: number;
    start_number?: number;
    row?: number | null;
    col?: number | null;
    is_accessible?: boolean;
    active?: boolean;
    notes?: string;
};

export type SeatSummary = {
    id: number;
    number: number;
    deck: number;
    row: number | null;
    col: number | null;
    kind: SeatKind;
    is_accessible: boolean;
    active: boolean;
};

// --- Bus del backend (fotos como URL al LEER)
export type Bus = {
    id: number | string;
    code: string;
    model: string;
    year: number;
    plate: string;
    chassis_number: string;
    capacity: number;
    active: boolean;
    notes?: string | null;
    created_at?: string;

    photo_front?: string | null;
    photo_back?: string | null;
    photo_left?: string | null;
    photo_right?: string | null;

    seats_count?: number;
};

type DRFPage<T> = { count: number; next: string | null; previous: string | null; results: T[] };

/* ================================
 * Listado
 * ================================ */

export type ListBusesParams = {
    q?: string;
    page?: number;
    pageSize?: number;
    active?: boolean;
    code?: string;
    model?: string;
    plate?: string;
    chassis?: string;
    yearFrom?: number;
    yearTo?: number;
    capacityMin?: number;
    capacityMax?: number;
    ordering?: string;
};

const BASE = "/catalog/buses/";

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

    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<Bus> | Bus[]>(url);
    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data.results ?? [], total: Number(data.count ?? 0) };
}

/* ================================
 * Crear / Actualizar (igual que licencias)
 * ================================ */

const clean = (v?: string | null) => {
    const s = (v ?? "").trim();
    return s.length ? s : undefined;
};

// Body para upsert (como licencias: si envías File/Blob -> sube; si no, se mantiene)
export type UpsertBusBody = Partial<
    Pick<Bus, "model" | "year" | "plate" | "chassis_number" | "capacity" | "active" | "notes">
> & {
    photo_front?: File | Blob | null;
    photo_back?: File | Blob | null;
    photo_left?: File | Blob | null;
    photo_right?: File | Blob | null;

    seat_blocks?: SeatBlock[]; // opcional
};

function needsMultipart(body: UpsertBusBody) {
    return (
        body.photo_front instanceof Blob ||
        body.photo_back  instanceof Blob ||
        body.photo_left  instanceof Blob ||
        body.photo_right instanceof Blob
    );
}

function toFormData(body: UpsertBusBody) {
    const fd = new FormData();

    if (body.model != null)          fd.append("model", String(body.model));
    if (body.year != null)           fd.append("year", String(body.year));
    if (body.plate != null)          fd.append("plate", String(body.plate));
    if (body.chassis_number != null) fd.append("chassis_number", String(body.chassis_number));
    if (body.capacity != null)       fd.append("capacity", String(body.capacity));
    if (body.active != null)         fd.append("active", body.active ? "true" : "false");
    if (clean(body.notes))           fd.append("notes", String(clean(body.notes)));

    // adjuntar solo si son archivos nuevos
    if (body.photo_front instanceof Blob) fd.append("photo_front", body.photo_front);
    if (body.photo_back  instanceof Blob) fd.append("photo_back",  body.photo_back);
    if (body.photo_left  instanceof Blob) fd.append("photo_left",  body.photo_left);
    if (body.photo_right instanceof Blob) fd.append("photo_right", body.photo_right);

    // seat_blocks (si se manda, lo serializamos)
    if (Array.isArray(body.seat_blocks)) {
        fd.append("seat_blocks", JSON.stringify(body.seat_blocks));
    }

    return fd;
}

export async function getBus(id: Bus["id"]) {
    return api.get<Bus>(`${BASE}${id}/`);
}

export async function createBus(body: UpsertBusBody) {
    if (needsMultipart(body)) {
        const fd = toFormData(body);
        return api.post<Bus>(BASE, fd);
    }
    const { photo_front, photo_back, photo_left, photo_right, ...rest } = body;
    const json = {
        ...rest,
        notes: clean(rest.notes),
    };
    return api.post<Bus>(BASE, json as any);
}

export async function updateBus(id: Bus["id"], body: UpsertBusBody, opts?: { partial?: boolean }) {
    const method = opts?.partial ? api.patch : api.put;

    if (needsMultipart(body)) {
        const fd = toFormData(body);
        return method<Bus>(`${BASE}${id}/`, fd as any);
    }
    const { photo_front, photo_back, photo_left, photo_right, ...rest } = body;
    const json = {
        ...rest,
        notes: clean(rest.notes),
    };
    return method<Bus>(`${BASE}${id}/`, json as any);
}

export async function deleteBus(id: Bus["id"]) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}

/* ================================
 * Conveniencia / Asientos
 * ================================ */

export async function listActiveBusesLite() {
    const { items } = await listBuses({ active: true, ordering: "code", pageSize: 200 });
    return items.map((b) => ({ id: b.id, label: `${b.code} — ${b.plate} (${b.model})`, plate: b.plate }));
}

export async function listBusSeats(busId: Bus["id"]) {
    return api.get<SeatSummary[]>(`${BASE}${busId}/seats/`);
}

export async function getBusSeatBlocks(busId: Bus["id"]) {
    return api.get<Pick<SeatBlock, "deck" | "kind" | "count" | "start_number">[]>(`${BASE}${busId}/seat-blocks/`);
}

export async function regenerateBusSeats(busId: Bus["id"], seatBlocks: SeatBlock[]) {
    return api.post<{ message: string; created: number }>(`${BASE}${busId}/seats/regenerate/`, { seat_blocks: seatBlocks });
}

export async function regenerateSimpleSeats(
    busId: Bus["id"],
    opts: { deck?: 1 | 2; kind?: SeatKind; count: number; start_number?: number }
) {
    const block: SeatBlock = {
        deck: opts.deck ?? 1,
        kind: opts.kind ?? "NORMAL",
        count: opts.count,
        ...(opts.start_number != null ? { start_number: opts.start_number } : {}),
    };
    return regenerateBusSeats(busId, [block]);
}
