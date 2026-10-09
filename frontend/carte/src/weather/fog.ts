/**
 * Brouillard (EP009-US006), fonctions pures testées en Vitest (sans three.js) :
 *  - `fogRange` : début et fin du brouillard linéaire (`THREE.Fog`, posé inactif au démarrage par stage.ts), calés sur la distance
 *    entre la caméra et le point regardé : le devant reste lisible, le fond de la ville se noie, à tous les zooms ;
 *  - `fogColorFor` : la couleur (espace linéaire de la scène) qui, après la passe finale (exposition, rendu des tons ACES de
 *    three.js, sRGB), s'affiche exactement comme une couleur du fond de page : un fragment noyé se confond avec le fond.
 * Les nombres sont des choix de rendu, à régler avec Dasco (`?weather=fog&intensity=`).
 */
type V3 = [number, number, number];

/** Brouillard inactif : il commencerait à un million de km (valeurs du démarrage, stage.ts) */
export const FOG_OFF = { near: 1e9, far: 2e9 } as const;

const smooth = (e0: number, e1: number, x: number) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

/**
 * k : intensité du brouillard (0..1) ; d : distance caméra – point regardé (m) ; size : taille du socle (m).
 * Au-dessus de 0,35, le brouillard du prototype ; en dessous, sa fin s'éloigne jusqu'à l'infini : il s'efface sans saut.
 */
export function fogRange(k: number, d: number, size: number): { near: number; far: number } {
  if (k <= 0.001) return { ...FOG_OFF };
  const near = d * (1 - 0.55 * k);
  const far = d + size * (1.6 - 1.25 * k);
  return { near, far: near + (far - near) / Math.max(smooth(0, 0.35, k), 1e-3) };
}

// Matrices du rendu des tons ACES de three.js (tonemapping_pars_fragment), en lignes
const IN: number[][] = [[0.59719, 0.35458, 0.04823], [0.07600, 0.90834, 0.01566], [0.02840, 0.13383, 0.83777]];
const OUT: number[][] = [[1.60475, -0.53108, -0.07367], [-0.10208, 1.10813, -0.00605], [-0.00327, -0.07276, 1.07602]];
const mul = (m: number[][], v: V3): V3 => [0, 1, 2].map((i) => m[i][0] * v[0] + m[i][1] * v[1] + m[i][2] * v[2]) as V3;
function inv(m: number[][]): number[][] {
  const [a, b, c] = m[0], [d, e, f] = m[1], [g, h, i] = m[2];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  return [[A / det, -(b * i - c * h) / det, (b * f - c * e) / det], [B / det, (a * i - c * g) / det, -(a * f - c * d) / det], [C / det, -(a * h - b * g) / det, (a * e - b * d) / det]];
}
const IN_INV = inv(IN), OUT_INV = inv(OUT);
const rrt = (v: number) => (v * (v + 0.0245786) - 0.000090537) / (v * (0.983729 * v + 0.432951) + 0.238081);
/** Inverse de RRTAndODTFit (racine positive du trinôme) */
function rrtInv(t: number): number {
  const A = 0.983729 * t - 1, B = 0.432951 * t - 0.0245786, C = 0.238081 * t + 0.000090537;
  if (Math.abs(A) < 1e-9) return -C / B;
  const disc = Math.max(0, B * B - 4 * A * C);
  const r1 = (-B + Math.sqrt(disc)) / (2 * A), r2 = (-B - Math.sqrt(disc)) / (2 * A);
  return [r1, r2].filter((r) => r >= 0).sort((x, y) => x - y)[0] ?? 0;
}
const srgbToLinear = (c: number) => (c <= 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4));
const linearToSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055);

/** Comme la passe finale : couleur linéaire de la scène → couleur sRGB affichée (0..1) (sert aux tests) */
export function displayed(lin: V3, exposure: number): V3 {
  const v = mul(OUT, mul(IN, lin.map((x) => (x * exposure) / 0.6) as V3).map(rrt) as V3);
  return v.map((x) => linearToSrgb(Math.min(1, Math.max(0, x)))) as V3;
}

/** Couleur linéaire à donner au brouillard pour qu'elle s'affiche comme la couleur sRGB `srgb` (0..1) */
export function fogColorFor(srgb: readonly number[], exposure: number): V3 {
  // (pas de variable nommée `z` dans la carte : ses appels sont déclarés purs au build, voir vite.config.ts)
  const odt = mul(OUT_INV, srgb.map(srgbToLinear) as V3);
  const w = odt.map((x) => rrtInv(Math.min(1, Math.max(0, x)))) as V3;
  return mul(IN_INV, w).map((x) => Math.max(0, (x * 0.6) / exposure)) as V3;
}
