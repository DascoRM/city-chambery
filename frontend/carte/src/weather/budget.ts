/**
 * Règle de dégradation des précipitations (règle 8 de l'epic, EP009-US005), pure et testée. On ne touche aux gouttes que quand la
 * densité de pixels est déjà au minimum (scene/quality.ts n'a plus rien à baisser) et que deux mesures de suite (2 × 2 s, en
 * mouvement, pluie affichée) passent sous 24 images/s : densité divisée par 2, puis coupure. Jamais de remontée dans la visite.
 * La lumière et le brouillard, gratuits, restent. 24 : entre les paliers 30 et 20 d'un écran à 60 Hz, la règle attrape « la pluie a
 * fait tomber le téléphone à 20 », pas l'iPhone déjà à 30-31 img/s sans météo.
 */
export const SLOW_FPS = 24;

export interface RainBudget {
  /** Part des gouttes gardée : 1, puis 0,5, puis 0 */
  level: number;
  /** Mesures lentes de suite */
  slow: number;
}

export const FULL_BUDGET: Readonly<RainBudget> = { level: 1, slow: 0 };

export function nextBudget(b: RainBudget, fps: number, atMin: boolean): RainBudget {
  if (b.level === 0) return b;
  if (!atMin || fps >= SLOW_FPS) return b.slow === 0 ? b : { level: b.level, slow: 0 };
  const slow = b.slow + 1;
  return slow >= 2 ? { level: b.level === 1 ? 0.5 : 0, slow: 0 } : { level: b.level, slow };
}
