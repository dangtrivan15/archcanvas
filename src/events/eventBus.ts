/**
 * Lightweight typed pub/sub event bus for cross-store communication.
 *
 * Used to decouple domain stores (graph, file, engine, history, layout)
 * from UI concerns (toasts, loading indicators, error dialogs).
 * Domain stores emit events; UI stores subscribe and react.
 */

type Handler<T> = (payload: T) => void;

export function createEventBus<T extends Record<string, unknown>>() {
  const handlers = new Map<keyof T, Set<Handler<any>>>();
  return {
    on<K extends keyof T>(event: K, handler: Handler<T[K]>): () => void {
      if (!handlers.has(event)) handlers.set(event, new Set());
      handlers.get(event)!.add(handler);
      return () => {
        handlers.get(event)?.delete(handler);
      };
    },
    emit<K extends keyof T>(event: K, payload: T[K]): void {
      handlers.get(event)?.forEach((h) => h(payload));
    },
  };
}
