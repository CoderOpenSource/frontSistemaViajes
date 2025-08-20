export default function Contact() {
    return (
        <section
            id="contacto"
            role="region"
            aria-labelledby="contacto-title"
            className="scroll-mt-20"
        >
            <div className="mx-auto max-w-6xl px-4 py-14">
                <div className="rounded-2xl border bg-white p-6 shadow-sm md:p-8">
                    <h2 id="contacto-title" className="text-3xl font-bold">Contacto</h2>
                    <p id="contacto-note" className="mt-2 max-w-prose text-gray-700">
                        ¿Necesitas una demo o soporte? Completa el formulario y te respondemos.
                    </p>

                    <form
                        onSubmit={(e) => e.preventDefault()}
                        aria-describedby="contacto-note contacto-privacidad"
                        className="mt-6 grid gap-4 md:grid-cols-2"
                    >
                        {/* Honeypot (anti-spam) */}
                        <div className="hidden">
                            <label htmlFor="company">Empresa</label>
                            <input id="company" name="company" autoComplete="off" tabIndex={-1} />
                        </div>

                        <div className="flex flex-col">
                            <label htmlFor="contact-name" className="mb-1 text-sm text-gray-700">Nombre</label>
                            <input
                                id="contact-name"
                                name="name"
                                autoComplete="name"
                                required
                                className="w-full rounded-xl border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                                placeholder="Tu nombre"
                            />
                        </div>

                        <div className="flex flex-col">
                            <label htmlFor="contact-email" className="mb-1 text-sm text-gray-700">Correo</label>
                            <input
                                id="contact-email"
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                className="w-full rounded-xl border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                                placeholder="tucorreo@dominio.com"
                            />
                        </div>

                        <div className="md:col-span-2 flex flex-col">
                            <label htmlFor="contact-topic" className="mb-1 text-sm text-gray-700">Motivo</label>
                            <select
                                id="contact-topic"
                                name="topic"
                                defaultValue="demo"
                                className="w-full rounded-xl border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                            >
                                <option value="demo">Demo</option>
                                <option value="soporte">Soporte</option>
                                <option value="consulta">Consulta general</option>
                            </select>
                        </div>

                        <div className="md:col-span-2 flex flex-col">
                            <label htmlFor="contact-message" className="mb-1 text-sm text-gray-700">Mensaje</label>
                            <textarea
                                id="contact-message"
                                name="message"
                                required
                                rows={5}
                                className="h-32 w-full rounded-xl border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                                placeholder="Cuéntanos tu caso"
                            />
                        </div>

                        <p id="contacto-privacidad" className="md:col-span-2 text-xs text-gray-500">
                            Usamos tu correo solo para responderte. No compartimos tus datos.
                        </p>

                        <div className="md:col-span-2">
                            <button
                                type="submit"
                                className="rounded-xl bg-black px-4 py-3 text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                Enviar
                            </button>
                            {/* Área para mensajes del formulario */}
                            <p aria-live="polite" className="sr-only">Tu mensaje fue enviado.</p>
                        </div>
                    </form>
                </div>
            </div>
        </section>
    );
}
