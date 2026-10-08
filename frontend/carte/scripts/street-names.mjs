/**
 * Emplacements des noms de rues (EP002-US001) : un nom par rue, posé sur la partie la plus droite.
 *
 * Entrée : les tronçons de rue de city.json (`roads`, en mètres, y vers le nord).
 * Sortie : { text, pos, angle, size, len, w, kind, bridge? } par nom, où
 *   - pos    : centre du texte (mètres)
 *   - angle  : direction de la rue en degrés dans le plan (0 = vers l'est, 90 = vers le nord), ramenée
 *              dans ]-90, 90] pour que le texte se lise de gauche à droite vu du sud
 *   - size   : hauteur des lettres en mètres
 *   - len    : longueur estimée du texte en mètres (le rendu peut la recalculer à partir de la police)
 * Le texte est celui d'OpenStreetMap, tel quel (mise en majuscules faite au rendu).
 */

const CHAR_WIDTH = 0.66; // largeur moyenne d'une lettre capitale, en fraction de la hauteur

const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const key = (p) => `${p[0]},${p[1]}`;

export const DEFAULTS = {
  skipKinds: ['cycleway', 'path', 'service'],
  minLength: 25, // une voie plus courte que ça n'a pas de nom
  minSize: 1.4,
  maxSize: 4.5,
  sizeOfWidth: 0.6, // hauteur des lettres = largeur de la voie × ce facteur
  maxBend: 0.1, // écart toléré au bord droit : 10 % de la longueur du texte
  gap: 60, // des tronçons de même nom à moins de 60 m (extrémités) forment une seule rue
};

export const textLength = (text, size) => text.length * size * CHAR_WIDTH;

/** Réunit les tronçons qui se touchent par une extrémité commune : une rue = des chaînes continues. */
function chainsOf(segments) {
  const chains = segments.map((s) => s.pts.slice());
  let merged = true;
  while (merged) {
    merged = false;
    const ends = new Map(); // extrémité → [[indice de chaîne, 'start' | 'end']]
    chains.forEach((c, i) => {
      for (const [p, side] of [[c[0], 'start'], [c.at(-1), 'end']]) {
        const k = key(p);
        if (!ends.has(k)) ends.set(k, []);
        ends.get(k).push([i, side]);
      }
    });
    for (const list of ends.values()) {
      // Une jonction « en T » (3 chaînes ou plus) reste une jonction : on ne choisit pas de branche
      if (list.length !== 2 || list[0][0] === list[1][0]) continue;
      const [[ia, sa], [ib, sb]] = list;
      const a = sa === 'end' ? chains[ia] : chains[ia].slice().reverse();
      const b = sb === 'start' ? chains[ib] : chains[ib].slice().reverse();
      chains[ia] = a.concat(b.slice(1));
      chains.splice(ib, 1);
      merged = true;
      break;
    }
  }
  return chains;
}

/**
 * Une rue = les tronçons de même nom dont les extrémités sont à moins de `gap` mètres les uns des autres
 * (jonctions, voies à double sens, tronçon non nommé entre deux) ; deux rues homonymes éloignées restent séparées.
 */
function componentsOf(segments, gap) {
  const parent = segments.map((_, i) => i);
  const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  const ends = segments.map((s) => [s.pts[0], s.pts.at(-1)]);
  for (let i = 0; i < segments.length; i++)
    for (let j = i + 1; j < segments.length; j++)
      if (ends[i].some((a) => ends[j].some((b) => dist(a, b) <= gap))) parent[find(i)] = find(j);
  const groups = new Map();
  segments.forEach((s, i) => {
    const r = find(i);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r).push(s);
  });
  return [...groups.values()];
}

const lengthOf = (pts) => pts.slice(1).reduce((s, p, i) => s + dist(pts[i], p), 0);

/** Point à la distance s le long de la ligne. */
function at(pts, s) {
  let rest = s;
  for (let i = 1; i < pts.length; i++) {
    const l = dist(pts[i - 1], pts[i]);
    if (rest <= l || i === pts.length - 1) {
      const t = l ? Math.min(1, rest / l) : 0;
      return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * t, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * t];
    }
    rest -= l;
  }
  return pts.at(-1);
}

/**
 * Meilleure fenêtre de longueur `T` sur la chaîne : la plus droite, puis la plus proche du milieu.
 * Écart = plus grande distance des points de la fenêtre à la corde qui joint ses extrémités.
 */
function bestWindow(pts, T, maxBend) {
  const L = lengthOf(pts);
  if (L < T) return null;
  let best = null;
  for (let s0 = 0; s0 <= L - T + 1e-6; s0 += 2) {
    const a = at(pts, s0), b = at(pts, s0 + T);
    const cl = dist(a, b);
    if (cl < T * 0.9) continue; // corde trop courte : la ligne fait un coude ou une boucle
    let bend = 0;
    for (let s = s0; s <= s0 + T; s += 2) {
      const p = at(pts, s);
      const d = Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / cl;
      if (d > bend) bend = d;
    }
    if (bend > maxBend) continue;
    const off = Math.abs(s0 + T / 2 - L / 2) / L; // écart au milieu, de 0 à 0,5
    const score = bend / maxBend + off; // droite d'abord, centrée ensuite
    if (!best || score < best.score) best = { score, a, b };
  }
  return best;
}

/** Ramène un angle dans ]-90, 90] (texte lisible de gauche à droite, du sud). */
function readable(deg) {
  let d = ((deg + 180) % 360 + 360) % 360 - 180; // ]-180, 180]
  if (d > 90) d -= 180;
  else if (d <= -90) d += 180;
  return d;
}

export function buildStreetLabels(roads, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  const skip = new Set(o.skipKinds);
  const byName = new Map();
  for (const r of roads) {
    if (!r.name || skip.has(r.kind) || r.pts.length < 2) continue;
    if (!byName.has(r.name)) byName.set(r.name, []);
    byName.get(r.name).push(r);
  }

  const labels = [];
  const dropped = []; // noms sans emplacement, avec la raison
  for (const [name, segs] of byName) {
    for (const comp of componentsOf(segs, o.gap)) {
      const chains = chainsOf(comp).sort((a, b) => lengthOf(b) - lengthOf(a));
      const w = Math.max(...comp.map((s) => s.w));
      if (lengthOf(chains[0]) < o.minLength) { dropped.push({ name, why: 'trop courte' }); continue; }
      // Tailles essayées : celle de la voie, puis plus petites jusqu'au minimum, tant que le nom ne tient pas
      const start = Math.min(o.maxSize, Math.max(o.minSize, w * o.sizeOfWidth));
      const sizes = [];
      for (let s = start; s > o.minSize; s *= 0.88) sizes.push(s);
      sizes.push(o.minSize);
      let placed = null;
      for (const size of sizes) {
        const T = textLength(name, size);
        for (const chain of chains) {
          const win = bestWindow(chain, T, o.maxBend * T);
          if (win) { placed = { win, size, T }; break; }
        }
        if (placed) break;
      }
      if (!placed) { dropped.push({ name, why: 'ne tient pas en ligne droite' }); continue; }
      const { win, size: sz, T } = placed;
      const center = [(win.a[0] + win.b[0]) / 2, (win.a[1] + win.b[1]) / 2];
      const angle = readable((Math.atan2(win.b[1] - win.a[1], win.b[0] - win.a[0]) * 180) / Math.PI);
      const dominant = comp.reduce((m, s) => (lengthOf(s.pts) > lengthOf(m.pts) ? s : m));
      labels.push({
        text: name,
        pos: [Math.round(center[0] * 10) / 10, Math.round(center[1] * 10) / 10],
        angle: Math.round(angle * 10) / 10,
        size: Math.round(sz * 10) / 10,
        len: Math.round(T * 10) / 10,
        w,
        kind: dominant.kind,
        ...(dominant.bridge ? { bridge: true } : {}),
      });
    }
  }
  return { labels, dropped, names: byName.size };
}
