// services/users.ts
import { api } from "./api";

// --- Roles ---
// El backend maneja ADMIN/VEND/CAJE. Para lectura necesitamos incluir ADMIN en el tipo.
// Para UI (selección) usualmente solo se asignan VEND/CAJE.
export type Role = "ADMIN" | "VEND" | "CAJE";
export type RoleUI = Exclude<Role, "ADMIN">;
export const ROLES: RoleUI[] = ["VEND", "CAJE"];

// Coincide con tu UserListSerializer (añadimos nombres, fechas y oficina)
export type User = {
    id: string | number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    role?: Role;
    active?: boolean;         // normalizado desde is_active
    is_active?: boolean;      // viene del backend
    date_joined?: string;
    last_login?: string | null;
    office?: number | null;       // id de la oficina
    office_name?: string | null;  // nombre de la oficina
};

export type ListUsersParams = { q?: string; page?: number; pageSize?: number };

// Página DRF por defecto
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

// ---- Helpers ----
const normalizeUser = (u: User): User => ({
    ...u,
    active:
        typeof u.active === "boolean"
            ? u.active
            : (u.is_active as boolean | undefined),
});

// Coerce office: "" -> null, "3" -> 3
const coerceOffice = (value: unknown): number | null | undefined => {
    if (value === "" || value === undefined) return null;
    if (value === null) return null;
    if (typeof value === "string") {
        const n = Number(value);
        return Number.isNaN(n) ? null : n;
    }
    if (typeof value === "number") return value;
    return undefined;
};

type UpsertUserBody = Partial<
    Pick<User, "username" | "email" | "role" | "first_name" | "last_name" | "office">
> & {
    password?: string;
    active?: boolean;     // front
    is_active?: boolean;  // opcional si ya lo traes “server-like”
};

const toServer = (body: UpsertUserBody) => {
    const { active, office, ...rest } = body;
    const payload: Record<string, any> = { ...rest };

    // DRF espera is_active
    if (typeof active === "boolean") payload.is_active = active;

    // Office limpio
    const officeFixed = coerceOffice(office);
    if (officeFixed !== undefined) payload.office = officeFixed;

    return payload;
};

// ---- Listado ----
export async function listUsers(params: ListUsersParams = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set("search", params.q);                          // DRF SearchFilter
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize)); // DRF PageNumberPagination
    qs.set("_", String(Date.now()));

    const data = await api.get<DRFPage<User> | User[]>(`/users/?${qs.toString()}`);

    if (Array.isArray(data)) {
        return { items: data.map(normalizeUser), total: data.length };
    } else {
        return { items: (data.results ?? []).map(normalizeUser), total: data.count ?? 0 };
    }
}

// ---- Obtener uno ----
export async function getUser(id: User["id"]) {
    const u = await api.get<User>(`/users/${id}/`);
    return normalizeUser(u);
}

// ---- Crear ----
export async function createUser(
    body: Pick<User, "username" | "email" | "role"> &
        Partial<Pick<User, "first_name" | "last_name" | "office">> & {
        password?: string;
        active?: boolean;
    }
) {
    const safeLog = { ...body, password: body.password ? "*** redacted ***" : undefined };
    console.log("[users.create] → request", { url: "/users/", method: "POST", body: safeLog });

    const u = await api.post<User>("/users/", toServer(body));
    const normalized = normalizeUser(u);

    console.log("[users.create] ← response (normalized)", normalized);
    return normalized;
}

// ---- Actualizar (PUT o PATCH) ----
export async function updateUser(
    id: User["id"],
    body: Partial<User> & { password?: string }
) {
    const safeBody: Record<string, any> = { ...body };
    if (typeof safeBody.password === "string" && safeBody.password.length > 0) {
        safeBody.password = "*** redacted ***";
    }

    const payload = toServer(body);
    console.log("[users.update] → request", {
        url: `/users/${id}/`,
        method: "PUT",
        id,
        body: safeBody,
        payloadSent: payload,
    });

    try {
        const res = await api.put<User>(`/users/${id}/`, payload);
        console.log("[users.update] ← response (raw)", res);
        const normalized = normalizeUser(res);
        console.log("[users.update] ← response (normalized)", normalized);
        return normalized;
    } catch (err) {
        console.error("[users.update] ✖ error", err);
        throw err;
    }
}

// ---- Eliminar ----
export async function deleteUser(id: User["id"]) {
    console.log("[users.delete] →", { url: `/users/${id}/`, method: "DELETE", id });
    await api.delete<void>(`/users/${id}/`);   // 👈 usa .delete (o api["delete"])
    console.log("[users.delete] ← ok");
    return { ok: true };
}

// ---- Admin: set password ----
export async function setUserPassword(id: User["id"], new_password: string) {
    console.log("[users.setPassword] →", { url: `/users/${id}/set-password/`, id });
    return api.post<{ detail: string }>(`/users/${id}/set-password/`, { new_password });
}
