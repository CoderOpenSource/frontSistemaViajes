// services/auth.ts
import { api } from "./api";
import {
    saveSession,
    clearSession,
    getStoredUser,
    setStoredUser,
    isAuthenticated as storageIsAuthenticated,
} from "./storage";

// ===== Tipos =====
export type User = {
    id: string;
    username: string;
    email: string;
    role?: string;
    must_change_password?: boolean;
};

export type LoginInput = { email: string; password: string };
export type LoginResponse = { access: string; refresh: string; user: User };

// ===== Auth API =====

// POST /auth/login → { access, refresh, user }
export async function login(input: LoginInput): Promise<LoginResponse> {
    const data = await api.post<LoginResponse>("/auth/login", input);
    // Guarda tokens + usuario en storage
    console.log(data.user);
    saveSession(data.access, data.refresh, data.user);
    return data;
}

// (Opcional) POST /auth/logout en servidor; aquí limpiamos el front siempre
export async function logout(): Promise<void> {
    // Si tienes endpoint en backend, puedes descomentar:
    // try { await api.post("/auth/logout"); } catch {}
    clearSession();
}

// GET /auth/me → { user }
export async function me(): Promise<User | null> {
    try {
        const { user } = await api.get<{ user: User }>("/auth/me");
        setStoredUser(user); // sincroniza cache local
        return user;
    } catch {
        // Si el token expiró o hay error de red, devuelve lo último que tengamos cacheado
        return getStoredUser();
    }
}

// ===== Conveniencias (re-export) =====
export function isAuthenticated(): boolean {
    return storageIsAuthenticated();
}

export function getCurrentUser(): User | null {
    return getStoredUser();
}

