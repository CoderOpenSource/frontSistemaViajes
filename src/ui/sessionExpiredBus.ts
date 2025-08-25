// ui/sessionExpiredBus.ts
type Listener = () => void;

const listeners = new Set<Listener>();

export function onSessionExpired(cb: Listener): () => void {
    listeners.add(cb);
    // ⬇️ devolvemos una función cuyo retorno es void (no boolean)
    return () => { listeners.delete(cb); };
}

export function triggerSessionExpired() {
    for (const cb of Array.from(listeners)) {
        try { cb(); } catch (e) { console.error(e); }
    }
}
