import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import {
    listPayments,
    listPaymentMethods,
    createPayment,
    confirmPayment,
    type PaymentRead,
    type PaymentMethod,
    type PaymentStatus,
} from "../../services/payments";
import {
    getOrder,
    type OrderRead,
    // helpers para evitar UUID y mostrar saldo
    findLatestOpenOrderByBuyer,
    searchOpenOrdersByBuyer,
    getOrderBalance,
} from "../../services/orders";
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
export default function PaymentsView() {
    const [items, setItems] = useState<PaymentRead[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    const [methods, setMethods] = useState<PaymentMethod[]>([]);
    const [offices, setOffices] = useState<OfficeLite[]>([]);

    // filtros
    const [status, setStatus] = useState<PaymentStatus | "">("");
    const [methodId, setMethodId] = useState<Id | "">("");
    const [search, setSearch] = useState("");

    // orden
    const [ordering, setOrdering] = useState("-created_at");

    // modales
    const [showCreate, setShowCreate] = useState(false);
    const [saving, setSaving] = useState(false);

    // detalle (ojito)
    const [detailsOpen, setDetailsOpen] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [details, setDetails] = useState<PaymentRead | null>(null);

    // form crear
    const [orderId, setOrderId] = useState<Id | "">("");
    const [loadedOrder, setLoadedOrder] = useState<OrderRead | null>(null);
    const [methodSel, setMethodSel] = useState<Id | "">("");
    const [amount, setAmount] = useState<string>("");
    const [currency, setCurrency] = useState<string>("BOB");
    const [officeId, setOfficeId] = useState<Id | "">("");
    const [txid, setTxid] = useState<string>("");
    const [confirmNow, setConfirmNow] = useState<boolean>(true);
    const [email, setEmail] = useState<string>(""); // 👈 NUEVO

    // 🔎 búsqueda por comprador (para no usar UUID)
    const [buyerQuery, setBuyerQuery] = useState("");
    const [buyerMatches, setBuyerMatches] = useState<OrderRead[]>([]);
    const [fetchingMatches, setFetchingMatches] = useState(false);

    // primer load
    useEffect(() => {
        (async () => {
            try {
                const [m, o] = await Promise.all([listPaymentMethods(), fetchOfficesLite()]);
                setMethods(m);
                setOffices(o);
            } catch (e: any) {
                toast.error(e?.message || "No se pudieron cargar catálogos.");
            }
        })();
    }, []);

    const fetchPayments = useCallback(async () => {
        setLoading(true);
        try {
            const { items, total } = await listPayments({
                status: (status || undefined) as PaymentStatus | undefined,
                method: methodId || undefined,
                search: search || undefined,
                ordering,
                pageSize: 50,
            });
            setItems(items);
            setTotal(total);
        } catch (e: any) {
            toast.error(e?.message || "Error cargando pagos");
        } finally {
            setLoading(false);
        }
    }, [status, methodId, search, ordering]);

    useEffect(() => {
        fetchPayments();
    }, [fetchPayments]);

    const resetForm = () => {
        setOrderId("");
        setLoadedOrder(null);
        setMethodSel("");
        setAmount("");
        setCurrency("BOB");
        setOfficeId("");
        setTxid("");
        setConfirmNow(true);
        setBuyerQuery("");
        setBuyerMatches([]);
        setFetchingMatches(false);
        setEmail(""); // 👈 limpiar email
    };

    const openDetails = async (paymentId: Id) => {
        setDetailsOpen(true);
        setDetails(null);
        setDetailsLoading(true);
        try {
            const p = items.find((x) => String(x.id) === String(paymentId));
            if (p) setDetails(p);
            else {
                const data = await api.get<PaymentRead>(`/ventas/payments/${paymentId}/`);
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

    // 🔄 cargar saldo de la orden escrita/seleccionada
    const fetchOrderDue = async () => {
        if (!orderId) return toast.error("Ingresa o selecciona la orden.");
        try {
            const o = await getOrder(orderId);
            setLoadedOrder(o);
            const due = Math.max(0, Number(o.total_amount) - Number(o.paid_amount));
            setAmount(due.toFixed(2));
            // si el buyer_doc parece email, lo sugerimos
            if (!email && o?.buyer_doc && /\S+@\S+\.\S+/.test(String(o.buyer_doc))) {
                setEmail(String(o.buyer_doc));
            }
            toast.success("Saldo sugerido cargado.");
        } catch (e: any) {
            setLoadedOrder(null);
            toast.error(e?.message || "No se encontró la orden.");
        }
    };

    // 🔎 autocomplete por comprador (mín 3 letras)
    useEffect(() => {
        const q = buyerQuery.trim();
        if (q.length < 3) { setBuyerMatches([]); return; }
        let alive = true;
        (async () => {
            try {
                setFetchingMatches(true);
                const res = await searchOpenOrdersByBuyer(q, { limit: 6, includePaid: false });
                if (!alive) return;
                setBuyerMatches(res);
            } catch {
                // silencioso
            } finally {
                if (alive) setFetchingMatches(false);
            }
        })();
        return () => { alive = false; };
    }, [buyerQuery]);

    const pickLatestForBuyer = async () => {
        const q = buyerQuery.trim();
        if (q.length < 3) return toast.info("Escribe al menos 3 letras del comprador");
        const o = await findLatestOpenOrderByBuyer(q);
        if (!o) return toast.error("No se encontró una orden abierta para ese comprador.");
        setOrderId(String(o.id));
        setLoadedOrder(o);
        setAmount(getOrderBalance(o).toFixed(2));
        toast.success("Se aplicó la última orden abierta.");
    };

    const selectOrderFromMatches = (o: OrderRead) => {
        setOrderId(String(o.id));
        setBuyerQuery(o.buyer_name);
        setBuyerMatches([]);
        setLoadedOrder(o);
        setAmount(getOrderBalance(o).toFixed(2));
    };

    const onCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!orderId) return toast.error("Selecciona una orden (o ingresa el ID).");
        if (!methodSel) return toast.error("Selecciona el método.");
        const num = Number(amount);
        if (!num || num <= 0) return toast.error("Ingresa un monto válido.");

        setSaving(true);
        try {
            await createPayment({
                order: orderId as string,
                method: methodSel,
                amount: amount,
                currency: currency || "BOB",
                office: officeId || null,
                transaction_id: txid || undefined,
                confirm: confirmNow,
                email: email || undefined, // 👈 pasa email al backend
            });
            toast.success(confirmNow ? "Pago creado y confirmado." : "Pago creado.");
            setShowCreate(false);
            resetForm();
            await fetchPayments();
        } catch (e: any) {
            toast.error(e?.message || "No se pudo crear el pago.");
        } finally {
            setSaving(false);
        }
    };

    const onConfirm = async (paymentId: Id) => {
        try {
            await confirmPayment(String(paymentId)); // si quieres, puedes pasar email aquí también
            toast.success("Pago confirmado.");
            await fetchPayments();
        } catch (e: any) {
            toast.error(e?.message || "No se pudo confirmar el pago.");
        }
    };

    /* ------------------------------ UI ------------------------------ */
    return (
        <div className="mt-6">
            {/* Toolbar compacta */}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-700">
                    {loading ? "Cargando…" : `${total} pagos`}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                    {/* filtros */}
                    <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={status}
                        onChange={(e) => setStatus(e.target.value as PaymentStatus | "")}
                    >
                        <option value="">Todos</option>
                        <option value="PENDING">Pendiente</option>
                        <option value="CONFIRMED">Confirmado</option>
                        <option value="FAILED">Fallido</option>
                        <option value="PARTIALLY_REFUNDED">Parcialmente devuelto</option>
                        <option value="REFUNDED">Devuelto</option>
                    </select>

                    <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={methodId}
                        onChange={(e) => setMethodId(e.target.value as Id | "")}
                    >
                        <option value="">Método: Todos</option>
                        {methods.map((m) => (
                            <option key={String(m.id)} value={String(m.id)}>
                                {m.code} · {m.name}
                            </option>
                        ))}
                    </select>

                    <input
                        className="rounded-xl border px-3 py-2 text-sm"
                        placeholder="Buscar por TxID…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />

                    <select
                        className="rounded-xl border px-3 py-2 text-sm"
                        value={ordering}
                        onChange={(e) => setOrdering(e.target.value)}
                    >
                        <option value="-created_at">Más recientes</option>
                        <option value="created_at">Más antiguos</option>
                        <option value="-amount">Monto desc</option>
                        <option value="amount">Monto asc</option>
                    </select>

                    <button
                        onClick={() => setShowCreate(true)}
                        className="inline-flex items-center gap-2 rounded-2xl border px-3 py-2 text-sm hover:bg-black hover:text-white"
                    >
                        + Nuevo pago
                    </button>
                </div>
            </div>

            {/* listado */}
            <div className="mt-4">
                {loading ? (
                    <div className="p-4 text-sm text-gray-600 flex items-center gap-2">
                        <Spinner /> Cargando…
                    </div>
                ) : items.length === 0 ? (
                    <div className="rounded-2xl border p-4 text-sm text-gray-600">No hay pagos.</div>
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
                                                <IconMoney className="h-4 w-4 text-gray-500" />
                                                <span>Pago</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconReceipt className="h-4 w-4 text-gray-500" />
                                                <span>Orden</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">
                                            <div className="flex items-center gap-2">
                                                <IconCircle className="h-4 w-4 text-gray-500" />
                                                <span>Estado</span>
                                            </div>
                                        </th>
                                        <th className="px-3 py-2 text-left">Método</th>
                                        <th className="px-3 py-2 text-left">Monto</th>
                                        <th className="px-3 py-2 text-left">TxID</th>
                                        <th className="px-3 py-2 text-left">Creado</th>
                                        <th className="px-3 py-2 text-left">Pagado</th>
                                        <th className="px-3 py-2 text-left"><span className="sr-only">Acciones</span></th>
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {items.map((p) => (
                                        <tr key={String(p.id)} className="border-t">
                                            <td className="px-3 py-2">{String(p.id).slice(0, 8)}…</td>
                                            <td className="px-3 py-2">{String(p.order).slice(0, 8)}…</td>
                                            <td className="px-3 py-2">
                                                <span className={badgeClass(p.status)}>{statusLabel(p.status)}</span>
                                            </td>
                                            <td className="px-3 py-2">{p.method?.code ?? "—"}</td>
                                            <td className="px-3 py-2">{formatBs(p.amount)}</td>
                                            <td className="px-3 py-2">{p.transaction_id || "—"}</td>
                                            <td className="px-3 py-2">{formatDateTime(p.created_at)}</td>
                                            <td className="px-3 py-2">{formatDateTime(p.paid_at)}</td>
                                            <td className="px-3 py-2">
                                                <div className="flex items-center gap-2">
                                                    <button
                                                        onClick={() => openDetails(p.id)}
                                                        className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                                    >
                                                        <IconEye className="h-4 w-4 text-gray-600" /> Ver
                                                    </button>
                                                    {p.status === "PENDING" && (
                                                        <button
                                                            onClick={() => onConfirm(p.id)}
                                                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                                        >
                                                            <IconCheckCircle className="h-4 w-4 text-gray-600" /> Confirmar
                                                        </button>
                                                    )}
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
                            {items.map((p) => (
                                <div key={String(p.id)} className="rounded-2xl border p-3">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">#{String(p.id).slice(0, 8)}…</div>
                                        <span className={badgeClass(p.status)}>{statusLabel(p.status)}</span>
                                    </div>
                                    <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-1 text-xs">
                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Orden</dt>
                                        <dd className="col-span-2 truncate">{String(p.order)}</dd>

                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Método</dt>
                                        <dd className="col-span-2">{p.method?.code ?? "—"}</dd>

                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Monto</dt>
                                        <dd className="col-span-2">{formatBs(p.amount)}</dd>

                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">TxID</dt>
                                        <dd className="col-span-2">{p.transaction_id || "—"}</dd>

                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Creado</dt>
                                        <dd className="col-span-2">{formatDateTime(p.created_at)}</dd>

                                        <dt className="text-[10px] uppercase tracking-wide text-gray-500">Pagado</dt>
                                        <dd className="col-span-2">{formatDateTime(p.paid_at)}</dd>
                                    </dl>

                                    <div className="mt-2 flex justify-end gap-2">
                                        <button
                                            onClick={() => openDetails(p.id)}
                                            className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                        >
                                            <IconEye className="h-4 w-4" /> Ver
                                        </button>
                                        {p.status === "PENDING" && (
                                            <button
                                                onClick={() => onConfirm(p.id)}
                                                className="inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs hover:bg-gray-50"
                                            >
                                                <IconCheckCircle className="h-4 w-4" /> Confirmar
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* Modal crear */}
            {showCreate && (
                <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" role="dialog" aria-modal="true">
                    <div className="w-full max-w-3xl max-h-[90vh] rounded-2xl bg-white shadow-lg flex flex-col">
                        {/* Header */}
                        <div className="flex items-center justify-between border-b px-5 py-3">
                            <h3 className="text-lg font-semibold">Nuevo pago</h3>
                            <button
                                className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                                onClick={() => {
                                    setShowCreate(false);
                                    resetForm();
                                }}
                                aria-label="Cerrar"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Body con scroll */}
                        <form className="flex-1 overflow-y-auto px-5 py-4 space-y-4" onSubmit={onCreate}>
                            {/* Orden (ID manual + botón saldo) */}
                            <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-end">
                                <div>
                                    <label className="text-sm text-gray-700">Order ID</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={orderId}
                                        onChange={(e) => setOrderId(e.target.value)}
                                        placeholder="UUID de la orden"
                                        required
                                    />
                                </div>
                                <button
                                    type="button"
                                    onClick={fetchOrderDue}
                                    className="rounded-xl border px-3 py-2 text-sm hover:bg-gray-50"
                                >
                                    Ver saldo
                                </button>
                            </div>

                            {/* Búsqueda por comprador (autocomplete) */}
                            <div>
                                <label className="text-sm text-gray-700">Buscar por comprador</label>
                                <div className="relative">
                                    <input
                                        value={buyerQuery}
                                        onChange={(e) => setBuyerQuery(e.target.value)}
                                        placeholder="Nombre del comprador (mín. 3 letras)…"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                    />
                                    {!!buyerMatches.length && (
                                        <div className="absolute z-10 mt-1 w-full rounded-xl border bg-white shadow max-h-64 overflow-auto">
                                            {buyerMatches.map((o) => (
                                                <button
                                                    key={String(o.id)}
                                                    type="button"
                                                    className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                                                    onClick={() => selectOrderFromMatches(o)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium">{o.buyer_name}</span>
                                                        <span className="text-xs text-gray-500">{String(o.id).slice(0, 8)}…</span>
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        Total {Number(o.total_amount).toFixed(2)} · Pagado {Number(o.paid_amount).toFixed(2)} · Saldo {getOrderBalance(o).toFixed(2)}
                                                    </div>
                                                </button>
                                            ))}
                                            {fetchingMatches && (
                                                <div className="px-3 py-2 text-xs text-gray-500">Buscando…</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className="mt-2 flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={pickLatestForBuyer}
                                        className="text-xs rounded-full border px-3 py-1 hover:bg-gray-50"
                                    >
                                        Usar última abierta
                                    </button>
                                </div>
                            </div>

                            {!!loadedOrder && (
                                <div className="rounded-xl border p-3 text-xs text-gray-700">
                                    <div><span className="text-gray-500">Comprador:</span> {loadedOrder.buyer_name} {loadedOrder.buyer_doc ? `(${loadedOrder.buyer_doc})` : ""}</div>
                                    <div><span className="text-gray-500">Total/Pagado:</span> {formatBs(loadedOrder.total_amount)} / {formatBs(loadedOrder.paid_amount)}</div>
                                    <div><span className="text-gray-500">Saldo sugerido:</span> {formatBs(Math.max(0, Number(loadedOrder.total_amount) - Number(loadedOrder.paid_amount)))}</div>
                                </div>
                            )}

                            {/* Método + Monto */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Método de pago</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={methodSel}
                                        onChange={(e) => setMethodSel(e.target.value as Id)}
                                        required
                                    >
                                        <option value="">Selecciona método…</option>
                                        {methods.map((m) => (
                                            <option key={String(m.id)} value={String(m.id)}>
                                                {m.code} · {m.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Monto</label>
                                    <input
                                        type="number"
                                        min={0}
                                        step="0.01"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        required
                                    />
                                </div>
                            </div>

                            {/* Moneda + Oficina */}
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-sm text-gray-700">Moneda</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={currency}
                                        onChange={(e) => setCurrency(e.target.value)}
                                        placeholder="BOB"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Oficina</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={officeId}
                                        onChange={(e) => setOfficeId(e.target.value as Id)}
                                    >
                                        <option value="">(Opcional)</option>
                                        {offices.map((o) => (
                                            <option key={String(o.id)} value={String(o.id)}>
                                                {o.code} · {o.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Email + TxID + confirmar */}
                            <div className="grid gap-3 sm:grid-cols-2 sm:items-center">
                                <div>
                                    <label className="text-sm text-gray-700">Email para recibo (opcional)</label>
                                    <input
                                        type="email"
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        placeholder="cliente@correo.com"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-700">Transaction ID</label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={txid}
                                        onChange={(e) => setTxid(e.target.value)}
                                        placeholder="Referencia / voucher"
                                    />
                                </div>
                                <label className="mt-1 inline-flex items-center gap-2 text-sm sm:col-span-2">
                                    <input
                                        type="checkbox"
                                        className="rounded border-gray-300"
                                        checked={confirmNow}
                                        onChange={(e) => setConfirmNow(e.target.checked)}
                                    />
                                    Confirmar al crear
                                </label>
                            </div>

                            {/* Submit */}
                            <div className="flex justify-end gap-2 border-t pt-3">
                                <button
                                    type="button"
                                    className="rounded-xl border px-3 py-2 text-sm"
                                    onClick={() => {
                                        setShowCreate(false);
                                        resetForm();
                                    }}
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                                >
                                    {saving && <Spinner />} Guardar
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal detalles (ojito) */}
            {detailsOpen && (
                <div className="fixed inset-0 z-50 bg-black/40 sm:grid sm:place-items-center p-0 sm:p-4" role="dialog" aria-modal="true">
                    <div className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-3xl bg-white shadow-lg flex flex-col rounded-none sm:rounded-2xl">
                        {/* Header sticky */}
                        <div className="flex items-center justify-between border-b px-4 sm:px-5 py-3 sticky top-0 bg-white z-10">
                            <h3 className="text-base sm:text-lg font-semibold">Detalle de pago</h3>
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
                                            <div className="text-xs text-gray-500">Pago</div>
                                            <div className="text-sm font-medium break-all">{String(details.id)}</div>
                                            <div className="mt-1 text-xs text-gray-500">Creado: {formatDateTime(details.created_at)}</div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Estado</div>
                                            <div className="text-sm font-medium">
                                                {statusLabel(details.status)}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">Pagado: {formatDateTime(details.paid_at)}</div>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Orden</div>
                                            <div className="text-sm font-medium">{String(details.order)}</div>
                                            <div className="text-xs text-gray-500 mt-1">Método: {details.method?.code ?? "—"}</div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Montos</div>
                                            <div className="text-sm font-semibold">{formatBs(details.amount)}</div>
                                            <div className="text-xs text-gray-500 mt-1">Moneda: {details.currency}</div>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Oficina</div>
                                            <div className="text-sm">{details.office ? `${details.office.code} · ${details.office.name}` : "—"}</div>
                                        </div>
                                        <div className="rounded-xl border p-3">
                                            <div className="text-xs text-gray-500">Caja / TxID</div>
                                            <div className="text-sm">{details.cashier?.username ?? "—"}</div>
                                            <div className="text-xs text-gray-500 mt-1">TxID: {details.transaction_id || "—"}</div>
                                            {/* 👇 Mostrar email si viene del backend */}
                                            {("email" in details) && (details as any).email ? (
                                                <div className="text-xs text-gray-500 mt-1">Email: {(details as any).email}</div>
                                            ) : null}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="flex-none border-t px-4 sm:px-5 py-3 sticky bottom-0 bg-white">
                            <div className="flex justify-end">
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
function badgeClass(status: PaymentStatus) {
    switch (status) {
        case "CONFIRMED":
            return "text-[10px] px-2 py-0.5 rounded-full border border-green-200 bg-green-50 text-green-700";
        case "PENDING":
            return "text-[10px] px-2 py-0.5 rounded-full border border-amber-200 bg-amber-50 text-amber-700";
        case "FAILED":
            return "text-[10px] px-2 py-0.5 rounded-full border border-red-200 bg-red-50 text-red-700";
        case "PARTIALLY_REFUNDED":
            return "text-[10px] px-2 py-0.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700";
        case "REFUNDED":
            return "text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700";
        default:
            return "text-[10px] px-2 py-0.5 rounded-full border border-gray-200 bg-gray-50 text-gray-700";
    }
}
function statusLabel(status: PaymentStatus) {
    switch (status) {
        case "CONFIRMED": return "Confirmado";
        case "PENDING": return "Pendiente";
        case "FAILED": return "Fallido";
        case "PARTIALLY_REFUNDED": return "Parcialmente devuelto";
        case "REFUNDED": return "Devuelto";
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
function IconMoney(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <rect x="3" y="6" width="18" height="12" rx="2" strokeWidth="1.5" />
            <circle cx="12" cy="12" r="2.5" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M3 10c2 0 3-2 3-2m12 0s1 2 3 2M3 14c2 0 3 2 3 2m12 0s1-2 3-2" />
        </svg>
    );
}
function IconCheckCircle(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
            <path strokeWidth="1.5" d="M8 12l3 3 5-6" />
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
function IconEye(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" {...props}>
            <path strokeWidth="1.5" d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z" />
            <circle cx="12" cy="12" r="3" strokeWidth="1.5" />
        </svg>
    );
}
