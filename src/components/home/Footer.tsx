export default function Footer() {
    const year = new Date().getFullYear();

    return (
        <footer role="contentinfo" className="border-t bg-white">
            <div className="mx-auto max-w-6xl px-4 py-6 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Lado izquierdo */}
                    <div className="flex items-center gap-3 text-gray-600">
                        <span>© {year} Serrano del Oriente</span>
                        <span className="hidden sm:inline text-gray-300">•</span>
                        {/* “Arriba” solo en móvil */}
                        <a
                            href="#top"
                            className="sm:hidden rounded-lg px-2 py-1 text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                        >
                            Arriba ↑
                        </a>
                    </div>

                    {/* Navegación del pie */}
                    <nav aria-label="Enlaces del pie" className="flex items-center gap-3">
                        <a
                            href="#"
                            className="rounded-lg px-2 py-1 text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                        >
                            Términos
                        </a>
                        <a
                            href="#"
                            className="rounded-lg px-2 py-1 text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                        >
                            Privacidad
                        </a>
                        <a
                            href="#contacto"
                            className="hidden sm:inline rounded-lg px-2 py-1 text-gray-600 transition hover:text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                        >
                            Contacto
                        </a>
                    </nav>
                </div>
            </div>
        </footer>
    );
}
