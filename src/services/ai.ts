import { api } from "./api";

/* ====================== Tipos ====================== */
export type ForecastRow = {
    route: string;
    date: string;   // YYYY-MM-DD
    yhat: number;   // predicción de asientos ocupados
    capacity: number;
};

// Acepta: [] | {data: []} | {results: []}
function unwrapArray<T>(res: any): T[] {
    if (Array.isArray(res)) return res as T[];
    if (Array.isArray(res?.data)) return res.data as T[];
    if (Array.isArray(res?.results)) return res.results as T[];
    return [];
}

/* ====================== Endpoints ====================== */

/**
 * Predice ocupación de TODAS las rutas para los próximos N días.
 * GET /api/ai/forecast/next-days/?days=14
 */
export async function forecastNextDays(days: number = 14): Promise<ForecastRow[]> {
    const res = await api.get(`/ai/forecast/next-days/?days=${days}`);
    return unwrapArray<ForecastRow>(res);
}

/**
 * Predice ocupación de UNA ruta en fechas específicas.
 * GET /api/ai/forecast/route/?route=SCZ-LPZ&dates=2025-09-10,2025-09-11
 */
export async function forecastRoute(route: string, dates: string[]): Promise<ForecastRow[]> {
    const qs = encodeURIComponent(dates.join(","));
    const res = await api.get(`/ai/forecast/route/?route=${encodeURIComponent(route)}&dates=${qs}`);
    return unwrapArray<ForecastRow>(res);
}
