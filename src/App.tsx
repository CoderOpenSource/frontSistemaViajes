// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import { Toaster } from "sonner";

// ⬇️ importa el contenedor de modales globales
import GlobalOverlays from "./ui/GlobalOverlays";
// (o directamente: import SessionExpiredModal from "./ui/SessionExpiredModal")

function App() {
    return (
        <Router>
            {/* 🔊 Overlays globales (modal de sesión expirada, etc.) */}
            <GlobalOverlays />
            {/* Si prefieres sin wrapper: <SessionExpiredModal /> */}

            <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/dashboard" element={<Dashboard />} />
            </Routes>

            {/* Toaster global para notificaciones */}
            <Toaster richColors closeButton position="top-center" />
        </Router>
    );
}

export default App;
