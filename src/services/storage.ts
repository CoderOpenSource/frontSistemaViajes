// services/storage.ts

// Usa un namespace por si convives con otras apps en el mismo dominio
const NS = "so"; // Serrano del Oriente

const ACCESS_KEY  = `${NS}:auth:access`;
const REFRESH_KEY = `${NS}:auth:refresh`;
const USER_KEY    = `${NS}:auth:user`;

// Pequeña utilidad por si algún día renderizas en SSR
const safeLocalStorage = typeof window !== "undefined" ? window.localStorage : null;

export type StoredUser = {
    id: string;
    username: string;
    email: string;
    role?: string;
    must_change_password?: boolean;
};

// ---------- Tokens ----------
export const getAccessToken  = (): string | null =>
    safeLocalStorage?.getItem(ACCESS_KEY) ?? null;

export const getRefreshToken = (): string | null =>
    safeLocalStorage?.getItem(REFRESH_KEY) ?? null;

export const setTokens = (access: string, refresh: string) => {
    safeLocalStorage?.setItem(ACCESS_KEY, access);
    safeLocalStorage?.setItem(REFRESH_KEY, refresh);
};

// ---------- Usuario ----------
export const getStoredUser = (): StoredUser | null => {
    const raw = safeLocalStorage?.getItem(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as StoredUser; } catch { return null; }
};

export const setStoredUser = (user: StoredUser) => {
    safeLocalStorage?.setItem(USER_KEY, JSON.stringify(user));
};

// ---------- Sesión ----------
export const saveSession = (access: string, refresh: string, user?: StoredUser) => {
    setTokens(access, refresh);
    if (user) setStoredUser(user);
};

export const clearSession = () => {
    safeLocalStorage?.removeItem(ACCESS_KEY);
    safeLocalStorage?.removeItem(REFRESH_KEY);
    safeLocalStorage?.removeItem(USER_KEY);
};

// Conveniencias
export const isAuthenticated = (): boolean => !!getAccessToken();
