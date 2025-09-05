// src/services/ai_chat.ts
import { api } from "./api";

/** Envía todo el historial al backend y devuelve el último reply */
export async function sendChatMessage(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>
): Promise<string> {
    const body = { messages };
    console.log("[AI_CHAT] → request body", body);

    // OJO: api.post devuelve data (payload), NO AxiosResponse
    const data = await api.post("/ai/chat/", body);

    console.log("[AI_CHAT] ← response data", data);

    const reply = (data?.reply ?? "").toString();
    if (!reply) {
        console.warn("[AI_CHAT] Respuesta sin 'reply' en /ai/chat/");
        throw new Error("Respuesta vacía del asistente");
    }
    return reply;
}
