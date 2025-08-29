// services/routes.ts
import { api } from "./api";

// -----------------------------------------------------------------------------
// Tipos: deben reflejar tu RouteSerializer y RouteStopSerializer del backend
// -----------------------------------------------------------------------------
export type Id = number | string;

export type RouteStop = {
    id: Id;
    // Escritura por id (PrimaryKeyRelatedField)
    office: Id;
    // Lectura cómoda
    office_code?: string;
    office_name?: string;

    order: number;                         // 0..N (0 = origin, último = destination)
    scheduled_offset_min?: number | null;  // minutos desde la salida programada
};

export type Route = {
    id: Id;
    name: string;
    origin: Id;
    origin_code?: string;
    destination: Id;
    destination_code?: string;
    active: boolean;
    created_at?: string;

    stops: RouteStop[];
};

// Paginación DRF por defecto
type DRFPage<T> = {
    count: number;
    next: string | null;
    previous: string | null;
    results: T[];
};

// -----------------------------------------------------------------------------
// Parámetros de listado
// -----------------------------------------------------------------------------
export type ListRoutesParams = {
    q?: string;            // SearchFilter (name, origin__name, destination__name, etc.)
    page?: number;
    pageSize?: number;
    ordering?: string;     // "name" | "-created_at" | etc.

    // Filtros de tu ViewSet
    active?: boolean;      // exact
    origin?: Id;           // exact
    destination?: Id;      // exact
    name?: string;         // icontains
};

export type ListRoutesResult = {
    items: Route[];
    total: number;
};

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------
const BASE = "/catalog/routes/";

/** Convierte respuesta DRF a {items,total} usable en UI */
function normalizeList<T>(data: DRFPage<T> | T[]) {
    if (Array.isArray(data)) {
        return { items: data, total: data.length };
    }
    return { items: data.results ?? [], total: Number(data.count ?? 0) };
}

/** Crea una secuencia de stops válida a partir de officeIds en orden y (opcional) offsets.
 *  - order: 0..N
 *  - offsets: si no se proveen, se usa [0, null, null, ...]
 *  - no permite repetidos (el backend también valida, pero esto evita requests inválidos)
 */
export function buildStopsSequence(
    officeIdsInOrder: Array<Id>,
    offsets?: Array<number | null>
): RouteStop[] {
    if (!officeIdsInOrder || officeIdsInOrder.length < 2) {
        throw new Error("Se requieren al menos 2 oficinas (origen y destino).");
    }
    const seen = new Set<string>();
    officeIdsInOrder.forEach((oid) => {
        const key = String(oid);
        if (seen.has(key)) throw new Error("No puede repetirse la misma oficina en la ruta.");
        seen.add(key);
    });

    const N = officeIdsInOrder.length;
    const offs =
        offsets && offsets.length === N
            ? offsets
            : Array.from({ length: N }, (_, i) => (i === 0 ? 0 : null));

    return officeIdsInOrder.map((officeId, idx) => ({
        id: idx, // placeholder local (backend generará id real al crear)
        office: officeId,
        order: idx,
        scheduled_offset_min: offs[idx] ?? null,
    }));
}

// -----------------------------------------------------------------------------
// Endpoints
// -----------------------------------------------------------------------------

export async function listRoutes(params: ListRoutesParams = {}): Promise<ListRoutesResult> {
    const qs = new URLSearchParams();

    if (params.q) qs.set("search", params.q);             // SearchFilter
    if (params.page) qs.set("page", String(params.page));
    if (params.pageSize) qs.set("page_size", String(params.pageSize));
    if (params.ordering) qs.set("ordering", params.ordering);

    // filters
    if (typeof params.active === "boolean") qs.set("active", String(params.active));
    if (params.origin != null) qs.set("origin", String(params.origin));
    if (params.destination != null) qs.set("destination", String(params.destination));
    if (params.name) qs.set("name__icontains", params.name);

    // cache-bust opcional
    qs.set("_", String(Date.now()));

    const url = `${BASE}?${qs.toString()}`;
    const data = await api.get<DRFPage<Route> | Route[]>(url);
    return normalizeList<Route>(data);
}

export async function getRoute(id: Id) {
    return api.get<Route>(`${BASE}${id}/`);
}

// ----------- Crear / Actualizar / Eliminar -----------
export type CreateRouteBody = {
    name: string;
    origin: Id;
    destination: Id;
    active?: boolean;
    stops: Array<{
        office: Id;
        order: number;
        scheduled_offset_min?: number | null;
    }>;
};

export type UpdateRouteBody = Partial<
    Pick<CreateRouteBody, "name" | "active" | "origin" | "destination" | "stops">
>;

export async function createRoute(body: CreateRouteBody) {
    // el backend valida: order 0..N, first=origin, last=destination, no repetidas
    return api.post<Route>(BASE, body);
}

export async function updateRoute(id: Id, body: UpdateRouteBody, opts?: { partial?: boolean }) {
    const method = opts?.partial ? api.patch : api.put;
    return method<Route>(`${BASE}${id}/`, body as any);
}

export async function deleteRoute(id: Id) {
    await api.delete<void>(`${BASE}${id}/`);
    return { ok: true };
}

// ----------- Acción custom: reordenar paradas -----------
// Mantiene origen (order=0) y destino (order=N) fijos.
export async function reorderStops(routeId: Id, stopIdsInNewOrder: Array<Id>) {
    return api.patch<Route>(`${BASE}${routeId}/reorder-stops/`, {
        stop_ids: stopIdsInNewOrder,
    });
}

// ----------- Utilidades para combos / selects -----------
export async function listActiveRoutesLite() {
    const { items } = await listRoutes({ active: true, ordering: "name", pageSize: 200 });
    // Ej: "LPZ-ORU — 4 paradas"
    return items.map((r) => ({
        id: r.id,
        label: `${r.name} — ${r.stops?.length ?? 0} paradas`,
        origin_code: r.origin_code,
        destination_code: r.destination_code,
    }));
}
