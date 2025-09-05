// src/services/boarding.ts
import { api } from "./api";

/* ============================================================================
   Tipos (alineados con TicketWithAttendanceSerializer y TicketAttendanceSerializer)
   ============================================================================ */

export type Id = string | number;

export type OfficeLite = { id: Id; code: string; name: string } | null;
export type UserLite = { id: Id; username: string; full_name: string } | null;

export type AttendanceOutcome = "PENDING" | "PRESENT" | "BOARDED" | "NO_SHOW";

export type Attendance = {
    outcome: AttendanceOutcome;
    presented_at: string | null; // ISO
    boarded_at: string | null; // ISO
    office: OfficeLite;
    recorded_by: UserLite;
    notes: string;
};

export type PassengerLite = {
    id: Id;
    full_name: string;
    document: string | null;
};

export type SeatLite = {
    id: Id;
    number: number;
    deck?: number | null;
} | null;

export type OfficeMin = { id: Id; code: string; name: string } | null;

export type TicketWithAttendance = {
    id: Id;
    status: "RESERVED" | "PAID" | "CANCELLED" | "NO_SHOW";
    price: string; // viene como string decimal en la API
    passenger: PassengerLite;
    seat: SeatLite;
    origin: OfficeMin;
    destination: OfficeMin;
    attendance: Attendance | null;
};

export type TicketsByDepartureResponse = {
    count: number;
    items: TicketWithAttendance[];
};

/* ============================================================================
   Endpoints
   ============================================================================ */

const BASE_DEPARTURES = "/ventas/departures/";
const BASE_BOARDING = "/ventas/boarding/";

/** Lista tickets (no cancelados) de una salida, con asistencia embebida */
export async function listTicketsForDeparture(
    departureId: Id
): Promise<TicketWithAttendance[]> {
    const data = await api.get<TicketsByDepartureResponse>(
        `${BASE_DEPARTURES}${departureId}/tickets/`
    );
    return data.items ?? [];
}

/** Marca PRESENT de un ticket (puedes pasar office_id) */
export async function markPresent(ticketId: Id, opts?: { office_id?: Id }) {
    return api.post<{ ok: true; attendance: Attendance }>(
        `${BASE_BOARDING}${ticketId}/present/`,
        opts?.office_id ? { office_id: opts.office_id } : {}
    );
}

/** Marca BOARDED de un ticket */
export async function markBoarded(ticketId: Id) {
    return api.post<{ ok: true; attendance: Attendance }>(
        `${BASE_BOARDING}${ticketId}/board/`,
        {}
    );
}

/** Cierra el embarque de una salida (marca NO_SHOW lo pendiente) */
export async function closeBoarding(departureId: Id) {
    return api.post<{ ok: true; no_show_marked: number }>(`${BASE_BOARDING}close/`, {
        departure_id: departureId,
    });
}

/* ============================================================================
   Helpers en lote (útiles para UI)
   ============================================================================ */

/** Marca PRESENT varios tickets (opcionalmente con office_id) */
export async function markPresentBulk(
    ticketIds: Id[],
    opts?: { office_id?: Id }
) {
    const results = await Promise.allSettled(
        ticketIds.map((tid) => markPresent(tid, opts))
    );
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    return { ok, fail };
}

/** Marca BOARDED varios tickets */
export async function markBoardedBulk(ticketIds: Id[]) {
    const results = await Promise.allSettled(ticketIds.map((tid) => markBoarded(tid)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const fail = results.length - ok;
    return { ok, fail };
}

/* ============================================================================
   Azúcar para UI
   ============================================================================ */

/** Texto amigable del estado de asistencia */
export function attendanceLabel(o?: AttendanceOutcome | null) {
    switch (o) {
        case "PRESENT":
            return "Presente";
        case "BOARDED":
            return "Embarcó";
        case "NO_SHOW":
            return "No se presentó";
        case "PENDING":
        default:
            return "Pendiente";
    }
}

/** Hora corta HH:mm (o “—”) */
export function shortTime(iso?: string | null) {
    if (!iso) return "—";
    try {
        const d = new Date(iso);
        const hh = String(d.getHours()).padStart(2, "0");
        const mm = String(d.getMinutes()).padStart(2, "0");
        return `${hh}:${mm}`;
    } catch {
        return "—";
    }
}
