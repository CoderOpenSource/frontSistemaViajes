type Item = { icon: string; title: string; desc: string };

const items: Item[] = [
    { icon: "🎟️", title: "Venta por tramos", desc: "Un mismo asiento se vende según origen/destino intermedio." },
    { icon: "🧒", title: "Menores y responsables", desc: "Registro de formularios y acompañantes obligatorios." },
    { icon: "📋", title: "Listas visadas", desc: "Salida/arribo por terminal con impresión inmediata." },
    { icon: "🧾", title: "Reportes", desc: "Pagantes por bus/fecha, tardíos y más (exportar)." },
    { icon: "🔐", title: "Seguridad", desc: "Roles, caducidad de contraseña y bitácora de operaciones." },
    { icon: "☁️", title: "Centralizado", desc: "BD en Santa Cruz; oficinas enlazadas por VPN." },
];

export default function Features() {
    return (
        <section id="features" aria-labelledby="features-title" className="scroll-mt-20">
            <div className="mx-auto max-w-6xl px-4 py-14">
                <h2 id="features-title" className="text-3xl font-bold">Funciones clave</h2>
                <p className="mt-2 max-w-prose text-gray-600">Todo lo necesario para controlar la flota y la taquilla.</p>

                <ul className="mt-10 grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((it) => (
                        <li key={it.title} className="h-full">
                            <article
                                className="group h-full rounded-2xl border p-5 transition hover:border-gray-300 hover:shadow-sm focus-within:shadow-sm"
                                // Si luego vuelves interactivo el card, conviértelo en <a> o <button>.
                            >
                                <div className="text-3xl transition-transform duration-200 group-hover:scale-105 motion-reduce:transition-none" aria-hidden>
                                    {it.icon}
                                </div>
                                <h3 className="mt-3 font-semibold">{it.title}</h3>
                                <p className="mt-1 text-sm text-gray-600">{it.desc}</p>

                                {/* En caso de necesitar un mini-CTA por tarjeta en el futuro:
                <a href="/..." className="mt-4 inline-flex items-center gap-1 text-sm text-gray-800 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20">
                  Ver más
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>
                </a>
                */}
                            </article>
                        </li>
                    ))}
                </ul>
            </div>
        </section>
    );
}
