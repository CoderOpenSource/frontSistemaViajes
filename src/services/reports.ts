// services/paidPassengersReport.ts
import { api } from "./api";

/* ========== Tipos que usa el front ========== */
export type PayingPassengersRequest = {
    /** YYYY-MM-DD */
    date: string;
    /** código del bus (el backend actual espera ?bus=...) */
    bus: string;
};

export type MinorsReportRequest = {
    /** YYYY-MM-DD */
    date: string;
    /** opcional: código del bus (?bus=...) */
    bus?: string;
};

export type PresentNotBoardedRequest = {
    /** YYYY-MM-DD */
    date: string;
    /** opcional: código del bus (?bus=...) */
    bus?: string;
};

/* --- Reporte #4: Manifiesto (por salida) --- */
export type BoardingManifestRequest = {
    /** ID de la salida (backend espera ?departure_id=...) */
    departureId: string | number;
};

/* ========== Endpoints (sin /api, igual que receipts.ts) ========== */
const BASE_PDF  = "/reports/paid-passengers-pdf/";
const BASE_XLSX = "/reports/paid-passengers-xlsx/";
const BASE_DOCX = "/reports/paid-passengers-docx/"; // DOCX Pagantes

const BASE_MINORS_PDF  = "/reports/minors-pdf/";
const BASE_MINORS_XLSX = "/reports/minors-xlsx/";
const BASE_MINORS_DOCX = "/reports/minors-docx/";   // 👈 NUEVO

/* --- Reporte #3: Presentes que NO abordaron --- */
const BASE_PNB_PDF  = "/reports/present-not-boarded-pdf/";
const BASE_PNB_XLSX = "/reports/present-not-boarded-xlsx/";
const BASE_PNB_DOCX = "/reports/present-not-boarded-docx/"; // 👈 NUEVO

/* --- Reporte #4: Manifiesto (por salida) --- */
const BASE_MANIFEST_PDF  = "/reports/boarding-manifest-pdf/";
const BASE_MANIFEST_XLSX = "/reports/boarding-manifest-xlsx/";
const BASE_MANIFEST_DOCX = "/reports/boarding-manifest-docx/"; // 👈 NUEVO

/* ---------------- helpers internos ---------------- */
function qs(params: Record<string, any>) {
    const u = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v === undefined || v === null || v === "") return;
        u.set(k, String(v));
    });
    // anti-cache
    u.set("_", String(Date.now()));
    return u.toString();
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ---------------- descarga genérica ---------------- */
type FileKind = "pdf" | "xlsx" | "docx";

async function fetchBlob(pathWithQs: string, type: FileKind): Promise<Blob> {
    const res = await api.get<Blob>(pathWithQs, {
        responseType: "blob",
        headers: { Accept: "*/*" }, // evita 406
    });

    if (res instanceof Blob) return res;

    if (res instanceof ArrayBuffer) {
        const mime =
            type === "pdf"
                ? "application/pdf"
                : type === "xlsx"
                    ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"; // docx
        return new Blob([res], { type: mime });
    }

    throw new Error("Respuesta inesperada al descargar archivo");
}

/* ======================================================
   API PÚBLICA
   ====================================================== */

/** ===== Reporte #1: Pagantes — PDF ===== */
export async function downloadPaidPassengersPdf(
    p: PayingPassengersRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_PDF}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "pdf");
    const filename = opts?.filename ?? `pasajeros_pagantes_${p.date}_${p.bus}.pdf`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #1: Pagantes — XLSX ===== */
export async function downloadPaidPassengersXlsx(
    p: PayingPassengersRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_XLSX}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "xlsx");
    const filename = opts?.filename ?? `pasajeros_pagantes_${p.date}_${p.bus}.xlsx`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #1: Pagantes — DOCX ===== */
export async function downloadPaidPassengersDocx(
    p: PayingPassengersRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_DOCX}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "docx");
    const filename = opts?.filename ?? `pasajeros_pagantes_${p.date}_${p.bus}.docx`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #2: Menores — PDF ===== */
export async function downloadMinorsPdf(
    p: MinorsReportRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_MINORS_PDF}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "pdf");
    const filename = opts?.filename ?? `menores_${p.date}_${p.bus ?? "ALL"}.pdf`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #2: Menores — XLSX ===== */
export async function downloadMinorsXlsx(
    p: MinorsReportRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_MINORS_XLSX}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "xlsx");
    const filename = opts?.filename ?? `menores_${p.date}_${p.bus ?? "ALL"}.xlsx`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #2: Menores — DOCX ===== */
export async function downloadMinorsDocx(
    p: MinorsReportRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_MINORS_DOCX}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "docx");
    const filename = opts?.filename ?? `menores_${p.date}_${p.bus ?? "ALL"}.docx`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #3: Presentes que NO abordaron — PDF ===== */
export async function downloadPresentNotBoardedPdf(
    p: PresentNotBoardedRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_PNB_PDF}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "pdf");
    const filename =
        opts?.filename ?? `presentes_sin_embarcar_${p.date}_${p.bus ?? "ALL"}.pdf`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #3: Presentes que NO abordaron — XLSX ===== */
export async function downloadPresentNotBoardedXlsx(
    p: PresentNotBoardedRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_PNB_XLSX}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "xlsx");
    const filename =
        opts?.filename ?? `presentes_sin_embarcar_${p.date}_${p.bus ?? "ALL"}.xlsx`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #3: Presentes que NO abordaron — DOCX ===== */
export async function downloadPresentNotBoardedDocx(
    p: PresentNotBoardedRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_PNB_DOCX}?${qs({ date: p.date, bus: p.bus })}`;
    const blob = await fetchBlob(url, "docx");
    const filename =
        opts?.filename ?? `presentes_sin_embarcar_${p.date}_${p.bus ?? "ALL"}.docx`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #4: Manifiesto — PDF ===== */
export async function downloadBoardingManifestPdf(
    p: BoardingManifestRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_MANIFEST_PDF}?${qs({ departure_id: p.departureId })}`;
    const blob = await fetchBlob(url, "pdf");
    const filename =
        opts?.filename ?? `manifiesto_salida_${String(p.departureId)}.pdf`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #4: Manifiesto — XLSX ===== */
export async function downloadBoardingManifestXlsx(
    p: BoardingManifestRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_MANIFEST_XLSX}?${qs({ departure_id: p.departureId })}`;
    const blob = await fetchBlob(url, "xlsx");
    const filename =
        opts?.filename ?? `manifiesto_salida_${String(p.departureId)}.xlsx`;
    triggerDownload(blob, filename);
}

/** ===== Reporte #4: Manifiesto — DOCX ===== */
export async function downloadBoardingManifestDocx(
    p: BoardingManifestRequest,
    opts?: { filename?: string }
) {
    const url = `${BASE_MANIFEST_DOCX}?${qs({ departure_id: p.departureId })}`;
    const blob = await fetchBlob(url, "docx");
    const filename =
        opts?.filename ?? `manifiesto_salida_${String(p.departureId)}.docx`;
    triggerDownload(blob, filename);
}
