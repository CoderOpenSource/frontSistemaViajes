// src/views/catalog/RoutesView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    listRoutes,
    createRoute,
    updateRoute,
    deleteRoute,
    reorderStops,
    type Route,
} from "../../services/routes";
import { listActiveOfficesLite } from "../../services/office";
import RouteStopsEditor, { type StopRow } from "./RouteStopsEditor";

const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

const Badge = ({ children, variant = "muted" }: { children: React.ReactNode; variant?: "success" | "muted" }) => {
    const cls = variant === "success" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700";
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
};

function useDebouncedValue<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

type OfficeOption = { id: number | string; label: string };

type FormRoute = {
    id?: Route["id"];
    name: string;
    origin: number | string | "";
    destination: number | string | "";
    active: boolean;
    // Mantener estructura compatible con StopRow
    stops: Array<{ office: number | string; order: number; scheduled_offset_min: number | null }>;
};

export default function RoutesView() {
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<Route[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const reqSeqRef = useRef(0);
    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

    // oficinas
    const [officeOptions, setOfficeOptions] = useState<OfficeOption[]>([]);
    const [loadingOffices, setLoadingOffices] = useState(true);

    // edición
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormRoute | null>(null);
    const [saving, setSaving] = useState(false);

    // ver
    const [viewing, setViewing] = useState<Route | null>(null);

    // eliminar
    const [confirmId, setConfirmId] = useState<Route["id"] | null>(null);
    const [deleting, setDeleting] = useState(false);

    const replaceItem = useCallback((updated: Route) => {
        setItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    }, []);
    const addItem = useCallback((created: Route) => setItems((prev) => [created, ...prev]), []);
    const removeItem = useCallback((id: Route["id"]) => setItems((prev) => prev.filter((o) => o.id !== id)), []);

    // === PREVIEW (ojito) ===
    type PreviewStop = { label: string; offset: number | null; order?: number };
    const [showPreview, setShowPreview] = useState(false);
    const [previewTitle, setPreviewTitle] = useState<string>("");
    const [previewStops, setPreviewStops] = useState<PreviewStop[]>([]);

    const asPreview = (stops: Array<{ office: any; order: number; scheduled_offset_min: number | null }>) =>
        [...stops]
            .sort((a, b) => a.order - b.order)
            .map((s) => ({
                label: officeLabel(s.office),
                offset: s.scheduled_offset_min ?? null,
                order: s.order,
            }));

    const openPreviewFromRoute = (r: Route) => {
        setPreviewTitle(r.name || "Ruta");
        setPreviewStops(
            [...(r.stops ?? [])]
                .sort((a, b) => a.order - b.order)
                .map((s) => ({
                    label: (s.office_name || s.office_code || s.office) as any,
                    offset: s.scheduled_offset_min ?? null,
                    order: s.order,
                }))
        );
        setShowPreview(true);
    };

    const openPreviewFromEditing = () => {
        if (!editing) return;
        const snap = ensureStopsWithEndpoints(editing);
        setPreviewTitle(snap.name || "Nueva ruta");
        setPreviewStops(asPreview(snap.stops ?? []));
        setShowPreview(true);
    };

    // cargar combos
    useEffect(() => {
        (async () => {
            try {
                setLoadingOffices(true);
                const opts = await listActiveOfficesLite();
                setOfficeOptions(opts);
            } catch (e: any) {
                toast.error(e?.message || "Error cargando oficinas");
            } finally {
                setLoadingOffices(false);
            }
        })();
    }, []);

    // listar
    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const { items, total } = await listRoutes({ q: qDebounced, page, pageSize, ordering: "name" });
            if (reqSeqRef.current !== mySeq) return;
            setItems(items ?? []);
            setTotal(Number(total ?? 0));
            setError(null);
        } catch (e: any) {
            if (reqSeqRef.current !== mySeq) return;
            const msg = e?.message || "Error cargando rutas";
            setError(msg);
            toast.error(msg);
        } finally {
            if (reqSeqRef.current === mySeq) setLoading(false);
        }
    }, [qDebounced, page, pageSize]);

    useEffect(() => setPage(1), [qDebounced]);
    useEffect(() => void fetchList(), [fetchList]);

    // ===== Helpers =====
    const officeLabel = (id: number | string) =>
        officeOptions.find((o) => String(o.id) === String(id))?.label ?? String(id);

    /**
     * Asegura que el arreglo de stops contenga extremos (origen/destino) coherentes
     * sin construir offsets de nuevo (evita duplicaciones).
     */
    const ensureStopsWithEndpoints = (ed: FormRoute): FormRoute => {
        let arr: FormRoute["stops"] = [...(ed.stops ?? [])].map((s) => ({ ...s }));

        // si no hay nada y tenemos orígenes/destinos, inicializa
        if (arr.length === 0) {
            if (ed.origin && ed.destination && String(ed.origin) !== String(ed.destination)) {
                arr = [
                    { office: ed.origin, order: 0, scheduled_offset_min: 0 },
                    { office: ed.destination, order: 1, scheduled_offset_min: null },
                ];
            } else if (ed.origin) {
                arr = [{ office: ed.origin, order: 0, scheduled_offset_min: 0 }];
            }
        }

        // sincroniza extremos con origin/destination (si existen)
        if (ed.origin) {
            if (arr.length === 0) {
                arr.push({ office: ed.origin, order: 0, scheduled_offset_min: 0 });
            } else {
                arr[0] = { ...arr[0], office: ed.origin, scheduled_offset_min: 0 };
            }
        }
        if (ed.destination) {
            if (arr.length < 2) {
                arr.push({
                    office: ed.destination,
                    order: arr.length,
                    scheduled_offset_min: arr.length === 0 ? null : arr[arr.length - 1].scheduled_offset_min ?? null,
                });
            } else {
                arr[arr.length - 1] = { ...arr[arr.length - 1], office: ed.destination };
            }
        }

        // elimina duplicados iguales a extremos dentro de intermedias
        const originId = ed.origin ? String(ed.origin) : null;
        const destId = ed.destination ? String(ed.destination) : null;
        if (arr.length >= 2) {
            arr = arr.filter((s, idx) => {
                if (idx === 0 || idx === arr.length - 1) return true;
                const sid = String(s.office);
                if (originId && sid === originId) return false;
                if (destId && sid === destId) return false;
                return true;
            });
        }

        // normaliza order
        arr = arr.map((s, i) => ({ ...s, order: i }));

        return { ...ed, stops: arr };
    };

    // oficinas disponibles para intermedias (sin duplicar, sin extremos)
    const availableOffices = (ed: FormRoute, currentIndex?: number) => {
        const stops = ed.stops ?? [];
        const used = new Set(stops.filter((_, idx) => idx !== currentIndex).map((s) => String(s.office)));
        const originId = String(ed.origin ?? "");
        const destId = String(ed.destination ?? "");
        return officeOptions.filter((o) => {
            const oid = String(o.id);
            if (oid === originId || oid === destId) return false;
            if (used.has(oid)) return false;
            return true;
        });
    };

    const canSave = useMemo(() => {
        if (!editing) return false;
        if (!editing.name || !editing.origin || !editing.destination) return false;
        if (String(editing.origin) === String(editing.destination)) return false;
        const ed = ensureStopsWithEndpoints(editing);
        return (ed.stops?.length ?? 0) >= 2;
    }, [editing]);

    // ===== Abrir modales =====
    const openCreate = () => {
        setEditing({ name: "", origin: "", destination: "", active: true, stops: [] });
        setShowForm(true);
    };

    const openEdit = (r: Route) => {
        const ordered = [...(r.stops ?? [])].sort((a, b) => a.order - b.order);
        setEditing({
            id: r.id,
            name: r.name,
            origin: r.origin,
            destination: r.destination,
            active: r.active,
            stops: ordered.map((s) => ({
                office: s.office,
                order: s.order,
                scheduled_offset_min: s.scheduled_offset_min ?? null,
            })),
        });
        setShowForm(true);
    };

    // ===== CRUD form helpers =====
    const addIntermediateStop = () => {
        setEditing((s) => {
            if (!s) return s;
            const ed = ensureStopsWithEndpoints(s);
            const avail = availableOffices(ed);
            if (avail.length === 0) {
                toast.info("No hay más oficinas disponibles para agregar como parada.");
                return s;
            }
            const officeToAdd = avail[0].id;
            const arr = [...(ed.stops ?? [])];
            const insertIndex = Math.max(1, arr.length - 1); // antes del destino
            arr.splice(insertIndex, 0, { office: officeToAdd, order: insertIndex, scheduled_offset_min: null });
            const withOrder = arr.map((st, idx) => ({ ...st, order: idx }));
            return { ...ed, stops: withOrder };
        });
    };

    // Cambios desde el RouteStopsEditor (mover/eliminar/cambiar offset)
    const setStopsFromEditor = (updater: (prev: StopRow[]) => StopRow[]) => {
        setEditing((s) => {
            if (!s) return s;
            const ed = ensureStopsWithEndpoints(s);
            const next = updater(ed.stops as StopRow[]);
            const normalized = next.map((st, i) => ({ office: st.office, order: i, scheduled_offset_min: st.scheduled_offset_min ?? null }));

            // Mantener coherentes origin/destination con extremos mostrados
            const first = normalized[0]?.office;
            const last = normalized[normalized.length - 1]?.office;
            return {
                ...ed,
                origin: first ?? ed.origin,
                destination: last ?? ed.destination,
                stops: normalized,
            };
        });
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSaving(true);
        try {
            const snapshot = ensureStopsWithEndpoints(editing);

            if (!snapshot.origin || !snapshot.destination) {
                toast.error("Debes seleccionar origen y destino.");
                return;
            }
            if (String(snapshot.origin) === String(snapshot.destination)) {
                toast.error("Origen y destino deben ser diferentes.");
                return;
            }
            if ((snapshot.stops?.length ?? 0) < 2) {
                toast.error("Debes tener al menos dos paradas (origen y destino).");
                return;
            }

            if (snapshot.id) {
                const p = updateRoute(snapshot.id, {
                    name: snapshot.name,
                    origin: snapshot.origin,
                    destination: snapshot.destination,
                    active: snapshot.active,
                    stops: snapshot.stops.map((s) => ({
                        office: s.office,
                        order: s.order,
                        scheduled_offset_min: s.scheduled_offset_min ?? null,
                    })),
                });
                toast.promise(p, {
                    loading: "Actualizando ruta…",
                    success: "Ruta actualizada",
                    error: (err) => err?.message || "Error al actualizar",
                });
                const updated = await p;
                replaceItem(updated);
            } else {
                const p = createRoute({
                    name: snapshot.name,
                    origin: snapshot.origin,
                    destination: snapshot.destination,
                    active: snapshot.active,
                    stops: snapshot.stops.map((s) => ({
                        office: s.office,
                        order: s.order,
                        scheduled_offset_min: s.scheduled_offset_min ?? null,
                    })),
                });
                toast.promise(p, {
                    loading: "Creando ruta…",
                    success: "Ruta creada",
                    error: (err) => err?.message || "Error al crear",
                });
                const created = await p;
                addItem(created);
                setTotal((t) => t + 1);
            }
            setShowForm(false);
            await fetchList();
        } finally {
            setSaving(false);
        }
    };

    // eliminar
    const routeToDelete = confirmId != null ? items.find((i) => i.id === confirmId) : null;
    const onDelete = async () => {
        if (!confirmId) return;
        const id = confirmId;
        setDeleting(true);
        try {
            const p = deleteRoute(id);
            toast.promise(p, { loading: "Eliminando…", success: "Ruta eliminada", error: (err) => err?.message || "Error al eliminar" });
            await p;
            removeItem(id);
            setTotal((t) => Math.max(0, t - 1));
            setConfirmId(null);
            await fetchList();
        } finally {
            setDeleting(false);
        }
    };

    // reordenado rápido desde la tabla (usa ids reales)
    const doReorder = async (route: Route, index: number, dir: -1 | 1) => {
        const ordered = [...(route.stops ?? [])].sort((a, b) => a.order - b.order);
        if (index <= 0 || index >= ordered.length - 1) return;
        const newIndex = index + dir;
        if (newIndex <= 0 || newIndex >= ordered.length - 1) return;

        const arr = [...ordered];
        const [it] = arr.splice(index, 1);
        arr.splice(newIndex, 0, it);
        const newOrderIds = arr.map((s) => s.id);

        const p = reorderStops(route.id, newOrderIds as Array<number | string>);
        toast.promise(p, { loading: "Reordenando paradas…", success: "Paradas reordenadas", error: (err) => err?.message || "No se pudo reordenar" });
        const updated = await p;
        replaceItem(updated);
    };

    // ===== Render =====
    const edForBtn = editing ? ensureStopsWithEndpoints(editing) : null;
    const canAddIntermediate = !!edForBtn?.origin && !!edForBtn?.destination && availableOffices(edForBtn!).length > 0;

    return (
        <div className="mt-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-96">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="7" strokeWidth="1.5" />
              <path d="M21 21l-3.6-3.6" strokeWidth="1.5" />
            </svg>
          </span>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar por nombre, origen o destino…"
                        className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Badge>{total} rutas</Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nueva ruta
                    </button>
                </div>
            </div>

            {/* Tabla / Cards */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando rutas…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay rutas.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden rounded-2xl border md:block">
                            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto overscroll-contain" style={{ scrollbarGutter: "stable both-edges" }}>
                                <table className="w-full min-w-[900px] table-fixed text-sm">
                                    <colgroup>
                                        <col className="w-56" />
                                        <col className="w-40" />
                                        <col className="w-40" />
                                        <col className="w-20" />
                                        <col className="w-24" />
                                        <col className="w-[320px]" />
                                    </colgroup>
                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2">Nombre</th>
                                        <th className="px-3 py-2">Origen</th>
                                        <th className="px-3 py-2">Destino</th>
                                        <th className="px-3 py-2">Paradas</th>
                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.map((r) => {
                                        const stopsOrdered = [...(r.stops ?? [])].sort((a, b) => a.order - b.order);
                                        return (
                                            <tr key={r.id} className="border-t align-top">
                                                <td className="px-3 py-1.5">
                                                    <div className="truncate font-medium text-gray-900" title={r.name}>
                                                        {r.name}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-1.5 whitespace-nowrap">{r.origin_code || "—"}</td>
                                                <td className="px-3 py-1.5 whitespace-nowrap">{r.destination_code || "—"}</td>
                                                <td className="px-3 py-1.5 whitespace-nowrap">{stopsOrdered.length}</td>
                                                <td className="px-3 py-1.5">
                                                    <Badge variant={r.active ? "success" : "muted"}>{r.active ? "Activa" : "Inactiva"}</Badge>
                                                </td>
                                                <td className="px-3 py-1.5">
                                                    <div className="flex items-center justify-end gap-1.5">
                                                        {stopsOrdered.length >= 2 && (
                                                            <div className="mr-auto hidden max-w-[190px] truncate text-xs text-gray-600 lg:block">
                                                                {stopsOrdered.map((s, idx) => (
                                                                    <span key={s.id}>
                                      {idx > 0 ? " → " : ""}
                                                                        {s.office_name || s.office_code || s.office}
                                    </span>
                                                                ))}
                                                            </div>
                                                        )}
                                                        {/* Ver (ojito) */}
                                                        <button title="Ver" className="rounded p-1 hover:bg-gray-100" onClick={() => openPreviewFromRoute(r)}>
                                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                                <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                                            </svg>
                                                        </button>

                                                        <button title="Editar" className="rounded p-1 hover:bg-gray-100" onClick={() => openEdit(r)}>
                                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                                            </svg>
                                                        </button>
                                                        {stopsOrdered.length > 3 && (
                                                            <>
                                                                <button title="Subir parada (intermedia)" className="rounded p-1 hover:bg-gray-100" onClick={() => doReorder(r, 1, -1)}>
                                                                    ↑
                                                                </button>
                                                                <button title="Bajar parada (intermedia)" className="rounded p-1 hover:bg-gray-100" onClick={() => doReorder(r, stopsOrdered.length - 2, +1)}>
                                                                    ↓
                                                                </button>
                                                            </>
                                                        )}
                                                        <button title="Eliminar" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => setConfirmId(r.id)}>
                                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile */}
                        <div className="grid gap-2 md:hidden">
                            {items.map((r) => {
                                const stopsOrdered = [...(r.stops ?? [])].sort((a, b) => a.order - b.order);
                                return (
                                    <div key={r.id} className="rounded-2xl border p-3">
                                        <dl className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Nombre</dt>
                                            <dd className="col-span-2 truncate text-gray-900">{r.name}</dd>
                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Origen</dt>
                                            <dd className="col-span-2 truncate text-gray-700">{r.origin_code || "—"}</dd>
                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Destino</dt>
                                            <dd className="col-span-2 truncate text-gray-700">{r.destination_code || "—"}</dd>
                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Paradas</dt>
                                            <dd className="col-span-2 truncate text-gray-700">{stopsOrdered.length}</dd>
                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Estado</dt>
                                            <dd className="col-span-2">
                                                <Badge variant={r.active ? "success" : "muted"}>{r.active ? "Activa" : "Inactiva"}</Badge>
                                            </dd>
                                        </dl>
                                        <div className="mt-3 flex justify-end gap-4 text-xs">
                                            <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => openPreviewFromRoute(r)}>
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                    <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                                </svg>
                                                <span>Ver</span>
                                            </button>

                                            <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => openEdit(r)}>
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                                </svg>
                                                <span>Editar</span>
                                            </button>
                                            <button className="inline-flex items-center gap-1.5 text-red-600 hover:underline" onClick={() => setConfirmId(r.id)}>
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7" />
                                                </svg>
                                                <span>Eliminar</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        ←
                    </button>
                    <span className="text-sm text-gray-600">
            Página <b>{page}</b> / {totalPages}
          </span>
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        →
                    </button>
                </div>
            )}

            {/* Modal PREVIEW (ojito) */}
            {showPreview && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setShowPreview(false)}>
                    <div className="w-full max-w-3xl rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold">{previewTitle}</h3>
                                <p className="text-xs text-gray-600">Secuencia de paradas (origen → destino)</p>
                            </div>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowPreview(false)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>

                        {/* Chips con scroll horizontal en móvil */}
                        <div className="mt-4">
                            <div className="rounded-xl border p-3">
                                <div className="flex items-stretch gap-2 overflow-x-auto pb-2" style={{ scrollbarGutter: "stable both-edges" }}>
                                    {previewStops
                                        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                        .map((s, i) => (
                                            <div key={`${s.label}-${i}`} className="flex items-center gap-2 shrink-0">
                                                <div className="min-w-[9rem] rounded-xl border px-3 py-2">
                                                    <div className="text-xs font-medium text-gray-900 truncate" title={s.label}>
                                                        {i === 0 ? "Origen: " : i === previewStops.length - 1 ? "Destino: " : ""}
                                                        {s.label}
                                                    </div>
                                                    <div className="text-[11px] text-gray-500">{s.offset != null ? `+${s.offset} min` : "—"}</div>
                                                </div>
                                                {i < previewStops.length - 1 && (
                                                    <div className="flex h-full items-center">
                                                        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path d="M5 12h14M13 5l7 7-7 7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                                        </svg>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>

                                {/* Vista tipo timeline para pantallas >= md */}
                                <div className="mt-4 hidden md:block">
                                    <ol className="grid grid-cols-12 gap-2">
                                        {previewStops
                                            .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                                            .map((s, i) => (
                                                <li key={`row-${i}`} className="col-span-12">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`h-2 w-2 rounded-full ${i === 0 ? "bg-green-500" : i === previewStops.length - 1 ? "bg-blue-500" : "bg-gray-400"}`} />
                                                        <div className="flex-1">
                                                            <div className="text-sm font-medium text-gray-900">{s.label}</div>
                                                            <div className="text-xs text-gray-500">{s.offset != null ? `Offset +${s.offset} min` : "Offset —"}</div>
                                                        </div>
                                                    </div>
                                                </li>
                                            ))}
                                    </ol>
                                </div>
                            </div>
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowPreview(false)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Crear/Editar */}
            {showForm && editing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}>
                    <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editing.id ? "Editar ruta" : "Nueva ruta"}</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>

                        <form className="mt-3 space-y-4" onSubmit={onSubmit}>
                            <div>
                                <label className="text-sm text-gray-700">Nombre</label>
                                <input
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    value={editing.name}
                                    onChange={(e) => setEditing((s) => ({ ...s!, name: e.target.value }))}
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Origen</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.origin}
                                        onChange={(e) =>
                                            setEditing((s) => {
                                                const next = ensureStopsWithEndpoints({ ...(s as FormRoute), origin: e.target.value });
                                                return next;
                                            })
                                        }
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {officeOptions.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Destino</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.destination}
                                        onChange={(e) =>
                                            setEditing((s) => {
                                                const next = ensureStopsWithEndpoints({ ...(s as FormRoute), destination: e.target.value });
                                                return next;
                                            })
                                        }
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {officeOptions.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Builder con RouteStopsEditor */}
                            <div className="rounded-xl border">
                                <div className="flex items-center justify-between border-b px-3 py-2">
                                    <div className="text-sm font-medium">Paradas (orden de viaje)</div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={addIntermediateStop}
                                            disabled={!canAddIntermediate || loadingOffices}
                                            className="inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-xs transition hover:bg-black hover:text-white disabled:opacity-50"
                                            title={!canAddIntermediate ? "No hay oficinas disponibles para agregar" : ""}
                                        >
                                            + Añadir parada intermedia
                                        </button>
                                        <button
                                            type="button"
                                            className="rounded-xl border px-3 py-1.5 text-xs"
                                            onClick={openPreviewFromEditing}
                                            disabled={(ensureStopsWithEndpoints(editing).stops?.length ?? 0) < 2}
                                        >
                                            👁️ Ver secuencia
                                        </button>
                                    </div>
                                </div>

                                <div className="max-h-[42vh] overflow-y-auto p-3">
                                    <RouteStopsEditor
                                        stops={(ensureStopsWithEndpoints(editing).stops as StopRow[]) ?? []}
                                        setStops={setStopsFromEditor}
                                        readOnlyFirstAndLast={true}
                                        getOfficeLabel={(id) => officeOptions.find(o => String(o.id) === String(id))?.label ?? String(id)}
                                    />

                                    <p className="mt-2 text-[11px] text-gray-500">Arrastra con ↑/↓, edita offsets. Origen/Destino se controlan arriba.</p>
                                </div>
                            </div>

                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                <input type="checkbox" className="h-4 w-4" checked={editing.active} onChange={(e) => setEditing((s) => ({ ...s!, active: e.target.checked }))} />
                                Activa
                            </label>

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>
                                    Cancelar
                                </button>
                                <button disabled={saving || !canSave} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50">
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal VER */}
            {viewing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setViewing(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Detalle de ruta</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setViewing(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>
                        <div className="mt-3 space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Nombre" value={viewing.name} />
                                <Field label="Estado" value={<Badge variant={viewing.active ? "success" : "muted"}>{viewing.active ? "Activa" : "Inactiva"}</Badge>} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Origen" value={viewing.origin_code || "—"} />
                                <Field label="Destino" value={viewing.destination_code || "—"} />
                            </div>
                            <div>
                                <div className="text-[10px] uppercase tracking-wide text-gray-500">Paradas</div>
                                <ol className="mt-1 list-decimal space-y-0.5 pl-5">
                                    {[...(viewing.stops ?? [])]
                                        .sort((a, b) => a.order - b.order)
                                        .map((s) => (
                                            <li key={s.id}>
                                                {(s.office_name || s.office_code || s.office) as any} {s.scheduled_offset_min != null ? <span className="text-gray-500">· +{s.scheduled_offset_min} min</span> : null}
                                            </li>
                                        ))}
                                </ol>
                            </div>
                        </div>
                        <div className="mt-4 flex justify-end">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setViewing(null)}>
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmación eliminar */}
            {confirmId !== null && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Eliminar ruta</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar <b>{routeToDelete?.name || ""}</b>? Esta acción no se puede deshacer.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setConfirmId(null)}>
                                Cancelar
                            </button>
                            <button className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50" onClick={onDelete} disabled={deleting}>
                                {deleting && <Spinner />} Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

    function Field({ label, value }: { label: string; value: React.ReactNode }) {
        return (
            <div>
                <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
                <div className="mt-0.5 text-gray-800">{value}</div>
            </div>
        );
    }
}
