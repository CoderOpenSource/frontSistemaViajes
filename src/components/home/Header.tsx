import { useEffect, useState } from "react";

export default function Header() {
    const [open, setOpen] = useState(false);

    // Bloquea el scroll cuando el menú está abierto
    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    // Cierra con ESC
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    return (
        <header id="top" className="sticky top-0 z-50 border-b bg-white">
            {/* Altura fija del header: h-14 = 56px → NO genera espacios dinámicos */}
            <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
                {/* Marca */}
                <a
                    href="/"
                    className="group flex items-center gap-2 font-semibold"
                    aria-label="Ir al inicio"
                >
          <span className="grid h-8 w-8 place-content-center rounded-xl bg-black text-white transition group-hover:opacity-90">
            SO
          </span>
                    <span className="whitespace-nowrap transition group-hover:text-gray-800">
            Serrano del Oriente
          </span>
                </a>

                {/* Navegación desktop */}
                <nav className="hidden md:flex items-center gap-4 text-sm">
                    {[
                        { href: "#features", label: "Funciones" },
                        { href: "#oficinas", label: "Oficinas" },
                        { href: "#contacto", label: "Contacto" },
                    ].map(it => (
                        <a
                            key={it.href}
                            href={it.href}
                            className="rounded-lg px-2 py-1 text-gray-600 transition hover:text-gray-900 hover:bg-gray-100
                         focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                        >
                            {it.label}
                        </a>
                    ))}
                </nav>

                {/* Login desktop (único) */}
                <div className="hidden md:flex">
                    <a
                        href="/login"
                        className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-800 transition
                       hover:bg-black hover:text-white focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-black/20"
                    >
                        Iniciar sesión
                    </a>
                </div>

                {/* Botón móvil */}
                <button
                    onClick={() => setOpen(v => !v)}
                    aria-label="Abrir menú"
                    aria-expanded={open}
                    aria-controls="mobile-menu"
                    className="md:hidden rounded-lg border border-gray-300 p-2 transition hover:bg-gray-50
                     focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                >
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Overlay + menú móvil SUPERPUESTO (no empuja layout) */}
            {open && (
                <>
                    {/* Clic afuera para cerrar */}
                    <button
                        aria-hidden
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-40 bg-black/30 md:hidden"
                        tabIndex={-1}
                    />
                    <div
                        id="mobile-menu"
                        className="fixed top-14 z-50 w-full border-t border-gray-200 bg-white md:hidden"
                    >
                        <div className="px-4 py-3 flex flex-col gap-2">
                            <a onClick={() => setOpen(false)} href="#features"
                               className="rounded-lg px-2 py-2 text-gray-900 transition hover:bg-gray-100
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20">
                                Funciones
                            </a>
                            <a onClick={() => setOpen(false)} href="#oficinas"
                               className="rounded-lg px-2 py-2 text-gray-900 transition hover:bg-gray-100
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20">
                                Oficinas
                            </a>
                            <a onClick={() => setOpen(false)} href="#contacto"
                               className="rounded-lg px-2 py-2 text-gray-900 transition hover:bg-gray-100
                            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20">
                                Contacto
                            </a>
                            <div className="pt-2">
                                <a
                                    href="/login"
                                    className="block w-full rounded-xl border border-gray-300 px-3 py-2 text-center text-gray-900 transition
                             hover:bg-black hover:text-white focus-visible:outline-none
                             focus-visible:ring-2 focus-visible:ring-black/20"
                                >
                                    Iniciar sesión
                                </a>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </header>
    );
}
