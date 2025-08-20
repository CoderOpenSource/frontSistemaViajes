export default function Login() {
    return (
        <section
            aria-labelledby="login-title"
            role="region"
            className="bg-white"
        >
            <div className="flex min-h-screen items-center justify-center px-4 py-10">
                <div className="grid w-full max-w-5xl grid-cols-1 lg:grid-cols-2 items-center gap-8">

                    {/* Columna: formulario */}
                    <div className="relative w-full max-w-md mx-auto">
                        {/* Fondo suave del bloque */}
                        <div
                            aria-hidden
                            className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-slate-100 to-slate-200"
                        />
                        {/* Tarjeta */}
                        <div className="relative rounded-2xl border bg-white p-6 shadow-sm md:p-8">
                            <div className="mb-4 flex items-center gap-2">
                                <span className="grid h-8 w-8 place-content-center rounded-xl bg-black text-white">SO</span>
                                <span className="text-sm text-gray-600">Serrano del Oriente</span>
                            </div>

                            <h1 id="login-title" className="text-2xl font-semibold">
                                Iniciar sesión
                            </h1>
                            <p id="login-desc" className="mt-1 text-sm text-gray-600">
                                Ingresa con tu correo y contraseña.
                            </p>

                            <form
                                onSubmit={(e) => e.preventDefault()}
                                aria-describedby="login-desc"
                                className="mt-6 grid gap-4"
                            >
                                <div className="flex flex-col">
                                    <label htmlFor="email" className="mb-1 text-sm text-gray-700">Correo</label>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        className="w-full rounded-xl border px-4 py-3 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                                        placeholder="tucorreo@dominio.com"
                                    />
                                </div>

                                <div className="flex flex-col">
                                    <div className="mb-1 flex items-center justify-between">
                                        <label htmlFor="password" className="text-sm text-gray-700">Contraseña</label>
                                        <a href="/recuperar" className="text-sm text-gray-700 hover:underline">
                                            ¿Olvidaste tu contraseña?
                                        </a>
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        className="w-full rounded-xl border px-4 py-3 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20"
                                        placeholder="••••••••"
                                    />
                                </div>

                                <div className="flex items-center justify-between">
                                    <label className="flex items-center gap-2 text-sm text-gray-700">
                                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                                        Recordarme
                                    </label>
                                    <a href="#contacto" className="text-sm text-gray-700 hover:underline">Soporte</a>
                                </div>

                                <button
                                    type="submit"
                                    className="mt-2 w-full rounded-xl bg-black px-4 py-3 text-white shadow-sm transition hover:opacity-90"
                                >
                                    Entrar
                                </button>
                            </form>

                            <div className="mt-6 flex items-center justify-center">
                                <a href="/" className="text-sm text-gray-600 hover:text-gray-900">← Volver al inicio</a>
                            </div>
                        </div>
                    </div>

                    {/* Columna: imagen GIF */}
                    <div className="hidden lg:flex items-center justify-center">
                        <img
                            src="/login_sistema.gif" // coloca tu gif aquí en /public
                            alt="Animación ilustrativa"
                            className="max-h-[500px] w-auto object-contain"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
