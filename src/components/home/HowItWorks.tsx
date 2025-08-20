export default function HowItWorks() {
    const steps = [
        "La oficina origen emite lista de partida y registra asientos libres por tramos.",
        "Oficinas intermedias venden solo asientos habilitados (Bulo-Bulo, Chimoré, Villa Tunari...).",
        "En cada parada se imprime la lista actualizada para visado de tránsito.",
        "El destino cierra viaje, registra tardíos y asientos libres sin oficina.",
    ];

    return (
        <section
            id="oficinas"
            aria-labelledby="how-title"
            role="region"
            className="border-t bg-slate-50 scroll-mt-20"
        >
            <div className="mx-auto max-w-7xl px-4 py-14">
                <h2 id="how-title" className="text-3xl font-bold">Cómo funciona en ruta</h2>

                {/* Contenedor responsive; en md+ añadimos una guía sutil tipo timeline */}
                <div className="relative mt-6">
                    <div className="
            hidden md:block
            absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-gray-200
          " aria-hidden />

                    <ol
                        className="grid list-decimal gap-4 pl-5 md:grid-cols-2 md:gap-5 md:pl-0"
                        aria-describedby="how-note"
                    >
                        {steps.map((t, i) => (
                            <li key={i} className="list-none">
                                <article
                                    tabIndex={0}
                                    className="
                    flex items-start gap-3 rounded-2xl border bg-white p-5 md:p-6
                    transition hover:border-gray-300 hover:shadow-sm
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20
                    motion-reduce:transition-none
                  "
                                    aria-label={`Paso ${i + 1}: ${t}`}
                                >
                  <span
                      aria-hidden
                      className="
                      grid h-8 w-8 place-content-center rounded-lg bg-black
                      text-sm font-bold text-white shadow-sm
                    "
                  >
                    {i + 1}
                  </span>
                                    <p className="text-gray-700">{t}</p>
                                </article>
                            </li>
                        ))}
                    </ol>

                    <p id="how-note" className="sr-only">
                        La lista está ordenada; sigue los pasos del 1 al 4.
                    </p>
                </div>
            </div>
        </section>
    );
}
