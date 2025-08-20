import { api } from "./api.ts";

export type LoginInput = { email: string; password: string };
export type User = { id: string; name: string; email: string; role?: string };

// Ajusta los paths a tu backend si son distintos
export async function login(input: LoginInput) {
    // Espera algo como { user, token? }
    return api.post<{ user: User; token?: string }>("/auth/login", input);
}

export async function logout() {
    await api.post("/auth/logout");
}

export async function me() {
    // Devuelve null si no hay sesión
    try {
        const { user } = await api.get<{ user: User }>("/auth/me");
        return user;
    } catch {
        return null;
    }
}
