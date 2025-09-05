// views/ventas/ReceiptsView.tsx
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
    FileText,
    DollarSign,
    Coins,
    CheckCircle2,
    Building2,
    CalendarClock,
    FileDown
} from "lucide-react";

import {
    listReceipts,
    getReceipt,
    type ReceiptRead,
    type ReceiptStatus,
} from "../../services/receipts";
import { api } from "../../services/api";

/* ------------------------------ types ------------------------------ */
type Id = string | number;
type OfficeLite = { id: Id; code: string; name: string };

/* ------------------------------ ui bits ------------------------------ */
const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

/* ----------------------------- helpers ----------------------------- */
const formatBs = (v: string | number) => `Bs ${Number(v ?? 0).toFixed(2)}`;
const formatDateTime = (s?: string | null) => (s ? new Date(s).toLocaleString() : "—");

async function fetchOfficesLite(): Promise<OfficeLite[]> {
    const data = await api.get<any>(`/catalog/offices/?page_size=500`);
    const arr = Array.isArray(data) ? data : data?.results ?? [];
    return arr.map((o: any) => ({ id: o.id, code: o.code, name: o.name }));
}

/* =============================== VIEW =============================== */
export default function ReceiptsView() {
    const [items, setItems] = useState<ReceiptRead[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const [offices, setOffices] = useState<OfficeLite[]>([]);

    // filtros
    const [status, setStatus] = useState<ReceiptStatus | "">("");
    const [officeId, setOfficeId] = useState<Id | "">("");
    const [search, setSearch] = useState("");

    // orden
    const [ordering, setOrdering] = useState("-issued_at");

    // detalle
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [details, setDetails] = useState<ReceiptRead | null>(null);

    // primer load
    useEffect(() => {
        (async () => {
            try {
                const o = await fetchOfficesLite();
                setOffices(o);
            } catch (e: any) {
                toast.error(e?.message || "No se pudieron cargar oficinas.");
            }
        })();
    }, []);

    const fetchReceipts = useCallback(async () => {
        setLoading(true);
        try {
            const { items, total } = await listReceipts({
                status: (status || undefined) as ReceiptStatus | undefined,
                issuer_office: officeId || undefined,
                search: search || undefined,
                ordering,
                pageSize: 50,
            });
            setItems(items);
            setTotal(total);
        } catch (e: any) {
            toast.error(e?.message || "Error cargando recibos");
        } finally {
            setLoading(false);
        }
    }, [status, officeId, search, ordering]);

    useEffect(() => {
        fetchReceipts();
    }, [fetchReceipts]);

    const openDetails = async (receiptId: Id) => {
        setDetailsOpen(true);
        setDetails(null);
        setDetailsLoading(true);
        try {
            const found = items.find((x) => String(x.id) === String(receiptId));
            if (found) setDetails(found);
            else {
                const data = await getReceipt(String(receiptId));
                setDetails(data);
            }
        } catch (e: any) {
            toast.error(e?.message || "No se pudieron cargar los detalles");
            setDetailsOpen(false);
        } finally {
            setDetailsLoading(false);
        }
    };

    const closeDetails = () => {
        setDetailsOpen(false);
        setDetails(null);
    };

    /* ------------------------------ UI ------------------------------ */
    return (
        <div className="mt-6">
            {/* Toolbar */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-700">
                    {loading ? "Cargando…" : `${total} recibos`}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    {/* filtros */}
                    <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as ReceiptStatus | "")}
                    >
                        <option value="">Todos</option>
                        <option value="ISSUED">Emitido</option>
                        <option value="VOID">Anulado</option>
                    </select>

                    <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={officeId}
                        onChange={(e) => setOfficeId(e.target.value as Id | "")}
                    >
                        <option value="">Oficina: Todas</option>
                        {offices.map((o) => (
                            <option key={String(o.id)} value={String(o.id)}>
                                {o.code} · {o.name}
                            </option>
                        ))}
                    </select>

                    <input
                        className="rounded-xl border px-3 py-2 text-sm"
                        placeholder="Buscar Nº / notas…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={ordering}
                        onChange={(e) => setOrdering(e.target.value)}
                    >
                        <option value="-issued_at">Más recientes</option>
                        <option value="issued_at">Más antiguos</option>
                        <option value="-total_amount">Monto desc</option>
                        <option value="total_amount">Monto asc</option>
                        <option value="number">Nº asc</option>
                        <option value="-number">Nº desc</option>
                    </select>
                </div>
            </div>

            {/* listado */}
            <div className="mt-4">
                {loading ? (
                    <div className="p-4 text-sm text-gray-600 flex items-center gap-2">
                        <Spinner /> Cargando…
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-4 text-sm text-gray-600">No hay recibos.</div>
                ) : (
                    <>
                        {/* Desktop */}
                        <div className="hidden md:block rounded-2xl border">
                            <div className="max-h-[60vh] overflow-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-50 sticky top-0 text-gray-700">
                                    <tr>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <FileText className="h-4 w-4 text-gray-500"/>
                                                <span>Número</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="h-4 w-4 text-gray-500"/>
                                                <span>Monto</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <Coins className="h-4 w-4 text-gray-500"/>
                                                <span>Moneda</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-gray-500"/>
                                                <span>Estado</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-gray-500"/>
                                                <span>Oficina</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <CalendarClock className="h-4 w-4 text-gray-500"/>
                                                <span>Emitido</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <FileDown className="h-4 w-4 text-gray-500"/>
                                                <span>PDF</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <span className="sr-only">Acciones</span>
                                        </th>
                                    </tr>
                                    </thead>

                                    <tbody>
                                    {items.map((r) => (
                                        <tr key={String(r.id)} className="border-t">
                                            <td className="px-3 py-2">{r.number}</td>
                                            <td className="px-3 py-2">{formatBs(r.total_amount)}</td>
                                            <td className="px-3 py-2">{r.currency}</td>
                                            <td className="px-3 py-2">
                                                <span className={badgeClass(r.status)}>{statusLabel(r.status)}</span>
                                            </td>
                                            <td className="px-3 py-2">
                                                {r.issuer_office ? `${r.issuer_office.code} · ${r.issuer_office.name}` : "—"}
                                            </td>
                                            <td className="px-3 py-2">{formatDateTime(r.issued_at)}</td>
                                            <td className="px-3 py-2">
                                                {r.receipt_pdf_url ? (
                                                    <a
                                                        href={`${r.receipt_pdf_url}${r.receipt_pdf_url.endsWith(".pdf") ? "" : ".pdf"}`}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                                    >
                                                        <IconDownload className="h-4 w-4 text-gray-600"/> Abrir
                                                    </a>
                                                ) : (
                                                    <span className="text-xs text-gray-500">—</span>
                                                )}
                                            </td>
                                            <td className="px-3 py-2">
                                                <button
                                                    onClick={() => openDetails(r.id)}
                                                    className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                                >
                                                    <IconEye className="h-4 w-4 text-gray-600"/> Ver
                                                </button>
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
                                <div key={String(r.id)} className="rounded-2xl border p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">{r.number}</div>
                                        <span className={badgeClass(r.status)}>{statusLabel(r.status)}</span>
                                    </div>
                                    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Monto</dt>
                                        <dd className="col-span-2">{formatBs(r.total_amount)} ({r.currency})</dd>

                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Oficina</dt>
                                        <dd className="col-span-2">{r.issuer_office ? `${r.issuer_office.code} · ${r.issuer_office.name}` : "—"}</dd>

                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Emitido</dt>
                                        <dd className="col-span-2">{formatDateTime(r.issued_at)}</dd>
                                    </dl>

                                    <div className="mt-2 flex justify-end gap-2">
                                        {r.receipt_pdf_url ? (
                                            <a
                                                href={r.receipt_pdf_url}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <IconDownload className="h-4 w-4" /> PDF
                                            </a>
                                        ) : null}
                                        <button
                                            onClick={() => openDetails(r.id)}
                                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                        >
                                            <IconEye className="h-4 w-4" /> Ver
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal detalles */}
            {detailsOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 sm:grid sm:place-items-center p-0 sm:p-4" role="dialog" aria-modal="true">
                    <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white shadow-lg flex flex-col rounded-none sm:rounded-2xl">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b px-4 sm:px-5 py-3 sticky top-0 bg-white z-10">
                            <h3 className="text-base sm:text-lg font-semibold">Detalle de recibo</h3>
                            <button onClick={closeDetails} className="rounded-full p-1 text-gray-500 hover:bg-gray-100" aria-label="Cerrar">
                                ✕
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto px-4 sm:px-5 py-4">
                            {detailsLoading ? (
                                <div className="flex items-center gap-2 text-sm text-gray-600"><Spinner /> Cargando…</div>
                            ) : !details ? (
                                <div className="text-sm text-gray-600">No se encontraron datos.</div>
                            ) : (
                                <>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Número</div>
                                            <div className="text-sm font-medium break-all">{details.number}</div>
                                            <div className="mt-1 text-xs text-gray-500">Emitido: {formatDateTime(details.issued_at)}</div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Estado</div>
                                            <div className="text-sm font-medium">{statusLabel(details.status)}</div>
                                            <div className="mt-1 text-xs text-gray-500">Moneda: {details.currency}</div>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Monto</div>
                                            <div className="text-sm font-semibold">{formatBs(details.total_amount)}</div>
                                            <div className="text-xs text-gray-500 mt-1">Pago: {String(details.payment).slice(0, 12)}…</div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Oficina / Cajero</div>
                                            <div className="text-sm">{details.issuer_office ? `${details.issuer_office.code} · ${details.issuer_office.name}` : "—"}</div>
                                            <div className="text-xs text-gray-500 mt-1">Usuario: {details.issuer?.full_name || details.issuer?.username || "—"}</div>
                                        </div>
                                    </div>

                                    {details.notes ? (
                                        <div className="mt-3 rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Notas</div>
                                            <div className="text-sm">{details.notes}</div>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>

                        <div className="flex-none border-t px-4 sm:px-5 py-3 sticky bottom-0 bg-white">
                            <div className="flex items-center justify-between">
                                {details?.receipt_pdf_url ? (
                                    <a
                                        href={details.receipt_pdf_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                                    >
                                        <IconDownload className="h-4 w-4" /> Abrir PDF
                                    </a>
                                ) : <span />}
                                <button onClick={closeDetails} className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50">
                                    Cerrar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------ helpers UI ------------------------------ */
function badgeClass(status: ReceiptStatus) {
    switch (status) {
        case "ISSUED":
            return "text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700";
        case "VOID":
            return "text-[10px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700";
        default:
            return "text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700";
    }
}
function statusLabel(status: ReceiptStatus) {
    switch (status) {
        case "ISSUED": return "Emitido";
        case "VOID": return "Anulado";
        default: return status;
    }
}

/* ============================= ICONOS ============================= */
function IconReceipt(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M6 3h12v18l-3-2-3 2-3-2-3 2V3z" />
            <path strokeWidth="1.5" d="M9 7h6M9 11h6M9 15h4" />
        </svg>
    );
}
function IconEye(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
        </svg>
    );
}
function IconDownload(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M12 3v12m0 0l-4-4m4 4l4-4" />
            <path strokeWidth="1.5" d="M4 15v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" />
        </svg>
    );
}
