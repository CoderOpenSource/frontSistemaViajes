// src/pages/Dashboard.tsx
import { useState, useMemo, useEffect, Suspense, lazy } from "react";
import Header from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/SideBar";
import Footer from "../components/dashboard/Footer";
import ChatWidget from "../views/ChatWidget.tsx";

import type { View } from "../types/views";
import { motion, AnimatePresence } from "framer-motion";
import {
    LayoutDashboard,
    Users,
    ShoppingCart,
    Map,
    Building2,
    BusFront,
    BadgeCheck,
    UserCog,
    Clock4,
    ListChecks,
    Loader2,
    CreditCard,            // 👈 nuevo ícono para “pagos” (puedes usar otro)
    Receipt,
    BarChart3,
    ClipboardCheck,
    LineChart,
} from "lucide-react";

// …
// Code-splitting por vista
const ResumenView     = lazy(() => import("../views/ResumenView"));
const PassengersView  = lazy(() => import("../views/passenger/PassengersView.tsx"));
const VentasView      = lazy(() => import("../views/ventas/OrdersView.tsx"));
const PaymentsView    = lazy(() => import("../views/ventas/PaymentsView.tsx")); // 👈 nuevo
const RoutesView      = lazy(() => import("../views/catalog/RoutesView"));
const UsuariosView    = lazy(() => import("../views/accounts/UsuariosView.tsx"));
const BitacoraView    = lazy(() => import("../views/accounts/BitacoraView.tsx"));
// Catálogo
const OficinasView    = lazy(() => import("../views/catalog/OfficeView.tsx"));
const BusesView       = lazy(() => import("../views/catalog/BusesView.tsx"));
const CrewView        = lazy(() => import("../views/catalog/CrewView.tsx"));
const Licenses        = lazy(() => import("../views/catalog/LicensesView.tsx"));
const SalidasView     = lazy(() => import("../views/catalog/DeparturesView.tsx"));
const ReceiptsView   = lazy(() => import("../views/ventas/ReceiptsView.tsx"));
const ReportesView = lazy(() => import("../views/reportes/ReportesView.tsx"));

// añade este import junto a los demás lazy:
const BoardingView   = lazy(() => import("../views/boarding/BoardingView.tsx"));

const ForecastIAView = lazy(() => import("../views/ia/ForecastIAView.tsx"));

const ICONS: Record<View, React.FC<React.SVGProps<SVGSVGElement>>> = {
    resumen:   LayoutDashboard,
    pasajeros: Users,
    ventas:    ShoppingCart,
    pagos:     CreditCard,     // 👈 nuevo
    recibos:   Receipt,
    rutas:     Map,
    usuarios:  UserCog,
    bitacora:  Clock4,
    oficinas:  Building2,
    buses:     BusFront,
    crews:     ListChecks,
    salidas:   Clock4,
    licenses:  BadgeCheck,
    reportes:  BarChart3,
    embarque:  ClipboardCheck,
    "ia-forecast": LineChart,
};


export default function Dashboard() {
    const [open, setOpen] = useState(false);
    const [activeView, setActiveView] = useState<View>("resumen");

    const { title, subtitle } = useMemo(() => {
        switch (activeView) {
            case "ventas":    return { title: "Ventas",    subtitle: "Registro y reporte de ventas" };
            case "pagos":     return { title: "Pagos",     subtitle: "Cobros, confirmaciones y recibos" };
            case "recibos":   return { title: "Recibos",   subtitle: "Comprobantes PDF y detalle de emisión" }; // 👈 nuevo
            case "pasajeros": return { title: "Pasajeros", subtitle: "Gestión de pasajeros" };
            case "rutas":     return { title: "Rutas",     subtitle: "Gestión de rutas y buses" };
            case "usuarios":  return { title: "Usuarios",  subtitle: "Gestión de cuentas y roles" };
            case "bitacora":  return { title: "Bitácora",  subtitle: "Auditoría del sistema" };
            case "oficinas":  return { title: "Oficinas",  subtitle: "Sedes y puntos de venta" };
            case "buses":     return { title: "Buses",     subtitle: "Flota vehicular" };
            case "crews":     return { title: "Empleados", subtitle: "Choferes y ayudantes" };
            case "salidas":   return { title: "Salidas",   subtitle: "Departures programados" };
            case "licenses":  return { title: "Licencias", subtitle: "Gestión de licencias de choferes" };
            case "reportes":  return { title: "Reportes",  subtitle: "Descarga de PDF/Excel y análisis" }; // 👈 nuevo
            case "embarque":
                return { title: "Embarque", subtitle: "Control de abordaje y check-in de pasajeros" };
            case "ia-forecast": return { title: "IA · Forecast", subtitle: "Predicción de ocupación por ruta y fecha" }; // 👈 NUEVO

            default:          return { title: "Resumen",   subtitle: "Estado general de operaciones" };
        }
    }, [activeView]);



    // Actualiza el título del documento (detalle pro)
    useEffect(() => {
        document.title = `${title} · Dashboard`;
    }, [title]);

    const Icon = ICONS[activeView] ?? LayoutDashboard;

    return (
        <div className="min-h-screen bg-white text-gray-900">
            <Header onToggleSidebar={() => setOpen(true)} />

            <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[18rem_1fr]">
                <Sidebar
                    open={open}
                    onClose={() => setOpen(false)}
                    onNavigate={(v) => setActiveView(v)}
                    active={activeView}
                />

                <main className="min-h-[70vh] border-l px-4 py-6 md:border-l-0 md:px-6">
                    {/* Encabezado de vista con icono */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="rounded-2xl border bg-white p-2 shadow-sm">
                                <Icon className="h-6 w-6" aria-hidden />
                            </div>
                            <div>
                                <h1 className="text-2xl font-semibold">{title}</h1>
                                <p className="text-sm text-gray-600">{subtitle}</p>
                            </div>
                        </div>
                    </div>

                    {/* Contenido con transiciones */}
                    <Suspense
                        fallback={
                            <div className="mt-6 inline-flex items-center gap-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                Cargando…
                            </div>
                        }
                    >
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={activeView}
                                initial={{ opacity: 0, y: 6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.18 }}
                                className="mt-4"
                            >
                                {activeView === "resumen"   && <ResumenView onNavigate={setActiveView} />}
                                {activeView === "pasajeros" && <PassengersView />}
                                {activeView === "ventas"    && <VentasView />}
                                {activeView === "pagos"     && <PaymentsView />}   {/* 👈 nuevo */}

                                {activeView === "rutas"     && <RoutesView />}

                                {activeView === "usuarios"  && <UsuariosView />}
                                {activeView === "bitacora"  && <BitacoraView />}

                                {activeView === "oficinas"  && <OficinasView />}
                                {activeView === "buses"     && <BusesView />}
                                {activeView === "crews"     && <CrewView />}
                                {activeView === "licenses"  && <Licenses />}

                                {activeView === "salidas"   && <SalidasView />}
                                {activeView === "recibos"   && <ReceiptsView />}   {/* 👈 nuevo */}
                                {activeView === "reportes" && <ReportesView />}
                                {activeView === "embarque" && <BoardingView />}
                                {activeView === "ia-forecast" && <ForecastIAView />}



                            </motion.div>
                        </AnimatePresence>
                    </Suspense>
                </main>
            </div>

            <Footer />
            <ChatWidget />
        </div>
    );
}
