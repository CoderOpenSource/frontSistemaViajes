// src/views/catalog/BusesView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    listBuses,
    createBus,
    updateBus,
    deleteBus,
    type Bus,
} from "../../services/buses";

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

type FormBus = {
    id?: Bus["id"];
    code?: string;
    model: string;
    year: number | string;
    plate: string;
    chassis_number: string;
    capacity: number | string;
    active: boolean;
    notes?: string;
};

export default function BusesView() {
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<Bus[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormBus | null>(null);
    const [saving, setSaving] = useState(false);

    const [confirmId, setConfirmId] = useState<Bus["id"] | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [viewing, setViewing] = useState<Bus | null>(null);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const reqSeqRef = useRef(0);

    // helpers UI optimista
    const replaceItem = useCallback((updated: Bus) => {
        setItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    }, []);
    const addItem = useCallback((created: Bus) => {
        setItems((prev) => [created, ...prev]);
    }, []);
    const removeItem = useCallback((id: Bus["id"]) => {
        setItems((prev) => prev.filter((o) => o.id !== id));
    }, []);

    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const { items, total } = await listBuses({ q: qDebounced, page, pageSize, ordering: "code" });
            if (reqSeqRef.current !== mySeq) return;
            setItems(items ?? []);
            setTotal(Number(total ?? 0));
            setError(null);
        } catch (e: any) {
            if (reqSeqRef.current !== mySeq) return;
            const msg = e?.message || "Error cargando buses";
            setError(msg);
            toast.error(msg);
        } finally {
            if (reqSeqRef.current === mySeq) setLoading(false);
        }
    }, [qDebounced, page, pageSize]);

    useEffect(() => { setPage(1); }, [qDebounced]);
    useEffect(() => { fetchList(); }, [fetchList]);

    // Form helpers
    const openCreate = () => {
        setEditing({
            model: "",
            year: new Date().getFullYear(),
            plate: "",
            chassis_number: "",
            capacity: 44,
            active: true,
            notes: "",
        });
        setShowForm(true);
    };

    const openEdit = (b: Bus) => {
        setEditing({
            id: b.id,
            code: b.code,
            model: b.model,
            year: b.year,
            plate: b.plate,
            chassis_number: b.chassis_number,
            capacity: b.capacity,
            active: b.active,
            notes: b.notes ?? "",
        });
        setShowForm(true);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        // Validaciones rápidas UI
        const yearNum = Number(editing.year);
        const capNum = Number(editing.capacity);
        if (isNaN(yearNum) || yearNum < 1980 || yearNum > 2100) {
            toast.error("Año inválido (1980–2100).");
            return;
        }
        if (isNaN(capNum) || capNum <= 0) {
            toast.error("Capacidad inválida.");
            return;
        }

        setSaving(true);
        try {
            const payload = {

                model: editing.model.trim(),
                year: yearNum,
                plate: editing.plate.trim(),
                chassis_number: editing.chassis_number.trim(),
                capacity: capNum,
                active: editing.active,
                notes: (editing.notes ?? "").trim(),
            };

            if (editing.id) {
                const p = updateBus(editing.id, payload);
                toast.promise(p, { loading: "Actualizando bus…", success: "Bus actualizado", error: (err) => err?.message || "Error al actualizar" });
                const updated = await p;
                replaceItem(updated);
            } else {
                const p = createBus(payload);
                toast.promise(p, { loading: "Creando bus…", success: "Bus creado", error: (err) => err?.message || "Error al crear" });
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

    // Delete
    const busToDelete = confirmId != null ? items.find((i) => i.id === confirmId) : null;

    const onDelete = async () => {
        if (!confirmId) return;
        const id = confirmId;
        setDeleting(true);
        try {
            const p = deleteBus(id);
            toast.promise(p, { loading: "Eliminando…", success: "Bus eliminado", error: (err) => err?.message || "Error al eliminar" });
            await p;
            removeItem(id);
            setTotal((t) => Math.max(0, t - 1));
            setConfirmId(null);
            await fetchList();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="mt-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-96">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            {/* icon search */}
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="7" strokeWidth="1.5" />
              <path d="M21 21l-3.6-3.6" strokeWidth="1.5" />
            </svg>
          </span>
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar por código, modelo, placa o chasis…"
                        className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Badge>
            <span className="inline-flex items-center gap-1">
              {/* icon bus */}
                <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="4" y="3" width="16" height="13" rx="2" strokeWidth="1.5" />
                <path d="M6 16v2M18 16v2M4 11h16" strokeWidth="1.5" />
              </svg>
                {total} buses
            </span>
                    </Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nuevo bus
                    </button>
                </div>
            </div>

            {/* Tabla (desktop) / Cards (móvil) */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando buses…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay buses.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden rounded-2xl border md:block">
                            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto overscroll-contain" style={{ scrollbarGutter: "stable both-edges" }}>
                                <table className="w-full text-sm table-fixed min-w-[860px]">
                                    <colgroup>
                                        <col className="w-24" />  {/* Código */}
                                        <col className="w-[18rem]" /> {/* Modelo/Año */}
                                        <col className="w-28" />  {/* Placa */}
                                        <col className="w-[14rem]" /> {/* Chasis */}
                                        <col className="w-24" />  {/* Capacidad */}
                                        <col className="w-24" />  {/* Estado */}
                                        <col className="w-32" />  {/* Acciones */}
                                    </colgroup>

                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2">Código</th>
                                        <th className="px-3 py-2">Modelo / Año</th>
                                        <th className="px-3 py-2">Placa</th>
                                        <th className="px-3 py-2">Chasis</th>
                                        <th className="px-3 py-2">Capacidad</th>
                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {items.map((b) => (
                                        <tr key={b.id} className="border-t align-top">
                                            <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-900">{b.code}</td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center gap-2 truncate" title={`${b.model} (${b.year})`}>
                                                    {/* icon model */}
                                                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                        <rect x="4" y="3" width="16" height="13" rx="2" strokeWidth="1.5" />
                                                    </svg>
                                                    <span className="truncate">{b.model}</span>
                                                    <span className="text-gray-500">· {b.year}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {/* icon plate */}
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="1.5" />
                            </svg>
                              {b.plate}
                          </span>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <div className="truncate" title={b.chassis_number}>{b.chassis_number}</div>
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {/* icon seats */}
                              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <path d="M7 12h10M6 16h12" strokeWidth="1.5" />
                              <rect x="5" y="5" width="14" height="6" rx="2" strokeWidth="1.5" />
                            </svg>
                              {b.capacity}
                          </span>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <Badge variant={b.active ? "success" : "muted"}>{b.active ? "Activo" : "Inactivo"}</Badge>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* Ver */}
                                                    <button
                                                        title="Ver"
                                                        className="rounded p-1 hover:bg-gray-100"
                                                        onClick={() => setViewing(b)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                                        </svg>
                                                    </button>
                                                    {/* Editar */}
                                                    <button
                                                        title="Editar"
                                                        className="rounded p-1 hover:bg-gray-100"
                                                        onClick={() => openEdit(b)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                                  d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                                        </svg>
                                                    </button>
                                                    {/* Eliminar */}
                                                    <button
                                                        title="Eliminar"
                                                        className="rounded p-1 text-red-600 hover:bg-red-50"
                                                        onClick={() => setConfirmId(b.id)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                                  d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Mobile cards */}
                        <div className="grid gap-2 md:hidden">
                            {items.map((b) => (
                                <div key={b.id} className="rounded-2xl border p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">{b.code}</div>
                                        <Badge variant={b.active ? "success" : "muted"}>{b.active ? "Activo" : "Inactivo"}</Badge>
                                    </div>
                                    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Modelo/Año</dt>
                                        <dd className="col-span-2 truncate">{b.model} · {b.year}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Placa</dt>
                                        <dd className="col-span-2 truncate">{b.plate}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Chasis</dt>
                                        <dd className="col-span-2 truncate">{b.chassis_number}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Capacidad</dt>
                                        <dd className="col-span-2 truncate">{b.capacity}</dd>
                                    </dl>

                                    <div className="mt-3 flex justify-end gap-4 text-xs">
                                        <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => setViewing(b)}>
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                            </svg>
                                            Ver
                                        </button>
                                        <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => openEdit(b)}>
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                      d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                            </svg>
                                            Editar
                                        </button>
                                        <button className="inline-flex items-center gap-1.5 text-red-600 hover:underline" onClick={() => setConfirmId(b.id)}>
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                      d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7" />
                                            </svg>
                                            Eliminar
                                        </button>
                                    </div>
                                </div>
                            ))}
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
                    <span className="text-sm text-gray-600">Página <b>{page}</b> / {totalPages}</span>
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        →
                    </button>
                </div>
            )}

            {/* Modal Crear/Editar */}
            {showForm && editing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}>
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editing.id ? "Editar bus" : "Nuevo bus"}</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">✕</button>
                        </div>

                        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {/* Código: solo lectura en edición */}
                                {editing?.id && (
                                    <div>
                                        <label className="text-sm text-gray-700">Código</label>
                                        <input
                                            disabled
                                            className="mt-1 w-full rounded-xl border bg-gray-50 px-3 py-2 text-sm"
                                            value={editing.code ?? ""}
                                            readOnly
                                        />
                                        <p className="mt-1 text-xs text-gray-500">
                                            Se genera automáticamente en el backend.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="text-sm text-gray-700">Año</label>
                                    <input type="number" min={1980} max={2100} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                           value={editing.year} onChange={(e) => setEditing((s) => ({ ...s!, year: e.target.value }))} required />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-gray-700">Modelo</label>
                                <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                       value={editing.model} onChange={(e) => setEditing((s) => ({ ...s!, model: e.target.value }))} required />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Placa</label>
                                    <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                           value={editing.plate} onChange={(e) => setEditing((s) => ({ ...s!, plate: e.target.value }))} required />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Chasis</label>
                                    <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                           value={editing.chassis_number} onChange={(e) => setEditing((s) => ({ ...s!, chassis_number: e.target.value }))} required />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Capacidad</label>
                                    <input type="number" min={1} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                           value={editing.capacity} onChange={(e) => setEditing((s) => ({ ...s!, capacity: e.target.value }))} required />
                                </div>
                                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                    <input type="checkbox" className="h-4 w-4" checked={editing.active}
                                           onChange={(e) => setEditing((s) => ({ ...s!, active: e.target.checked }))} />
                                    Activo
                                </label>
                            </div>

                            <div>
                                <label className="text-sm text-gray-700">Notas</label>
                                <textarea rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                          value={editing.notes ?? ""} onChange={(e) => setEditing((s) => ({ ...s!, notes: e.target.value }))} />
                            </div>

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>Cancelar</button>
                                <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50">
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal VER (solo lectura) */}
            {viewing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setViewing(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Detalle de bus</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setViewing(null)} aria-label="Cerrar">✕</button>
                        </div>

                        <div className="mt-3 space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Código" value={viewing.code} />
                                <Field label="Estado" value={<Badge variant={viewing.active ? "success" : "muted"}>{viewing.active ? "Activo" : "Inactivo"}</Badge>} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Modelo" value={viewing.model} />
                                <Field label="Año" value={String(viewing.year)} />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Placa" value={viewing.plate} />
                                <Field label="Chasis" value={viewing.chassis_number} />
                            </div>
                            <Field label="Capacidad" value={`${viewing.capacity} asientos`} />
                            <Field label="Notas" value={viewing.notes || "—"} />
                            <Field label="Creado" value={viewing.created_at ? new Date(viewing.created_at).toLocaleString() : "—"} />
                        </div>

                        <div className="mt-4 flex justify-end">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setViewing(null)}>Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirmación eliminar */}
            {confirmId !== null && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Eliminar bus</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">✕</button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar <b>{busToDelete?.code}</b>
                            {busToDelete?.plate ? ` (placa ${busToDelete.plate})` : ""}? Esta acción no se puede deshacer.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setConfirmId(null)}>Cancelar</button>
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
