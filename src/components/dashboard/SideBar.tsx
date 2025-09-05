import type { View } from "../../types/views";
import { useEffect, useMemo, useState } from "react";

type Props = {
    open: boolean;
    onClose: () => void;
    onNavigate: (v: View) => void;
    active: View;
};

type Leaf = { label: string; view: View; icon?: JSX.Element };
type Group = { label: string; children: Leaf[]; icon?: JSX.Element };
type NavItem = Leaf | Group;

/* ========= NAV con ICONOS ========= */
/* ========= NAV con ICONOS ========= */
const nav: NavItem[] = [
    { label: "Resumen", view: "resumen", icon: <IconHome className="h-4 w-4" /> },

    {
        label: "Gestionar usuarios",
        icon: <IconUsersCog className="h-4 w-4" />,
        children: [
            { label: "Usuarios", view: "usuarios", icon: <IconUsers className="h-4 w-4" /> },
            { label: "Bitácora", view: "bitacora", icon: <IconClipboard className="h-4 w-4" /> },
        ],
    },

    {
        label: "Gestionar catálogo",
        icon: <IconBoxes className="h-4 w-4" />,
        children: [
            { label: "Oficinas",  view: "oficinas",  icon: <IconBuilding className="h-4 w-4" /> },
            { label: "Buses",     view: "buses",     icon: <IconBus className="h-4 w-4" /> },
            { label: "Rutas",     view: "rutas",     icon: <IconRoute className="h-4 w-4" /> },
            { label: "Salidas",   view: "salidas",   icon: <IconCalendarClock className="h-4 w-4" /> },
            { label: "Empleados", view: "crews",     icon: <IconIdBadge className="h-4 w-4" /> },
            { label: "Licencias", view: "licenses",  icon: <IconLicense className="h-4 w-4" /> },
        ],
    },

    {
        label: "Gestionar pasajeros",
        icon: <IconUsersRound className="h-4 w-4" />,
        children: [{ label: "Pasajeros", view: "pasajeros", icon: <IconUser className="h-4 w-4" /> }],
    },

    {
        label: "Gestionar ventas",
        icon: <IconCash className="h-4 w-4" />,
        children: [
            { label: "Ventas",  view: "ventas",  icon: <IconCash className="h-4 w-4" /> },
            { label: "Pagos",   view: "pagos",   icon: <IconCash className="h-4 w-4" /> },
            { label: "Recibos", view: "recibos", icon: <IconCash className="h-4 w-4" /> }, // 👈 nuevo
        ],
    },
    {
        label: "Operación diaria",
        icon: <IconCalendarClock className="h-4 w-4" />,
        children: [
            { label: "Control de Embarque", view: "embarque", icon: <IconCalendarClock className="h-4 w-4" /> },
            // en el futuro puedes añadir:
            // { label: "Asistencia de tripulación", view: "asistencias", icon: <IconIdBadge className="h-4 w-4" /> },
            // { label: "Tripulaciones por salida", view: "salidas-crew", icon: <IconUsersRound className="h-4 w-4" /> },
        ],
    },

    {
        label: "Reportes",
        icon: <IconReport className="h-4 w-4" />,
        children: [
            {
                label: "Generador de reportes",   // 👈 más general
                view: "reportes",
                icon: <IconReportDoc className="h-4 w-4" />
            },
            // luego podrás añadir más hijos si decides separar vistas:
            // { label: "Ventas por oficina", view: "reportes-oficina", icon: <IconReportDoc className="h-4 w-4" /> },
        ],
    },

    {
        label: "IA",
        icon: <IconSparkles className="h-4 w-4" />,
        children: [
            { label: "Forecast (IA)", view: "ia-forecast", icon: <IconBrain className="h-4 w-4" /> },
        ],
    },




];


export default function Sidebar({ open, onClose, onNavigate, active }: Props) {
    // grupos abiertos por defecto si el hijo está activo
    const defOpen = useMemo(() => {
        const map: Record<string, boolean> = {};
        nav.forEach((item) => {
            if (isGroup(item)) map[item.label] = item.children.some((c) => c.view === active);
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
                {/* LOGO / IMAGEN */}
                <div className="mb-3">
                    <div className="flex items-center justify-center rounded-xl border bg-white/60 p-3">
                        <img
                            src="https://res.cloudinary.com/dkpuiyovk/image/upload/v1756586232/bus_way9kk.png"
                            alt="Bus — Sistema de boletos"
                            className="h-16 w-auto object-contain"
                            loading="lazy"
                        />
                    </div>
                </div>

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
                  <span className="flex items-center gap-2 font-medium text-gray-900">
                    <span className="text-gray-500">{item.icon}</span>
                      {item.label}
                  </span>
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
                                                        "w-full text-left rounded-md px-3 py-2 text-sm transition flex items-center gap-2",
                                                        "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10",
                                                        isActive ? "bg-black text-white hover:bg-black" : "text-gray-800",
                                                    ].join(" ")}
                                                >
                                                    {/* icono hijo */}
                                                    <span className={isActive ? "text-white" : "text-gray-500"}>{c.icon}</span>
                                                    <span className="truncate">{c.label}</span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <button
                                    key={(item as Leaf).view}
                                    type="button"
                                    onClick={() => {
                                        onNavigate((item as Leaf).view);
                                        onClose();
                                    }}
                                    aria-current={active === (item as Leaf).view ? "page" : undefined}
                                    className={[
                                        "w-full text-left rounded-lg px-3 py-2 transition flex items-center gap-2",
                                        "hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-black/10",
                                        active === (item as Leaf).view ? "bg-black text-white hover:bg-black" : "text-gray-800",
                                    ].join(" ")}
                                >
                <span className={active === (item as Leaf).view ? "text-white" : "text-gray-500"}>
                  {(item as Leaf).icon}
                </span>
                                    <span className="truncate">{(item as Leaf).label}</span>
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

/* =============================
   ICONOS (SVGs puros, sin libs)
   ============================= */
function IconHome(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5" />
            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 10v9h12v-9" />
        </svg>
    );
}
function IconUsersCog(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M7 14a4 4 0 1 1 4-4" />
            <path strokeWidth="1.5" d="M2 20a6 6 0 0 1 12 0" />
            <circle cx="17" cy="9" r="2.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M17 14v2M17 5v2M14 9h-2M22 9h-2M15.2 11.8l-1.4 1.4M21.2 11.8l1.4 1.4M15.2 6.2l-1.4-1.4M21.2 6.2 22.6 4.8" />
        </svg>
    );
}
function IconUsers(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M8.5 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8Z" />
            <path strokeWidth="1.5" d="M16.5 13a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
            <path strokeWidth="1.5" d="M2 20a6.5 6.5 0 0 1 13 0" />
            <path strokeWidth="1.5" d="M15 20c.5-2.5 2.5-4 5-4s4.5 1.5 5 4" transform="translate(-5 0)" />
        </svg>
    );
}
function IconClipboard(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="6" y="5" width="12" height="16" rx="2" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M9 5V3h6v2" />
            <path strokeWidth="1.5" d="M8.5 10.5h7M8.5 14h7M8.5 17.5h5" />
        </svg>
    );
}
function IconBoxes(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="3" width="8" height="8" rx="1.5" strokeWidth="1.5" />
            <rect x="13" y="3" width="8" height="8" rx="1.5" strokeWidth="1.5" />
            <rect x="3" y="13" width="8" height="8" rx="1.5" strokeWidth="1.5" />
            <rect x="13" y="13" width="8" height="8" rx="1.5" strokeWidth="1.5" />
        </svg>
    );
}
function IconBuilding(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="4" y="3" width="16" height="18" rx="2" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M8 7h2M8 11h2M8 15h2M14 7h2M14 11h2M14 15h2M4 19h16" />
        </svg>
    );
}
function IconBus(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="4" y="4" width="16" height="12" rx="3" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M6 16v2M18 16v2" />
            <circle cx="8" cy="18" r="1.5" />
            <circle cx="16" cy="18" r="1.5" />
            <path strokeWidth="1.5" d="M6 8h12" />
        </svg>
    );
}
function IconRoute(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M6 18c0-3 3-3 6-3s6 0 6-3-3-3-6-3" />
            <circle cx="6" cy="18" r="2" strokeWidth="1.5" />
            <circle cx="18" cy="9" r="2" strokeWidth="1.5" />
        </svg>
    );
}
function IconCalendarClock(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="5" width="18" height="16" rx="2" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M16 3v4M8 3v4M3 9h18" />
            <circle cx="12" cy="15" r="3.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" strokeLinecap="round" d="M12 14v2l1.5 1" />
        </svg>
    );
}
function IconIdBadge(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="5" y="3" width="14" height="18" rx="2" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M9 7h6M9 11h6" />
            <circle cx="12" cy="16.5" r="2" strokeWidth="1.5" />
        </svg>
    );
}
function IconLicense(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M6 10h7M6 14h5" />
            <circle cx="17" cy="12" r="2" strokeWidth="1.5" />
        </svg>
    );
}
function IconUsersRound(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="8" cy="9" r="3.5" strokeWidth="1.5" />
            <circle cx="17" cy="7" r="2.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M2 20a7 7 0 0 1 12 0M14.5 20c.3-1.7 1.8-3 3.5-3s3.2 1.3 3.5 3" />
        </svg>
    );
}
function IconUser(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="8.5" r="3.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M4 20a8 8 0 0 1 16 0" />
        </svg>
    );
}
function IconCash(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="2.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M3 10c2 0 3-2 3-2m12 0s1 2 3 2M3 14c2 0 3 2 3 2m12 0s1-2 3-2" />
        </svg>
    );
}
function IconReport(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="3" width="18" height="18" rx="2" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M7 14v4M11 10v8M15 12v6M19 7H5" />
        </svg>
    );
}

function IconReportDoc(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
            <path strokeWidth="1.5" d="M14 3v5h5" />
            <path strokeWidth="1.5" d="M9 13h6M9 16h6M9 10h3" />
        </svg>
    );
}
function IconSparkles(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" strokeLinecap="round" d="M12 3l1.6 3.4L17 8l-3.4 1.6L12 13l-1.6-3.4L7 8l3.4-1.6L12 3z" />
            <path strokeWidth="1.5" strokeLinecap="round" d="M19 14l.9 1.9L22 17l-1.9.9L19 20l-.9-2.1L16 17l2.1-.9L19 14zM5 14l.7 1.6L7 17l-1.4.7L5 19l-.7-1.3L3 17l1.3-.4L5 14z" />
        </svg>
    );
}
function IconBrain(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M8.5 5.5a2.5 2.5 0 0 0-2.5 2.5v1A3.5 3.5 0 0 0 9 12v6a2.5 2.5 0 0 0 5 0v-1.5M15.5 5.5A2.5 2.5 0 0 1 18 8v1a3.5 3.5 0 0 1-3 3v6a2.5 2.5 0 0 1-5 0V16" />
        </svg>
    );
}