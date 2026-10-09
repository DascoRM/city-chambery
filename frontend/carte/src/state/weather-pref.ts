/**
 * Préférences météo du visiteur (EP009), gardées dans le navigateur comme la progression :
 *  - « Afficher la météo » : désactivée, le module météo n'est même pas téléchargé à la visite suivante ;
 *  - « Effets réduits » : comme `prefers-reduced-motion` (ni éclairs ni balancement, précipitations ralenties).
 * Si le stockage est bloqué (navigation privée), les valeurs par défaut valent à chaque visite.
 */
const KEY = 'chambery-diorama:meteo:v1';

export interface WeatherPref { enabled: boolean; reduced: boolean }

export function loadWeatherPref(): WeatherPref {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<WeatherPref> | null;
    return { enabled: v?.enabled !== false, reduced: v?.reduced === true };
  } catch {
    return { enabled: true, reduced: false };
  }
}

export function saveWeatherPref(p: WeatherPref): void {
  try {
    if (p.enabled && !p.reduced) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify({ enabled: p.enabled, reduced: p.reduced }));
  } catch {
    /* stockage bloqué : le choix reste valable jusqu'au rechargement */
  }
}
