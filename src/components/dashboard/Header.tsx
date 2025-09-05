import { useEffect, useRef, useState } from "react";
import type { StoredUser } from "../../services/storage";
import { getStoredUser, clearSession, isAuthenticated } from "../../services/storage";

type Props = { onToggleSidebar: () => void };

export default function Header({ onToggleSidebar }: Props) {
    const [user, setUser] = useState<StoredUser | null>(null);
    const [open, setOpen] = useState(false);
    const [dark, setDark] = useState<boolean>(() => {
        if (typeof document !== "undefined") {
            return document.documentElement.classList.contains("dark");
        }
        return false;
    });
    const [notif, setNotif] = useState<number>(3); // ✅ demo: cambia según tu data

    const menuRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => { setUser(getStoredUser()); }, []);

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

    const toggleTheme = () => {
        setDark((d) => {
            const next = !d;
            document.documentElement.classList.toggle("dark", next);
            return next;
        });
    };

    return (
        <header className="sticky top-0 z-40 border-b bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70 dark:bg-neutral-900 dark:border-neutral-800">
            <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
                {/* Izquierda */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={onToggleSidebar}
                        className="rounded-lg border p-2 md:hidden dark:border-neutral-700"
                        aria-label="Abrir menú lateral"
                        title="Menú"
                    >
                        <IconMenu className="h-5 w-5" />
                    </button>

                    <a href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-content-center rounded-xl bg-black text-white dark:bg-white dark:text-black">
              SO
            </span>
                        <span className="hidden sm:block text-gray-900 dark:text-gray-100">
              Serrano del Oriente
            </span>
                    </a>
                </div>

                {/* Centro */}
                <nav className="hidden md:flex items-center gap-4 text-sm">
                    <a className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" href="#" title="Centro de ayuda">
                        <IconHelp className="h-4 w-4" /> Ayuda
                    </a>
                    <a className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white" href="#" title="Contactar soporte">
                        <IconLifeBuoy className="h-4 w-4" /> Soporte
                    </a>
                </nav>

                {/* Derecha */}
                <div className="relative flex items-center gap-1 sm:gap-2">
                    {/* Username */}
                    <span className="hidden sm:block text-xs sm:text-sm text-gray-700 dark:text-gray-200 max-w-[16ch] truncate">
            {user?.username ?? "Invitado"}
          </span>

                    {/* Buscar */}
                    <button
                        className="rounded-full border p-2 hover:bg-gray-50 transition dark:border-neutral-700 dark:hover:bg-neutral-800"
                        aria-label="Buscar"
                        title="Buscar (Ctrl + K)"
                        onClick={() => console.log("open search")}
                    >
                        <IconSearch className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                    </button>

                    {/* Notificaciones */}
                    <button
                        className="relative rounded-full border p-2 hover:bg-gray-50 transition dark:border-neutral-700 dark:hover:bg-neutral-800"
                        aria-label="Notificaciones"
                        title="Notificaciones"
                        onClick={() => {
                            console.log("open notifications");
                            setNotif(0); // al abrir, marcar como visto (demo)
                        }}
                    >
                        <IconBell className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                        {notif > 0 && (
                            <span
                                aria-label={`${notif} notificaciones nuevas`}
                                className="absolute -right-0.5 -top-0.5 grid h-4 min-w-[16px] place-content-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white"
                            >
                {notif > 9 ? "9+" : notif}
              </span>
                        )}
                    </button>

                    {/* Ajustes */}
                    <a
                        href="/ajustes"
                        className="rounded-full border p-2 hover:bg-gray-50 transition dark:border-neutral-700 dark:hover:bg-neutral-800"
                        aria-label="Ajustes"
                        title="Ajustes"
                    >
                        <IconSettings className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                    </a>

                    {/* Tema */}
                    <button
                        onClick={toggleTheme}
                        className="rounded-full border p-2 hover:bg-gray-50 transition dark:border-neutral-700 dark:hover:bg-neutral-800"
                        aria-label={dark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
                        title={dark ? "Tema: oscuro" : "Tema: claro"}
                        aria-pressed={dark}
                    >
                        {dark ? <IconSun className="h-5 w-5 text-gray-700 dark:text-gray-200" /> : <IconMoon className="h-5 w-5 text-gray-700" />}
                    </button>

                    {/* Perfil */}
                    <button
                        ref={btnRef}
                        onClick={() => setOpen((v) => !v)}
                        className="grid h-9 w-9 place-content-center rounded-full border hover:bg-gray-50 transition dark:border-neutral-700 dark:hover:bg-neutral-800"
                        aria-label="Abrir menú de cuenta"
                        aria-haspopup="menu"
                        aria-expanded={open}
                        title="Cuenta"
                    >
                        <IconUserCircle className="h-5 w-5 text-gray-700 dark:text-gray-200" />
                    </button>

                    {open && (
                        <div
                            ref={menuRef}
                            role="menu"
                            className="absolute right-0 top-11 w-56 overflow-hidden rounded-xl border bg-white shadow-lg dark:bg-neutral-900 dark:border-neutral-700"
                        >
                            <div className="px-3 py-2 border-b dark:border-neutral-700">
                                <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                                    {user?.username ?? "Invitado"}
                                </p>
                                {user?.email && (
                                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user.email}</p>
                                )}
                            </div>

                            <a
                                role="menuitem"
                                href="/perfil"
                                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                                onClick={() => setOpen(false)}
                            >
                                <IconUser className="h-4 w-4" /> Ver perfil
                            </a>

                            {isAuthenticated() ? (
                                <button
                                    role="menuitem"
                                    onClick={handleLogout}
                                    className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40"
                                >
                                    <IconLogout className="h-4 w-4" /> Cerrar sesión
                                </button>
                            ) : (
                                <a
                                    role="menuitem"
                                    href="/login"
                                    className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-200 dark:hover:bg-neutral-800"
                                >
                                    <IconLogin className="h-4 w-4" /> Iniciar sesión
                                </a>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}

/* =============================
   Iconos (SVG puros, sin libs)
   ============================= */
function IconMenu(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" strokeLinecap="round" d="M4 7h16M4 12h16M4 17h16" />
        </svg>
    );
}
function IconSearch(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="11" cy="11" r="7" strokeWidth="1.5" />
            <path strokeWidth="1.5" strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
    );
}
function IconBell(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
            <path strokeWidth="1.5" d="M9.5 19a2.5 2.5 0 0 0 5 0" />
        </svg>
    );
}
function IconSettings(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
            <path strokeWidth="1.5" d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 6.6 4.2l.1.1a1.7 1.7 0 0 0 1.9.3H8.7A1.7 1.7 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1.3 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 6l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
        </svg>
    );
}
function IconSun(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="4" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l-1.5-1.5M20.5 20.5 19 19M5 19l-1.5 1.5M20.5 3.5 19 5" />
        </svg>
    );
}
function IconMoon(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z" />
        </svg>
    );
}
function IconUserCircle(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z" />
            <path strokeWidth="1.5" d="M4 20a8 8 0 0 1 16 0" />
        </svg>
    );
}
function IconUser(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Z" />
            <path strokeWidth="1.5" d="M4 20a8 8 0 0 1 16 0" />
        </svg>
    );
}
function IconLogin(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M15 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3" />
            <path strokeWidth="1.5" d="M10 17l5-5-5-5" />
            <path strokeWidth="1.5" d="M15 12H3" />
        </svg>
    );
}
function IconLogout(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M9 21H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3" />
            <path strokeWidth="1.5" d="M16 17l5-5-5-5" />
            <path strokeWidth="1.5" d="M21 12H9" />
        </svg>
    );
}
function IconHelp(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M9.1 9a3 3 0 1 1 3.9 2.9c-.8.3-1 1-1 1.6V14" />
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
            <circle cx="12" cy="18" r="1" fill="currentColor" />
        </svg>
    );
}
function IconLifeBuoy(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="4" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M4.6 7.5 7.5 4.6M16.5 19.4l2.9-2.9M19.4 7.5 16.5 4.6M7.5 19.4 4.6 16.5" />
        </svg>
    );
}
