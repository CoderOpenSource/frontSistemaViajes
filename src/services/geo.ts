
// Catálogo Bolivia (resumido y correcto a nivel provincia/municipio)
export const BO_GEO = {
    "Santa Cruz": {
        "Andrés Ibáñez": {
            "Santa Cruz de la Sierra": ["Centro", "Equipetrol", "Plan 3000"],
            "La Guardia": ["Centro", "El Carmen"],
            "El Torno": ["El Torno"],
            "Porongo": ["Porongo"],
            "Cotoca": ["Cotoca (ciudad)", "Puerto Pailas"],
        },
        "Ichilo": {
            "Buena Vista": ["Buena Vista"],
            "San Carlos": ["San Carlos"],
            "San Juan": ["San Juan"],              // (San Juan de Yapacaní)
            "Yapacaní": ["Yapacaní"],
        },
        "Chiquitos": {
            "San José de Chiquitos": ["San José de Chiquitos"],
            "Pailón": ["Pailón"],
            "Roboré": ["Roboré"],
        },
        "Ignacio Warnes": {
            "Warnes": ["Warnes"],
            "Okinawa Uno": ["Okinawa Uno"],
        },
        "Obispo Santistevan": {
            "Montero": ["Montero"],
            "General Saavedra": ["General Saavedra"],
            "Mineros": ["Mineros"],
            "Fernández Alonso": ["Fernández Alonso"],
        },
        "Ñuflo de Chávez": {
            "Concepción": ["Concepción"],
            "San Javier": ["San Javier"],
            "San Ramón": ["San Ramón"],
        },
        "Germán Busch": {
            "Puerto Suárez": ["Puerto Suárez"],
            "Puerto Quijarro": ["Puerto Quijarro"],
            "Carmen Rivero Tórrez": ["Carmen Rivero Tórrez"],
        },
        // puedes seguir ampliando según necesites
    },

    "Cochabamba": {
        "Cercado": {
            "Cochabamba": ["Centro", "Queru Queru"],
        },
        "Chapare": {
            "Villa Tunari": ["Villa Tunari"],
            "Shinahota": ["Shinahota"],
            "Chimoré": ["Chimoré"],
            "Puerto Villarroel": ["Puerto Villarroel"],
            "Entre Ríos": ["Entre Ríos"],
        },
        "Quillacollo": {
            "Quillacollo": ["Quillacollo"],
            "Tiquipaya": ["Tiquipaya"],
            "Colcapirhua": ["Colcapirhua"],
            "Vinto": ["Vinto"],
            "Sipe Sipe": ["Sipe Sipe"],
        },
        "Punata": {
            "Punata": ["Punata"],
            "Villa Rivero": ["Villa Rivero"],
            "San Benito": ["San Benito"],
            "Tacachi": ["Tacachi"],
            "Cuchumuela": ["Cuchumuela"],
        },
        // idem: añade otras provincias si las usas
    },
} as const;

