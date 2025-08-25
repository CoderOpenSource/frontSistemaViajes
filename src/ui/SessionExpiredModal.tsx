// ui/SessionExpiredModal.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { onSessionExpired } from "./sessionExpiredBus";
import { logout } from "../services/auth";

export default function SessionExpiredModal() {
    const [open, setOpen] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const off = onSessionExpired(() => setOpen(true));
        return () => { off(); };            // 👈 cleanup que retorna void
    }, []);

    const goToLogin = async () => {
        try { await logout(); } catch {}
        setOpen(false);
        navigate("/login", { replace: true });
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Sesión expirada</h3>
                    <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setOpen(false)} aria-label="Cerrar">✕</button>
                </div>

                <div className="mt-3 flex items-start gap-3 text-sm text-gray-700">
                    <svg className="h-5 w-5 text-red-600 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="10" strokeWidth="1.5" />
                        <path d="M12 7v6m0 4h.01" strokeWidth="1.5" />
                    </svg>
                    <p>Tu sesión ha expirado o no es válida. Por favor vuelve a iniciar sesión para continuar.</p>
                </div>

                <div className="mt-4 flex justify-end gap-2">
                    <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setOpen(false)}>
                        Cerrar
                    </button>
                    <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm bg-black text-white hover:opacity-90" onClick={goToLogin}>
                        Iniciar sesión
                    </button>
                </div>
            </div>
        </div>
    );
}
