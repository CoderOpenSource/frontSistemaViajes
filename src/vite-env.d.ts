/// <reference types="vite/client" />

interface ImportMetaEnv {
    readonly VITE_API_URL: string;
    // aquí puedes añadir más variables si usas otras
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
