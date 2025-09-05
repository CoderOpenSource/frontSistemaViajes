import { useEffect, useRef, useState } from "react";
import { sendChatMessage } from "../services/ai_chat";
import { MessageCircle, X, Send, ChevronDown } from "lucide-react";

type Msg = { role: "user" | "assistant"; content: string };

export default function ChatWidget() {
    const [open, setOpen] = useState(false);
    const [minimized, setMinimized] = useState(false);
    const [loading, setLoading] = useState(false);
    const [input, setInput] = useState("");
    const [messages, setMessages] = useState<Msg[]>([
        {
            role: "assistant",
            content:
                "¡Hola! Soy tu asistente de transporte 🚌. Puedo ayudarte con horarios, cambios, equipaje y precios. ¿En qué te ayudo?",
        },
    ]);

    // Refs
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    // Focus al abrir/expandir
    useEffect(() => {
        if (open && !minimized) inputRef.current?.focus();
    }, [open, minimized]);

    // Auto scroll al final (cuando cambian mensajes, al abrir o al expandir)
    useEffect(() => {
        if (!open || minimized) return;
        // usar rAF para esperar el render y tamaños finales
        requestAnimationFrame(() => {
            if (messagesEndRef.current) {
                messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
            } else if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
            }
        });
    }, [messages, open, minimized]);

    async function handleSend() {
        const text = input.trim();
        if (!text || loading) return;

        const next = [...messages, { role: "user", content: text } as Msg];
        setMessages(next);
        setInput("");
        setLoading(true);

        try {
            console.log("[CHAT_WIDGET] Enviando mensajes:", next);

            const reply = await sendChatMessage(
                next.map((m) => ({ role: m.role, content: m.content }))
            );

            console.log("[CHAT_WIDGET] Recibido reply:", reply);

            setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
        } catch (e) {
            console.error("[CHAT_WIDGET] Error al consultar IA:", e);
            setMessages((prev) => [
                ...prev,
                {
                    role: "assistant",
                    content:
                        "Lo siento, no pude responder ahora mismo. Intenta de nuevo en unos segundos.",
                },
            ]);
        } finally {
            setLoading(false);
        }
    }

    function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    }

    // Burbuja flotante cerrada
    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-4 right-4 z-[1000] inline-flex items-center gap-2 rounded-full bg-black px-4 py-3 text-white shadow-lg hover:opacity-90"
                aria-label="Abrir chat"
            >
                <MessageCircle className="h-5 w-5" />
                <span className="hidden sm:inline">Ayuda</span>
            </button>
        );
    }

    return (
        <div className="fixed bottom-4 right-4 z-[1000] w-[92vw] max-w-[360px]">
            {/* Caja del chat */}
            <div className="overflow-hidden rounded-2xl border bg-white shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <div className="flex items-center gap-2">
                        <div className="rounded-full bg-black p-1.5 text-white">
                            <MessageCircle className="h-4 w-4" />
                        </div>
                        <div>
                            <div className="text-sm font-semibold">Asistente IA</div>
                            <div className="text-[11px] text-gray-500">
                                Transporte · responde en español
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            className="rounded-md p-1.5 hover:bg-gray-100"
                            onClick={() => setMinimized((v) => !v)}
                            title={minimized ? "Expandir" : "Minimizar"}
                        >
                            <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                    minimized ? "-rotate-180" : "rotate-0"
                                }`}
                            />
                        </button>
                        <button
                            className="rounded-md p-1.5 hover:bg-gray-100"
                            onClick={() => setOpen(false)}
                            title="Cerrar"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {/* Body */}
                {!minimized && (
                    <>
                        <div
                            ref={containerRef}
                            className="max-h-[50vh] space-y-2 overflow-y-auto px-3 py-3"
                        >
                            {messages.map((m, idx) => (
                                <Bubble key={idx} role={m.role} text={m.content} />
                            ))}
                            {loading && <Bubble role="assistant" text="Escribiendo…" thinking />}
                            {/* ancla para scroll al final */}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Input */}
                        <div className="border-t p-2">
                            <div className="flex items-end gap-2">
                <textarea
                    ref={inputRef}
                    rows={1}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Escribe tu mensaje… (Enter para enviar)"
                    className="max-h-28 w-full resize-none rounded-xl border px-3 py-2 text-sm focus:outline-none"
                />
                                <button
                                    onClick={handleSend}
                                    disabled={loading || !input.trim()}
                                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
                                >
                                    <Send className="h-4 w-4" />
                                </button>
                            </div>
                            <p className="mt-1 text-[10px] text-gray-500">
                                Shift+Enter para salto de línea.
                            </p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function Bubble({
                    role,
                    text,
                    thinking,
                }: {
    role: "user" | "assistant";
    text: string;
    thinking?: boolean;
}) {
    const isUser = role === "user";
    return (
        <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
            <div
                className={[
                    "max-w-[85%] rounded-2xl px-3 py-2 text-sm",
                    isUser ? "bg-black text-white" : "bg-gray-100 text-gray-900",
                ].join(" ")}
            >
                {thinking ? (
                    <span className="inline-flex items-center gap-1">
            <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:-0.2s]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-gray-400 [animation-delay:0.2s]" />
          </span>
                ) : (
                    text
                )}
            </div>
        </div>
    );
}
