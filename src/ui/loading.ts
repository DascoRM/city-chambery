/**
 * Progression du chargement de la ville (EP004-US002).
 *
 * Un écran initial vit dans index.html (`#boot`), visible avant même le code de l'appli. Ce module le met à jour
 * avec les vraies étapes de `main()` (jamais un pourcentage inventé), puis passe la main au lobby, qui affiche
 * la même progression. Chaque étape rend la main au navigateur pour qu'il repeigne la barre.
 */
export interface LoadingState { pct: number; label: string }

export interface Loading {
  /** Avance la progression (0 à 100) ; rend la main au navigateur pour qu'il repeigne. */
  set(pct: number, label: string): Promise<void>;
  state(): LoadingState;
  /** Le lobby (ou tout autre abonné) reçoit chaque changement. */
  onChange(fn: (s: LoadingState) => void): void;
  /** Fait disparaître l'écran initial en fondu, puis le retire du DOM. */
  hideBoot(): void;
}

/** Une image peinte, sans jamais bloquer : un onglet masqué ne déclenche pas `requestAnimationFrame`. */
const paint = () =>
  new Promise<void>((resolve) => {
    const done = () => resolve();
    window.setTimeout(done, 60);
    requestAnimationFrame(() => window.setTimeout(done, 0));
  });

export function createLoading(): Loading {
  const boot = document.getElementById('boot');
  const fill = document.getElementById('boot-fill');
  const label = document.getElementById('boot-label');
  const listeners: ((s: LoadingState) => void)[] = [];
  let current: LoadingState = { pct: 0, label: '' };
  let hidden = false;

  return {
    async set(pct, text) {
      current = { pct: Math.max(current.pct, Math.min(100, pct)), label: text };
      if (fill) fill.style.width = `${current.pct}%`;
      if (label && text) label.textContent = `Chargement de la ville · ${text}`;
      for (const fn of listeners) fn(current);
      await paint();
    },
    state: () => current,
    onChange: (fn) => {
      listeners.push(fn);
      fn(current);
    },
    hideBoot() {
      if (hidden || !boot) return;
      hidden = true;
      boot.classList.add('boot-out');
      window.setTimeout(() => boot.remove(), 600);
    },
  };
}
