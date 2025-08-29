// src/views/catalog/BusesView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    listBuses,
    createBus,
    updateBus,
    deleteBus,
    getBusSeatBlocks,
    KIND_OPTIONS,
    type Bus,
    type SeatBlock,
    type UpsertBusBody,
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

    // Imágenes
    frontFile?: File | null;
    backFile?: File | null;
    leftFile?: File | null;
    rightFile?: File | null;

    frontUrl?: string | null;
    backUrl?: string | null;
    leftUrl?: string | null;
    rightUrl?: string | null;

    clearFront?: boolean;
    clearBack?: boolean;
    clearLeft?: boolean;
    clearRight?: boolean;

    // Bloques de asientos
    seat_blocks: (SeatBlock & { count: number | string; start_number?: number | string })[];
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

    useEffect(() => {
        setPage(1);
    }, [qDebounced]);
    useEffect(() => {
        fetchList();
    }, [fetchList]);

    // Form helpers
    const openCreate = () => {
        const defaultCap = 44;
        setEditing({
            model: "",
            year: new Date().getFullYear(),
            plate: "",
            chassis_number: "",
            capacity: defaultCap,
            active: true,
            notes: "",

            frontFile: null,
            backFile: null,
            leftFile: null,
            rightFile: null,
            frontUrl: null,
            backUrl: null,
            leftUrl: null,
            rightUrl: null,
            clearFront: false,
            clearBack: false,
            clearLeft: false,
            clearRight: false,

            // por defecto, un solo bloque en piso 1 NORMAL con toda la capacidad
            seat_blocks: [{ deck: 1, kind: "NORMAL", count: defaultCap, start_number: 1 }],
        });
        setShowForm(true);
    };

    const openEdit = async (b: Bus) => {
        // Abre el modal rápido con datos base
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

            // URLs existentes del backend
            frontUrl: b.photo_front ?? null,
            backUrl: b.photo_back ?? null,
            leftUrl: b.photo_left ?? null,
            rightUrl: b.photo_right ?? null,

            // archivos aún no cargados
            frontFile: null,
            backFile: null,
            leftFile: null,
            rightFile: null,

            clearFront: false,
            clearBack: false,
            clearLeft: false,
            clearRight: false,

            seat_blocks: [], // luego precargamos desde el backend
        });
        setShowForm(true);

        // Trae los bloques actuales reconstruidos para que el usuario los vea/edite
        try {
            const blocks = await getBusSeatBlocks(b.id);
            setEditing((s) =>
                s
                    ? {
                        ...s,
                        seat_blocks: (blocks ?? []).map((blk) => ({
                            ...blk,
                            count: Number(blk.count),
                            start_number: blk.start_number ?? 1,
                        })),
                    }
                    : s
            );
        } catch (e: any) {
            toast.error(e?.message || "No se pudieron cargar los bloques de asientos.");
        }
    };

    const blocksSum = useMemo(() => {
        if (!editing) return 0;
        return (editing.seat_blocks ?? []).reduce((acc, b) => acc + (Number(b.count) || 0), 0);
    }, [editing]);

    const capacityNum = useMemo(() => Number(editing?.capacity ?? 0), [editing]);
    const capacityOk = blocksSum === capacityNum;

    const addBlock = () => {
        setEditing((s) => {
            if (!s) return s;
            const last = s.seat_blocks?.[s.seat_blocks.length - 1];
            const nextStart = (last ? Number(last.start_number || 1) + Number(last.count || 0) : 1) || 1;
            return {
                ...s,
                seat_blocks: [...(s.seat_blocks ?? []), { deck: 1, kind: "NORMAL", count: 1, start_number: nextStart }],
            };
        });
    };

    const removeBlock = (idx: number) => {
        setEditing((s) => {
            if (!s) return s;
            const copy = [...(s.seat_blocks ?? [])];
            copy.splice(idx, 1);
            return { ...s, seat_blocks: copy };
        });
    };

    const updateBlock = (
        idx: number,
        patch: Partial<SeatBlock & { count: number | string; start_number?: number | string }>
    ) => {
        setEditing((s) => {
            if (!s) return s;
            const copy = [...(s.seat_blocks ?? [])];
            copy[idx] = { ...copy[idx], ...patch };
            return { ...s, seat_blocks: copy };
        });
    };

    // Previews locales (revocación de blob URLs)
    const frontPreview = editing?.frontFile ? URL.createObjectURL(editing.frontFile) : editing?.frontUrl || null;
    const backPreview = editing?.backFile ? URL.createObjectURL(editing.backFile) : editing?.backUrl || null;
    const leftPreview = editing?.leftFile ? URL.createObjectURL(editing.leftFile) : editing?.leftUrl || null;
    const rightPreview = editing?.rightFile ? URL.createObjectURL(editing.rightFile) : editing?.rightUrl || null;
    useEffect(() => {
        return () => {
            if (frontPreview?.startsWith("blob:")) URL.revokeObjectURL(frontPreview);
            if (backPreview?.startsWith("blob:")) URL.revokeObjectURL(backPreview);
            if (leftPreview?.startsWith("blob:")) URL.revokeObjectURL(leftPreview);
            if (rightPreview?.startsWith("blob:")) URL.revokeObjectURL(rightPreview);
        };
    }, [frontPreview, backPreview, leftPreview, rightPreview]);

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

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

        const hasBlocks = (editing.seat_blocks ?? []).length > 0;
        if (hasBlocks && !capacityOk) {
            toast.error(`La suma de bloques (${blocksSum}) debe igualar la capacidad (${capNum}).`);
            return;
        }

        setSaving(true);
        try {
            const payload: UpsertBusBody = {
                model: editing.model.trim(),
                year: yearNum,
                plate: editing.plate.trim(),
                chassis_number: editing.chassis_number.trim(),
                capacity: capNum,
                active: editing.active,
                notes: (editing.notes ?? "").trim() || undefined,
            };

            // fotos -> si hay archivo, lo mandamos; si se marcó quitar, mandamos null; si no, omitimos campo
            if (editing.frontFile) payload.photo_front = editing.frontFile;
            else if (editing.clearFront) payload.photo_front = null;

            if (editing.backFile) payload.photo_back = editing.backFile;
            else if (editing.clearBack) payload.photo_back = null;

            if (editing.leftFile) payload.photo_left = editing.leftFile;
            else if (editing.clearLeft) payload.photo_left = null;

            if (editing.rightFile) payload.photo_right = editing.rightFile;
            else if (editing.clearRight) payload.photo_right = null;

            // seat_blocks
            const seatBlocks = hasBlocks
                ? (editing.seat_blocks ?? []).map((b) => ({
                    deck: Number(b.deck) as 1 | 2,
                    kind: b.kind,
                    count: Number(b.count),
                    start_number: b.start_number ? Number(b.start_number) : undefined,
                }))
                : undefined;

            if (seatBlocks) (payload as any).seat_blocks = seatBlocks;

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

            {/* Tabla / Cards */}
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
                                <table className="w-full text-sm table-fixed min-w-[980px]">
                                    <colgroup>
                                        <col className="w-24" />
                                        <col className="w-[16rem]" />
                                        <col className="w-28" />
                                        <col className="w-[14rem]" />
                                        <col className="w-24" />
                                        <col className="w-24" />
                                        <col className="w-40" />
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
                                                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                        <rect x="4" y="3" width="16" height="13" rx="2" strokeWidth="1.5" />
                                                    </svg>
                                                    <span className="truncate">{b.model}</span>
                                                    <span className="text-gray-500">· {b.year}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                              <rect x="3" y="7" width="18" height="10" rx="2" strokeWidth="1.5" />
                            </svg>
                              {b.plate}
                          </span>
                                            </td>
                                            <td className="px-3 py-1.5">
                                                <div className="truncate" title={b.chassis_number}>
                                                    {b.chassis_number}
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
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
                                                    <button title="Ver" className="rounded p-1 hover:bg-gray-100" onClick={() => setViewing(b)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                                        </svg>
                                                    </button>
                                                    <button title="Editar" className="rounded p-1 hover:bg-gray-100" onClick={() => openEdit(b)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                                        </svg>
                                                    </button>
                                                    <button title="Eliminar" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => setConfirmId(b.id)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a 2 2 0 0 0 2-2V7" />
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
                                        <dd className="col-span-2 truncate">
                                            {b.model} · {b.year}
                                        </dd>

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
                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                            </svg>
                                            Editar
                                        </button>
                                        <button className="inline-flex items-center gap-1.5 text-red-600 hover:underline" onClick={() => setConfirmId(b.id)}>
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a 2 2 0 0 0 2-2V7" />
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
                    <span className="text-sm text-gray-600">
            Página <b>{page}</b> / {totalPages}
          </span>
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        →
                    </button>
                </div>
            )}

            {/* Modal Crear/Editar */}
            {showForm && editing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}>
                    <div className="w-full max-w-3xl rounded-2xl bg-white shadow-lg flex max-h-[90vh]">
                        <div className="flex w-full flex-col">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b">
                                <h3 className="text-lg font-semibold">{editing.id ? "Editar bus" : "Nuevo bus"}</h3>
                                <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">
                                    ✕
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-y-auto px-5">
                                <form id="busForm" className="mt-3 space-y-4" onSubmit={onSubmit}>
                                    {/* Datos básicos */}
                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        {editing?.id && (
                                            <div>
                                                <label className="text-sm text-gray-700">Código</label>
                                                <input disabled className="mt-1 w-full rounded-xl border bg-gray-50 px-3 py-2 text-sm" value={editing.code ?? ""} readOnly />
                                                <p className="mt-1 text-xs text-gray-500">Se genera automáticamente en el backend.</p>
                                            </div>
                                        )}
                                        <div>
                                            <label className="text-sm text-gray-700">Año</label>
                                            <input
                                                type="number"
                                                min={1980}
                                                max={2100}
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.year}
                                                onChange={(e) => setEditing((s) => ({ ...s!, year: e.target.value }))}
                                                required
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm text-gray-700">Modelo</label>
                                        <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10" value={editing.model} onChange={(e) => setEditing((s) => ({ ...s!, model: e.target.value }))} required />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm text-gray-700">Placa</label>
                                            <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10" value={editing.plate} onChange={(e) => setEditing((s) => ({ ...s!, plate: e.target.value }))} required />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-700">Chasis</label>
                                            <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10" value={editing.chassis_number} onChange={(e) => setEditing((s) => ({ ...s!, chassis_number: e.target.value }))} required />
                                        </div>
                                    </div>

                                    {/* Fotos */}
                                    <div>
                                        <div className="mb-1 text-sm font-medium text-gray-800">Fotos del bus</div>

                                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                            {/* Frontal */}
                                            <PhotoInput
                                                label="Frontal"
                                                preview={frontPreview}
                                                onFile={(f) =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        frontFile: f,
                                                        clearFront: !f && !s?.frontUrl ? false : false, // reset clear si se sube algo
                                                    }))
                                                }
                                                onClear={() =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        frontFile: null,
                                                        frontUrl: null,
                                                        clearFront: true,
                                                    }))
                                                }
                                            />

                                            {/* Posterior */}
                                            <PhotoInput
                                                label="Posterior"
                                                preview={backPreview}
                                                onFile={(f) =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        backFile: f,
                                                        clearBack: !f && !s?.backUrl ? false : false,
                                                    }))
                                                }
                                                onClear={() =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        backFile: null,
                                                        backUrl: null,
                                                        clearBack: true,
                                                    }))
                                                }
                                            />

                                            {/* Lateral Izq */}
                                            <PhotoInput
                                                label="Lateral Izq."
                                                preview={leftPreview}
                                                onFile={(f) =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        leftFile: f,
                                                        clearLeft: !f && !s?.leftUrl ? false : false,
                                                    }))
                                                }
                                                onClear={() =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        leftFile: null,
                                                        leftUrl: null,
                                                        clearLeft: true,
                                                    }))
                                                }
                                            />

                                            {/* Lateral Der */}
                                            <PhotoInput
                                                label="Lateral Der."
                                                preview={rightPreview}
                                                onFile={(f) =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        rightFile: f,
                                                        clearRight: !f && !s?.rightUrl ? false : false,
                                                    }))
                                                }
                                                onClear={() =>
                                                    setEditing((s) => ({
                                                        ...s!,
                                                        rightFile: null,
                                                        rightUrl: null,
                                                        clearRight: true,
                                                    }))
                                                }
                                            />
                                        </div>
                                    </div>

                                    {/* Asientos */}
                                    <div>
                                        <div className="mb-1 flex items-center justify-between">
                                            <div className="text-sm font-medium text-gray-800">Configurar asientos (bloques)</div>
                                            <button type="button" onClick={addBlock} className="inline-flex items-center gap-1 rounded-xl border px-2 py-1 text-xs hover:bg-gray-50">
                                                + Añadir bloque
                                            </button>
                                        </div>

                                        <div className="rounded-2xl border">
                                            <div className="grid grid-cols-12 gap-2 px-3 py-2 text-xs text-gray-600">
                                                <div className="col-span-2">Piso</div>
                                                <div className="col-span-4">Tipo</div>
                                                <div className="col-span-3">Cantidad</div>
                                                <div className="col-span-3">N° inicial</div>
                                            </div>
                                            <div>
                                                {(editing.seat_blocks ?? []).map((blk, idx) => (
                                                    <div key={idx} className="grid grid-cols-12 items-center gap-2 border-t px-3 py-2">
                                                        <div className="col-span-2">
                                                            <select className="w-full rounded-lg border px-2 py-1 text-sm" value={blk.deck} onChange={(e) => updateBlock(idx, { deck: Number(e.target.value) as 1 | 2 })}>
                                                                <option value={1}>1</option>
                                                                <option value={2}>2</option>
                                                            </select>
                                                        </div>
                                                        <div className="col-span-4">
                                                            <select className="w-full rounded-lg border px-2 py-1 text-sm" value={blk.kind} onChange={(e) => updateBlock(idx, { kind: e.target.value as SeatBlock["kind"] })}>
                                                                {KIND_OPTIONS.map((k) => (
                                                                    <option key={k} value={k}>
                                                                        {k.replace("_", " ")}
                                                                    </option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="col-span-3">
                                                            <input type="number" min={0} className="w-full rounded-lg border px-2 py-1 text-sm" value={blk.count} onChange={(e) => updateBlock(idx, { count: e.target.value })} />
                                                        </div>
                                                        <div className="col-span-2">
                                                            <input
                                                                type="number"
                                                                min={1}
                                                                className="w-full rounded-lg border px-2 py-1 text-sm"
                                                                value={blk.start_number ?? ""}
                                                                onChange={(e) => updateBlock(idx, { start_number: e.target.value })}
                                                                placeholder="Auto"
                                                            />
                                                        </div>
                                                        <div className="col-span-1 text-right">
                                                            <button type="button" onClick={() => removeBlock(idx)} className="rounded p-1 text-red-600 hover:bg-red-50">
                                                                ✕
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(editing.seat_blocks ?? []).length === 0 && <div className="border-t px-3 py-3 text-sm text-gray-500">Sin bloques. Añade al menos uno.</div>}
                                            </div>
                                        </div>

                                        <div className="mt-2 flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <label className="text-gray-700">Capacidad</label>
                                                <input
                                                    type="number"
                                                    min={1}
                                                    className="w-28 rounded-xl border px-3 py-1 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                    value={editing.capacity}
                                                    onChange={(e) => setEditing((s) => ({ ...s!, capacity: e.target.value }))}
                                                    required
                                                />
                                            </div>
                                            <div className={`text-sm ${capacityOk ? "text-green-600" : "text-red-600"}`}>
                                                Total bloques: <b>{blocksSum}</b> / Capacidad: <b>{capacityNum}</b>
                                            </div>
                                        </div>

                                        <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                            <input type="checkbox" className="h-4 w-4" checked={editing?.active ?? true} onChange={(e) => setEditing((s) => ({ ...s!, active: e.target.checked }))} />
                                            Activo
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-sm text-gray-700">Notas</label>
                                        <textarea rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10" value={editing.notes ?? ""} onChange={(e) => setEditing((s) => ({ ...s!, notes: e.target.value }))} />
                                    </div>
                                </form>
                            </div>

                            {/* Footer */}
                            <div className="border-t px-5 py-3 flex justify-end gap-2 bg-white">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>
                                    Cancelar
                                </button>
                                <button form="busForm" disabled={saving || ((editing.seat_blocks ?? []).length > 0 && !capacityOk)} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50">
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal VER (solo lectura) */}
            {viewing && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setViewing(null)}>
                    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Detalle de bus</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setViewing(null)} aria-label="Cerrar">
                                ✕
                            </button>
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
                            <h3 className="text-lg font-semibold">Eliminar bus</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar <b>{items.find((i) => i.id === confirmId)?.code || ""}</b>? Esta acción no se puede deshacer.
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

    function PhotoInput({
                            label,
                            preview,
                            onFile,
                            onClear,
                        }: {
        label: string;
        preview: string | null;
        onFile: (f: File | null) => void;
        onClear: () => void;
    }) {
        return (
            <div className="rounded-2xl border p-3">
                <div className="text-xs text-gray-700 mb-1">{label}</div>
                <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50 grid place-items-center">
                    {preview ? <img src={preview} alt={label} className="max-h-full max-w-full object-contain" /> : <div className="text-xs text-gray-400">Sin imagen</div>}
                </div>
                <div className="mt-2 flex gap-2">
                    <input
                        type="file"
                        accept="image/*"
                        className="w-full rounded-xl border px-3 py-2 text-xs"
                        onChange={(e) => onFile(e.target.files?.[0] || null)}
                    />
                    <button type="button" className="whitespace-nowrap rounded-xl border px-2 py-1 text-xs text-red-600 hover:bg-red-50" onClick={onClear}>
                        Quitar
                    </button>
                </div>
            </div>
        );
    }
}
