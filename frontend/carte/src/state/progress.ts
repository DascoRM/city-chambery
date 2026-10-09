/** Progression de découverte, gardée dans le navigateur (pas de compte pour le POC). */
const KEY = 'chambery-diorama:discovered:v1';

export function loadDiscovered(): Set<string> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function saveDiscovered(ids: Set<string>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* navigation privée ou stockage bloqué : la progression reste en mémoire */
  }
}

export function resetDiscovered(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
}
