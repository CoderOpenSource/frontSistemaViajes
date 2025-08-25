// src/views/catalog/CrewView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listActiveOfficesLite } from "../../services/office.ts";
import { toast } from "sonner";
import {
    listCrew,
    createCrew,
    updateCrew,
    deleteCrew,
    type CrewMember,
    type UpsertCrewBody,
    type CrewRole,
} from "../../services/crew";

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

type FormCrew = {
    id?: CrewMember["id"];
    code?: string;
    first_name: string;
    last_name: string;
    national_id?: string;
    phone?: string;
    address?: string;
    birth_date?: string;
    role: CrewRole;
    active: boolean;
    office?: number | null;   // 👈 NUEVO
    photoFile?: File | null;
    photoUrl?: string | null;
};


const ROLE_LABEL: Record<CrewRole, string> = {
    DRIVER: "Driver",
    ASSISTANT: "Assistant",
};

export default function CrewView() {
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);

    const [roleFilter, setRoleFilter] = useState<CrewRole | "">(""); // 👈 filtro por rol opcional
    const [offices, setOffices] = useState<{id:number|string, label:string}[]>([]);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<CrewMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormCrew | null>(null);
    const [saving, setSaving] = useState(false);

    const [confirmId, setConfirmId] = useState<CrewMember["id"] | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [viewing, setViewing] = useState<CrewMember | null>(null);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const reqSeqRef = useRef(0);

    const replaceItem = useCallback((updated: CrewMember) => {
        setItems((prev) => prev.map((o) => (o.id === updated.id ? { ...o, ...updated } : o)));
    }, []);
    const addItem = useCallback((created: CrewMember) => {
        setItems((prev) => [created, ...prev]);
    }, []);
    const removeItem = useCallback((id: CrewMember["id"]) => {
        setItems((prev) => prev.filter((o) => o.id !== id));
    }, []);

    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const { items, total } = await listCrew({
                q: qDebounced,
                role: roleFilter || undefined, // 👈 filtro
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
            const msg = e?.message || "Error cargando empleados";
            setError(msg);
            toast.error(msg);
        } finally {
            if (reqSeqRef.current === mySeq) setLoading(false);
        }
    }, [qDebounced, roleFilter, page, pageSize]);

    useEffect(() => {
        listActiveOfficesLite().then(setOffices).catch((e) => {
            toast.error("Error cargando oficinas");
            console.error(e);
        });
    }, []);

    useEffect(() => { setPage(1); }, [qDebounced, roleFilter]);
    useEffect(() => { fetchList(); }, [fetchList]);

    // Form helpers
    const openCreate = () => {
        setEditing({
            first_name: "",
            last_name: "",
            national_id: "",
            phone: "",
            address: "",
            birth_date: "",
            role: "ASSISTANT",
            active: true,
            office: null,       // 👈
            photoFile: null,
            photoUrl: null,
        });
        setShowForm(true);
    };

    const openEdit = (c: CrewMember) => {
        setEditing({
            id: c.id,
            code: c.code,
            first_name: c.first_name,
            last_name: c.last_name,
            national_id: c.national_id || "",
            phone: c.phone || "",
            address: c.address || "",
            birth_date: c.birth_date || "",
            role: c.role,
            active: c.active,
            office: c.office ?? null,   // 👈
            photoFile: null,
            photoUrl: c.photo || null,
        });
        setShowForm(true);
    };

    const onPickPhoto = (file?: File | null) => {
        if (!editing) return;
        setEditing((s) => ({ ...(s as FormCrew), photoFile: file || null }));
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        if (!editing.first_name.trim()) {
            toast.error("El nombre es requerido.");
            return;
        }

        setSaving(true);
        try {
            const payload: UpsertCrewBody = {
                first_name: editing.first_name.trim(),
                last_name: (editing.last_name || "").trim(),
                national_id: (editing.national_id || "").trim() || undefined,
                phone: (editing.phone || "").trim() || undefined,
                address: (editing.address || "").trim() || undefined,
                birth_date: editing.birth_date || undefined,
                role: editing.role,
                active: editing.active,
                office: editing.office ?? undefined,   // 👈 enviar oficina
            };


            if (editing.photoFile) {
                payload.photo = editing.photoFile; // activa multipart en el service
            }

            if (editing.id) {
                const p = updateCrew(editing.id, payload);
                toast.promise(p, { loading: "Actualizando empleado…", success: "Empleado actualizado", error: (err) => err?.message || "Error al actualizar" });
                const updated = await p;
                replaceItem(updated);
            } else {
                const p = createCrew(payload);
                toast.promise(p, { loading: "Creando empleado…", success: "Empleado creado", error: (err) => err?.message || "Error al crear" });
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
    const crewToDelete = confirmId != null ? items.find((i) => i.id === confirmId) : null;
    const onDelete = async () => {
        if (!confirmId) return;
        const id = confirmId;
        setDeleting(true);
        try {
            const p = deleteCrew(id);
            toast.promise(p, { loading: "Eliminando…", success: "Empleado eliminado", error: (err) => err?.message || "Error al eliminar" });
            await p;
            removeItem(id);
            setTotal((t) => Math.max(0, t - 1));
            setConfirmId(null);
            await fetchList();
        } finally {
            setDeleting(false);
        }
    };

    // Preview de imagen
    const previewUrl = (() => {
        if (!editing) return null;
        if (editing.photoFile) return URL.createObjectURL(editing.photoFile);
        return editing.photoUrl || null;
    })();
    useEffect(() => {
        return () => {
            if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        };
    }, [previewUrl]);

    return (
        <div className="mt-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
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
                            placeholder="Buscar por código, nombre, CI/DNI o teléfono…"
                            className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                        />
                    </div>

                    {/* Filtro por rol */}
                    <select
                        value={roleFilter}
                        onChange={(e) => setRoleFilter((e.target.value || "") as CrewRole | "")}
                        className="w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10 sm:w-48"
                    >
                        <option value="">Todos los roles</option>
                        <option value="DRIVER">Driver</option>
                        <option value="ASSISTANT">Assistant</option>
                    </select>
                </div>

                <div className="flex items-center gap-2">
                    <Badge>
            <span className="inline-flex items-center gap-1">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="8" r="4" strokeWidth="1.5" />
                <path d="M4 21a8 8 0 0 1 16 0" strokeWidth="1.5" />
              </svg>
                {total} empleados
            </span>
                    </Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nuevo empleado
                    </button>
                </div>
            </div>

            {/* Tabla (desktop) / Cards (móvil) */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner /> Cargando empleados…</div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay empleados.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden rounded-2xl border md:block">
                            <div className="max-h-[60vh] overflow-y-auto overflow-x-auto overscroll-contain" style={{ scrollbarGutter: "stable both-edges" }}>
                                <table className="w-full text-sm table-fixed min-w-[980px]">
                                    <colgroup>
                                        <col className="w-28" />          {/* Código */}
                                        <col className="w-[16rem]" />     {/* Nombre */}
                                        <col className="w-28" />          {/* Rol */}
                                        <col className="w-28" />          {/* CI/DNI */}
                                        <col className="w-28" />          {/* Teléfono */}

                                        <col className="w-24" />          {/* Estado */}
                                        <col className="w-32" />          {/* Acciones */}
                                    </colgroup>

                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2">Código</th>
                                        <th className="px-3 py-2">Nombre</th>
                                        <th className="px-3 py-2">Rol</th>
                                        <th className="px-3 py-2">CI/DNI</th>
                                        <th className="px-3 py-2">Teléfono</th>

                                        <th className="px-3 py-2">Estado</th>
                                        <th className="px-3 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {items.map((c) => (
                                        <tr key={c.id} className="border-t align-top">
                                            <td className="px-3 py-1.5 whitespace-nowrap font-medium text-gray-900">{c.code}</td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center gap-2 truncate" title={`${c.first_name} ${c.last_name}`}>
                                                    <Avatar url={c.photo} size={20} />
                                                    <span className="truncate">{c.first_name} {c.last_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">
                                                <Badge>{c.role_display || ROLE_LABEL[c.role]}</Badge>
                                            </td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">{c.national_id || "—"}</td>
                                            <td className="px-3 py-1.5 whitespace-nowrap">{c.phone || "—"}</td>
                                            <td className="px-3 py-1.5"><Badge variant={c.active ? "success" : "muted"}>{c.active ? "Activo" : "Inactivo"}</Badge></td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button title="Ver" className="rounded p-1 hover:bg-gray-100" onClick={() => setViewing(c)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                                        </svg>
                                                    </button>
                                                    <button title="Editar" className="rounded p-1 hover:bg-gray-100" onClick={() => openEdit(c)}>
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                                  d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                                        </svg>
                                                    </button>
                                                    <button title="Eliminar" className="rounded p-1 text-red-600 hover:bg-red-50" onClick={() => setConfirmId(c.id)}>
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
                            {items.map((c) => (
                                <div key={c.id} className="rounded-2xl border p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">{c.code}</div>
                                        <Badge variant={c.active ? "success" : "muted"}>{c.active ? "Activo" : "Inactivo"}</Badge>
                                    </div>
                                    <div className="mt-2 flex items-center gap-2">
                                        <Avatar url={c.photo} size={36} />
                                        <div className="text-sm font-medium">{c.first_name} {c.last_name}</div>
                                    </div>
                                    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Rol</dt>
                                        <dd className="col-span-2 truncate">{c.role_display || ROLE_LABEL[c.role]}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">CI/DNI</dt>
                                        <dd className="col-span-2 truncate">{c.national_id || "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Teléfono</dt>
                                        <dd className="col-span-2 truncate">{c.phone || "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Dirección</dt>
                                        <dd className="col-span-2 truncate">{c.address || "—"}</dd>
                                    </dl>

                                    <div className="mt-3 flex justify-end gap-4 text-xs">
                                        <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => setViewing(c)}>
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" strokeWidth="1.5" />
                                                <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
                                            </svg>
                                            Ver
                                        </button>
                                        <button className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline" onClick={() => openEdit(c)}>
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                                                      d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z" />
                                            </svg>
                                            Editar
                                        </button>
                                        <button className="inline-flex items-center gap-1.5 text-red-600 hover:underline" onClick={() => setConfirmId(c.id)}>
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
                    <div className="w-full max-w-xl rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editing.id ? "Editar empleado" : "Nuevo empleado"}</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">✕</button>
                        </div>

                        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
                            {/* Foto + campos principales */}
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[160px,1fr]">
                                {/* Foto centrada */}
                                <div className="rounded-2xl border p-3">
                                    <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-50">
                                        <div className="flex h-full w-full items-center justify-center">
                                            {previewUrl ? (
                                                <img
                                                    src={previewUrl}
                                                    alt="Foto"
                                                    className="max-h-full max-w-full object-contain"
                                                />
                                            ) : (
                                                <div className="text-xs text-gray-400">Sin foto</div>
                                            )}
                                        </div>
                                    </div>
                                    <label className="mt-3 block text-xs text-gray-700">Foto</label>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-xs file:mr-2 file:rounded-lg file:border file:bg-white file:px-2 file:py-1"
                                        onChange={(e) => onPickPhoto(e.target.files?.[0] || null)}
                                    />
                                    {editing.photoFile && (
                                        <button
                                            type="button"
                                            onClick={() => onPickPhoto(null)}
                                            className="mt-2 w-full rounded-xl border px-3 py-1.5 text-xs hover:bg-gray-50"
                                        >
                                            Quitar foto seleccionada
                                        </button>
                                    )}
                                </div>

                                {/* Campos */}
                                <div className="grid grid-cols-1 gap-3">
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
                                            <p className="mt-1 text-xs text-gray-500">Se genera automáticamente en el
                                                backend.</p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm text-gray-700">Nombre</label>
                                            <input
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.first_name}
                                                onChange={(e) => setEditing((s) => ({
                                                    ...s!,
                                                    first_name: e.target.value
                                                }))}
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-700">Apellido</label>
                                            <input
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.last_name}
                                                onChange={(e) => setEditing((s) => ({
                                                    ...s!,
                                                    last_name: e.target.value
                                                }))}
                                            />
                                        </div>
                                    </div>

                                    {/* 👇 Selector de ROL */}
                                    <div>
                                        <label className="text-sm text-gray-700">Rol</label>
                                        <select
                                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                            value={editing.role}
                                            onChange={(e) => setEditing((s) => ({
                                                ...s!,
                                                role: e.target.value as CrewRole
                                            }))}
                                            required
                                        >
                                            <option value="DRIVER">Driver</option>
                                            <option value="ASSISTANT">Assistant</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm text-gray-700">CI/DNI</label>
                                            <input
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.national_id || ""}
                                                onChange={(e) => setEditing((s) => ({
                                                    ...s!,
                                                    national_id: e.target.value
                                                }))}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-700">Teléfono</label>
                                            <input
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.phone || ""}
                                                onChange={(e) => setEditing((s) => ({...s!, phone: e.target.value}))}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-sm text-gray-700">Dirección</label>
                                        <input
                                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                            value={editing.address || ""}
                                            onChange={(e) => setEditing((s) => ({...s!, address: e.target.value}))}
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm text-gray-700">Fecha de nacimiento</label>
                                            <input
                                                type="date"
                                                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                value={editing.birth_date || ""}
                                                onChange={(e) => setEditing((s) => ({
                                                    ...s!,
                                                    birth_date: e.target.value
                                                }))}
                                            />
                                        </div>
                                        <label
                                            className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4"
                                                checked={editing.active}
                                                onChange={(e) => setEditing((s) => ({...s!, active: e.target.checked}))}
                                            />
                                            Activo
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-sm text-gray-700">Oficina</label>
                                        <select
                                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                            value={editing.office ?? ""}
                                            onChange={(e) =>
                                                setEditing((s) => ({
                                                    ...s!,
                                                    office: e.target.value ? Number(e.target.value) : null
                                                }))
                                            }
                                        >
                                            <option value="">— Selecciona oficina —</option>
                                            {offices.map((o) => (
                                                <option key={o.id} value={o.id}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                </div>
                            </div>

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm"
                                        onClick={() => setShowForm(false)}>Cancelar
                                </button>
                                <button disabled={saving}
                                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50">
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
                            <h3 className="text-lg font-semibold">Detalle de empleado</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setViewing(null)} aria-label="Cerrar">✕</button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[180px,1fr]">
                            <div className="rounded-2xl border p-3">
                                <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-50">
                                    <div className="flex h-full w-full items-center justify-center">
                                        {viewing.photo ? (
                                            <img src={viewing.photo} alt="Foto" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <div className="text-xs text-gray-400">Sin foto</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Código" value={viewing.code} />
                                    <Field label="Estado" value={<Badge variant={viewing.active ? "success" : "muted"}>{viewing.active ? "Activo" : "Inactivo"}</Badge>} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Nombre" value={`${viewing.first_name} ${viewing.last_name || ""}`} />
                                    <Field label="Rol" value={viewing.role_display || ROLE_LABEL[viewing.role]} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="CI/DNI" value={viewing.national_id || "—"} />
                                    <Field label="Teléfono" value={viewing.phone || "—"} />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Nacimiento" value={viewing.birth_date ? new Date(viewing.birth_date).toLocaleDateString() : "—"} />
                                    <Field label="Dirección" value={viewing.address || "—"} />
                                </div>
                                <Field label="Oficina" value={viewing.office_name || "—"} />

                                <Field label="Creado" value={viewing.created_at ? new Date(viewing.created_at).toLocaleString() : "—"} />
                            </div>
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
                            <h3 className="text-lg font-semibold">Eliminar empleado</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">✕</button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar <b>{crewToDelete?.code}</b>
                            {crewToDelete?.first_name ? ` (${crewToDelete.first_name} ${crewToDelete.last_name || ""})` : ""}? Esta acción no se puede deshacer.
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

    function Avatar({ url, size = 24 }: { url?: string | null; size?: number }) {
        return (
            <div
                className="flex items-center justify-center overflow-hidden rounded-full bg-gray-100"
                style={{ width: size, height: size }}
            >
                {url ? (
                    <img src={url} alt="avatar" className="h-full w-full object-cover" />
                ) : (
                    <svg className="h-1/2 w-1/2 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="8" r="4" strokeWidth="1.5" />
                        <path d="M4 21a8 8 0 0 1 16 0" strokeWidth="1.5" />
                    </svg>
                )}
            </div>
        );
    }
}
