// src/views/reportes/ReportsView.tsx
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { FileText, CalendarClock, BusFront, Download, Users, UserX } from "lucide-react";

import {
    downloadPaidPassengersPdf,
    downloadPaidPassengersXlsx,
    downloadPaidPassengersDocx,            // 👈 DOCX Pagantes
    downloadMinorsPdf,
    downloadMinorsXlsx,
    downloadMinorsDocx,                     // 👈 DOCX Menores
    downloadPresentNotBoardedPdf,
    downloadPresentNotBoardedXlsx,
    downloadPresentNotBoardedDocx,          // 👈 DOCX PNB
    downloadBoardingManifestPdf,
    downloadBoardingManifestXlsx,
    downloadBoardingManifestDocx,           // 👈 DOCX Manifiesto
} from "../../services/reports";
import { api, type ApiError } from "../../services/api";

// 👉 usamos fetch por fecha
import { listDeparturesByDateLite } from "../../services/departures";

/* ------------------------------ types ------------------------------ */
type Id = string | number;
type BusLite = { id: Id; code: string; model?: string };
type ReportType = "paid" | "minors" | "pnb" | "manifest";

type DepLite = {
    id: Id;
    label: string;
    status: string;
    scheduled_at?: string;
    bus_code?: string;
};

/* ------------------------------ ui bits ------------------------------ */
const Spinner = () => (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
    </svg>
);

/* ----------------------------- helpers ----------------------------- */
function isValidISO(d?: string) {
    if (!d) return false;
    const x = new Date(d);
    return !Number.isNaN(x.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(d);
}

async function fetchBusesLite(): Promise<BusLite[]> {
    const data = await api.get<any>("/catalog/buses/?page_size=500&ordering=code");
    const arr = Array.isArray(data) ? data : data?.results ?? [];
    return arr.map((b: any) => ({ id: b.id, code: b.code, model: b.model }));
}

function errMsg(e: unknown, fallback: string) {
    const ae = e as ApiError;
    return ae?.data?.["detail"] || ae?.message || fallback;
}

/* =============================== VIEW =============================== */
export default function ReportsView() {
    const [loadingPdf, setLoadingPdf] = useState(false);
    const [loadingXlsx, setLoadingXlsx] = useState(false);
    const [loadingDocx, setLoadingDocx] = useState(false); // 👈 NUEVO

    const [buses, setBuses] = useState<BusLite[]>([]);
    const [fetchingBuses, setFetchingBuses] = useState(true);

    // filtros
    const [reportType, setReportType] = useState<ReportType>("paid");
    const [date, setDate] = useState<string>("");
    const [busCode, setBusCode] = useState<string>("");

    // selector de salidas (para manifiesto)
    const [depsAll, setDepsAll] = useState<DepLite[]>([]);
    const [loadingDeps, setLoadingDeps] = useState(false);
    const [depId, setDepId] = useState<string>("");

    // opciones (ya vienen filtradas por fecha)
    const depOptionsForDate = useMemo(() => depsAll, [depsAll]);

    // buses
    useEffect(() => {
        (async () => {
            try {
                setFetchingBuses(true);
                const bs = await fetchBusesLite();
                setBuses(bs);
            } catch (e: any) {
                toast.error(errMsg(e, "No se pudieron cargar buses."));
            } finally {
                setFetchingBuses(false);
            }
        })();
    }, []);

    // refetch de salidas cuando cambia la fecha (todas las del día local)
    useEffect(() => {
        (async () => {
            try {
                setLoadingDeps(true);
                if (isValidISO(date)) {
                    const opts: DepLite[] = await listDeparturesByDateLite(date, 500);
                    setDepsAll(opts);
                    if (opts.length === 0) toast.message("No hay salidas para la fecha seleccionada.");
                } else {
                    setDepsAll([]);
                    setDepId("");
                }
            } catch (e: any) {
                toast.error(errMsg(e, "No se pudieron cargar salidas para la fecha."));
            } finally {
                setLoadingDeps(false);
            }
        })();
    }, [date]);

    // validaciones por tipo
    const canRequest = useMemo(() => {
        if (reportType === "manifest") {
            return isValidISO(date) && !!depId.trim();
        }
        if (!isValidISO(date)) return false;
        if (reportType === "paid") return !!busCode.trim();
        return true; // minors / pnb: bus opcional
    }, [date, busCode, reportType, depId]);

    async function onDownloadPdf() {
        if (!canRequest) {
            toast.info(
                reportType === "paid"
                    ? "Completa fecha y código de bus."
                    : reportType === "manifest"
                        ? "Selecciona la fecha y una salida."
                        : "Completa la fecha (el bus es opcional)."
            );
            return;
        }
        setLoadingPdf(true);
        try {
            if (reportType === "paid") {
                const bus = busCode.trim();
                await downloadPaidPassengersPdf({ date, bus }, { filename: `pasajeros_pagantes_${date}_${bus}.pdf` });
            } else if (reportType === "minors") {
                const bus = busCode.trim() || undefined;
                await downloadMinorsPdf({ date, bus }, { filename: `menores_${date}_${bus ?? "ALL"}.pdf` });
            } else if (reportType === "pnb") {
                const bus = busCode.trim() || undefined;
                await downloadPresentNotBoardedPdf({ date, bus }, { filename: `presentes_sin_embarcar_${date}_${bus ?? "ALL"}.pdf` });
            } else {
                const dep = depId.trim();
                await downloadBoardingManifestPdf({ departureId: dep }, { filename: `manifiesto_salida_${dep}.pdf` });
            }
            toast.success("Descarga de PDF iniciada.");
        } catch (e: any) {
            toast.error(errMsg(e, "No se pudo descargar el PDF."));
        } finally {
            setLoadingPdf(false);
        }
    }

    async function onDownloadXlsx() {
        if (!canRequest) {
            toast.info(
                reportType === "paid"
                    ? "Completa fecha y código de bus."
                    : reportType === "manifest"
                        ? "Selecciona la fecha y una salida."
                        : "Completa la fecha (el bus es opcional)."
            );
            return;
        }
        setLoadingXlsx(true);
        try {
            if (reportType === "paid") {
                const bus = busCode.trim();
                await downloadPaidPassengersXlsx({ date, bus }, { filename: `pasajeros_pagantes_${date}_${bus}.xlsx` });
            } else if (reportType === "minors") {
                const bus = busCode.trim() || undefined;
                await downloadMinorsXlsx({ date, bus }, { filename: `menores_${date}_${bus ?? "ALL"}.xlsx` });
            } else if (reportType === "pnb") {
                const bus = busCode.trim() || undefined;
                await downloadPresentNotBoardedXlsx({ date, bus }, { filename: `presentes_sin_embarcar_${date}_${bus ?? "ALL"}.xlsx` });
            } else {
                const dep = depId.trim();
                await downloadBoardingManifestXlsx({ departureId: dep }, { filename: `manifiesto_salida_${dep}.xlsx` });
            }
            toast.success("Descarga de Excel iniciada.");
        } catch (e: any) {
            toast.error(errMsg(e, "No se pudo descargar el Excel."));
        } finally {
            setLoadingXlsx(false);
        }
    }

    // 👉 Word (.docx) para los tipos soportados
    async function onDownloadDocx() {
        if (!canRequest) {
            toast.info(
                reportType === "manifest"
                    ? "Selecciona la fecha y una salida."
                    : reportType === "paid"
                        ? "Completa fecha y código de bus."
                        : "Completa la fecha (el bus es opcional)."
            );
            return;
        }
        setLoadingDocx(true);
        try {
            if (reportType === "paid") {
                const bus = busCode.trim();
                await downloadPaidPassengersDocx({ date, bus }, { filename: `pasajeros_pagantes_${date}_${bus}.docx` });
            } else if (reportType === "minors") {
                const bus = busCode.trim() || undefined;
                await downloadMinorsDocx({ date, bus }, { filename: `menores_${date}_${bus ?? "ALL"}.docx` });
            } else if (reportType === "pnb") {
                const bus = busCode.trim() || undefined;
                await downloadPresentNotBoardedDocx({ date, bus }, { filename: `presentes_sin_embarcar_${date}_${bus ?? "ALL"}.docx` });
            } else {
                const dep = depId.trim();
                await downloadBoardingManifestDocx({ departureId: dep }, { filename: `manifiesto_salida_${dep}.docx` });
            }
            toast.success("Descarga de Word iniciada.");
        } catch (e: any) {
            toast.error(errMsg(e, "No se pudo descargar el Word."));
        } finally {
            setLoadingDocx(false);
        }
    }

    const headerTitle =
        reportType === "paid"
            ? "Reportes de ventas"
            : reportType === "minors"
                ? "Reportes de menores"
                : reportType === "pnb"
                    ? "Presentes que NO abordaron"
                    : "Manifiesto (visado)";

    const headerSubtitle =
        reportType === "paid"
            ? "Pasajeros pagantes por fecha y bus"
            : reportType === "minors"
                ? "Menores viajantes por fecha (bus opcional)"
                : reportType === "pnb"
                    ? "Asistieron pero no abordaron (fecha; bus opcional)"
                    : "Listado por salida para visado antes de partir";

    return (
        <div className="mt-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div className="flex items-center gap-2">
                    <div className="rounded-2xl border bg-white p-2 shadow-sm">
                        {reportType === "paid" ? (
                            <FileText className="h-5 w-5" />
                        ) : reportType === "minors" ? (
                            <Users className="h-5 w-5" />
                        ) : reportType === "pnb" ? (
                            <UserX className="h-5 w-5" />
                        ) : (
                            <FileText className="h-5 w-5" />
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold">{headerTitle}</h2>
                        <p className="text-sm text-gray-600">{headerSubtitle}</p>
                    </div>
                </div>
            </div>

            {/* Selector de tipo de reporte */}
            <div className="mt-4 rounded-2xl border p-3">
                <label className="text-xs text-gray-600">Tipo de reporte</label>
                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:max-w-3xl">
                    <button
                        type="button"
                        onClick={() => setReportType("paid")}
                        className={`rounded-xl border px-3 py-2 text-sm ${reportType === "paid" ? "bg-black text-white" : "hover:bg-gray-50"}`}
                    >
                        Pagantes
                    </button>
                    <button
                        type="button"
                        onClick={() => setReportType("minors")}
                        className={`rounded-xl border px-3 py-2 text-sm ${reportType === "minors" ? "bg-black text-white" : "hover:bg-gray-50"}`}
                    >
                        Menores
                    </button>
                    <button
                        type="button"
                        onClick={() => setReportType("pnb")}
                        className={`rounded-xl border px-3 py-2 text-sm ${reportType === "pnb" ? "bg-black text-white" : "hover:bg-gray-50"}`}
                    >
                        Presentes sin embarcar
                    </button>
                    <button
                        type="button"
                        onClick={() => setReportType("manifest")}
                        className={`rounded-xl border px-3 py-2 text-sm ${reportType === "manifest" ? "bg-black text-white" : "hover:bg-gray-50"}`}
                    >
                        Manifiesto (por salida)
                    </button>
                </div>
            </div>

            {/* Filtros */}
            <div className="mt-4 rounded-2xl border p-4">
                {reportType === "manifest" ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Fecha (para filtrar salidas) */}
                        <div className="rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">Fecha</span>
                            </div>
                            <div className="mt-3">
                                <label className="text-xs text-gray-600">Fecha (YYYY-MM-DD)</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => {
                                        setDate(e.target.value);
                                        setDepId(""); // resetear selección si cambia la fecha
                                    }}
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        {/* Select de salidas para esa fecha */}
                        <div className="rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <FileText className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">Salida</span>
                            </div>
                            <div className="mt-3">
                                <label className="text-xs text-gray-600">Elegir por fecha y hora</label>
                                <select
                                    value={depId}
                                    onChange={(e) => setDepId(e.target.value)}
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                    disabled={!isValidISO(date) || loadingDeps}
                                >
                                    <option value="">
                                        {!isValidISO(date) ? "(Selecciona fecha primero)" : loadingDeps ? "Cargando…" : "(Seleccionar salida)"}
                                    </option>
                                    {depOptionsForDate.map((o) => (
                                        <option key={String(o.id)} value={String(o.id)}>
                                            {o.label}
                                        </option>
                                    ))}
                                </select>
                                {depId && (
                                    <p className="mt-1 text-[11px] text-gray-500">
                                        Seleccionado: {depOptionsForDate.find((o) => String(o.id) === String(depId))?.label}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2">
                        {/* Fecha */}
                        <div className="rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <CalendarClock className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">Fecha</span>
                            </div>
                            <div className="mt-3">
                                <label className="text-xs text-gray-600">Fecha (YYYY-MM-DD)</label>
                                <input
                                    type="date"
                                    value={date}
                                    onChange={(e) => setDate(e.target.value)}
                                    className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                />
                            </div>
                        </div>

                        {/* Bus */}
                        <div className="rounded-xl border p-3">
                            <div className="flex items-center gap-2">
                                <BusFront className="h-4 w-4 text-gray-500" />
                                <span className="text-sm font-medium">
                  Bus (por código){reportType === "paid" ? "" : " — opcional"}
                </span>
                            </div>

                            <div className="mt-2 grid gap-3 sm:grid-cols-2">
                                <div>
                                    <label className="text-xs text-gray-600">Elegir de la lista</label>
                                    <select
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        value={busCode}
                                        onChange={(e) => setBusCode(e.target.value)}
                                    >
                                        <option value="">{reportType === "paid" ? "(Seleccionar)" : "(Todos los buses)"}</option>
                                        {fetchingBuses ? (
                                            <option value="" disabled>
                                                Cargando…
                                            </option>
                                        ) : (
                                            buses.map((b) => (
                                                <option key={String(b.id)} value={b.code}>
                                                    {b.code}
                                                    {b.model ? ` · ${b.model}` : ""}
                                                </option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="text-xs text-gray-600">
                                        {reportType === "paid" ? "O escribir código" : "Escribir código (opcional)"}
                                    </label>
                                    <input
                                        className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                                        placeholder={reportType === "paid" ? "Ej: BUS-32" : "Ej: BUS-32 (opcional)"}
                                        value={busCode}
                                        onChange={(e) => setBusCode(e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Acciones */}
                <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div className="grid gap-3 sm:grid-cols-3">
                        {/* Descargar PDF */}
                        <button
                            type="button"
                            disabled={!canRequest || loadingPdf}
                            onClick={onDownloadPdf}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                        >
                            {loadingPdf ? <Spinner /> : <Download className="h-4 w-4" />}
                            Descargar PDF
                        </button>

                        {/* Descargar Excel */}
                        <button
                            type="button"
                            disabled={!canRequest || loadingXlsx}
                            onClick={onDownloadXlsx}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                        >
                            {loadingXlsx ? <Spinner /> : <Download className="h-4 w-4" />}
                            Descargar Excel
                        </button>

                        {/* Descargar Word (DOCX) */}
                        <button
                            type="button"
                            disabled={!canRequest || loadingDocx}
                            onClick={onDownloadDocx}
                            className="inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-black hover:text-white disabled:opacity-50"
                            title={
                                reportType === "paid"
                                    ? "Descargar Word de pagantes"
                                    : reportType === "minors"
                                        ? "Descargar Word de menores"
                                        : reportType === "pnb"
                                            ? "Descargar Word de presentes sin embarcar"
                                            : "Descargar Word del manifiesto"
                            }
                        >
                            {loadingDocx ? <Spinner /> : <Download className="h-4 w-4" />}
                            Descargar Word
                        </button>
                    </div>
                </div>
            </div>

            {/* Ayuda breve */}
            <div className="mt-3 text-xs text-gray-600">
                <ul className="list-disc pl-5 space-y-1">
                    <li>
                        {reportType === "paid" ? (
                            <>
                                El backend requiere <b>fecha</b> y <b>código de bus</b>.
                            </>
                        ) : reportType === "minors" ? (
                            <>
                                El backend requiere <b>fecha</b>. El <b>bus</b> es <i>opcional</i>.
                            </>
                        ) : reportType === "pnb" ? (
                            <>
                                El backend requiere <b>fecha</b>. El <b>bus</b> es <i>opcional</i> (presentes sin embarcar).
                            </>
                        ) : (
                            <>El manifiesto se genera por <b>fecha</b> + <b>salida</b> seleccionada.</>
                        )}
                    </li>
                    <li>
                        <b>Descargar PDF</b>, <b>Excel</b> y <b>Word</b> guardan archivos localmente (Blob).
                    </li>
                </ul>
            </div>
        </div>
    );
}
