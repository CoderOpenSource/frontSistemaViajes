// src/pages/Dashboard.tsx
import { useState, useMemo, Suspense, lazy } from "react";
import Header from "../components/dashboard/Header";
import Sidebar from "../components/dashboard/SideBar";
import Footer from "../components/dashboard/Footer";
import type { View } from "../types/views";

// Code-splitting por vista
const ResumenView  = lazy(() => import("../views/ResumenView"));
const PassengersView     = lazy(() => import("../views/passenger/PassengersView.tsx"));
const VentasView   = lazy(() => import("../views/ventas/TicketsView.tsx"));


// ✅ NUEVO: RoutesView (catálogo)
const RoutesView   = lazy(() => import("../views/catalog/RoutesView"));

// Cuentas
const UsuariosView = lazy(() => import("../views/accounts/UsuariosView.tsx"));
const BitacoraView = lazy(() => import("../views/accounts/BitacoraView.tsx"));

// Catálogo
// ✅ corrige a OfficesView (coincide con tu archivo)
const OficinasView = lazy(() => import("../views/catalog/OfficeView.tsx"));
const BusesView    = lazy(() => import("../views/catalog/BusesView.tsx"));
const CrewView     = lazy(() => import("../views/catalog/CrewView.tsx"));
const Licenses     = lazy(() => import("../views/catalog/LicensesView.tsx"));

// ⚠️ Revisa esta ruta: antes apuntaba a RutasView.tsx
// Si tienes un componente específico de Salidas (Departures), cambia el import:
const SalidasView  = lazy(() => import("../views/catalog/DeparturesView.tsx"));
// Ejemplo recomendado:
// const SalidasView  = lazy(() => import("../views/catalog/DeparturesView.tsx"));

export default function Dashboard() {
    const [open, setOpen] = useState(false);
    const [activeView, setActiveView] = useState<View>("resumen");

    const { title, subtitle } = useMemo(() => {
        switch (activeView) {
            case "ventas":    return { title: "Ventas",    subtitle: "Registro y reporte de ventas" };
            case "pasajeros":    return { title: "Pasajeros",    subtitle: "Gestion de Pasajeros" };
            case "rutas":     return { title: "Rutas",     subtitle: "Gestión de rutas y buses" };
            case "usuarios":  return { title: "Usuarios",  subtitle: "Gestión de cuentas y roles" };
            case "bitacora":  return { title: "Bitácora",  subtitle: "Auditoría del sistema" };
            case "oficinas":  return { title: "Oficinas",  subtitle: "Sedes y puntos de venta" };
            case "buses":     return { title: "Buses",     subtitle: "Flota vehicular" };
            case "crews":     return { title: "Empleados", subtitle: "Choferes y ayudantes" };
            case "salidas":   return { title: "Salidas",   subtitle: "Departures programados" };
            case "licenses":  return { title: "Licencias", subtitle: "Gestión de licencias de choferes" };

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
                    active={activeView}
                />

                <main className="min-h-[70vh] border-l px-4 py-6 md:border-l-0 md:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl font-semibold">{title}</h1>
                            <p className="text-sm text-gray-600">{subtitle}</p>
                        </div>
                    </div>

                    <Suspense fallback={<div className="mt-6 animate-pulse text-sm text-gray-500">Cargando…</div>}>
                        {activeView === "resumen"  && <ResumenView onNavigate={setActiveView} />}
                        {activeView === "pasajeros"   && <PassengersView />}
                        {activeView === "ventas"   && <VentasView />}


                        {/* ✅ usa el RoutesView en la vista "rutas" */}
                        {activeView === "rutas"    && <RoutesView />}

                        {activeView === "usuarios" && <UsuariosView />}
                        {activeView === "bitacora" && <BitacoraView />}

                        {/* ✅ Offices/Buses/Crew/Licenses correctos */}
                        {activeView === "oficinas" && <OficinasView />}
                        {activeView === "buses"    && <BusesView />}
                        {activeView === "crews"    && <CrewView />}
                        {activeView === "licenses" && <Licenses />}

                        {/* ⚠️ ajusta este import si creas un DeparturesView propio */}
                        {activeView === "salidas"  && <SalidasView />}
                    </Suspense>
                </main>
            </div>

            <Footer />
        </div>
    );
}
