import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { listAudit, type AuditLog } from "../../services/audit.ts";

// ---- UI helpers (mismo estilo que UsuariosView) ----
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

// ---- Utilidades ----
function formatDate(iso: string) {
    try {
        return new Date(iso).toLocaleString("es-BO", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        });
    } catch {
        return iso;
    }
}

function stringifyExtra(v: unknown) {
    try {
        if (typeof v === "string") {
            try { return JSON.stringify(JSON.parse(v), null, 2); } catch { return v; }
        }
        if (v == null) return "";
        return JSON.stringify(v, null, 2);
    } catch {
        return String(v ?? "");
    }
}

export default function BitacoraView() {
    const [q, setQ] = useState("");
    const qDebounced = useDebouncedValue(q, 350);

    const [page, setPage] = useState(1);
    const [pageSize] = useState(10);
    const [total, setTotal] = useState(0);
    const [items, setItems] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);
    const reqSeqRef = useRef(0);

    const fetchList = useCallback(
        async () => {
            const mySeq = ++reqSeqRef.current;
            try {
                setLoading(true);
                const { items, total } = await listAudit({
                    q: qDebounced,
                    page,                // 👈 usa la página tal cual
                    parseExtra: true,    // 👈 si quieres, quita pageSize (global a 10)
                });
                if (reqSeqRef.current !== mySeq) return;
                setItems(items ?? []);
                setTotal(Number(total ?? 0));
                setError(null);
            } catch (e: any) {
                if (reqSeqRef.current !== mySeq) return;
                const msg = e?.message || "Error cargando bitácora";
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
                        placeholder="Buscar acción, entidad o usuario…"
                        className="w-full rounded-2xl border px-10 py-2 text-sm outline-none focus:ring-2 focus:ring-black/10"
                    />
                </div>

                <div className="flex items-center gap-2">
                    <Badge>{total} eventos</Badge>
                </div>
            </div>

            {/* Tabla (desktop) / Cards (móvil) */}
            <div className="mt-4">
                {loading ? (
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                        <Spinner /> Cargando eventos…
                    </div>
                ) : error ? (
                    <div className="text-sm text-red-600">Error: {error}</div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-6 text-sm text-gray-600">No hay registros.</div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden rounded-2xl border md:block">
                            {/* scroller interno de la tabla */}
                            <div
                                className="max-h-[60vh] overflow-y-auto overscroll-contain"
                                style={{ scrollbarGutter: "stable" }} // evita saltos por la barra
                            >
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 z-10 bg-gray-50 text-left text-gray-600 shadow-sm">
                                    <tr>
                                        <th className="px-4 py-2">Fecha</th>
                                        <th className="px-4 py-2">Usuario</th>
                                        <th className="px-4 py-2">Acción</th>
                                        <th className="px-4 py-2">Entidad</th>
                                        <th className="px-4 py-2">Registro</th>
                                        <th className="px-4 py-2">Extra</th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {items.map((r) => (
                                        <tr key={r.id} className="border-t align-top">
                                            <td className="px-4 py-2 whitespace-nowrap font-medium text-gray-900">
                                                {formatDate(r.created_at)}
                                            </td>
                                            <td className="px-4 py-2 whitespace-nowrap">{r.user_username ?? "—"}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{r.action}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{r.entity}</td>
                                            <td className="px-4 py-2 whitespace-nowrap">{r.record_id ?? "—"}</td>
                                            <td className="px-4 py-2">
                                                <ExtraCell value={r.extra} />
                                            </td>
                                        </tr>
                                    ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>


                        {/* Mobile cards */}
                        <div className="grid gap-2 md:hidden">
                            {items.map((r) => (
                                <div key={r.id} className="rounded-2xl border p-3">
                                    <dl className="grid grid-cols-3 gap-x-3 gap-y-1">
                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Fecha</dt>
                                        <dd className="col-span-2 truncate text-sm font-medium text-gray-900">{formatDate(r.created_at)}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Usuario</dt>
                                        <dd className="col-span-2 truncate text-xs text-gray-700">{r.user_username ?? "—"}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Acción</dt>
                                        <dd className="col-span-2 truncate text-xs text-gray-700">{r.action}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Entidad</dt>
                                        <dd className="col-span-2 truncate text-xs text-gray-700">{r.entity}</dd>

                                        <dt className="col-span-1 text-[10px] uppercase tracking-wide text-gray-500">Registro</dt>
                                        <dd className="col-span-2 truncate text-xs text-gray-700">{r.record_id ?? "—"}</dd>
                                    </dl>

                                    <div className="mt-2">
                                        <ExtraCell value={r.extra} compact />
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
        </div>
    );
}

function ExtraCell({ value, compact = false }: { value: unknown; compact?: boolean }) {
    const [open, setOpen] = useState(false);
    const pretty = useMemo(() => stringifyExtra(value), [value]);
    const isLong = pretty.length > 140;

    if (!isLong) {
        return (
            <pre className={`max-h-40 overflow-auto rounded-xl bg-gray-100 p-3 text-xs ${compact ? "text-[11px]" : ""}`}>{
                pretty || "—"
            }</pre>
        );
    }

    return (
        <div>
            <button
                className="mb-1 rounded-lg border px-2 py-1 text-xs hover:bg-gray-50"
                onClick={() => setOpen((o) => !o)}
            >
                {open ? "Ocultar" : "Ver JSON"}
            </button>
            {open && (
                <pre className={`max-h-60 overflow-auto rounded-xl bg-gray-100 p-3 text-xs ${compact ? "text-[11px]" : ""}`}>{
                    pretty
                }</pre>
            )}
        </div>
    );
}
