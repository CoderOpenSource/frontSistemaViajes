// src/views/catalog/OfficesView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { BO_GEO } from "../../services/geo";

import {
    listOffices,
    createOffice,
    updateOffice,
    deleteOffice,
    type Office,
} from "../../services/office"; // <-- ojo ruta

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

type FormOffice = {
    id?: Office["id"];
    code?: string; // read-only en edición
    name: string;
    department: string;
    province: string;
    municipality: string;
    locality: string;
    address?: string;
    phone?: string;
    location_url?: string;
    active: boolean;
};

export default function OfficesView() {
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<Office[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // arriba, con otros useState
    const [viewing, setViewing] = useState<Office | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormOffice | null>(null);
    const [saving, setSaving] = useState(false);

    const [confirmId, setConfirmId] = useState<Office["id"] | null>(null);
    const [deleting, setDeleting] = useState(false);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const reqSeqRef = useRef(0);



    // helpers UI optimista
    const replaceItem = useCallback((updated: Office) => {
        setItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    }, []);
    const addItem = useCallback((created: Office) => {
        setItems((prev) => [created, ...prev]);
    }, []);
    const removeItem = useCallback((id: Office["id"]) => {
        setItems((prev) => prev.filter((o) => o.id !== id));
    }, []);

    // helper
    const openView = (o: Office) => setViewing(o);

    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const { items, total } = await listOffices({
                q: qDebounced,
                page,
                pageSize,
                ordering: "code",
            });
            if (reqSeqRef.current !== mySeq) return;
            setItems(items ?? []);
            setTotal(Number(total ?? 0));
            setError(null);
        } catch (e: any) {
            if (reqSeqRef.current !== mySeq) return;
            const msg = e?.message || "Error cargando oficinas";
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

    // ------- Selects dependientes -------
    const departments = useMemo(() => Object.keys(BO_GEO), []);
    const provinces = useMemo(() => {
        if (!editing?.department) return [];
        return Object.keys(BO_GEO[editing.department] ?? {});
    }, [editing?.department]);
    const municipalities = useMemo(() => {
        if (!editing?.department || !editing?.province) return [];
        return Object.keys(BO_GEO[editing.department]?.[editing.province] ?? {});
    }, [editing?.department, editing?.province]);
    const localities = useMemo(() => {
        if (!editing?.department || !editing?.province || !editing?.municipality) return [];
        return BO_GEO[editing.department]?.[editing.province]?.[editing.municipality] ?? [];
    }, [editing?.department, editing?.province, editing?.municipality]);

    // ------- Form helpers -------
    const openCreate = () => {
        setEditing({
            name: "",
            department: "",
            province: "",
            municipality: "",
            locality: "",
            address: "",
            phone: "",
            location_url: "",
            active: true,
        });
        setShowForm(true);
    };

    const openEdit = (o: Office) => {
        setEditing({
            id: o.id,
            code: o.code,
            name: o.name,
            department: o.department,
            province: o.province,
            municipality: o.municipality,
            locality: o.locality,
            address: o.address ?? "",
            phone: o.phone ?? "",
            location_url: o.location_url ?? "",
            active: o.active,
        });
        setShowForm(true);
    };

    const onChangeDepartment = (dep: string) => {
        setEditing((s) => ({
            ...s!,
            department: dep,
            // reset cascada
            province: "",
            municipality: "",
            locality: "",
        }));
    };
    const onChangeProvince = (prov: string) => {
        setEditing((s) => ({
            ...s!,
            province: prov,
            municipality: "",
            locality: "",
        }));
    };
    const onChangeMunicipality = (mun: string) => {
        setEditing((s) => ({
            ...s!,
            municipality: mun,
            locality: "",
        }));
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSaving(true);
        try {
            const payload = {
                name: editing.name,
                department: editing.department,
                province: editing.province,
                municipality: editing.municipality,
                locality: editing.locality,
                address: editing.address,
                phone: editing.phone,
                location_url: editing.location_url,
                active: editing.active,
            };

            if (editing.id) {
                const p = updateOffice(editing.id, payload);
                toast.promise(p, {
                    loading: "Actualizando oficina…",
                    success: "Oficina actualizada",
                    error: (err) => err?.message || "Error al actualizar",
                });
                const updated = await p;
                replaceItem(updated);
            } else {
                const p = createOffice(payload);
                toast.promise(p, {
                    loading: "Creando oficina…",
                    success: "Oficina creada",
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

    // ------- Delete -------
    const officeToDelete = confirmId != null ? items.find((i) => i.id === confirmId) : null;

    const onDelete = async () => {
        if (!confirmId) return;
        const id = confirmId;
        setDeleting(true);
        try {
            const p = deleteOffice(id);
            toast.promise(p, {
                loading: "Eliminando…",
                success: "Oficina eliminada",
                error: (err) => err?.message || "Error al eliminar",
            });
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
                        placeholder="Buscar por código, nombre o dirección…"
                        className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Badge>{total} oficinas</Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nueva oficina
                    </button>
                </div>
            </div>

            {/* Tabla (desktop) / Cards (móvil) */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando oficinas…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay oficinas.</div>
                ) : (
                    <>
                        {/* Desktop (scroll interno + header sticky + ancho controlado) */}
                        <div className="hidden rounded-2xl border md:block">
                            <div
                                className="max-h-[60vh] overflow-y-auto overflow-x-auto overscroll-contain"
                                style={{scrollbarGutter: "stable both-edges"}}
                            >
                                <table className="w-full text-sm table-fixed min-w-[820px]">
                                    <colgroup>
                                        <col className="w-24"/>
                                        {/* Código */}
                                        <col className="w-56"/>
                                        {/* Nombre */}
                                        <col className="w-[24rem]"/>
                                        {/* Ubicación (resumen) */}
                                        <col className="w-28"/>
                                        {/* Teléfono */}
                                        <col className="w-24"/>
                                        {/* Estado */}
                                        <col className="w-32"/>
                                        {/* Acciones */}
                                    </colgroup>


                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconHash className="h-4 w-4 text-gray-500"/>
                                                <span>Código</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconIdBadge className="h-4 w-4 text-gray-500"/>
                                                <span>Nombre</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconMapPin className="h-4 w-4 text-gray-500"/>
                                                <span>Ubicación</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconPhone className="h-4 w-4 text-gray-500"/>
                                                <span>Teléfono</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconCircle className="h-4 w-4 text-gray-500"/>
                                                <span>Estado</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <IconSettings className="h-4 w-4 text-gray-500"/>
                                                <span>Acciones</span>
                                            </div>
                                        </th>
                                    </tr>
                                </thead>


                                <tbody>
                                {items.map((o) => (
                                    <tr key={o.id} className="border-t align-top">
                                        <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-900">{o.code}</td>
                                        <td className="px-3 py-1.5">
                                            <div className="truncate" title={o.name}>{o.name}</div>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div
                                                className="truncate"
                                                title={`${o.department} · ${o.province} · ${o.municipality} · ${o.locality}`}
                                            >
                                                {o.department} · {o.province} · {o.municipality} · {o.locality}
                                            </div>
                                        </td>
                                        <td className="px-3 py-1.5 whitespace-nowrap">{o.phone || "—"}</td>
                                        <td className="px-3 py-1.5">
                                            <Badge variant={o.active ? "success" : "muted"}>
                                                {o.active ? "Activa" : "Inactiva"}
                                            </Badge>
                                        </td>
                                        <td className="px-3 py-1.5">
                                            <div className="flex items-center justify-end gap-1.5">
                                                {/* Ver */}
                                                <button
                                                    title="Ver"
                                                    className="rounded p-1 hover:bg-gray-100"
                                                    onClick={() => openView(o)}
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                         stroke="currentColor">
                                                        <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
                                                              strokeWidth="1.5"/>
                                                        <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
                                                    </svg>
                                                </button>

                                                {/* Editar */}
                                                <button
                                                    title="Editar"
                                                    className="rounded p-1 hover:bg-gray-100"
                                                    onClick={() => openEdit(o)}
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                         stroke="currentColor">
                                                        <path strokeWidth="1.5" strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                              d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z"/>
                                                    </svg>
                                                </button>

                                                {/* Eliminar */}
                                                <button
                                                    title="Eliminar"
                                                    className="rounded p-1 text-red-600 hover:bg-red-50"
                                                    onClick={() => setConfirmId(o.id)}
                                                >
                                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                         stroke="currentColor">
                                                        <path strokeWidth="1.5" strokeLinecap="round"
                                                              strokeLinejoin="round"
                                                              d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7"/>
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
                {items.map((o) => (
                    <div key={o.id} className="rounded-2xl border p-3">
                <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
                    <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Código</dt>
                    <dd className="col-span-2 truncate text-sm font-medium text-gray-900">{o.code}</dd>

                    <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Nombre</dt>
                    <dd className="col-span-2 truncate text-xs text-gray-700">{o.name}</dd>

                    <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Depto/Prov/Mun/Loc</dt>
                    <dd className="col-span-2 truncate text-xs text-gray-700">
                        {o.department} • {o.province} • {o.municipality} • {o.locality}
                    </dd>

                    <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Dirección</dt>
                                        <dd className="col-span-2 truncate text-xs text-gray-700">{o.address || "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Teléfono</dt>
                                        <dd className="col-span-2 truncate text-xs text-gray-700">{o.phone || "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Mapa</dt>
                                        <dd className="col-span-2 truncate text-xs">
                                            {o.location_url ? (
                                                <a href={o.location_url} target="_blank" rel="noreferrer"
                                                   className="text-blue-600 hover:underline">
                                                    Abrir
                                                </a>
                                            ) : (
                                                "—"
                                            )}
                                        </dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Estado</dt>
                                        <dd className="col-span-2">
                                            <Badge
                                                variant={o.active ? "success" : "muted"}>{o.active ? "Activa" : "Inactiva"}</Badge>
                                        </dd>
                                    </dl>

                                    <div className="mt-3 flex justify-end gap-4 text-xs">
                                        <button
                                            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                            onClick={() => openEdit(o)}
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                      d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                            </svg>
                                            <span>Editar</span>
                                        </button>

                                        <button
                                            className="inline-flex items-center gap-1.5 text-red-600 hover:underline"
                                            onClick={() => setConfirmId(o.id)}
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                      d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7" />
                                            </svg>
                                            <span>Eliminar</span>
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
                    <button
                        className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                    >
                        ←
                    </button>
                    <span className="text-sm text-gray-600">
            Página <b>{page}</b> / {totalPages}
          </span>
                    <button
                        className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                    >
                        →
                    </button>
                </div>
            )}

            {/* Modal Crear/Editar */}
            {showForm && editing && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editing.id ? "Editar oficina" : "Nueva oficina"}</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>

                        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
                            {/* Código: solo lectura en edición */}
                            {editing.id && (
                                <div>
                                    <label className="text-sm text-gray-700">Código</label>
                                    <input
                                        disabled
                                        className="mt-1 w-full rounded-xl border bg-gray-50 px-3 py-2 text-sm"
                                        value={editing.code ?? ""}
                                        readOnly
                                    />
                                    <p className="mt-1 text-xs text-gray-500">Se genera automáticamente según la regla del backend.</p>
                                </div>
                            )}

                            <div>
                                <label className="text-sm text-gray-700">Nombre</label>
                                <input
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    value={editing.name}
                                    onChange={(e) => setEditing((s) => ({ ...s!, name: e.target.value }))}
                                    required
                                />
                            </div>

                            {/* Cascada: Departamento → Provincia → Municipio → Localidad */}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {/* Departamento */}
                                <div>
                                    <label className="text-sm text-gray-700">Departamento</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.department}
                                        onChange={(e) => onChangeDepartment(e.target.value)}
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {departments.map((d) => (
                                            <option key={d} value={d}>{d}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Provincia */}
                                <div>
                                    <label className="text-sm text-gray-700">Provincia</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.province}
                                        onChange={(e) => onChangeProvince(e.target.value)}
                                        disabled={!editing.department}
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {provinces.map((p) => (
                                            <option key={p} value={p}>{p}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                {/* Municipio */}
                                <div>
                                    <label className="text-sm text-gray-700">Municipio</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.municipality}
                                        onChange={(e) => onChangeMunicipality(e.target.value)}
                                        disabled={!editing.province}
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {municipalities.map((m) => (
                                            <option key={m} value={m}>{m}</option>
                                        ))}
                                    </select>
                                </div>

                                {/* Localidad */}
                                <div>
                                    <label className="text-sm text-gray-700">Localidad</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.locality}
                                        onChange={(e) => setEditing((s) => ({ ...s!, locality: e.target.value }))}
                                        disabled={!editing.municipality}
                                        required
                                    >
                                        <option value="">— Selecciona —</option>
                                        {localities.map((l) => (
                                            <option key={l} value={l}>{l}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>


                            <div>
                                <label className="text-sm text-gray-700">Dirección</label>
                                <input
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    value={editing.address ?? ""}
                                    onChange={(e) => setEditing((s) => ({ ...s!, address: e.target.value }))}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Teléfono</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.phone ?? ""}
                                        onChange={(e) => setEditing((s) => ({ ...s!, phone: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">URL de Google Maps</label>
                                    <input
                                        type="url"
                                        placeholder="https://maps.google.com/…"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.location_url ?? ""}
                                        onChange={(e) => setEditing((s) => ({ ...s!, location_url: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={editing.active}
                                    onChange={(e) => setEditing((s) => ({ ...s!, active: e.target.checked }))}
                                />
                                Activa
                            </label>

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>
                                    Cancelar
                                </button>
                                <button
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50"
                                >
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal VER (solo lectura) */}
            {viewing && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setViewing(null)}
                >
                    <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Detalle de oficina</h3>
                            <button
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => setViewing(null)}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-3 space-y-3 text-sm">
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Código" value={viewing.code} />
                                <Field label="Nombre" value={viewing.name} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Departamento" value={viewing.department} />
                                <Field label="Provincia" value={viewing.province} />
                                <Field label="Municipio" value={viewing.municipality} />
                                <Field label="Localidad" value={viewing.locality} />
                            </div>

                            <Field label="Dirección" value={viewing.address || "—"} />
                            <div className="grid grid-cols-2 gap-3">
                                <Field label="Teléfono" value={viewing.phone || "—"} />
                                <Field
                                    label="Estado"
                                    value={
                                        <Badge variant={viewing.active ? "success" : "muted"}>
                                            {viewing.active ? "Activa" : "Inactiva"}
                                        </Badge>
                                    }
                                />
                            </div>

                            <Field
                                label="Mapa"
                                value={
                                    viewing.location_url ? (
                                        <a
                                            href={viewing.location_url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                        >
                                            Abrir mapa
                                            <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M7 17L17 7M7 7h10v10" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                            </svg>
                                        </a>
                                    ) : (
                                        "—"
                                    )
                                }
                            />
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
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Eliminar oficina</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar <b>{officeToDelete?.code}</b>
                            {officeToDelete?.name ? ` (${officeToDelete.name})` : ""}? Esta acción no se puede deshacer.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="rounded-xl border px-3 py-2 text-sm" onClick={() => setConfirmId(null)}>
                                Cancelar
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                onClick={onDelete}
                                disabled={deleting}
                            >
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
    function IconHash(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <path strokeWidth="1.5" strokeLinecap="round" d="M4 9h16M4 15h16M10 3L8 21M16 3l-2 18" />
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
    function IconMapPin(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <path strokeWidth="1.5" d="M12 21s7-6.5 7-11.5S15.5 3 12 3 5 6.5 5 9.5 12 21 12 21z" />
                <circle cx="12" cy="9.5" r="2.5" strokeWidth="1.5" />
            </svg>
        );
    }
    function IconPhone(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <path strokeWidth="1.5" strokeLinecap="round" d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.6A2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.7c.2 1.3.6 2.6 1.2 3.8a2 2 0 0 1-.5 2.3l-1.3 1.3a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.3-.5c1.2.6 2.5 1 3.8 1.2A2 2 0 0 1 22 16.9z" />
            </svg>
        );
    }
    function IconCircle(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
            </svg>
        );
    }
    function IconSettings(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <path strokeWidth="1.5" d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                <path strokeWidth="1.5" d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1A2 2 0 1 1 4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 0 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1A2 2 0 1 1 6.6 4.2l.1.1a1.7 1.7 0 0 0 1.9.3H8.7A1.7 1.7 0 0 0 10 3.1V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 1.3 1.5h.1a1.7 1.7 0 0 0 1.9-.3l.1-.1A2 2 0 1 1 19.8 6l-.1.1a1.7 1.7 0 0 0-.3 1.9v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
            </svg>
        );
    }


}
