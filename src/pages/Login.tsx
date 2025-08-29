import { useState } from "react";
import { login } from "../services/auth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Login() {
    const navigate = useNavigate();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const [submitting, setSubmitting] = useState(false);
    const [fieldError, setFieldError] = useState<{ email?: string; password?: string }>({});

    const validate = () => {
        const e: typeof fieldError = {};
        if (!email) e.email = "Ingresa tu correo.";
        // validación simple de correo
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Correo inválido.";
        if (!password) e.password = "Ingresa tu contraseña.";
        setFieldError(e);
        return Object.keys(e).length === 0;
    };

    const handleSubmit = async (ev: React.FormEvent) => {
        ev.preventDefault();
        if (submitting) return;
        if (!validate()) return;

        setSubmitting(true);

        try {
            await toast.promise(
                (async () => {
                    const { user } = await login({ email, password });

                    if (user?.must_change_password) {
                        toast.info("Debes actualizar tu contraseña.");
                        navigate("/cambiar-password");
                        return;
                    }

                    // pequeña pausa para que se perciba el success
                    await new Promise((r) => setTimeout(r, 500));
                    navigate("/dashboard"); // o "/dashboard"
                })(),
                {
                    loading: "Ingresando...",
                    success: "¡Bienvenido! Redirigiendo…",
                    error: (err) => err?.message || "Correo o contraseña incorrectos",
                }
            );
        } finally {
            setSubmitting(false);
        }
    };


    return (
        <section aria-labelledby="login-title" role="region" className="bg-white">
            <div className="flex min-h-screen items-center justify-center px-4 py-10">
                <div className="grid w-full max-w-5xl grid-cols-1 items-center gap-8 lg:grid-cols-2">
                    {/* Columna: formulario */}
                    <div className="relative mx-auto w-full max-w-md">
                        {/* Fondo suave */}
                        <div aria-hidden className="absolute -inset-2 rounded-3xl bg-gradient-to-b from-slate-100 to-slate-200" />
                        {/* Tarjeta */}
                        <div className="relative rounded-2xl border bg-white p-6 shadow-sm md:p-8">
                            <h1 id="login-title" className="text-2xl font-semibold">
                                Iniciar sesión
                            </h1>
                            <p id="login-desc" className="mt-1 text-sm text-gray-600">
                                Ingresa con tu correo y contraseña.
                            </p>

                            <form onSubmit={handleSubmit} className="mt-6 grid gap-4" noValidate>
                                {/* Correo */}
                                <div className="flex flex-col">
                                    <label htmlFor="email" className="mb-1 text-sm text-gray-700">
                                        Correo
                                    </label>
                                    <input
                                        id="email"
                                        type="email"
                                        placeholder="ejemplo@correo.com"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        required
                                        aria-invalid={!!fieldError.email}
                                        aria-describedby={fieldError.email ? "email-err" : undefined}
                                        className={`w-full rounded-xl border px-4 py-3 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${
                                            fieldError.email ? "border-red-400" : ""
                                        }`}
                                    />
                                    {fieldError.email && (
                                        <p id="email-err" className="mt-1 text-xs text-red-600">
                                            {fieldError.email}
                                        </p>
                                    )}
                                </div>

                                {/* Contraseña */}
                                <div className="flex flex-col">
                                    <label htmlFor="password" className="mb-1 text-sm text-gray-700">
                                        Contraseña
                                    </label>
                                    <input
                                        id="password"
                                        type="password"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                        aria-invalid={!!fieldError.password}
                                        aria-describedby={fieldError.password ? "password-err" : undefined}
                                        className={`w-full rounded-xl border px-4 py-3 text-gray-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 ${
                                            fieldError.password ? "border-red-400" : ""
                                        }`}
                                    />
                                    {fieldError.password && (
                                        <p id="password-err" className="mt-1 text-xs text-red-600">
                                            {fieldError.password}
                                        </p>
                                    )}
                                </div>


                                {/* Botón */}
                                {/* Botón */}
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-white transition
       hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {submitting && (
                                        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                                    )}
                                    {submitting ? "Ingresando..." : "Entrar"}
                                </button>

                                {/* Botón volver al home */}
                                <a
                                    href="/"
                                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-700 transition hover:bg-gray-50"
                                >
                                    ⬅ Volver al inicio
                                </a>

                            </form>
                        </div>
                    </div>

                    {/* Columna: imagen (oculta en móvil) */}
                    <div className="hidden items-center justify-center lg:flex">
                        <img
                            src="/login_sistema.gif"
                            alt="Animación ilustrativa"
                            className="max-h-[500px] w-auto object-contain"
                        />
                    </div>
                </div>
            </div>
        </section>
    );
}
