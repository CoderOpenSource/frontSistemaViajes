// views/PasajerosView.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { toast } from "sonner";
import {
    listPassengers,
    createPassenger,
    updatePassenger,
    deletePassenger,
    searchPassengers,
    createMinorWithGuardianTx,
    type Passenger,
    type DocType, listRelations, createRelation, deleteRelation, type PassengerRelation,
} from "../../services/passengers";

const DOCS: DocType[] = ["CI", "PASAPORTE", "OTRO"];

const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

const Badge = ({
                   children,
                   variant = "muted",
               }: {
    children: React.ReactNode;
    variant?: "success" | "muted" | "warn";
}) => {
    const cls =
        variant === "success"
            ? "bg-green-100 text-green-700"
            : variant === "warn"
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-700";
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${cls}`}>
      {children}
    </span>
    );
};

function useDebouncedValue<T>(value: T, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

// ---- helpers edad ----
const calcAge = (iso?: string | null) => {
    if (!iso) return null;
    const d = new Date(iso);
    const t = new Date();
    let edad = t.getFullYear() - d.getFullYear();
    const m = t.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && t.getDate() < d.getDate())) edad--;
    return Math.max(0, edad);
};
const isMinor = (age: number | null) => age !== null && age < 18;

// ---- Form type ----
type FormPassenger = {
    id?: string;
    tipo_doc: DocType;
    nro_doc: string;
    nombres: string;
    apellidos?: string;
    fecha_nac?: string | null;
    telefono?: string;
    email?: string;
    activo?: boolean;
};

export default function PasajerosView() {
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<Passenger[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState<FormPassenger | null>(null);
    const [saving, setSaving] = useState(false);

    const [confirmId, setConfirmId] = useState<string | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [detailPassenger, setDetailPassenger] = useState<Passenger | null>(null);

    // --- estado para apoderado (cuando es menor) ---
    const [guardianSearch, setGuardianSearch] = useState("");
    const guardianSearchDeb = useDebouncedValue(guardianSearch, 300);
    const [guardianResults, setGuardianResults] = useState<Passenger[]>([]);
    const [selectedGuardianId, setSelectedGuardianId] = useState<string | null>(null);
    const [createGuardian, setCreateGuardian] = useState(false);
    const [newGuardian, setNewGuardian] = useState({
        tipo_doc: "CI" as DocType,
        nro_doc: "",
        nombres: "",
        apellidos: "",
        telefono: "",
        email: "",
    });

    useEffect(() => {
        (async () => {
            if (guardianSearchDeb.trim().length < 2) {
                setGuardianResults([]);
                return;
            }
            try {
                const res = await searchPassengers(guardianSearchDeb, 8);
                setGuardianResults(res);
            } catch {
                // silencioso
            }
        })();
    }, [guardianSearchDeb]);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const reqSeqRef = useRef(0);

    const fetchList = useCallback(async () => {
        const mySeq = ++reqSeqRef.current;
        try {
            setLoading(true);
            const { items, total } = await listPassengers({ q: qDebounced, page, pageSize });
            if (reqSeqRef.current !== mySeq) return;
            setItems(items);
            setTotal(total);
            setError(null);
        } catch (e: any) {
            if (reqSeqRef.current !== mySeq) return;
            const msg = e?.message ?? "Error cargando pasajeros";
            setError(msg);
            toast.error(msg);
        } finally {
            if (reqSeqRef.current === mySeq) setLoading(false);
        }
    }, [qDebounced, page, pageSize]);

    useEffect(() => {
        fetchList();
    }, [fetchList]);

    const openCreate = () => {
        setEditing({
            tipo_doc: "CI",
            nro_doc: "",
            nombres: "",
            apellidos: "",
            fecha_nac: "",
            telefono: "",
            email: "",
            activo: true,
        });
        // reset bloque apoderado
        setGuardianSearch("");
        setGuardianResults([]);
        setSelectedGuardianId(null);
        setCreateGuardian(false);
        setNewGuardian({
            tipo_doc: "CI",
            nro_doc: "",
            nombres: "",
            apellidos: "",
            telefono: "",
            email: "",
        });
        setShowForm(true);
    };

    // --- estados para relaciones en edición ---
    const [relations, setRelations] = useState<PassengerRelation[]>([]);
    const [addingRelation, setAddingRelation] = useState(false);

// cuando abrimos editar, si es menor, cargamos relaciones
    const openEdit = async (p: Passenger) => {
        setEditing({
            id: p.id,
            tipo_doc: p.tipo_doc,
            nro_doc: p.nro_doc,
            nombres: p.nombres,
            apellidos: p.apellidos ?? "",
            fecha_nac: p.fecha_nac ?? "",
            telefono: p.telefono ?? "",
            email: p.email ?? "",
            activo: p.activo ?? true,
        });
        setShowForm(true);

        if (p.es_menor) {
            try {
                const { items } = await listRelations({ menor: p.id });

                setRelations(items);
            } catch {
                setRelations([]);
            }
        } else {
            setRelations([]);
        }
    };

    const onSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editing) return;
        setSaving(true);
        try {
            const age = calcAge(editing.fecha_nac);
            const menor = isMinor(age);

            if (editing.id) {
                // EDITAR
                const p = updatePassenger(editing.id, editing);
                toast.promise(p, {
                    loading: "Actualizando…",
                    success: "Pasajero actualizado",
                    error: "Error al actualizar",
                });
                await p;
            } else if (menor) {
                // CREAR MENOR + (APODERADO) + RELACIÓN
                if (!selectedGuardianId && !createGuardian) {
                    toast.error("Selecciona o crea un apoderado para el menor.");
                    setSaving(false);
                    return;
                }
                if (createGuardian && (!newGuardian.nombres || !newGuardian.nro_doc)) {
                    toast.error("Completa los datos del apoderado (nombres y número de documento).");
                    setSaving(false);
                    return;
                }

                const p = createMinorWithGuardian({
                    minor: {
                        tipo_doc: editing.tipo_doc,
                        nro_doc: editing.nro_doc,
                        nombres: editing.nombres,
                        apellidos: editing.apellidos,
                        fecha_nac: editing.fecha_nac ?? "",
                        telefono: editing.telefono,
                        email: editing.email,
                        activo: editing.activo ?? true,
                    },
                    existingGuardianId: createGuardian ? undefined : selectedGuardianId ?? undefined,
                    newGuardian: createGuardian ? newGuardian : undefined,
                    parentesco: "Tutor",
                    es_tutor_legal: true,
                });

                toast.promise(p, {
                    loading: "Creando menor y apoderado…",
                    success: "Menor y relación creados",
                    error: "Error al crear",
                });
                await p;
                setTotal((t) => t + 1);
            } else {
                // CREAR ADULTO normal
                const p = createPassenger(editing);
                toast.promise(p, {
                    loading: "Creando…",
                    success: "Pasajero creado",
                    error: "Error al crear",
                });
                await p;
                setTotal((t) => t + 1);
            }

            setShowForm(false);
            await fetchList();
        } finally {
            setSaving(false);
        }
    };

    const onDelete = async () => {
        if (!confirmId) return;
        setDeleting(true);
        try {
            const p = deletePassenger(confirmId);
            toast.promise(p, {
                loading: "Eliminando…",
                success: "Pasajero eliminado",
                error: "Error al eliminar",
            });
            await p;
            setConfirmId(null);
            setTotal((t) => Math.max(0, t - 1));
            await fetchList();
        } finally {
            setDeleting(false);
        }
    };

    const columnas = (
        <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
        <tr>
            <th className="px-4 py-2 text-left">
                <div className="flex items-center gap-2">
                    <IconIdCard className="h-4 w-4 text-gray-500"/>
                    <span>Documento</span>
                </div>
            </th>
            <th className="px-4 py-2 text-left">
                <div className="flex items-center gap-2">
                    <IconUser className="h-4 w-4 text-gray-500"/>
                    <span>Nombre</span>
                </div>
            </th>
            <th className="px-4 py-2 text-left">
                <div className="flex items-center gap-2">
                    <IconPhone className="h-4 w-4 text-gray-500"/>
                    <span>Contacto</span>
                </div>
            </th>
            <th className="px-4 py-2 text-left">
                <div className="flex items-center gap-2">
                    <IconCircle className="h-4 w-4 text-gray-500"/>
                    <span>Estado</span>
                </div>
            </th>
            <th className="px-4 py-2 text-left">
                <div className="flex items-center gap-2">
                    <IconChild className="h-4 w-4 text-gray-500"/>
                    <span>Menor</span>
                </div>
            </th>
            <th className="w-40 px-4 py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                    <IconSettings className="h-4 w-4 text-gray-500"/>
                    <span>Acciones</span>
                </div>
            </th>
        </tr>
        </thead>

    );

    return (
        <div className="mt-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:w-96">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="11" cy="11" r="7" strokeWidth="1.5"/>
              <path d="M21 21l-3.6-3.6" strokeWidth="1.5"/>
            </svg>
          </span>
                    <input
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Buscar por doc/nombre/teléfono…"
                        className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Badge>{total} pasajeros</Badge>
                    <button
                        onClick={openCreate}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm font-medium transition hover:bg-black hover:text-white"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <path d="M12 5v14M5 12h14" strokeWidth="1.5" />
                        </svg>
                        Nuevo pasajero
                    </button>
                </div>
            </div>

            {/* Tabla/Cards */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando pasajeros…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay pasajeros.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden rounded-2xl border md:block">
                            <div
                                className="max-h-[60vh] overflow-y-auto overscroll-contain"
                                style={{ scrollbarGutter: "stable" }}
                            >
                                <table className="w-full text-sm">
                                    {columnas}
                                    <tbody>
                                    {items.map((p) => (
                                        <tr key={p.id} className="border-t">
                                            <td className="px-4 py-2">
                                                <div className="font-medium text-gray-900">
                                                    {p.tipo_doc} {p.nro_doc}
                                                </div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="text-gray-900 font-medium">
                                                    {[p.nombres, p.apellidos].filter(Boolean).join(" ")}
                                                </div>
                                                <div className="text-xs text-gray-500">{p.fecha_nac || "—"}</div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="text-gray-700">{p.telefono || "—"}</div>
                                                <div className="text-xs text-gray-500">{p.email || "—"}</div>
                                            </td>
                                            <td className="px-4 py-2">
                                                <Badge variant={p.activo ? "success" : "muted"}>
                                                    {p.activo ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2">
                                                <Badge variant={p.es_menor ? "warn" : "muted"}>
                                                    {p.es_menor ? "Sí" : "No"}
                                                </Badge>
                                            </td>
                                            <td className="px-4 py-2">
                                                <div className="flex items-center justify-end gap-4">
                                                    <button
                                                        className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                                                        onClick={() => setDetailPassenger(p)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor">
                                                            <path
                                                                strokeWidth="1.5"
                                                                strokeLinecap="round"
                                                                strokeLinejoin="round"
                                                                d="M1.5 12s4.5-7.5 10.5-7.5S22.5 12 22.5 12s-4.5 7.5-10.5 7.5S1.5 12 1.5 12z"
                                                            />
                                                            <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
                                                        </svg>
                                                        <span>Ver</span>
                                                    </button>

                                                    <button
                                                        className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                                        onClick={() => openEdit(p)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor">
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
                                                        onClick={() => setConfirmId(p.id)}
                                                    >
                                                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                             stroke="currentColor">
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

                        {/* Móvil */}
                        <div className="grid gap-2 md:hidden">
                            {items.map((p) => {
                                const full = [p.nombres, p.apellidos].filter(Boolean).join(" ");
                                return (
                                    <div key={p.id} className="rounded-2xl border p-3">
                                        <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Doc
                                            </dt>
                                            <dd className="col-span-2 truncate text-sm font-medium text-gray-900">
                                                {p.tipo_doc} {p.nro_doc}
                                            </dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Nombre
                                            </dt>
                                            <dd className="col-span-2 truncate text-xs text-gray-700">{full || "—"}</dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Tel/Email
                                            </dt>
                                            <dd className="col-span-2 truncate text-xs text-gray-600">
                                                {p.telefono || "—"} {p.email ? `· ${p.email}` : ""}
                                            </dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Menor
                                            </dt>
                                            <dd className="col-span-2">
                                                <Badge variant={p.es_menor ? "warn" : "muted"}>
                                                    {p.es_menor ? "Sí" : "No"}
                                                </Badge>
                                            </dd>

                                            <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">
                                                Estado
                                            </dt>
                                            <dd className="col-span-2">
                                                <Badge variant={p.activo ? "success" : "muted"}>
                                                    {p.activo ? "Activo" : "Inactivo"}
                                                </Badge>
                                            </dd>
                                        </dl>

                                        <div className="mt-3 flex justify-end gap-4 text-xs">
                                            <button
                                                className="inline-flex items-center gap-1.5 text-blue-600 hover:underline"
                                                onClick={() => setDetailPassenger(p)}
                                            >
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                     stroke="currentColor">
                                                    <path
                                                        strokeWidth="1.5"
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M1.5 12s4.5-7.5 10.5-7.5S22.5 12 22.5 12s-4.5 7.5-10.5 7.5S1.5 12 1.5 12z"
                                                    />
                                                    <circle cx="12" cy="12" r="3" strokeWidth="1.5"/>
                                                </svg>
                                                <span>Ver</span>
                                            </button>

                                            <button
                                                className="inline-flex items-center gap-1.5 text-gray-700 hover:text-black hover:underline"
                                                onClick={() => openEdit(p)}
                                            >
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                     stroke="currentColor">
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
                                                onClick={() => setConfirmId(p.id)}
                                            >
                                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none"
                                                     stroke="currentColor">
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
            {detailPassenger && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setDetailPassenger(null)}
                >
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Detalle pasajero</h3>
                            <button
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => setDetailPassenger(null)}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="mt-3 space-y-2 text-sm text-gray-700">
                            <p><b>Documento:</b> {detailPassenger.tipo_doc} {detailPassenger.nro_doc}</p>
                            <p><b>Nombre:</b> {[detailPassenger.nombres, detailPassenger.apellidos].filter(Boolean).join(" ")}</p>
                            <p><b>Fecha nac.:</b> {detailPassenger.fecha_nac || "—"}</p>
                            <p><b>Teléfono:</b> {detailPassenger.telefono || "—"}</p>
                            <p><b>Email:</b> {detailPassenger.email || "—"}</p>
                            <p><b>Estado:</b> {detailPassenger.activo ? "Activo ✅" : "Inactivo ❌"}</p>
                            <p><b>Es menor:</b> {detailPassenger.es_menor ? "Sí 👶" : "No"}</p>

                            {/* Si es menor y tiene apoderados */}
                            {detailPassenger.es_menor && (
                                <div className="mt-3">
                                    <b>Apoderados:</b>
                                    {detailPassenger.apoderados_list?.length ? (
                                        <ul className="mt-1 list-disc pl-5 text-sm">
                                            {detailPassenger.apoderados_list.map((apo) => (
                                                <li key={apo.id}>
                                                    {apo.nombres} {apo.apellidos ?? ""} — {apo.tipo_doc} {apo.nro_doc}
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="text-gray-500 text-sm">Sin apoderados registrados</p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
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
                            <h3 className="text-lg font-semibold">
                                {editing.id ? "Editar pasajero" : "Nuevo pasajero"}
                            </h3>
                            <button
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => setShowForm(false)}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        <form className="mt-3 space-y-3" onSubmit={onSubmit}>
                            <div className="grid grid-cols-3 gap-3">
                                <div className="col-span-1">
                                    <label className="text-sm text-gray-700">Tipo doc</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.tipo_doc}
                                        onChange={(e) =>
                                            setEditing((s) => ({ ...s!, tipo_doc: e.target.value as DocType }))
                                        }
                                    >
                                        {DOCS.map((d) => (
                                            <option key={d} value={d}>
                                                {d}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="text-sm text-gray-700">Nro doc</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.nro_doc}
                                        onChange={(e) =>
                                            setEditing((s) => ({ ...s!, nro_doc: e.target.value }))
                                        }
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Nombres</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.nombres}
                                        onChange={(e) =>
                                            setEditing((s) => ({ ...s!, nombres: e.target.value }))
                                        }
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Apellidos</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.apellidos ?? ""}
                                        onChange={(e) =>
                                            setEditing((s) => ({ ...s!, apellidos: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Fecha nac.</label>
                                    <input
                                        type="date"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.fecha_nac ?? ""}
                                        onChange={(e) =>
                                            setEditing((s) => ({ ...s!, fecha_nac: e.target.value }))
                                        }
                                    />
                                    {/* Edad/menor */}
                                    {(() => {
                                        const age = calcAge(editing?.fecha_nac);
                                        return (
                                            <div className="mt-1 text-xs text-gray-600">
                                                Edad: <b>{age ?? "—"}</b> • Menor:{" "}
                                                <b>{isMinor(age) ? "Sí" : "No"}</b>
                                            </div>
                                        );
                                    })()}
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Teléfono</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                        value={editing.telefono ?? ""}
                                        onChange={(e) =>
                                            setEditing((s) => ({ ...s!, telefono: e.target.value }))
                                        }
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="text-sm text-gray-700">Email</label>
                                <input
                                    type="email"
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                    value={editing.email ?? ""}
                                    onChange={(e) =>
                                        setEditing((s) => ({ ...s!, email: e.target.value }))
                                    }
                                />
                            </div>

                            <label className="mt-1 inline-flex cursor-pointer items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    className="h-4 w-4"
                                    checked={editing.activo ?? true}
                                    onChange={(e) =>
                                        setEditing((s) => ({ ...s!, activo: e.target.checked }))
                                    }
                                />
                                Activo
                            </label>

                            {/* Bloque apoderados (crear o editar menor) */}
                            {isMinor(calcAge(editing?.fecha_nac)) && (
                                <div className="mt-3 rounded-xl border p-3">
                                    <div className="mb-2 text-sm font-medium text-gray-800">Apoderado(s)</div>

                                    {/* CREAR NUEVO MENOR */}
                                    {!editing.id && (
                                        <>
                                            <div className="mb-3 flex items-center gap-4 text-sm">
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="guardian_mode"
                                                        checked={!createGuardian}
                                                        onChange={() => setCreateGuardian(false)}
                                                    />
                                                    Seleccionar existente
                                                </label>
                                                <label className="inline-flex items-center gap-2">
                                                    <input
                                                        type="radio"
                                                        name="guardian_mode"
                                                        checked={createGuardian}
                                                        onChange={() => setCreateGuardian(true)}
                                                    />
                                                    Crear nuevo
                                                </label>
                                            </div>

                                            {/* EXISTENTE */}
                                            {!createGuardian && (
                                                <div>
                                                    <input
                                                        value={guardianSearch}
                                                        onChange={(e) => {
                                                            setGuardianSearch(e.target.value);
                                                            setSelectedGuardianId(null);
                                                        }}
                                                        placeholder="Buscar apoderado…"
                                                        className="w-full rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                                                    />
                                                    {guardianResults.map((g) => (
                                                        <button
                                                            key={g.id}
                                                            type="button"
                                                            onClick={() => setSelectedGuardianId(g.id)}
                                                            className={`block w-full px-3 py-2 text-left hover:bg-gray-50 ${
                                                                selectedGuardianId === g.id ? "bg-gray-100" : ""
                                                            }`}
                                                        >
                                                            {g.nombres} {g.apellidos ?? ""} — {g.tipo_doc} {g.nro_doc}
                                                        </button>
                                                    ))}
                                                    {selectedGuardianId && (
                                                        <div className="mt-2 text-xs text-green-700">✓ Apoderado seleccionado</div>
                                                    )}
                                                </div>
                                            )}

                                            {/* NUEVO */}
                                            {createGuardian && (
                                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                                                    {/* …inputs de nuevo apoderado igual que ya tenías… */}
                                                </div>
                                            )}
                                        </>
                                    )}

                                    {/* EDITAR MENOR EXISTENTE */}
                                    {editing.id && (
                                        <div className="mt-3 space-y-2">
                                            {/* Lista actual de apoderados */}
                                            {relations.length > 0 ? (
                                                <ul className="space-y-1 text-sm">
                                                    {relations.map((rel) => (
                                                        <li key={rel.id} className="flex items-center justify-between">
            <span>
              {rel.apoderado_det?.nombres} {rel.apoderado_det?.apellidos ?? ""} —{" "}
                {rel.apoderado_det?.tipo_doc} {rel.apoderado_det?.nro_doc}
            </span>
                                                            <button
                                                                type="button"
                                                                className="text-red-600 text-xs hover:underline"
                                                                onClick={async () => {
                                                                    await deleteRelation(rel.id);
                                                                    setRelations((prev) => prev.filter((r) => r.id !== rel.id));
                                                                    toast.success("Relación eliminada");
                                                                }}
                                                            >
                                                                Quitar
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-gray-500">Sin apoderados registrados</p>
                                            )}

                                            {/* Botón toggle */}
                                            {!addingRelation ? (
                                                <button
                                                    type="button"
                                                    className="mt-2 text-blue-600 text-xs hover:underline"
                                                    onClick={() => setAddingRelation(true)}
                                                >
                                                    + Añadir apoderado
                                                </button>
                                            ) : (
                                                <div className="space-y-2">
                                                    <input
                                                        placeholder="Buscar apoderado…"
                                                        className="w-full rounded-xl border px-3 py-2 text-sm"
                                                        value={guardianSearch}
                                                        onChange={(e) => setGuardianSearch(e.target.value)}
                                                    />
                                                    {guardianResults
                                                        .filter(
                                                            (g) =>
                                                                g.id !== editing.id &&
                                                                !relations.some((rel) => rel.apoderado === g.id)
                                                        )
                                                        .map((g) => (
                                                            <button
                                                                key={g.id}
                                                                type="button"
                                                                className="block w-full px-3 py-1 text-left hover:bg-gray-50 text-sm"
                                                                onClick={async () => {
                                                                    const rel = await createRelation({
                                                                        menor: editing.id!,
                                                                        apoderado: g.id,
                                                                    });
                                                                    setRelations((prev) => [...prev, rel]);
                                                                    toast.success("Relación añadida");
                                                                    setAddingRelation(false);
                                                                    setGuardianSearch("");
                                                                    setGuardianResults([]);
                                                                }}
                                                            >
                                                                {g.nombres} {g.apellidos} — {g.tipo_doc} {g.nro_doc}
                                                            </button>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                    )}


                                </div>
                            )}

                            <div className="mt-2 flex justify-end gap-2">
                                <button
                                    type="button"
                                    className="rounded-xl border px-3 py-2 text-sm"
                                    onClick={() => setShowForm(false)}
                                >
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


            {/* Confirmación eliminar */}
            {confirmId && (
                <div
                    className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
                    role="dialog"
                    aria-modal="true"
                    onKeyDown={(e) => e.key === "Escape" && setConfirmId(null)}
                >
                    <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-lg">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Eliminar pasajero</h3>
                            <button
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => setConfirmId(null)}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>
                        <p className="mt-2 text-sm text-gray-600">
                            ¿Seguro que deseas eliminar este pasajero? Esta acción no se puede
                            deshacer.
                        </p>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                className="rounded-xl border px-3 py-2 text-sm"
                                onClick={() => setConfirmId(null)}
                            >
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
    function IconIdCard(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <rect x="3" y="5" width="18" height="14" rx="2" strokeWidth="1.5" />
                <circle cx="9" cy="12" r="2.5" strokeWidth="1.5" />
                <path strokeWidth="1.5" d="M14 10h5M14 14h5" />
            </svg>
        );
    }
    function IconUser(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <circle cx="12" cy="8" r="4" strokeWidth="1.5" />
                <path strokeWidth="1.5" d="M4 20a8 8 0 0 1 16 0" />
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
    function IconChild(props: React.SVGProps<SVGSVGElement>) {
        return (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
                <circle cx="12" cy="7" r="3" strokeWidth="1.5" />
                <path strokeWidth="1.5" d="M5 21v-2a5 5 0 0 1 10 0v2M19 21v-2c0-2-1.5-3.5-3.5-4" />
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
