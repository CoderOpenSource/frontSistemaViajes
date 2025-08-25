// services/api.ts
import { getAccessToken, getRefreshToken, saveSession, clearSession } from "./storage";
import { triggerSessionExpired } from "../ui/sessionExpiredBus";

const RAW_API_URL = import.meta.env.VITE_API_URL ?? "";
const API_URL = RAW_API_URL.replace(/\/+$/, "");
if (!API_URL) throw new Error("Falta VITE_API_URL en .env");

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type ApiError = Error & { status?: number; data?: unknown };

type RequestOpts = {
    method?: HttpMethod;
    body?: any;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;
    timeoutMs?: number;
    authToken?: string | null;
};

function buildUrl(path: string) {
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${API_URL}${p}`;
}

function isAuthPublic(path: string) {
    const p = path.toLowerCase();
    return (
        p.startsWith("/auth/login") ||
        p.startsWith("/auth/register") ||
        p.startsWith("/auth/refresh") ||
        p.startsWith("/token/refresh")
    );
}

async function parseResponse(res: Response) {
    if (res.status === 204) return null;
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!text) return null;
    if (ctype.includes("application/json")) {
        try {
            return JSON.parse(text);
        } catch {
            return text;
        }
    }
    return text;
}

function buildApiError(status: number, data: unknown): ApiError {
    const err: ApiError = new Error(
        (data as any)?.detail ||
        (data as any)?.message ||
        (data as any)?.error ||
        `HTTP ${status}`
    );
    err.status = status;
    err.data = data;
    return err;
}

// ---------- helpers para body/headers ----------
const isFormData = (b: any): b is FormData =>
    typeof FormData !== "undefined" && b instanceof FormData;
const isURLSearchParams = (b: any): b is URLSearchParams =>
    typeof URLSearchParams !== "undefined" && b instanceof URLSearchParams;
const isRawSendable = (b: any) =>
    b instanceof Blob || b instanceof ArrayBuffer || typeof b === "string";

/** Decide Content-Type. Si es FormData, NO lo seteamos (el browser pone boundary). */
function buildHeaders(
    base: Record<string, string> | undefined,
    body: any
): Record<string, string> {
    const h: Record<string, string> = { ...(base || {}) };
    if (h["Content-Type"]) return h; // se respeta lo que pase el caller

    if (isFormData(body)) {
        // nada
    } else if (isURLSearchParams(body)) {
        h["Content-Type"] = "application/x-www-form-urlencoded;charset=UTF-8";
    } else if (isRawSendable(body)) {
        // Blob/ArrayBuffer/string -> el browser infiere o ya es texto plano
    } else if (body !== undefined) {
        h["Content-Type"] = "application/json";
    }
    return h;
}

/** Serializa body según tipo. */
function buildBody(body: any) {
    if (body === undefined) return undefined;
    if (isFormData(body) || isURLSearchParams(body) || isRawSendable(body)) return body;
    // objeto -> JSON
    return JSON.stringify(body);
}

// ====== refresh SimpleJWT ======
async function tryRefreshToken(): Promise<boolean> {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
        const res = await fetch(buildUrl("/token/refresh/"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "omit",
            body: JSON.stringify({ refresh }),
        });
        const data = await parseResponse(res);
        if (!res.ok) return false;
        const access = (data as any)?.access;
        if (!access) return false;
        saveSession(access, refresh);
        return true;
    } catch {
        clearSession();
        return false;
    }
}

let sessionExpiredShown = false;
function showSessionExpiredOnce() {
    if (sessionExpiredShown) return;
    sessionExpiredShown = true;
    try {
        triggerSessionExpired();
    } finally {
        setTimeout(() => {
            sessionExpiredShown = false;
        }, 2000);
    }
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    const {
        method = "GET",
        body,
        headers,
        credentials = "omit",
        timeoutMs = 15000,
        authToken = null,
    } = opts;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    // 🔐 auth header (excepto rutas públicas)
    const shouldAttachAuth = !isAuthPublic(path);
    const token = shouldAttachAuth ? (authToken ?? getAccessToken()) : null;

    const finalHeaders = buildHeaders(
        {
            ...(headers || {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            Accept: (headers?.Accept as string) || "application/json, */*",
        },
        body
    );

    const makeFetch = () =>
        fetch(buildUrl(path), {
            method,
            headers: finalHeaders,
            credentials,
            body: buildBody(body),
            signal: controller.signal,
        });

    try {
        // 1º intento
        let res = await makeFetch();
        let data = await parseResponse(res);

        // 401 -> reintenta tras refresh (si es ruta con auth)
        if (res.status === 401 && shouldAttachAuth) {
            const refreshed = await tryRefreshToken();
            if (refreshed) {
                const retryHeaders = buildHeaders(
                    {
                        ...(headers || {}),
                        Authorization: `Bearer ${getAccessToken()}`,
                        Accept: (headers?.Accept as string) || "application/json, */*",
                    },
                    body
                );
                res = await fetch(buildUrl(path), {
                    method,
                    headers: retryHeaders,
                    credentials,
                    body: buildBody(body), // reusamos body tal cual
                    signal: controller.signal,
                });
                data = await parseResponse(res);
            } else {
                clearSession();
                showSessionExpiredOnce();
                throw buildApiError(401, data);
            }
        }

        if (!res.ok) throw buildApiError(res.status, data);
        return data as T;
    } catch (e: any) {
        if (e.name === "AbortError") throw buildApiError(0, "Tiempo de espera agotado");
        throw e;
    } finally {
        clearTimeout(t);
    }
}

export const api = {
    get:   <T>(path: string, opts?: Omit<RequestOpts, "method" | "body">) =>
        request<T>(path, { ...opts, method: "GET" }),
    post:  <T>(path: string, body?: any, opts?: Omit<RequestOpts, "method" | "body">) =>
        request<T>(path, { ...opts, method: "POST", body }),
    put:   <T>(path: string, body?: any, opts?: Omit<RequestOpts, "method" | "body">) =>
        request<T>(path, { ...opts, method: "PUT", body }),
    patch: <T>(path: string, body?: any, opts?: Omit<RequestOpts, "method" | "body">) =>
        request<T>(path, { ...opts, method: "PATCH", body }),
    delete:<T>(path: string, opts?: Omit<RequestOpts, "method" | "body">) =>
        request<T>(path, { ...opts, method: "DELETE" }),
    del:   <T>(path: string, opts?: Omit<RequestOpts, "method" | "body">) =>
        request<T>(path, { ...opts, method: "DELETE" }),
};
