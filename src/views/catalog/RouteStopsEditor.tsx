// RouteStopsEditor.tsx
import React, { useMemo } from "react";

export type StopRow = {
    id?: number | string;         // opcional (cuando viene del backend)
    office: number | string;      // id de Office
    office_name?: string;         // nombre/código opcional (si viene del backend)
    order: number;                // 0..N
    scheduled_offset_min: number | null;
};

type Props = {
    stops: StopRow[];
    setStops: (updater: (prev: StopRow[]) => StopRow[]) => void;
    readOnlyFirstAndLast?: boolean; // si el origen/destino no deben moverse
    /**
     * Resolver opcional para mostrar el nombre de la oficina a partir del id.
     * Ej: (id) => officeOptions.find(o=>String(o.id)===String(id))?.label ?? String(id)
     */
    getOfficeLabel?: (id: number | string) => string;
};

export default function RouteStopsEditor({
                                             stops,
                                             setStops,
                                             readOnlyFirstAndLast = true,
                                             getOfficeLabel,
                                         }: Props) {
    // Utilidad: clamp a >= 0, y normalizar null/number
    const sanitizeOffset = (raw: string): number | null => {
        if (raw === "") return null;
        const n = Number(raw);
        if (!Number.isFinite(n)) return 0;
        return Math.max(0, Math.floor(n));
    };

    const labelFor = (s: StopRow) =>
        s.office_name ?? (getOfficeLabel ? getOfficeLabel(s.office) : String(s.office));

    const setOffset = (idx: number, v: number | null) => {
        setStops((prev) => {
            const next = prev.map((s, i) => (i === idx ? { ...s, scheduled_offset_min: v } : s));
            // Mantener secuencia no-decreciente de offsets
            if (idx > 0) {
                const prevVal = next[idx - 1].scheduled_offset_min ?? 0;
                if (next[idx].scheduled_offset_min == null || next[idx].scheduled_offset_min < prevVal) {
                    next[idx] = { ...next[idx], scheduled_offset_min: prevVal };
                }
            }
            // Origen siempre 0
            if (next.length > 0) {
                next[0] = { ...next[0], scheduled_offset_min: 0 };
            }
            return next;
        });
    };

    const move = (idx: number, dir: -1 | 1) => {
        setStops((prev) => {
            const j = idx + dir;
            if (j < 0 || j >= prev.length) return prev;
            const copy = [...prev];
            const A = { ...copy[idx] };
            const B = { ...copy[j] };
            copy[idx] = B;
            copy[j] = A;
            // recalcular order
            const remapped = copy.map((s, i) => ({ ...s, order: i }));
            // asegurar origen 0 y no-decreciente
            remapped[0] = { ...remapped[0], scheduled_offset_min: 0 };
            for (let i = 1; i < remapped.length; i++) {
                const prevVal = remapped[i - 1].scheduled_offset_min ?? 0;
                const cur = remapped[i].scheduled_offset_min ?? prevVal;
                remapped[i].scheduled_offset_min = Math.max(prevVal, cur);
            }
            return remapped;
        });
    };

    const removeAt = (idx: number) => {
        setStops((prev) => {
            const filtered = prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i }));
            if (filtered.length > 0) {
                filtered[0] = { ...filtered[0], scheduled_offset_min: 0 };
                for (let i = 1; i < filtered.length; i++) {
                    const prevVal = filtered[i - 1].scheduled_offset_min ?? 0;
                    const cur = filtered[i].scheduled_offset_min ?? prevVal;
                    filtered[i].scheduled_offset_min = Math.max(prevVal, cur);
                }
            }
            return filtered;
        });
    };

    const rows = useMemo(() => stops.map((s) => ({ ...s })), [stops]);

    return (
        <div className="space-y-2">
            {rows.map((s, i) => {
                const key = s.id ?? `${s.office}-${s.order}`;
                const locked = readOnlyFirstAndLast && (i === 0 || i === rows.length - 1);
                const name = labelFor(s);

                return (
                    <div
                        key={key}
                        className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 rounded-xl border px-2 py-2"
                    >
                        {/* Índice */}
                        <div className="w-8 text-center text-xs text-gray-500">{i}</div>

                        {/* Nombre de oficina */}
                        <div className="min-w-0 truncate text-sm" title={name}>
                            {name}
                        </div>

                        {/* Offset (min) */}
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-gray-500" htmlFor={`off-${key}`}>
                                Offset (min)
                            </label>
                            <input
                                id={`off-${key}`}
                                type="number"
                                className="w-20 rounded-lg border px-2 py-1 text-sm"
                                value={s.scheduled_offset_min ?? 0}
                                min={0}
                                onChange={(e) => {
                                    const v = sanitizeOffset(e.target.value);
                                    setOffset(i, v);
                                }}
                                onBlur={(e) => {
                                    // normalizar al salir del control
                                    const v = sanitizeOffset(e.target.value);
                                    setOffset(i, v);
                                }}
                            />
                        </div>

                        {/* Ordenar */}
                        <div className="flex items-center gap-1">
                            <button
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() => move(i, -1)}
                                disabled={locked || i === 0}
                                title={locked ? "Fijado" : "Subir"}
                            >
                                ↑
                            </button>
                            <button
                                className="rounded border px-2 py-1 text-xs"
                                onClick={() => move(i, +1)}
                                disabled={locked || i === rows.length - 1}
                                title={locked ? "Fijado" : "Bajar"}
                            >
                                ↓
                            </button>
                        </div>

                        {/* Eliminar */}
                        <div>
                            <button
                                className="rounded border px-2 py-1 text-xs text-red-600 disabled:opacity-50"
                                onClick={() => removeAt(i)}
                                disabled={locked}
                                title={locked ? "No se puede eliminar origen/destino" : "Eliminar"}
                            >
                                Eliminar
                            </button>
                        </div>
                    </div>
                );
            })}
            {rows.length === 0 && (
                <div className="rounded-lg border px-3 py-2 text-xs text-gray-600">Sin paradas aún…</div>
            )}
        </div>
    );
}
