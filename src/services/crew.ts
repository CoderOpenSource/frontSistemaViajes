// services/crew.ts
import { api } from "./api";

// ---- Roles disponibles (en el backend) ----
export type CrewRole = "DRIVER" | "ASSISTANT";

// ---- Tipos del backend (CrewMemberSerializer) ----
export type CrewMember = {
    id: number | string;
    code: string;               // generado por el backend (EMP-0001, etc.)
    first_name: string;
    last_name: string;
    full_name?: string;
    national_id?: string | null;
    phone?: string | null;
    address?: string | null;
    birth_date?: string | null; // ISO YYYY-MM-DD
    role: CrewRole;
    role_display?: string;      // read-only

    // NUEVOS (por FK a Office)
    office?: number | null;         // id (editable)
    office_code?: string | null;    // read-only
    office_name?: string | null;    // read-only

    photo?: string | null;      // URL (Cloudinary)
    active: boolean;

    created_at?: string;        // ISO
    updated_at?: string;        // ISO
};

// Página DRF por defecto
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

export type ListCrewParams = {
    q?: string;
    page?: number;
    pageSize?: number;

    active?: boolean;
    code?: string;
    national_id?: string;
    role?: CrewRole;
    office?: number | string; // 👈 NUEVO (exact)

    first_name?: string;
    last_name?: string;

    ordering?: string; // code, -code, first_name, -first_name, last_name, created_at, -created_at, role, -role
};

// ---- Helpers ----
const BASE = "/catalog/crew/";

// Limpia strings vacíos -> undefined (para no enviar "")
const clean = (v?: string | null) => {
    const s = (v ?? "").trim();
    return s.length ? s : undefined;
};

// Util: construye FormData para multipart si hay photo File/Blob
export type UpsertCrewBody = Partial<
    Pick<
        CrewMember,
        | "first_name"
        | "last_name"
        | "national_id"
        | "phone"
        | "address"
        | "birth_date"
        | "role"
        | "active"
        | "office"     // 👈 NUEVO
    >
> & {
    photo?: File | Blob | null;
};

function toFormData(body: UpsertCrewBody) {
    const fd = new FormData();
    if (body.first_name != null) fd.append("first_name", String(body.first_name));
    if (body.last_name != null)  fd.append("last_name", String(body.last_name));
    if (clean(body.national_id)) fd.append("national_id", String(clean(body.national_id)));
    if (clean(body.phone))       fd.append("phone", String(clean(body.phone)));
    if (clean(body.address))     fd.append("address", String(clean(body.address)));
    if (body.birth_date != null) fd.append("birth_date", String(body.birth_date));
    if (body.role != null)       fd.append("role", String(body.role));
    if (body.active != null)     fd.append("active", body.active ? "true" : "false");
    if (body.office != null)     fd.append("office", String(body.office)); // 👈 incluye oficina

    if (body.photo instanceof Blob) fd.append("photo", body.photo);        // File | Blob
    return fd;
}

function needsMultipart(body: UpsertCrewBody) {
    return body.photo instanceof Blob;
}

// ---- Listado ----
export async function listCrew(params: ListCrewParams = {}) {
    const qs = new URLSearchParams();

    if (params.q) qs.set("search", params.q);
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));

    if (typeof params.active === "boolean") qs.set("active", String(params.active));
    if (params.code) qs.set("code__icontains", params.code);
    if (params.national_id) qs.set("national_id__icontains", params.national_id);
    if (params.role) qs.set("role", params.role);               // exact
    if (params.office != null) qs.set("office", String(params.office)); // 👈 exact

    // nombres via search
    if (params.first_name) {
        const current = qs.get("search");
        qs.set("search", current ? `${current} ${params.first_name}` : params.first_name);
    }
    if (params.last_name) {
        const current = qs.get("search");
        qs.set("search", current ? `${current} ${params.last_name}` : params.last_name);
    }

    if (params.ordering) qs.set("ordering", params.ordering);

    // cache-bust opcional
    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<CrewMember> | CrewMember[]>(url);

    if (Array.isArray(data)) {
        return { items: data, total: data.length };
    } else {
        return { items: data.results ?? [], total: Number(data.count ?? 0) };
    }
}

// ---- Obtener uno ----
export async function getCrew(id: CrewMember["id"]) {
    return api.get<CrewMember>(`${BASE}${id}/`);
}

// ---- Crear ----
export async function createCrew(body: UpsertCrewBody) {
    console.log("📤 createCrew() payload recibido:", body);

    if (needsMultipart(body)) {
        const fd = toFormData(body);

        // log legible del FormData
        for (const [key, value] of fd.entries()) {
            console.log("FormData ->", key, value);
        }

        return api.post<CrewMember>(BASE, fd);
    }

    // JSON: limpia campos vacíos para no mandar ""
    const { photo, ...rest } = body;
    const json = {
        ...rest,
        national_id: clean(rest.national_id),
        phone:       clean(rest.phone),
        address:     clean(rest.address),
    };

    console.log("JSON ->", json);
    return api.post<CrewMember>(BASE, json as any);
}

// ---- Actualizar ----
export async function updateCrew(
    id: CrewMember["id"],
    body: UpsertCrewBody,
    opts?: { partial?: boolean }
) {
    const method = opts?.partial ? api.patch : api.put;

    if (needsMultipart(body)) {
        const fd = toFormData(body);
        return method<CrewMember>(`${BASE}${id}/`, fd as any);
    }

    const { photo, ...rest } = body;
    const json = {
        ...rest,
        national_id: clean(rest.national_id),
        phone:       clean(rest.phone),
        address:     clean(rest.address),
    };

    return method<CrewMember>(`${BASE}${id}/`, json as any);
}

// ---- Eliminar ----
export async function deleteCrew(id: CrewMember["id"]) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}

// Conveniencia: drivers activos (id + "CODE — Nombre")
export async function listActiveDriversLite() {
    const { items } = await listCrew({
        role: "DRIVER",
        q: "",
        page: 1,
        pageSize: 200,
        // si quieres forzar solo activos:
        active: true,
        ordering: "code",
    });
    return items.map((c) => ({
        id: c.id,
        label: `${c.code} — ${c.first_name} ${c.last_name ?? ""}`.trim(),
    }));
}
