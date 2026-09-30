/**
 * Éléphants ramenés sur la fontaine (itération 35), gardés dans le navigateur comme les lieux découverts.
 * Liste des places (0 à 3) déjà occupées ; vidée quand une nouvelle partie commence.
 */
const KEY = 'chambery-diorama:herd:v1';

export function loadReturned(): Set<number> {
  try {
    const raw = localStorage.getItem(KEY);
    return new Set(raw ? (JSON.parse(raw) as number[]) : []);
  } catch {
    return new Set();
  }
}

export function saveReturned(ids: Set<number>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify([...ids]));
  } catch {
    /* navigation privée ou stockage bloqué : la partie reste en mémoire */
  }
}
