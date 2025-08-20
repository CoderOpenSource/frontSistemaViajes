// services/api.ts
const RAW_API_URL = import.meta.env.VITE_API_URL ?? "";
const API_URL = RAW_API_URL.replace(/\/+$/, ""); // sin slash final

if (!API_URL) throw new Error("Falta VITE_API_URL en .env");

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export type ApiError = Error & { status?: number; data?: unknown };

type RequestOpts = {
    method?: HttpMethod;
    body?: unknown;
    headers?: Record<string, string>;
    credentials?: RequestCredentials;      // "include" | "same-origin" | "omit"
    timeoutMs?: number;                    // default 15000
    authToken?: string | null;             // si usas Bearer
};

function buildUrl(path: string) {
    const p = path.startsWith("/") ? path : `/${path}`;
    return `${API_URL}${p}`;
}

async function parseResponse(res: Response) {
    if (res.status === 204) return null;
    const ctype = res.headers.get("content-type") || "";
    const text = await res.text();
    if (!text) return null;
    if (ctype.includes("application/json")) {
        try { return JSON.parse(text); } catch { return text; }
    }
    return text;
}

async function request<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    const {
        method = "GET",
        body,
        headers = {},
        credentials = "include",           // ⬅ por defecto incluye cookies (cámbialo si no usas sesiones)
        timeoutMs = 15000,
        authToken = null,
    } = opts;

    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    const finalHeaders: Record<string, string> = { ...headers };
    if (body !== undefined && finalHeaders["Content-Type"] === undefined) {
        finalHeaders["Content-Type"] = "application/json";
    }
    if (authToken) {
        finalHeaders["Authorization"] = `Bearer ${authToken}`;
    }

    let data: unknown;
    try {
        const res = await fetch(buildUrl(path), {
            method,
            headers: finalHeaders,
            credentials,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            signal: controller.signal,
        });
        data = await parseResponse(res);

        if (!res.ok) {
            const err: ApiError = new Error(
                (data as any)?.message || (data as any)?.error || `HTTP ${res.status}`
            );
            err.status = res.status;
            err.data = data;
            throw err;
        }
        return data as T;
    } catch (e: any) {
        if (e.name === "AbortError") {
            const err: ApiError = new Error("Tiempo de espera agotado");
            err.status = 0;
            throw err;
        }
        throw e;
    } finally {
        clearTimeout(t);
    }
}

export const api = {
    get:   <T>(path: string, opts?: Omit<RequestOpts, "method" | "body">) => request<T>(path, { ...opts, method: "GET" }),
    post:  <T>(path: string, body?: unknown, opts?: Omit<RequestOpts, "method" | "body">) => request<T>(path, { ...opts, method: "POST", body }),
    put:   <T>(path: string, body?: unknown, opts?: Omit<RequestOpts, "method" | "body">) => request<T>(path, { ...opts, method: "PUT", body }),
    patch: <T>(path: string, body?: unknown, opts?: Omit<RequestOpts, "method" | "body">) => request<T>(path, { ...opts, method: "PATCH", body }),
    delete:<T>(path: string, opts?: Omit<RequestOpts, "method" | "body">) => request<T>(path, { ...opts, method: "DELETE" }),
};
