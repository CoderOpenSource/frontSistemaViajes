// src/components/BusSeatPicker.tsx
import React, { useEffect, useMemo, useState } from "react";
import SeatPicker from "react-seat-picker";
import type { SeatSummary } from "../../services/buses";

type Id = string | number;

type Props = {
    seats: SeatSummary[];
    occupied: Array<Id>;
    selected: Id | null;
    onSelect: (id: Id | null) => void;
    /** ej: 2 => [1,2] | [3,4]. Si no se pasa, se auto-detecta. */
    aisleAfterCol?: number;
};

export default function BusSeatPicker({
                                          seats,
                                          occupied,
                                          selected,
                                          onSelect,
                                          aisleAfterCol,
                                      }: Props) {
    const [deck, setDeck] = useState<1 | 2>(1);

    // --- LOG 0: props “crudas” ---
    useEffect(() => {
        console.log("[SeatPicker] props in", {
            seatsLength: seats?.length,
            sampleSeat: seats?.[0],
            occupied: occupied?.map(String),
            selected: selected != null ? String(selected) : null,
            aisleAfterCol,
        });
    }, [seats, occupied, selected, aisleAfterCol]);

    const decks = useMemo(() => {
        const group = (d: 1 | 2) => seats.filter((s) => s.deck === d);
        const out = { 1: group(1), 2: group(2) } as const;
        console.log("[SeatPicker] decks grouped", { d1: out[1].length, d2: out[2].length });
        return out;
    }, [seats]);

    const effectiveAisle = useMemo(() => {
        const v = aisleAfterCol ?? autoDetectAisle(decks[deck]);
        console.log("[SeatPicker] effectiveAisle", v, "(deck", deck, ")");
        return v;
    }, [aisleAfterCol, decks, deck]);

    const rows = useMemo(() => {
        const r = buildRowsForPicker(decks[deck], {
            aisleAfterCol: effectiveAisle,
            occupiedIds: new Set(occupied.map(String)),
            selectedId: selected != null ? String(selected) : null,
        });
        // --- LOG 1: estructura final que consume react-seat-picker ---
        console.log("[SeatPicker] rows built", {
            deck,
            rowsCount: r.length,
            row0Len: r[0]?.length,
            row0: r[0],
        });
        return r;
    }, [decks, deck, effectiveAisle, occupied, selected]);

    // react-seat-picker necesita que llames addCb/removeCb
    const handleAdd = (
        { row, number, id }: { row: string | number; number: string | number; id?: Id },
        addCb: (row: string | number, number: string | number, id?: Id) => void
    ) => {
        console.log("[SeatPicker] addSeat", { row, number, id });
        addCb(row, number, id);
        onSelect((id ?? null) as Id | null);
    };

    const handleRemove = (
        { row, number }: { row: string | number; number: string | number },
        removeCb: (row: string | number, number: string | number) => void
    ) => {
        console.log("[SeatPicker] removeSeat", { row, number });
        removeCb(row, number);
        onSelect(null);
    };

    const hasDeck2 = decks[2].length > 0;

    return (
        <div className="rounded-2xl border">
            {/* Tabs pisos */}
            <div className="flex gap-2 p-2 border-b">
                <button
                    type="button"
                    className={`px-3 py-1 rounded-xl border ${deck === 1 ? "bg-black text-white" : ""}`}
                    onClick={() => setDeck(1)}
                >
                    1º piso
                </button>
                <button
                    type="button"
                    className={`px-3 py-1 rounded-xl border ${deck === 2 ? "bg-black text-white" : ""}`}
                    onClick={() => setDeck(2)}
                    disabled={!hasDeck2}
                    title={hasDeck2 ? "Segundo piso" : "Este bus no tiene segundo piso"}
                >
                    2º piso
                </button>
            </div>

            <div className="p-3 overflow-x-auto">
                {/* Si no hay filas, mostramos una pista visual + dejamos logs en consola */}
                {rows.length === 0 ? (
                    <div className="rounded-xl border border-dashed p-4 text-sm text-gray-600">
                        No hay asientos para este piso. Revisa la consola (logs “[SeatPicker] …”)
                        para ver el porqué (deck vacío, row/col nulos, etc.).
                    </div>
                ) : (
                    <SeatPicker
                        rows={rows}
                        maxReservableSeats={1}
                        addSeatCallback={handleAdd}
                        removeSeatCallback={handleRemove}
                        alpha
                        visible
                        continuous
                    />
                )}

                {/* Leyenda */}
                <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-600">
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border" /> Libre
          </span>
                    <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border bg-gray-200" />
            Ocupado / Inactivo
          </span>
                    <span className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-3 rounded border ring-2 ring-black" />
            Seleccionado
          </span>
                </div>

                {/* Panelcito de debug opcional en pantalla */}
                <DebugInfo
                    deck={deck}
                    hasDeck2={hasDeck2}
                    seatsLen={seats.length}
                    d1={decks[1].length}
                    d2={decks[2].length}
                    aisle={effectiveAisle}
                    rowsCount={rows.length}
                    row0Len={rows[0]?.length}
                />
            </div>
        </div>
    );
}

/* ---------------- helpers ---------------- */

// Devuelve Array<Array<Seat|null>>, no objetos {title, seats}
function buildRowsForPicker(
    deckSeats: SeatSummary[],
    opts: { aisleAfterCol: number; occupiedIds: Set<string>; selectedId: string | null }
) {
    if (!deckSeats.length) return [];

    // Si row/col vienen null, los tratamos como 1 para evitar que TODO caiga en 0,0
    const norm = deckSeats.map((s) => ({
        ...s,
        row: s.row ?? 1,
        col: s.col ?? 1,
    }));

    const rowList = Array.from(new Set(norm.map((s) => s.row as number))).sort((a, b) => a - b);
    const colList = Array.from(new Set(norm.map((s) => s.col as number))).sort((a, b) => a - b);

    // Mapa rápido row->col->seat
    const byRow = new Map<number, Map<number, SeatSummary>>();
    for (const s of norm) {
        const r = s.row as number;
        const c = s.col as number;
        if (!byRow.has(r)) byRow.set(r, new Map());
        byRow.get(r)!.set(c, s);
    }

    const rows: Array<Array<any>> = [];

    for (const r of rowList) {
        const cols: Array<any> = [];
        for (const c of colList) {
            // Pasillo: insertamos un hueco justo después de aisleAfterCol (col “a la izquierda” del pasillo)
            if (c === opts.aisleAfterCol + 1) {
                cols.push(null);
            }

            const s = byRow.get(r)?.get(c);
            if (!s) {
                cols.push(null);
                continue;
            }

            const idStr = String(s.id);
            const isOcc = opts.occupiedIds.has(idStr);
            const isSel = opts.selectedId === idStr;

            cols.push({
                id: s.id,
                number: String(s.number),
                isReserved: isOcc || !s.active,
                isSelected: isSel,
                tooltip: `#${s.number} · ${s.deck}º · ${prettyKind(s.kind)}${s.is_accessible ? " · Accesible" : ""}`,
            });
        }
        rows.push(cols);
    }

    return rows;
}

// Auto-detecta el pasillo buscando el gap más frecuente entre columnas
function autoDetectAisle(seats: SeatSummary[]): number {
    if (!seats.length) return 2;
    const byRow: Record<number, number[]> = {};
    for (const s of seats) {
        const r = (s.row ?? 1) as number;
        const c = (s.col ?? 1) as number;
        (byRow[r] ??= []).push(c);
    }
    const score: Record<number, number> = {};
    for (const cols of Object.values(byRow)) {
        cols.sort((a, b) => a - b);
        for (let i = 0; i < cols.length - 1; i++) {
            const left = cols[i];
            const gap = cols[i + 1] - left;
            if (gap > 1) score[left] = (score[left] ?? 0) + 1;
        }
    }
    const top = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    return top ? Number(top[0]) : 2;
}

function prettyKind(kind: SeatSummary["kind"]) {
    switch (kind) {
        case "CAMA":
            return "Cama";
        case "SEMI_CAMA":
            return "Semi cama";
        case "LEITO":
            return "Leito";
        case "ESPECIAL":
            return "Especial";
        default:
            return "Normal";
    }
}

/* --- UI debug opcional --- */
function DebugInfo(props: {
    deck: number;
    hasDeck2: boolean;
    seatsLen: number;
    d1: number;
    d2: number;
    aisle: number;
    rowsCount: number;
    row0Len?: number;
}) {
    return (
        <details className="mt-3 text-xs text-gray-500">
            <summary>Debug</summary>
            <div className="mt-1 grid grid-cols-2 gap-x-6 gap-y-1">
                <span>deck:</span><b>{props.deck}</b>
                <span>hasDeck2:</span><b>{String(props.hasDeck2)}</b>
                <span>seats total:</span><b>{props.seatsLen}</b>
                <span>deck1 seats:</span><b>{props.d1}</b>
                <span>deck2 seats:</span><b>{props.d2}</b>
                <span>aisleAfterCol:</span><b>{props.aisle}</b>
                <span>rowsCount:</span><b>{props.rowsCount}</b>
                <span>row0 length:</span><b>{props.row0Len ?? "-"}</b>
            </div>
        </details>
    );
}
