export default function Hero() {
    return (
        <section className="bg-gradient-to-b from-white to-slate-50 scroll-mt-20">
            <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:py-24 lg:grid-cols-2">
                <div>
                    <h1 className="text-4xl font-bold leading-tight md:text-5xl">
                        Venta y reserva de pasajes
                        <span className="block text-gray-600">con control por tramos</span>
                    </h1>
                    <p className="mt-4 text-gray-700 md:text-lg">
                        Sistema web centralizado para oficinas departamentales e intermedias. Emite listas de embarque,
                        registra menores y evita pérdidas por ventas informales.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                        <a href="/login" className="rounded-xl bg-black px-4 py-3 text-white hover:opacity-90">Entrar</a>
                        <a href="#features" className="rounded-xl border px-4 py-3 hover:bg-black hover:text-white">Ver funciones</a>
                    </div>
                    <ul className="mt-4 list-disc pl-5 text-sm text-gray-600">
                        <li>Tramos múltiples por asiento</li>
                        <li>Listas visadas antes de partir</li>
                        <li>Bitácora y roles con caducidad</li>
                    </ul>
                </div>

                <div className="relative">
                    <div className="card aspect-video w-full rounded-2xl border bg-white p-4 shadow-sm grid place-content-center text-center">
                        <div className="text-7xl">🚌🧾</div>
                        <p className="mt-2 text-sm text-gray-500">Ejemplo: Lista de pasajeros por bus/fecha</p>
                    </div>

                </div>
            </div>
        </section>
    );
}
