import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
    createUser,
    deleteUser,
    listUsers,
    updateUser,
    type User,
    type Role,
    ROLES,
} from "../../services/users.ts";

const roleLabel = (r?: Role) =>
    r === "VEND" ? "Vendedor" : r === "CAJE" ? "Cajero" : "—";

type FormUser = {
    id?: User["id"];
    username: string;
    email: string;
    role: Role;
    password?: string;
    first_name?: string;
    last_name?: string;
    active?: boolean;
};

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

export default function UsuariosView() {
    const [q, setQ] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const qDebounced = useDebouncedValue(q, 350);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormUser | null>(null);
    const [saving, setSaving] = useState(false);

    const [confirmId, setConfirmId] = useState<User["id"] | null>(null);
    const [deleting, setDeleting] = useState(false);

    // helpers UI optimista
    const replaceItem = useCallback((updated: User) => {
        setItems((prev) => prev.map((u) => (u.id === updated.id ? { ...u, ...updated } : u)));
    }, []);
    const addItem = useCallback((created: User) => {
        setItems((prev) => [created, ...prev]);
    }, []);
    const removeItem = useCallback((id: User["id"]) => {
        setItems((prev) => prev.filter((u) => u.id !== id));
    }, []);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

    // ------- Data load -------
    const reqSeqRef = useRef(0);

    const fetchList = useCallback(
        async () => {
            const mySeq = ++reqSeqRef.current;
            try {
                setLoading(true);
                const { items, total } = await listUsers({
                    q: qDebounced,
                    page,              // 👈 usa la página actual
                    // pageSize: 10     // opcional: quítalo; DRF ya usa global 10
                });
                if (reqSeqRef.current !== mySeq) return;
                setItems(items ?? []);
                setTotal(Number(total ?? 0));
                setError(null);
            } catch (e: any) {
                if (reqSeqRef.current !== mySeq) return;
                const msg = e?.message || "Error cargando usuarios";
                setError(msg);
                toast.error(msg);
            } finally {
                if (reqSeqRef.current === mySeq) setLoading(false);
            }
        },
        [qDebounced, page]   // 👈 dependencias limpias
    );

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    // ------- Form helpers -------
    const openCreate = () => {
        setEditing({
            username: "",
            email: "",
            role: "VEND",
            first_name: "",
            last_name: "",
            password: "",
            active: true,
        });
        setShowForm(true);
    };

    const openEdit = (u: User) => {
        setEditing({
            id: u.id,
            username: u.username,
            email: u.email,
            role: (u.role as Role) ?? "VEND",
            first_name: u.first_name ?? "",
            last_name: u.last_name ?? "",
            active: (u as any).active ?? (u as any).is_active ?? true,
        });
        setShowForm(true);
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSaving(true);
        try {
            if (editing.id) {
                // EDITAR
                const p = updateUser(editing.id, {
                    username: editing.username,
                    email: editing.email,
                    role: editing.role,
                    first_name: editing.first_name,
                    last_name: editing.last_name,
                    active: editing.active,
                    ...(editing.password ? { password: editing.password } : {}),
                });
                toast.promise(p, {
                    loading: "Actualizando usuario…",
                    success: "Usuario actualizado",
                    error: (err) => err?.message || "Error al actualizar",
                });
                const updated = await p;          // 👈 resultado real del backend
                replaceItem(updated);             // UI inmediata
            } else {
                // CREAR
                const p = createUser({
                    username: editing.username,
                    email: editing.email,
                    role: editing.role,
                    ...(editing.password ? { password: editing.password } : {}),
                    first_name: editing.first_name,
                    last_name: editing.last_name,
                    active: editing.active,
                });
                toast.promise(p, {
                    loading: "Creando usuario…",
                    success: "Usuario creado",
                    error: (err) => err?.message || "Error al crear",
                });
                const created = await p;          // 👈 resultado real del backend
                addItem(created);                 // UI inmediata
                setTotal((t) => t + 1);
            }
            setShowForm(false);

            // sincroniza con backend (por si cambió algo fuera de la página actual)
            await fetchList();
        } finally {
            setSaving(false);
        }
    };

    // ------- Delete -------
    const userToDelete = confirmId != null ? items.find((i) => i.id === confirmId) : null;

    const onDelete = async () => {
        if (!confirmId) return;
        const id = confirmId;
        setDeleting(true);
        try {
            const p = deleteUser(id);
            toast.promise(p, {
                loading: "Eliminando…",
                success: "Usuario eliminado",
                error: (err) => err?.message || "Error al eliminar",
            });
            await p;                 // 👈 espera al backend de verdad
            removeItem(id);          // UI inmediata
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
                        onChange={(e) => {
                            setQ(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Buscar por usuario o email…"
                        className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Badge>{total} usuarios</Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nuevo usuario
                    </button>
                </div>
            </div>

            {/* Tabla (desktop) / Cards (móvil) */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando usuarios…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay usuarios.</div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden rounded-2xl border md:block">
                            {/* scroller interno */}
                            <div
                                className="max-h-[60vh] overflow-y-auto overscroll-contain"
                                style={{ scrollbarGutter: "stable" }}
                            >
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-2">Usuario</th>
                                        <th className="px-4 py-2">Nombre</th>
                                        <th className="px-4 py-2">Email</th>
                                        <th className="px-4 py-2">Rol</th>
                                        <th className="px-4 py-2">Estado</th>
                                        <th className="w-44 px-4 py-2 text-right">Acciones</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {items.map((u) => (
                                        <tr key={u.id} className="border-t">
                                            <td className="px-4 py-2 font-medium text-gray-900">{u.username}</td>
                                            <td className="px-4 py-2">
                                                {[u.first_name, u.last_name].filter(Boolean).join(" ") || "—"}
                                            </td>
                                            <td className="px-4 py-2">{u.email}</td>
                                            <td className="px-4 py-2">
                                                <Badge>{roleLabel(u.role as Role)}</Badge>
                                            </td>
                                            <td className="px-4 py-2">
                                                <Badge variant={u.active ? "success" : "muted"}>
                                                    {u.active ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </td>

                                            <td className="px-4 py-2">
                                                <div className="flex items-center justify-end gap-4">
                                                    <button
                                                        className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                                        onClick={() => openEdit(u)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z"
                                                            />
                                                        </svg>
                                                        <span>Editar</span>
                                                    </button>

                                                    <button
                                                        className="inline-flex items-center gap-1.5 text-red-600 hover:underline"
                                                        onClick={() => setConfirmId(u.id)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                            <path
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7"
                                                            />
                                                        </svg>
                                                        <span>Eliminar</span>
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
                        {/* Mobile cards (con etiquetas tipo <th>) */}
                        <div className="grid gap-2 md:hidden">
                            {items.map((u) => {
                                const fullName =
                                    [u.first_name, u.last_name].filter(Boolean).join(" ") || "—";
                                return (
                                    <div key={u.id} className="rounded-2xl border p-3">
                                        <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Usuario
                                            </dt>
                                            <dd className="col-span-2 truncate text-sm font-medium text-gray-900">
                                                {u.username}
                                            </dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Nombre
                                            </dt>
                                            <dd className="col-span-2 truncate text-xs text-gray-700">
                                                {fullName}
                                            </dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Email
                                            </dt>
                                            <dd className="col-span-2 truncate text-xs text-gray-600">
                                                {u.email}
                                            </dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Rol
                                            </dt>
                                            <dd className="col-span-2">
                                                <Badge>{roleLabel(u.role as Role)}</Badge>
                                            </dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Estado
                                            </dt>
                                            <dd className="col-span-2">
                                                <Badge variant={u.active ? "success" : "muted"}>
                                                    {u.active ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </dd>
                                        </dl>

                                        <div className="mt-3 flex justify-end gap-4 text-xs">
                                            <button
                                                className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                                onClick={() => openEdit(u)}
                                            >
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M16.862 3.487a2.121 2.121 0 1 1 3 3L8.5 17.85 4 19l1.15-4.5L16.862 3.487z"
                                                    />
                                                </svg>
                                                <span>Editar</span>
                                            </button>

                                            <button
                                                className="inline-flex items-center gap-1.5 text-red-600 hover:underline"
                                                onClick={() => setConfirmId(u.id)}
                                            >
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                                    <path
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M6 7h12M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m-7 0v10a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2V7"
                                                    />
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
                            <h3 className="text-lg font-semibold">{editing.id ? "Editar usuario" : "Nuevo usuario"}</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setShowForm(false)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>

                        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
                            <div>
                                <label className="text-sm text-gray-700">Usuario</label>
                                <input
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    value={editing.username}
                                    onChange={(e) => setEditing((s) => ({ ...s!, username: e.target.value }))}
                                    required
                                />
                            </div>
                            <div>
                                <label className="text-sm text-gray-700">Email</label>
                                <input
                                    type="email"
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    value={editing.email}
                                    onChange={(e) => setEditing((s) => ({ ...s!, email: e.target.value }))}
                                    required
                                />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Nombre</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.first_name ?? ""}
                                        onChange={(e) => setEditing((s) => ({ ...s!, first_name: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Apellido</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.last_name ?? ""}
                                        onChange={(e) => setEditing((s) => ({ ...s!, last_name: e.target.value }))}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Rol</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.role}
                                        onChange={(e) => setEditing((s) => ({ ...s!, role: e.target.value as Role }))}
                                    >
                                        {ROLES.map((r) => (
                                            <option key={r} value={r}>
                                                {roleLabel(r)}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <label className="mt-6 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        className="h-4 w-4"
                                        checked={editing.active ?? true}
                                        onChange={(e) => setEditing((s) => ({ ...s!, active: e.target.checked }))}
                                    />
                                    Activo
                                </label>
                            </div>

                            <div>
                                <label className="text-sm text-gray-700">
                                    Contraseña {editing.id && <span className="text-gray-500">(opcional)</span>}
                                </label>
                                <input
                                    type="password"
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    value={editing.password ?? ""}
                                    onChange={(e) => setEditing((s) => ({ ...s!, password: e.target.value }))}
                                    placeholder={editing.id ? "Dejar vacío para no cambiar" : "Mín. 6 caracteres"}
                                />
                            </div>

                            <div className="mt-2 flex justify-end gap-2">
                                <button type="button" className="rounded-xl border px-3 py-2 text-sm" onClick={() => setShowForm(false)}>
                                    Cancelar
                                </button>
                                <button disabled={saving} className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition hover:bg-black hover:text-white disabled:opacity-50">
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </form>
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
                            <h3 className="text-lg font-semibold">Eliminar usuario</h3>
                            <button className="rounded-full p-1 text-gray-500 hover:bg-gray-100" onClick={() => setConfirmId(null)} aria-label="Cerrar">
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar <b>{userToDelete?.username}</b>
                            {userToDelete?.email ? ` (${userToDelete.email})` : ""}? Esta acción no se puede deshacer.
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
}
