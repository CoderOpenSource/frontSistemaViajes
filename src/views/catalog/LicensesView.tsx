// src/views/catalog/LicensesView.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
    listLicenses,
    createLicense,
    updateLicense,
    deleteLicense,
    type DriverLicense,
    type UpsertLicenseBody,
} from "../../services/licenses";
import { listActiveDriversLite } from "../../services/crew";

const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);
const Badge = ({
                   children, variant = "muted",
               }: { children: React.ReactNode; variant?: "success" | "muted" }) => {
    const cls = variant === "success" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700";
    return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>{children}</span>;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
    return (
        <div>
            <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
            <div className="mt-0.5 text-gray-800">{value}</div>
        </div>
    );
}
type FormLicense = {
    id?: DriverLicense["id"];
    crew_member: number | string | "";
    number: string;
    category?: string;
    issued_at?: string;
    expires_at?: string;
    active: boolean;
    notes?: string;

    frontFile?: File | null;
    backFile?: File | null;
    frontUrl?: string | null; // lectura existente
    backUrl?: string | null;  // lectura existente
};

export default function LicensesView() {
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<DriverLicense[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // arriba, junto a otros useState:
    const [viewing, setViewing] = useState<DriverLicense | null>(null);

    const [drivers, setDrivers] = useState<{ id: number | string; label: string }[]>([]);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormLicense | null>(null);
    const [saving, setSaving] = useState(false);

    const [confirmId, setConfirmId] = useState<DriverLicense["id"] | null>(null);
    const [deleting, setDeleting] = useState(false);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const reqSeqRef = useRef(0);

    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const { items, total } = await listLicenses({
                q: q.trim() || undefined,
                page,
                pageSize,
                ordering: "-active,expires_at",
            });
            if (reqSeqRef.current !== mySeq) return;
            setItems(items ?? []);
            setTotal(Number(total ?? 0));
            setError(null);
        } catch (e: any) {
            if (reqSeqRef.current !== mySeq) return;
            const msg = e?.message || "Error cargando licencias";
            setError(msg);
            toast.error(msg);
        } finally {
            if (reqSeqRef.current === mySeq) setLoading(false);
        }
    }, [q, page, pageSize]);

    useEffect(() => {
        // opciones de chofer
        listActiveDriversLite()
            .then(setDrivers)
            .catch((e) => {
                console.error(e);
                toast.error("Error cargando choferes");
            });
    }, []);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const openCreate = () => {
        setEditing({
            crew_member: "",
            number: "",
            category: "",
            issued_at: "",
            expires_at: "",
            active: true,
            notes: "",
            frontFile: null,
            backFile: null,
            frontUrl: null,
            backUrl: null,
        });
        setShowForm(true);
    };

    const openEdit = (row: DriverLicense) => {
        setEditing({
            id: row.id,
            crew_member: row.crew_member,
            number: row.number,
            category: row.category || "",
            issued_at: row.issued_at || "",
            expires_at: row.expires_at || "",
            active: row.active,
            notes: row.notes || "",
            frontFile: null,
            backFile: null,
            frontUrl: row.front_image || null,
            backUrl: row.back_image || null,
        });
        setShowForm(true);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;

        if (!editing.crew_member) {
            toast.error("Selecciona un chofer.");
            return;
        }
        if (!editing.number.trim()) {
            toast.error("El número de licencia es requerido.");
            return;
        }

        setSaving(true);
        try {
            const payload: UpsertLicenseBody = {
                crew_member: editing.crew_member,
                number: editing.number.trim(),
                category: (editing.category || "").trim() || undefined,
                issued_at: editing.issued_at || undefined,
                expires_at: editing.expires_at || undefined,
                active: editing.active,
                notes: (editing.notes || "").trim() || undefined,
            };

            if (editing.frontFile) payload.front_image = editing.frontFile;
            if (editing.backFile)  payload.back_image  = editing.backFile;

            if (editing.id) {
                const p = updateLicense(editing.id, payload);
                toast.promise(p, { loading: "Actualizando licencia…", success: "Licencia actualizada", error: (err) => err?.message || "Error al actualizar" });
                await p;
            } else {
                const p = createLicense(payload);
                toast.promise(p, { loading: "Creando licencia…", success: "Licencia creada", error: (err) => err?.message || "Error al crear" });
                await p;
                setTotal((t) => t + 1);
            }
            setShowForm(false);
            await fetchList();
        } finally {
            setSaving(false);
        }
    };

    const licenseToDelete = confirmId != null ? items.find((i) => i.id === confirmId) : null;
    const onDelete = async () => {
        if (!confirmId) return;
        const id = confirmId;
        setDeleting(true);
        try {
            const p = deleteLicense(id);
            toast.promise(p, { loading: "Eliminando…", success: "Licencia eliminada", error: (err) => err?.message || "Error al eliminar" });
            await p;
            setConfirmId(null);
            setTotal((t) => Math.max(0, t - 1));
            await fetchList();
        } finally {
            setDeleting(false);
        }
    };

    // Previews locales
    const frontPreview = editing?.frontFile ? URL.createObjectURL(editing.frontFile) : editing?.frontUrl || null;
    const backPreview  = editing?.backFile  ? URL.createObjectURL(editing.backFile)  : editing?.backUrl  || null;
    useEffect(() => {
        return () => {
            if (frontPreview?.startsWith("blob:")) URL.revokeObjectURL(frontPreview);
            if (backPreview?.startsWith("blob:")) URL.revokeObjectURL(backPreview);
        };
    }, [frontPreview, backPreview]);

    return (
        <div className="mt-6">
            <div className="flex items-center justify-between gap-2">
                <div className="relative w-full sm:w-96">
                    <input
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder="Buscar licencia (número, chofer)…"
                        className="w-full rounded-2xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    />
                </div>
                <button onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <path d="M12 5v14M5 12h14" strokeWidth="1.5"/>
                    </svg>
                    Nueva licencia
                </button>
            </div>

            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500"><Spinner/> Cargando…</div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay licencias.</div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden md:block rounded-2xl border">
                            <div className="max-h-[60vh] overflow-auto">
                                <table className="min-w-[920px] w-full table-fixed text-sm">
                                    <colgroup>
                                        <col className="w-40"/>
                                        {/* Chofer */}
                                        <col className="w-32"/>
                                        {/* Número */}
                                        <col className="w-24"/>
                                        {/* Categoría */}
                                        <col className="w-32"/>
                                        {/* Emisión */}
                                        <col className="w-32"/>
                                        {/* Expira */}
                                        <col className="w-24"/>
                                        {/* Estado */}
                                        <col className="w-36"/>
                                        {/* Acciones */}
                                    </colgroup>
                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-3 py-2">Chofer</th>
                                        <th className="px-3 py-2">Número</th>
                                        <th className="px-3 py-2">Categoría</th>
                                        <th className="px-3 py-2">Emisión</th>
                                        <th className="px-3 py-2">Expira</th>
                                        <th className="px-3 py-2">Activo</th>
                                        <th className="px-3 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.map((l) => (
                                        <tr key={l.id} className="border-t">
                                            <td className="px-3 py-1.5 truncate" title={l.crew_name || ""}>
                                                <div className="truncate">{l.crew_code} — {l.crew_name}</div>
                                            </td>
                                            <td className="px-3 py-1.5">{l.number}</td>
                                            <td className="px-3 py-1.5">{l.category || "—"}</td>
                                            <td className="px-3 py-1.5">{l.issued_at || "—"}</td>
                                            <td className="px-3 py-1.5">{l.expires_at || "—"}</td>
                                            <td className="px-3 py-1.5">{l.active ? "Sí" : "No"}</td>
                                            <td className="px-3 py-1.5">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    {/* 👁 Ver */}
                                                    <button
                                                        title="Ver"
                                                        className="rounded p-1 hover:bg-gray-100"
                                                        onClick={() => setViewing(l)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor">
                                                            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
                                                                  strokeWidth="1.5"/>
                                                            <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
                                                        </svg>
                                                    </button>

                                                    {/* ✎ Editar */}
                                                    <button title="Editar" className="rounded p-1 hover:bg-gray-100"
                                                            onClick={() => openEdit(l)}>✎
                                                    </button>

                                                    {/* 🗑 Eliminar */}
                                                    <button title="Eliminar"
                                                            className="rounded p-1 text-red-600 hover:bg-red-50"
                                                            onClick={() => setConfirmId(l.id)}>🗑
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
                            {items.map((l) => (
                                <div key={l.id} className="rounded-2xl border p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">{l.number}</div>
                                        <span
                                            className={`rounded-full px-2 py-0.5 text-xs ${l.active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}`}>
                {l.active ? "Activa" : "Inactiva"}
              </span>
                                    </div>

                                    <div className="mt-1 text-sm text-gray-800 truncate">
                                        {l.crew_code} — {l.crew_name || "—"}
                                    </div>

                                    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Categoría</dt>
                                        <dd className="col-span-2 truncate">{l.category || "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Emisión</dt>
                                        <dd className="col-span-2 truncate">{l.issued_at || "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Expira</dt>
                                        <dd className="col-span-2 truncate">{l.expires_at || "—"}</dd>
                                    </dl>

                                    {/* mini previews opcionales si existen URLs */}
                                    {(l.front_image || l.back_image) && (
                                        <div className="mt-2 grid grid-cols-2 gap-2">
                                            {l.front_image && (
                                                <a href={l.front_image} target="_blank" rel="noreferrer"
                                                   className="block overflow-hidden rounded-lg border">
                                                    <img src={l.front_image} alt="Frente"
                                                         className="h-24 w-full object-cover"/>
                                                </a>
                                            )}
                                            {l.back_image && (
                                                <a href={l.back_image} target="_blank" rel="noreferrer"
                                                   className="block overflow-hidden rounded-lg border">
                                                    <img src={l.back_image} alt="Dorso"
                                                         className="h-24 w-full object-cover"/>
                                                </a>
                                            )}
                                        </div>
                                    )}

                                    <div className="mt-3 flex justify-end gap-4 text-xs">
                                        <button
                                            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                            onClick={() => setViewing(l)}
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                 stroke="currentColor">
                                                <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"
                                                      strokeWidth="1.5"/>
                                                <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
                                            </svg>
                                            Ver
                                        </button>
                                        <button
                                            className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                            onClick={() => openEdit(l)}>
                                            ✎ Editar
                                        </button>
                                        <button
                                            className="inline-flex items-center gap-1.5 text-red-600 hover:underline"
                                            onClick={() => setConfirmId(l.id)}>
                                            🗑 Eliminar
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
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
                            onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                        ←
                    </button>
                    <span className="text-sm text-gray-600">Página <b>{page}</b> / {totalPages}</span>
                    <button className="rounded-full border px-3 py-1 text-sm disabled:opacity-50"
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                        →
                    </button>
                </div>
            )}

            {/* Modal Crear/Editar */}
            {showForm && editing && (
                <div
                className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 sm:p-4"
                role="dialog"
                aria-modal="true"
                onKeyDown={(e) => e.key === "Escape" && setShowForm(false)}
        >
            <div className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">{editing.id ? "Editar licencia" : "Nueva licencia"}</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                    onClick={() => setShowForm(false)} aria-label="Cerrar">✕
                            </button>
                        </div>

                        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[180px,1fr]">
                                {/* Imágenes */}
                                <div className="space-y-4">
                                    <div className="rounded-2xl border p-3">
                                        <div className="text-xs text-gray-700 mb-1">Frente</div>
                                        <div
                                            className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                                            {frontPreview ? (
                                                <img src={frontPreview} alt="Frente"
                                                     className="max-h-full max-w-full object-contain"/>
                                            ) : (
                                                <div className="text-xs text-gray-400">Sin imagen</div>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*"
                                               className="mt-2 w-full rounded-xl border px-3 py-2 text-xs"
                                               onChange={(e) => setEditing((s) => ({
                                                   ...(s as FormLicense),
                                                   frontFile: e.target.files?.[0] || null
                                               }))}/>
                                    </div>

                                    <div className="rounded-2xl border p-3">
                                        <div className="text-xs text-gray-700 mb-1">Dorso</div>
                                        <div
                                            className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                                            {backPreview ? (
                                                <img src={backPreview} alt="Dorso"
                                                     className="max-h-full max-w-full object-contain"/>
                                            ) : (
                                                <div className="text-xs text-gray-400">Sin imagen</div>
                                            )}
                                        </div>
                                        <input type="file" accept="image/*"
                                               className="mt-2 w-full rounded-xl border px-3 py-2 text-xs"
                                               onChange={(e) => setEditing((s) => ({
                                                   ...(s as FormLicense),
                                                   backFile: e.target.files?.[0] || null
                                               }))}/>
                                    </div>
                                </div>

                                {/* Campos */}
                                <div className="grid grid-cols-1 gap-3">
                                    <div>
                                        <label className="text-sm text-gray-700">Chofer</label>
                                        <select
                                            className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                            value={editing.crew_member}
                                            onChange={(e) => setEditing((s) => ({
                                                ...(s as FormLicense),
                                                crew_member: e.target.value || ""
                                            }))}
                                            required
                                        >
                                            <option value="">— Selecciona chofer —</option>
                                            {drivers.map(d => <option key={d.id} value={d.id}>{d.label}</option>)}
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm text-gray-700">Número</label>
                                            <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                                   value={editing.number}
                                                   onChange={(e) => setEditing((s) => ({
                                                       ...(s as FormLicense),
                                                       number: e.target.value
                                                   }))} required/>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-700">Categoría</label>
                                            <input className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                                   value={editing.category || ""} onChange={(e) => setEditing((s) => ({
                                                ...(s as FormLicense),
                                                category: e.target.value
                                            }))}/>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                        <div>
                                            <label className="text-sm text-gray-700">Emisión</label>
                                            <input type="date"
                                                   className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                                   value={editing.issued_at || ""} onChange={(e) => setEditing((s) => ({
                                                ...(s as FormLicense),
                                                issued_at: e.target.value
                                            }))}/>
                                        </div>
                                        <div>
                                            <label className="text-sm text-gray-700">Expira</label>
                                            <input type="date"
                                                   className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                                   value={editing.expires_at || ""}
                                                   onChange={(e) => setEditing((s) => ({
                                                       ...(s as FormLicense),
                                                       expires_at: e.target.value
                                                   }))}/>
                                        </div>
                                    </div>

                                    <label
                                        className="inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                        <input type="checkbox" className="h-4 w-4" checked={editing.active}
                                               onChange={(e) => setEditing((s) => ({
                                                   ...(s as FormLicense),
                                                   active: e.target.checked
                                               }))}/>
                                        Activa
                                    </label>

                                    <div>
                                        <label className="text-sm text-gray-700">Notas</label>
                                        <textarea rows={3} className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                                  value={editing.notes || ""} onChange={(e) => setEditing((s) => ({
                                            ...(s as FormLicense),
                                            notes: e.target.value
                                        }))}/>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm"
                                        onClick={() => setShowForm(false)}>Cancelar
                                </button>
                                <button disabled={saving}
                                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50">
                                    {saving && <Spinner/>} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            {/* Modal VER */}
            {viewing && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-3 sm:p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setViewing(null)}
                >
                    <div className="w-full max-w-lg sm:max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Detalle de licencia</h3>
                            <button
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => setViewing(null)}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-[180px,1fr]">
                            {/* Imágenes */}
                            <div className="space-y-4">
                                <div className="rounded-2xl border p-3">
                                    <div className="text-xs text-gray-700 mb-1">Frente</div>
                                    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                                        {viewing.front_image ? (
                                            <img src={viewing.front_image} alt="Frente" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <div className="text-xs text-gray-400">Sin imagen</div>
                                        )}
                                    </div>
                                </div>

                                <div className="rounded-2xl border p-3">
                                    <div className="text-xs text-gray-700 mb-1">Dorso</div>
                                    <div className="aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50 flex items-center justify-center">
                                        {viewing.back_image ? (
                                            <img src={viewing.back_image} alt="Dorso" className="max-h-full max-w-full object-contain" />
                                        ) : (
                                            <div className="text-xs text-gray-400">Sin imagen</div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Campos */}
                            <div className="space-y-3 text-sm">
                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Chofer" value={`${viewing.crew_code ?? ""} ${viewing.crew_name ?? ""}`.trim() || "—"} />
                                    <Field label="Estado" value={<Badge variant={viewing.active ? "success" : "muted"}>{viewing.active ? "Activa" : "Inactiva"}</Badge>} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Número" value={viewing.number} />
                                    <Field label="Categoría" value={viewing.category || "—"} />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <Field label="Emisión" value={viewing.issued_at || "—"} />
                                    <Field label="Expira" value={viewing.expires_at || "—"} />
                                </div>

                                <Field label="Notas" value={viewing.notes || "—"} />
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
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog"
                     aria-modal="true" onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}>
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Eliminar licencia</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                    onClick={() => setConfirmId(null)} aria-label="Cerrar">✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar la licencia
                            {licenseToDelete?.number ? <> <b>{licenseToDelete.number}</b></> : ""}?
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button className="rounded-xl border px-3 py-2 text-sm"
                                    onClick={() => setConfirmId(null)}>Cancelar
                            </button>
                            <button
                                className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                                onClick={onDelete} disabled={deleting}>
                                {deleting && <Spinner/>} Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );

}
