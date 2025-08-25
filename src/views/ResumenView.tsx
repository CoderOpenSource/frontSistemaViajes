// src/views/ResumenView.tsx
import type { View } from "../types/views";

export default function ResumenView({ onNavigate }: { onNavigate?: (v: View) => void }) {
    return (
        <>
            <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                    { k: "Ventas (hoy)", v: "Bs 3.450" },
                    { k: "Pasajeros", v: "128" },
                    { k: "Ocupación", v: "82%" },
                    { k: "Tardíos", v: "4" },
                ].map(c => (
                    <div key={c.k} className="rounded-2xl border p-4 shadow-sm hover:shadow transition">
                        <p className="text-sm text-gray-600">{c.k}</p>
                        <p className="mt-1 text-xl font-semibold">{c.v}</p>
                    </div>
                ))}
            </section>

            <section className="mt-6 grid gap-6 lg:grid-cols-2">
                <div className="rounded-2xl border bg-white p-4">
                    <h2 className="text-lg font-semibold">Últimas ventas</h2>
                    <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="text-left text-gray-600">
                            <tr>
                                <th className="py-2">Hora</th>
                                <th className="py-2">Bus</th>
                                <th className="py-2">Ruta</th>
                                <th className="py-2">Monto</th>
                            </tr>
                            </thead>
                            <tbody>
                            {[
                                ["08:10", "SCZ-001", "SCZ → Montero", "Bs 45"],
                                ["08:25", "SCZ-014", "SCZ → Yapacaní", "Bs 70"],
                                ["08:40", "SCZ-022", "SCZ → Warnes", "Bs 30"],
                                ["09:05", "SCZ-031", "SCZ → Cotoca", "Bs 20"],
                            ].map((r, i) => (
                                <tr key={i} className="border-t">
                                    {r.map((c, j) => <td key={j} className="py-2">{c}</td>)}
                                </tr>
                            ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="rounded-2xl border bg-white p-4">
                    <h2 className="text-lg font-semibold">Acciones rápidas</h2>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {[
                            ["Nueva lista de embarque", "🧾", "embarque"],
                            ["Registrar tardío", "⏱️", "tardios"],
                            ["Abrir taquilla", "💼", "taquilla"],
                            ["Gestionar rutas", "🛣️", "rutas"],
                        ].map(([t, e, v]) => (
                            <button
                                key={t}
                                className="flex items-center justify-between rounded-xl border px-4 py-3 text-left hover:bg-black hover:text-white transition"
                                onClick={() => onNavigate?.(v as View)}
                            >
                                <span>{t}</span>
                                <span className="text-lg">{e}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </section>
        </>
    );
}
