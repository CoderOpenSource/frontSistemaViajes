import type { View } from "../../types/views";
import { useEffect, useMemo, useState } from "react";

type Props = {
    open: boolean;
    onClose: () => void;
    onNavigate: (v: View) => void;
    active: View;
};

type Leaf = { label: string; view: View };
type Group = { label: string; children: Leaf[] };
type NavItem = Leaf | Group;

const nav: NavItem[] = [
    { label: "Resumen", view: "resumen" },
    { label: "Ventas", view: "ventas" },
    { label: "Listas de embarque", view: "embarque" },
    { label: "Tardíos", view: "tardios" },
    { label: "Taquilla", view: "taquilla" },
    { label: "Rutas", view: "rutas" },
    {
        label: "Gestionar usuarios",
        children: [
            { label: "Usuarios", view: "usuarios" },
            { label: "Bitácora", view: "bitacora" },
        ],
    },
    {
        label: "Gestionar catálogo",
        children: [
            { label: "Oficinas", view: "oficinas" },
            { label: "Buses", view: "buses" },
            { label: "Rutas", view: "rutas" },      // reutiliza tu vista de rutas
            { label: "Salidas", view: "salidas" },  // Departures
            { label: "Empleados", view: "crews" },
            { label: "Licencias", view: "licenses" },
        ],
    },
];

export default function Sidebar({ open, onClose, onNavigate, active }: Props) {
    // grupos abiertos por defecto si el hijo está activo
    const defOpen = useMemo(() => {
        const map: Record<string, boolean> = {};
        nav.forEach((item) => {
            if (isGroup(item)) {
                map[item.label] = item.children.some((c) => c.view === active);
            }
        });
        return map;
    }, [active]);

    const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(defOpen);

    // Si cambia la vista activa, asegúrate de expandir su grupo
    useEffect(() => setOpenGroups((prev) => ({ ...prev, ...defOpen })), [defOpen]);

    function toggleGroup(key: string) {
        setOpenGroups((s) => ({ ...s, [key]: !s[key] }));
    }

    return (
        <>
            {/* backdrop móvil */}
            <div
                className={`fixed inset-0 z-40 bg-black/30 md:hidden ${open ? "" : "hidden"}`}
                onClick={onClose}
            />

            <aside
                className={`fixed z-50 h-full w-72 bg-white p-4 border-r md:static md:z-auto transition-transform
        ${open ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
                aria-label="Navegación lateral"
            >
                <nav className="space-y-1">
                    {nav.map((item) =>
                        isGroup(item) ? (
                            <div key={item.label} className="rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => toggleGroup(item.label)}
                                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left transition hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10"
                                    aria-expanded={Boolean(openGroups[item.label])}
                                    aria-controls={`group-${slug(item.label)}`}
                                >
                                    <span className="font-medium text-gray-900">{item.label}</span>
                                    <Chevron open={Boolean(openGroups[item.label])} />
                                </button>

                                <div
                                    id={`group-${slug(item.label)}`}
                                    className={`mt-1 space-y-1 overflow-hidden pl-2 ${openGroups[item.label] ? "max-h-96" : "max-h-0"} transition-[max-height] duration-300`}
                                >
                                    {item.children.map((c) => {
                                        const isActive = active === c.view;
                                        return (
                                            <button
                                                key={c.view}
                                                type="button"
                                                onClick={() => {
                                                    onNavigate(c.view);
                                                    onClose();
                                                }}
                                                aria-current={isActive ? "page" : undefined}
                                                className={[
                                                    "w-full text-left rounded-md px-3 py-2 text-sm transition",
                                                    "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10",
                                                    isActive ? "bg-black text-white hover:bg-black" : "text-gray-800",
                                                ].join(" ")}
                                            >
                                                {c.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        ) : (
                            <button
                                key={item.view}
                                type="button"
                                onClick={() => {
                                    onNavigate(item.view);
                                    onClose();
                                }}
                                aria-current={active === item.view ? "page" : undefined}
                                className={[
                                    "w-full text-left rounded-lg px-3 py-2 transition",
                                    "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10",
                                    active === item.view ? "bg-black text-white hover:bg-black" : "text-gray-800",
                                ].join(" ")}
                            >
                                {item.label}
                            </button>
                        )
                    )}
                </nav>
            </aside>
        </>
    );
}

function isGroup(x: NavItem): x is Group {
    return (x as Group).children != null;
}

function slug(s: string) {
    return s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function Chevron({ open }: { open: boolean }) {
    return (
        <svg
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : "rotate-0"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
        >
            <path d="M6 9l6 6 6-6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    );
}
