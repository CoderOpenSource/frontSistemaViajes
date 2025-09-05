// services/payments.ts
import { api } from "./api";

export type PaymentStatus =
    | "PENDING"
    | "CONFIRMED"
    | "FAILED"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";

export type PaymentRead = {
    id: string;
    order: string;
    amount: string;
    currency: string;
    status: PaymentStatus;
    method: { id: number | string; code: string; name: string };
    office?: { id: number | string; code: string; name: string } | null;
    cashier?: { id: number | string; username: string; full_name?: string } | null;
    transaction_id?: string;
    email?: string | null;   // 👈 NUEVO
    paid_at?: string | null;
    created_at: string;
};

const BASE = "/ventas/payments/";

export async function createPayment(args: {
    order: string;
    method: number | string;
    amount: string | number;
    currency?: string;
    office?: number | string | null;
    transaction_id?: string;
    confirm?: boolean;
    email?: string;   // 👈 NUEVO
}) {
    return api.post<PaymentRead>(BASE, {
        order: args.order,
        method: args.method,
        amount: String(args.amount),
        currency: args.currency ?? "BOB",
        office: args.office ?? null,
        transaction_id: args.transaction_id ?? "",
        confirm: !!args.confirm,
        email: args.email ?? "",   // 👈 se envía al backend
    });
}

export async function confirmPayment(payment_id: string, email?: string) {
    return api.post<PaymentRead>(`${BASE}confirm/`, {
        payment_id,
        email: email ?? null,   // 👈 opcional, lo mandamos si lo tenemos
    });
}

export async function getPayment(id: string) {
    return api.get<PaymentRead>(`${BASE}${id}/`);
}
