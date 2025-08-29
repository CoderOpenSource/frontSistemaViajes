// src/types/react-seat-picker.d.ts
declare module "react-seat-picker" {
    import * as React from "react";

    export type Seat = {
        id?: string | number;
        number: string | number;
        tooltip?: React.ReactNode;
        isReserved?: boolean;
        isSelected?: boolean;
        isEnabled?: boolean;
        orientation?: "north" | "south" | "east" | "west";
        [key: string]: any;
    };

    export interface SeatPickerProps {
        // ✅ la librería espera array de arrays, NO objetos { title, seats }
        rows: Array<Array<Seat | null>>;
        alpha?: boolean;
        visible?: boolean;
        continuous?: boolean;
        selectedByDefault?: boolean;
        maxReservableSeats?: number;
        loading?: boolean;
        tooltipProps?: any;

        // ✅ callbacks con addCb/removeCb
        addSeatCallback?: (
            args: { row: string | number; number: string | number; id?: string | number },
            addCb: (row: string | number, number: string | number, id?: string | number, newTooltip?: any) => void,
            params?: any,
            removeCb?: (row: string | number, number: string | number, newTooltip?: any) => void
        ) => void;

        removeSeatCallback?: (
            args: { row: string | number; number: string | number; id?: string | number },
            removeCb: (row: string | number, number: string | number, newTooltip?: any) => void
        ) => void;

        [key: string]: any;
    }

    export default class SeatPicker extends React.Component<SeatPickerProps> {}
}
