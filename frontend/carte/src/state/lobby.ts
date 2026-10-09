/**
 * Case « Ne plus afficher cet écran » du lobby (EP004), gardée dans le navigateur comme la progression.
 * Si le stockage est bloqué (navigation privée), le lobby s'affiche à chaque visite.
 */
const KEY = 'chambery-diorama:lobby:v1';

export function loadLobbySkip(): boolean {
  try {
    return localStorage.getItem(KEY) === 'skip';
  } catch {
    return false;
  }
}

export function saveLobbySkip(skip: boolean): void {
  try {
    if (skip) localStorage.setItem(KEY, 'skip');
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage bloqué : le choix reste valable jusqu'au rechargement */
  }
}
