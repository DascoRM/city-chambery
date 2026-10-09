/**
 * Points du joueur (itération 34), gardés dans le navigateur comme la progression.
 * Gagnés en attrapant l'éléphant ; prévus pour être dépensés plus tard (bâtiments, etc.).
 * Indépendants de « Recommencer l'exploration » : remettre les lieux à zéro ne retire pas les points.
 */
const KEY = 'chambery-diorama:points:v1';

export function loadPoints(): number {
  try {
    const n = Number(localStorage.getItem(KEY));
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

export function savePoints(n: number): void {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* navigation privée ou stockage bloqué : les points restent en mémoire */
  }
}
