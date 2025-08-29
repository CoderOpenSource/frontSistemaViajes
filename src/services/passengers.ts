// services/passengers.ts
import { api } from "./api";

// ----------- Tipos -----------
export type DocType = "CI" | "PASAPORTE" | "OTRO";

export type Passenger = {
    id: string;                 // UUID
    tipo_doc: DocType;
    nro_doc: string;
    nombres: string;
    apellidos?: string | null;
    fecha_nac?: string | null;  // YYYY-MM-DD
    telefono?: string | null;
    email?: string | null;
    activo?: boolean;
    creado_en?: string;
    es_menor?: boolean;         // read_only del backend
    apoderados_list?: Array<Pick<Passenger, "id" | "nombres" | "apellidos" | "tipo_doc" | "nro_doc">>;
};

export type PassengerRelation = {
    id: number;
    menor: string;              // UUID
    apoderado: string;          // UUID
    parentesco?: string | null;
    es_tutor_legal?: boolean;
    vigente_desde?: string | null;
    vigente_hasta?: string | null;
    observaciones?: string | null;
    menor_det?: Pick<Passenger, "id" | "nombres" | "apellidos" | "tipo_doc" | "nro_doc">;
    apoderado_det?: Pick<Passenger, "id" | "nombres" | "apellidos" | "tipo_doc" | "nro_doc">;
};

export type ListParams = { q?: string; page?: number; pageSize?: number; activo?: boolean };
type DRFPage<T> = { count: number; next: string | null; previous: string | null; results: T[] };

// ----------- Helpers -----------
const normalizePassenger = (p: Passenger): Passenger => ({ ...p });

// ----------- Pasajeros -----------
export async function listPassengers(params: ListParams = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("search", params.q);               // DRF SearchFilter
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));
    if (typeof params.activo === "boolean") qs.set("activo", String(params.activo));
    qs.set("_", String(Date.now()));

    const data = await api.get<DRFPage<Passenger> | Passenger[]>(`/passengers/?${qs.toString()}`);
    if (Array.isArray(data)) {
        return { items: data.map(normalizePassenger), total: data.length };
    } else {
        return { items: (data.results ?? []).map(normalizePassenger), total: data.count ?? 0 };
    }
}

// endpoint dedicado (action) /passengers/search/?q=
export async function searchPassengers(q: string, limit = 10) {
    const qs = new URLSearchParams({ q, page_size: String(limit), _: String(Date.now()) });
    const data = await api.get<Passenger[] | DRFPage<Passenger>>(`/passengers/search/?${qs.toString()}`);
    return Array.isArray(data)
        ? data.map(normalizePassenger)
        : (data.results ?? []).map(normalizePassenger);
}

export async function getPassenger(id: Passenger["id"]) {
    const p = await api.get<Passenger>(`/passengers/${id}/`);
    return normalizePassenger(p);
}

type UpsertPassenger = Partial<
    Pick<
        Passenger,
        "tipo_doc" | "nro_doc" | "nombres" | "apellidos" |
        "fecha_nac" | "telefono" | "email" | "activo"
    >
>;

export async function createPassenger(body: UpsertPassenger) {
    const res = await api.post<Passenger>("/passengers/", body);
    return normalizePassenger(res);
}

export async function updatePassenger(id: Passenger["id"], body: UpsertPassenger) {
    const res = await api.put<Passenger>(`/passengers/${id}/`, body);
    return normalizePassenger(res);
}

export async function deletePassenger(id: Passenger["id"]) {
    await api.delete<void>(`/passengers/${id}/`);
    return { ok: true };
}

// ----------- Relaciones menor ↔ apoderado -----------
type ListRelationsParams = { menor?: string; apoderado?: string; page?: number; pageSize?: number };

export async function listRelations(params: ListRelationsParams = {}) {
    const qs = new URLSearchParams();
    if (params.menor) qs.set("menor", params.menor);
    if (params.apoderado) qs.set("apoderado", params.apoderado);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));
    qs.set("_", String(Date.now()));

    const data = await api.get<DRFPage<PassengerRelation> | PassengerRelation[]>(
        `/relations/?${qs.toString()}`
    );

    if (Array.isArray(data)) return { items: data, total: data.length };
    return { items: data.results ?? [], total: data.count ?? 0 };
}

export async function createRelation(body: Pick<PassengerRelation, "menor" | "apoderado"> & Partial<PassengerRelation>) {
    return api.post<PassengerRelation>("/relations/", body);
}

export async function deleteRelation(id: PassengerRelation["id"]) {
    await api.delete<void>(`/relations/${id}/`);
    return { ok: true };
}

// ----------- Helper: crear menor + (crear/seleccionar) apoderado + relación -----------
type GuardianDraft = Pick<UpsertPassenger, "tipo_doc" | "nro_doc" | "nombres" | "apellidos" | "telefono" | "email">;

// ----------- Helper: crear menor + apoderado (transacción en backend) -----------

/**
 * Usa el endpoint dedicado en backend que crea menor + apoderado + relación
 * en una sola transacción (más seguro).
 */
export async function createMinorWithGuardianTx(args: {
    menor: {
        tipo_doc: DocType;
        nro_doc: string;
        nombres: string;
        apellidos?: string;
        fecha_nac: string;
        telefono?: string;
        email?: string;
        activo?: boolean;
    };
    apoderado: {
        tipo_doc: DocType;
        nro_doc: string;
        nombres: string;
        apellidos?: string;
        telefono?: string;
        email?: string;
        activo?: boolean;
    };
    parentesco?: string;
    es_tutor_legal?: boolean;
}) {
    const res = await api.post<Passenger>("/passengers/crear-menor-con-apoderado/", args);
    return normalizePassenger(res);
}

