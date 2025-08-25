// services/licenses.ts
import { api } from "./api";

// ---- Tipos del backend (DriverLicenseSerializer) ----
export type DriverLicense = {
    id: number | string;

    // FK
    crew_member: number | string;   // editable
    crew_code?: string;             // read-only
    crew_name?: string;             // read-only
    crew_role?: "DRIVER" | "ASSISTANT"; // read-only (útil para validar en UI)

    // Datos de licencia
    number: string;
    category?: string | null;
    issued_at?: string | null;      // ISO YYYY-MM-DD
    expires_at?: string | null;     // ISO YYYY-MM-DD

    // Imágenes (URLs al leer)
    front_image?: string | null;
    back_image?: string | null;

    active: boolean;
    notes?: string | null;
};

// Página DRF por defecto
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type ListLicenseParams = {
    q?: string;                 // SearchFilter: number, category, crew_member__code, first_name, last_name
    page?: number;
    pageSize?: number;

    // filterset_fields del ViewSet
    crew_member?: number | string;         // ?crew_member=ID
    crew_member_role?: "DRIVER" | "ASSISTANT"; // ?crew_member__role=DRIVER
    number?: string;                       // ?number / ?number__icontains
    active?: boolean;                      // exact

    issued_gte?: string;   // ?issued_at__gte
    issued_lte?: string;   // ?issued_at__lte
    expires_gte?: string;  // ?expires_at__gte
    expires_lte?: string;  // ?expires_at__lte

    ordering?: string;     // "-expires_at", "issued_at", "number", "active", "id"
};

// ---- Helpers ----
const BASE = "/catalog/licenses/";

// Limpia strings vacíos -> undefined
const clean = (v?: string | null) => {
    const s = (v ?? "").trim();
    return s.length ? s : undefined;
};

// Cuerpo para crear/actualizar
export type UpsertLicenseBody = Partial<
    Pick<
        DriverLicense,
        | "crew_member"
        | "number"
        | "category"
        | "issued_at"
        | "expires_at"
        | "active"
        | "notes"
    >
> & {
    // Enviar solo si subes archivo nuevo
    front_image?: File | Blob | null;
    back_image?: File | Blob | null;
};

function toFormData(body: UpsertLicenseBody) {
    const fd = new FormData();

    if (body.crew_member != null) fd.append("crew_member", String(body.crew_member));
    if (clean(body.number))       fd.append("number", String(clean(body.number)));
    if (clean(body.category))     fd.append("category", String(clean(body.category)));
    if (body.issued_at != null)   fd.append("issued_at", String(body.issued_at));
    if (body.expires_at != null)  fd.append("expires_at", String(body.expires_at));
    if (body.active != null)      fd.append("active", body.active ? "true" : "false");
    if (clean(body.notes))        fd.append("notes", String(clean(body.notes)));

    if (body.front_image instanceof Blob) fd.append("front_image", body.front_image);
    if (body.back_image  instanceof Blob) fd.append("back_image",  body.back_image);

    return fd;
}

function needsMultipart(body: UpsertLicenseBody) {
    return body.front_image instanceof Blob || body.back_image instanceof Blob;
}

// ---- Listado ----
export async function listLicenses(params: ListLicenseParams = {}) {
    const qs = new URLSearchParams();

    if (params.q) qs.set("search", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));

    if (params.crew_member != null) qs.set("crew_member", String(params.crew_member));
    if (params.crew_member_role)    qs.set("crew_member__role", params.crew_member_role);

    if (params.number) qs.set("number__icontains", params.number);
    if (typeof params.active === "boolean") qs.set("active", String(params.active));

    if (params.issued_gte)  qs.set("issued_at__gte", params.issued_gte);
    if (params.issued_lte)  qs.set("issued_at__lte", params.issued_lte);
    if (params.expires_gte) qs.set("expires_at__gte", params.expires_gte);
    if (params.expires_lte) qs.set("expires_at__lte", params.expires_lte);

    if (params.ordering) qs.set("ordering", params.ordering);

    // cache-bust opcional
    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<DriverLicense> | DriverLicense[]>(url);

    if (Array.isArray(data)) {
        return { items: data, total: data.length };
    } else {
        return { items: data.results ?? [], total: Number(data.count ?? 0) };
    }
}

// ---- Obtener una ----
export async function getLicense(id: DriverLicense["id"]) {
    return api.get<DriverLicense>(`${BASE}${id}/`);
}

// ---- Crear ----
export async function createLicense(body: UpsertLicenseBody) {
    // Si subes alguna imagen, usamos multipart
    if (needsMultipart(body)) {
        const fd = toFormData(body);

        // Debug opcional
        // for (const [k, v] of fd.entries()) console.log("License FormData ->", k, v);

        return api.post<DriverLicense>(BASE, fd);
    }

    // JSON (sin archivos)
    const { front_image, back_image, ...rest } = body;
    const json = {
        ...rest,
        number:   clean(rest.number),
        category: clean(rest.category),
        notes:    clean(rest.notes),
    };
    return api.post<DriverLicense>(BASE, json as any);
}

// ---- Actualizar ----
export async function updateLicense(
    id: DriverLicense["id"],
    body: UpsertLicenseBody,
    opts?: { partial?: boolean }
) {
    const method = opts?.partial ? api.patch : api.put;

    if (needsMultipart(body)) {
        const fd = toFormData(body);
        return method<DriverLicense>(`${BASE}${id}/`, fd as any);
    }

    const { front_image, back_image, ...rest } = body;
    const json = {
        ...rest,
        number:   clean(rest.number),
        category: clean(rest.category),
        notes:    clean(rest.notes),
    };
    return method<DriverLicense>(`${BASE}${id}/`, json as any);
}

// ---- Eliminar ----
export async function deleteLicense(id: DriverLicense["id"]) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}
