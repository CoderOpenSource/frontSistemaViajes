// src/pages/Dashboard.tsx
import { useState, useMemo, Suspense, lazy } from "react";
import Header from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/SideBar";
import Footer from "../components/dashboard/Footer";
import type { View } from "../types/views";

// Code-splitting por vista
const ResumenView  = lazy(() => import("../views/ResumenView"));
const VentasView   = lazy(() => import("../views/VentasView"));
const EmbarqueView = lazy(() => import("../views/EmbarqueView"));
const TardiosView  = lazy(() => import("../views/TardiosView"));
const TaquillaView = lazy(() => import("../views/TaquillaView"));
const RutasView    = lazy(() => import("../views/RutasView"));
const UsuariosView = lazy(() => import("../views/accounts/UsuariosView.tsx"));
const BitacoraView = lazy(() => import("../views/accounts/BitacoraView.tsx"));
const OficinasView = lazy(() => import("../views/catalog/OfficeView.tsx"));
const BusesView    = lazy(() => import("../views/catalog/BusesView.tsx"));
const CrewView    = lazy(() => import("../views/catalog/CrewView.tsx"))
const SalidasView  = lazy(() => import("../views/RutasView.tsx"));
const Licenses  = lazy(() => import("../views/catalog/LicensesView.tsx"));

export default function Dashboard() {
    const [open, setOpen] = useState(false);
    const [activeView, setActiveView] = useState<View>("resumen");

    const { title, subtitle } = useMemo(() => {
        switch (activeView) {
            case "ventas":    return { title: "Ventas",    subtitle: "Registro y reporte de ventas" };
            case "embarque":  return { title: "Listas de embarque", subtitle: "Control de embarques" };
            case "tardios":   return { title: "Tardíos",   subtitle: "Pasajeros reportados como tardíos" };
            case "taquilla":  return { title: "Taquilla",  subtitle: "Apertura y cierre de caja" };
            case "rutas":     return { title: "Rutas",     subtitle: "Gestión de rutas y buses" };
            case "usuarios":  return { title: "Usuarios",  subtitle: "Gestión de cuentas y roles" };
            case "bitacora":  return { title: "Bitácora",  subtitle: "Auditoría del sistema" };
            case "oficinas":   return { title: "Oficinas", subtitle: "Sedes y puntos de venta" };
            case "buses":      return { title: "Buses", subtitle: "Flota vehicular" };
            case "crews": // 👈 aquí lo agregamos
                return { title: "Empleados", subtitle: "Choferes y ayudantes" };
            case "salidas":    return { title: "Salidas", subtitle: "Departures programados" };
            case "licenses":
                return { title: "Licencias", subtitle: "Gestión de licencias de choferes" };

            default:          return { title: "Resumen",   subtitle: "Estado general de operaciones" };
        }
    }, [activeView]);

    return (
        <div className="min-h-screen bg-white text-gray-900">
            <Header onToggleSidebar={() => setOpen(true)} />

            <div className="mx-auto grid max-w-7xl grid-cols-1 md:grid-cols-[18rem_1fr]">
                <Sidebar
                    open={open}
                    onClose={() => setOpen(false)}
                    onNavigate={(v) => setActiveView(v)}
                    active={activeView}   // <-- nuevo
                />


                <main className="min-h-[70vh] border-l md:border-l-0 px-4 py-6 md:px-6">
                    {/* Título + acciones (opcional por vista) */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold">{title}</h1>
                            <p className="text-sm text-gray-600">{subtitle}</p>
                        </div>
                    </div>

                    {/* Contenido: solo cambia esto */}
                    <Suspense fallback={<div className="mt-6 animate-pulse text-sm text-gray-500">Cargando…</div>}>
                        {activeView === "resumen"  && <ResumenView onNavigate={setActiveView} />}
                        {activeView === "ventas"   && <VentasView />}
                        {activeView === "embarque" && <EmbarqueView />}
                        {activeView === "tardios"  && <TardiosView />}
                        {activeView === "taquilla" && <TaquillaView />}
                        {activeView === "rutas"    && <RutasView />}
                        {activeView === "usuarios"    && <UsuariosView />}
                        {activeView === "bitacora" && <BitacoraView />}
                        {activeView === "oficinas"  && <OficinasView />}
                        {activeView === "buses"     && <BusesView />}
                        {activeView === "salidas"   && <SalidasView />}
                        {activeView === "crews"    && <CrewView />}
                        {activeView === "licenses" && <Licenses />}

                    </Suspense>
                </main>
            </div>

            <Footer />
        </div>
    );
}
