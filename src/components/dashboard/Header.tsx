import { useEffect, useRef, useState } from "react";
import type { StoredUser } from "../../services/storage";
import { getStoredUser, clearSession, isAuthenticated } from "../../services/storage";

type Props = { onToggleSidebar: () => void };

export default function Header({ onToggleSidebar }: Props) {
    const [user, setUser] = useState<StoredUser | null>(null);
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        setUser(getStoredUser());
    }, []);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    useEffect(() => {
        const onClick = (e: MouseEvent) => {
            const t = e.target as Node;
            if (!menuRef.current || !btnRef.current) return;
            if (!menuRef.current.contains(t) && !btnRef.current.contains(t)) setOpen(false);
        };
        document.addEventListener("click", onClick);
        return () => document.removeEventListener("click", onClick);
    }, []);

    const handleLogout = () => {
        clearSession();
        window.location.href = "/login";
    };

    return (
        <header className="sticky top-0 z-40 border-b bg-white">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
                {/* Izquierda */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onToggleSidebar}
                        className="rounded-lg border p-2 md:hidden"
                        aria-label="Abrir menú lateral"
                    >
                        <span className="text-lg">☰</span>
                    </button>
                    <a href="/" className="flex items-center gap-2 font-semibold">
                        <span className="grid h-8 w-8 place-content-center rounded-xl bg-black text-white">SO</span>
                        <span className="hidden sm:block">Serrano del Oriente</span>
                    </a>
                </div>

                {/* Centro */}
                <nav className="hidden md:flex items-center gap-6 text-sm">
                    <a className="text-gray-600 hover:text-gray-900" href="#">Ayuda</a>
                    <a className="text-gray-600 hover:text-gray-900" href="#">Soporte</a>
                </nav>

                {/* Derecha */}
                <div className="relative flex items-center gap-2 sm:gap-3">
                    {/* Username a la izquierda del icono */}
                    <span className="text-xs sm:text-sm text-gray-700 max-w-[12ch] truncate">
            {user?.username ?? "Invitado"}
          </span>

                    {/* Botón de perfil */}
                    <button
                        ref={btnRef}
                        onClick={() => setOpen((v) => !v)}
                        className="grid h-9 w-9 place-content-center rounded-full border hover:bg-gray-50 transition"
                        aria-label="Abrir menú de cuenta"
                        aria-haspopup="menu"
                        aria-expanded={open}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path strokeWidth="1.5" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z"/>
                            <path strokeWidth="1.5" d="M4 20a8 8 0 0 1 16 0"/>
                        </svg>
                    </button>

                    {open && (
                        <div
                            ref={menuRef}
                            role="menu"
                            className="absolute right-0 top-11 w-48 overflow-hidden rounded-xl border bg-white shadow-lg"
                        >
                            <div className="px-3 py-2 border-b">
                                <p className="text-sm font-medium text-gray-900 truncate">{user?.username ?? "Invitado"}</p>
                                {user?.email && <p className="text-xs text-gray-500 truncate">{user.email}</p>}
                            </div>

                            <a
                                role="menuitem"
                                href="/perfil"
                                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                onClick={() => setOpen(false)}
                            >
                                Ver perfil
                            </a>

                            {isAuthenticated() ? (
                                <button
                                    role="menuitem"
                                    onClick={handleLogout}
                                    className="block w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                                >
                                    Cerrar sesión
                                </button>
                            ) : (
                                <a
                                    role="menuitem"
                                    href="/login"
                                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                                >
                                    Iniciar sesión
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
