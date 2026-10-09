/**
 * Choix des toits, fait une seule fois dans le script de données :
 *  1. emprise quasi rectangulaire → toit « rectangle » (deux pans, quatre pans, pyramide) ;
 *  2. sinon → squelette droit (formes en L, en U, avec cour) ;
 *  3. sinon → toit plat.
 * L'application ne fait que dessiner ce qui est décidé ici.
 *
 * Forme du toit : tag OSM roof:shape quand il existe (≈ 3 % à Chambéry),
 * sinon choix stylistique déterministe (pas une donnée réelle).
 */

const MAX_RECT_AREA = 900; // m² : au-delà, pas de toit « rectangle »
const MAX_SKELETON_AREA = 2500; // m² : au-delà (sauf églises), toit plat
const MIN_AREA = 12;
const MIN_RECT = 0.82; // surface emprise / surface du rectangle englobant
const MIN_RECT_TAGGED = 0.65;
const PITCH = Math.tan((33 * Math.PI) / 180);
export const FLAT_KINDS = new Set(['garage', 'garages', 'carport', 'roof', 'parking', 'kiosk', 'shed', 'hut']);
const TALL_ROOF_KINDS = new Set(['church', 'cathedral', 'chapel']);

const r1 = (v) => Math.round(v * 10) / 10;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/** Même hachage que src/scene/palette.ts (rand) : des identifiants proches donnent des valeurs très différentes. */
export function rand(seed) {
  let x = Math.floor(seed) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

function mapTag(tag) {
  if (!tag) return null;
  if (tag === 'flat') return 'flat';
  if (['gabled', 'saltbox', 'double_saltbox', 'gambrel', 'skillion'].includes(tag)) return 'gabled';
  if (['hipped', 'half-hipped', 'quadruple_saltbox', 'mansard'].includes(tag)) return 'hipped';
  if (tag === 'pyramidal') return 'pyramidal';
  return null;
}

/**
 * @returns {'rect' | 'skeleton' | 'flat'} et, pour 'rect', le plan du toit à stocker dans city.json
 */
export function chooseRoof(b, footprint) {
  const tagged = mapTag(b.roof);
  if (tagged === 'flat' || footprint < MIN_AREA) return { kind: 'flat' };
  if (!tagged && FLAT_KINDS.has(b.kind)) return { kind: 'flat' };

  if (!b.holes.length && (tagged || footprint <= MAX_RECT_AREA)) {
    const obb = minAreaRect(b.outer);
    if (obb && footprint / obb.area >= (tagged ? MIN_RECT_TAGGED : MIN_RECT)) {
      const shape =
        tagged ?? (obb.a / obb.b < 1.25 && rand(b.id * 5 + 2) < 0.5 ? 'pyramidal' : rand(b.id * 11 + 5) < 0.55 ? 'hipped' : 'gabled');
      const rise = b.roofH ?? Math.min(6.5, Math.max(1.2, obb.b * PITCH));
      return {
        kind: 'rect',
        rect: { s: shape, cx: r1(obb.cx), cy: r1(obb.cy), ux: r4(obb.ux), uy: r4(obb.uy), a: r1(obb.a), b: r1(obb.b), rise: r1(rise) },
      };
    }
  }
  // Très grands bâtiments : toit plat, sauf église ou si BD TOPO mesure un vrai toit (> 1,5 m)
  if (footprint > MAX_SKELETON_AREA && !TALL_ROOF_KINDS.has(b.kind) && !(b.roofH > 1.5)) return { kind: 'flat' };
  return { kind: 'skeleton' };
}

// ---------------------------------------------------------------------------
// Rectangle orienté d'aire minimale
// ---------------------------------------------------------------------------
function convexHull(pts) {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower = [], upper = [];
  for (const q of p) { while (lower.length >= 2 && cross(lower.at(-2), lower.at(-1), q) <= 0) lower.pop(); lower.push(q); }
  for (const q of p.reverse()) { while (upper.length >= 2 && cross(upper.at(-2), upper.at(-1), q) <= 0) upper.pop(); upper.push(q); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function minAreaRect(pts) {
  const hull = convexHull(pts);
  if (hull.length < 3) return null;
  let best = null;
  for (let i = 0; i < hull.length; i++) {
    const [x1, y1] = hull[i], [x2, y2] = hull[(i + 1) % hull.length];
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (len < 1e-6) continue;
    const ux = (x2 - x1) / len, uy = (y2 - y1) / len;
    let minS = Infinity, maxS = -Infinity, minT = Infinity, maxT = -Infinity;
    for (const [x, y] of hull) {
      const s = x * ux + y * uy, t = -x * uy + y * ux;
      minS = Math.min(minS, s); maxS = Math.max(maxS, s);
      minT = Math.min(minT, t); maxT = Math.max(maxT, t);
    }
    const area = (maxS - minS) * (maxT - minT);
    if (!best || area < best.area) {
      const sc = (minS + maxS) / 2, tc = (minT + maxT) / 2;
      let a = (maxS - minS) / 2, b = (maxT - minT) / 2;
      let axx = ux, axy = uy;
      if (b > a) { [a, b] = [b, a]; [axx, axy] = [-uy, ux]; } // axe principal = grand côté
      best = { cx: sc * ux - tc * uy, cy: sc * uy + tc * ux, ux: axx, uy: axy, a, b, area };
    }
  }
  return best;
}
