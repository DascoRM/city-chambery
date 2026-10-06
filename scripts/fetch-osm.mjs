#!/usr/bin/env node
/**
 * Télécharge les données OpenStreetMap de l'emprise du diorama (via l'API Overpass),
 * les projette en mètres locaux, les découpe au carré du socle et écrit
 * public/data/city.json, consommé par l'application.
 *
 * Usage :
 *   npm run data                      → télécharge puis construit
 *   npm run data -- --offline         → reconstruit depuis data/raw/overpass.json (pas de réseau)
 *   OVERPASS_URL=https://... npm run data   → autre instance Overpass
 *
 * Données © contributeurs OpenStreetMap, licence ODbL.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { chooseRoof } from './roofs.mjs';
import { loadBdTopo, applyBdTopo } from './bdtopo.mjs';
import { loadTerrain } from './terrain.mjs';
import { distToSegment, pointInRing } from './geo.mjs';
import { buildStreetLabels } from './street-names.mjs';
import { buildParkings } from './lib/parkings.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CONFIG = JSON.parse(await readFile(resolve(ROOT, 'diorama.config.json'), 'utf8'));
const POIS = JSON.parse(await readFile(resolve(ROOT, 'src/content/pois.json'), 'utf8'));
const RAW_PATH = resolve(ROOT, 'data/raw/overpass.json');
const OUT_PATH = resolve(ROOT, 'public/data/city.json');
const OVERPASS_URL = process.env.OVERPASS_URL ?? 'https://overpass-api.de/api/interpreter';
const OFFLINE = process.argv.includes('--offline');

const { south, west, north, east } = CONFIG.bbox;
const BB = `${south},${west},${north},${east}`;

// ---------------------------------------------------------------------------
// 1. Téléchargement
// ---------------------------------------------------------------------------
const QUERY = `
[out:json][timeout:120];
(
  way["building"](${BB});
  relation["building"](${BB});
  way["highway"](${BB});
  way["leisure"~"^(park|garden|playground|pitch)$"](${BB});
  way["landuse"~"^(grass|recreation_ground|meadow|forest|village_green)$"](${BB});
  relation["leisure"="park"](${BB});
  way["natural"~"^(water|wood|scrub)$"](${BB});
  way["waterway"](${BB});
  node["natural"="tree"](${BB});
  nwr["amenity"](${BB});
  nwr["historic"](${BB});
  nwr["tourism"](${BB});
  nwr["place"="square"](${BB});
  nwr["name"~"Curial|Boigne|Saint-L|phants|Dullin|Savoisien|Ducs de Savoie|de-Sales",i](${BB});
);
out geom;
`;

async function download() {
  console.log(`→ Requête Overpass (${OVERPASS_URL})…`);
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'carte-chambery-poc/0.1' },
    body: 'data=' + encodeURIComponent(QUERY),
  });
  if (!res.ok) throw new Error(`Overpass a répondu ${res.status} ${res.statusText}\n${(await res.text()).slice(0, 500)}`);
  const json = await res.json();
  await mkdir(dirname(RAW_PATH), { recursive: true });
  await writeFile(RAW_PATH, JSON.stringify(json));
  console.log(`  ${json.elements.length} éléments reçus (brut sauvegardé dans data/raw/)`);
  return json;
}

let raw;
const estimatedIds = new Set();
if (OFFLINE) {
  if (!existsSync(RAW_PATH)) throw new Error('Mode --offline : data/raw/overpass.json introuvable. Lance d\'abord `npm run data`.');
  raw = JSON.parse(await readFile(RAW_PATH, 'utf8'));
} else {
  raw = await download();
}

// ---------------------------------------------------------------------------
// 2. Projection : lat/lon → mètres locaux (x = est, y = nord), origine au centre du bbox
// ---------------------------------------------------------------------------
const lat0 = (south + north) / 2;
const lon0 = (west + east) / 2;
const M_PER_DEG_LAT = 111_132;
const M_PER_DEG_LON = 111_320 * Math.cos((lat0 * Math.PI) / 180);
const project = (lat, lon) => [(lon - lon0) * M_PER_DEG_LON, (lat - lat0) * M_PER_DEG_LAT];
const [minX, minY] = project(south, west);
const [maxX, maxY] = project(north, east);
const r1 = (v) => Math.round(v * 10) / 10;
const rp = ([x, y]) => [r1(x), r1(y)];

// ---------------------------------------------------------------------------
// 3. Géométrie : découpage au rectangle du socle
// ---------------------------------------------------------------------------
/** Sutherland–Hodgman : découpe un polygone (anneau ouvert) par le rectangle. */
function clipPolygon(ring) {
  const edges = [
    (p) => p[0] >= minX, (p) => p[0] <= maxX, (p) => p[1] >= minY, (p) => p[1] <= maxY,
  ];
  const inter = [
    (a, b) => lerpAt(a, b, 0, minX), (a, b) => lerpAt(a, b, 0, maxX),
    (a, b) => lerpAt(a, b, 1, minY), (a, b) => lerpAt(a, b, 1, maxY),
  ];
  let out = ring;
  for (let e = 0; e < 4 && out.length; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const cIn = edges[e](cur), pIn = edges[e](prev);
      if (cIn) {
        if (!pIn) out.push(inter[e](prev, cur));
        out.push(cur);
      } else if (pIn) {
        out.push(inter[e](prev, cur));
      }
    }
  }
  return out;
}
function lerpAt(a, b, axis, v) {
  const t = (v - a[axis]) / (b[axis] - a[axis]);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
/** Liang–Barsky par segment : découpe une polyligne, renvoie des morceaux. */
function clipLine(pts) {
  const parts = [];
  let cur = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const seg = clipSegment(pts[i], pts[i + 1]);
    if (!seg) { if (cur.length > 1) parts.push(cur); cur = []; continue; }
    const [a, b] = seg;
    if (cur.length && (cur[cur.length - 1][0] !== a[0] || cur[cur.length - 1][1] !== a[1])) {
      if (cur.length > 1) parts.push(cur);
      cur = [];
    }
    if (!cur.length) cur.push(a);
    cur.push(b);
  }
  if (cur.length > 1) parts.push(cur);
  return parts;
}
function clipSegment(a, b) {
  let t0 = 0, t1 = 1;
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const p = [-dx, dx, -dy, dy];
  const q = [a[0] - minX, maxX - a[0], a[1] - minY, maxY - a[1]];
  for (let i = 0; i < 4; i++) {
    if (p[i] === 0) { if (q[i] < 0) return null; continue; }
    const t = q[i] / p[i];
    if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; }
    else { if (t < t0) return null; if (t < t1) t1 = t; }
  }
  return [[a[0] + dx * t0, a[1] + dy * t0], [a[0] + dx * t1, a[1] + dy * t1]];
}
function area(ring) {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i], [x2, y2] = ring[(i + 1) % ring.length];
    s += x1 * y2 - x2 * y1;
  }
  return s / 2;
}
/** Anneau ouvert (sans point de fermeture dupliqué), sens anti-horaire. */
function normRing(pts, ccw = true) {
  const r = pts.slice();
  if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r.pop();
  if ((area(r) > 0) !== ccw) r.reverse();
  return r;
}
const geomToPts = (geom) => geom.map((g) => project(g.lat, g.lon));

/** Assemble les membres (ways) d'une relation multipolygone en anneaux fermés. */
function assembleRings(members, role) {
  const segs = members.filter((m) => m.type === 'way' && m.role === role && m.geometry).map((m) => geomToPts(m.geometry));
  const rings = [];
  const same = (a, b) => Math.abs(a[0] - b[0]) < 0.01 && Math.abs(a[1] - b[1]) < 0.01;
  while (segs.length) {
    let ring = segs.shift();
    let guard = 0;
    while (!same(ring[0], ring[ring.length - 1]) && guard++ < 500) {
      const end = ring[ring.length - 1];
      const i = segs.findIndex((s) => same(s[0], end) || same(s[s.length - 1], end));
      if (i < 0) break;
      const s = segs.splice(i, 1)[0];
      ring = ring.concat(same(s[0], end) ? s.slice(1) : s.reverse().slice(1));
    }
    if (ring.length >= 4) rings.push(ring);
  }
  return rings;
}

/** Retourne [{outer, holes}] pour un way fermé ou une relation multipolygone. */
function polygonsOf(el) {
  if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
    return [{ outer: geomToPts(el.geometry), holes: [] }];
  }
  if (el.type === 'relation' && el.members) {
    const outers = assembleRings(el.members, 'outer');
    const inners = assembleRings(el.members, 'inner');
    // POC : chaque trou est rattaché au premier anneau extérieur (suffisant pour les cas simples)
    return outers.map((o, i) => ({ outer: o, holes: i === 0 ? inners : [] }));
  }
  return [];
}
function clipPoly({ outer, holes }) {
  const o = clipPolygon(normRing(outer, true));
  if (o.length < 3 || Math.abs(area(o)) < 1) return null;
  const hs = holes.map((h) => clipPolygon(normRing(h, false))).filter((h) => h.length >= 3);
  return { outer: o.map(rp), holes: hs.map((h) => h.map(rp)) };
}

// ---------------------------------------------------------------------------
// 4. Extraction des couches
// ---------------------------------------------------------------------------
const hash = (n) => {
  let x = Number(BigInt(n) % 4294967296n) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d); x ^= x >>> 15; x = Math.imul(x, 0x846ca68b); x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};
const num = (v) => { const f = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(f) ? f : null; };

function buildingHeight(tags, id, footprint) {
  const h = num(tags.height) ?? num(tags['building:height']);
  if (h) return { h, estimated: false };
  const lv = num(tags['building:levels']);
  const roof = num(tags['roof:levels']) ?? 0;
  if (lv) return { h: (lv + roof * 0.6) * CONFIG.defaultLevelHeight + 1, estimated: false };
  // Pas de hauteur dans OSM : estimation plausible pour un centre ancien (R+2 à R+4)
  const kind = tags.building;
  if (['church', 'cathedral', 'chapel'].includes(kind)) return { h: 18, estimated: true };
  if (['garage', 'garages', 'shed', 'roof', 'kiosk', 'carport', 'hut'].includes(kind) || footprint < 40)
    return { h: 3.5, estimated: true };
  const levels = 3 + Math.floor(hash(id) * 3); // 3..5
  return { h: levels * CONFIG.defaultLevelHeight + 1, estimated: true };
}

const ROAD_WIDTH = {
  motorway: 14, trunk: 12, primary: 11, secondary: 9, tertiary: 8, unclassified: 6, residential: 6,
  living_street: 5, pedestrian: 6, service: 4, track: 3, footway: 2.5, path: 2, cycleway: 2.5, steps: 2.5,
};

const buildings = [];
const roads = [];
const areas = []; // piétons, verts, eau
const water = [];
const trees = [];
const places = [];
let estimatedHeights = 0;

const deferredParts = [];
function addBuilding(el, t) {
  for (const poly of polygonsOf(el)) {
    const c = clipPoly(poly);
    if (!c) continue;
    const { h, estimated } = buildingHeight(t, el.id, Math.abs(area(c.outer)));
    if (estimated) { estimatedHeights++; estimatedIds.add(el.id); }
    const minH = num(t.min_height) ?? 0;
    const roofH = num(t['roof:height']);
    buildings.push({
      id: el.id, kind: t.building, h: r1(h), minH: r1(minH), name: t.name, ...c,
      ...(t['roof:shape'] ? { roof: t['roof:shape'] } : {}),
      ...(roofH ? { roofH } : {}),
    });
  }
}

for (const el of raw.elements) {
  const t = el.tags ?? {};

  if (t.building && t.building !== 'no' && t.layer !== '-1' && t.location !== 'underground') {
    // `building:part=no` est un bâtiment ordinaire (le Musée des Beaux-Arts, l'Hôtel des douanes) ; `building:part=yes` est
    // une partie de bâtiment : on la garde de côté, et on ne la dessine que si aucun bâtiment ordinaire ne la recouvre
    // (le Palais de justice n'existe dans OSM que comme « partie »)
    if (t['building:part'] && t['building:part'] !== 'no') deferredParts.push(el);
    else addBuilding(el, t);
    continue;
  }

  if (t.highway && el.type === 'way' && el.geometry) {
    if (t.tunnel === 'yes' || t.tunnel === 'building_passage' || t.layer?.startsWith('-')) continue;
    const isArea = t.area === 'yes' && ['pedestrian', 'footway', 'service'].includes(t.highway);
    if (isArea) {
      const c = clipPoly({ outer: geomToPts(el.geometry), holes: [] });
      if (c) areas.push({ kind: 'plaza', ...c });
      continue;
    }
    // Les trottoirs dessinés à part doublent les rues : on les ignore
    if (t.footway === 'sidewalk' || t.footway === 'traffic_island') continue;
    const w = ROAD_WIDTH[t.highway];
    if (!w) continue;
    const bridge = !!t.bridge && t.bridge !== 'no';
    for (const part of clipLine(geomToPts(el.geometry))) {
      roads.push({ kind: t.highway, w, pts: part.map(rp), name: t.name, ...(bridge ? { bridge: true } : {}) });
    }
    continue;
  }

  if (t.waterway && el.type === 'way' && el.geometry) {
    // Tronçons couverts (la Leysse passe sous les boulevards de l'hypercentre) : ignorés,
    // sauf pour les cours d'eau listés dans showCoveredWater (dessinés quand même, marqués covered)
    const covered = !!t.tunnel && t.tunnel !== 'no';
    if (covered && !(CONFIG.showCoveredWater ?? []).includes(t.name)) continue;
    if (!['river', 'canal', 'stream'].includes(t.waterway)) continue;
    // Largeur OSM exagérée ×1,8 pour rester lisible à l'échelle du diorama
    const base = { river: 10, canal: 6, stream: 3.5 }[t.waterway];
    const w = Math.max(base, (num(t.width) ?? 0) * 1.8);
    for (const part of clipLine(geomToPts(el.geometry))) water.push({ kind: 'line', w: r1(w), pts: part.map(rp), name: t.name, ...(covered ? { covered: true } : {}) });
    continue;
  }

  const GREEN = ['park', 'garden', 'playground', 'pitch', 'grass', 'recreation_ground', 'meadow', 'forest', 'village_green', 'wood', 'scrub'];
  const greenKind = [t.leisure, t.landuse, t.natural].find((v) => GREEN.includes(v));
  if (t.natural === 'water' || greenKind) {
    for (const poly of polygonsOf(el)) {
      const c = clipPoly(poly);
      if (!c) continue;
      if (t.natural === 'water') water.push({ kind: 'area', ...c });
      else areas.push({ kind: 'green', ...c, ...(t.name && ['park', 'garden'].includes(t.leisure) ? { name: t.name } : {}) });
    }
    // pas de continue : un parc peut aussi être un lieu nommé
  }

  if (t.natural === 'tree' && el.type === 'node') {
    const p = project(el.lat, el.lon);
    if (p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY) trees.push(rp(p));
    continue;
  }

  const placeKind = ['bar', 'pub', 'cafe', 'restaurant', 'nightclub', 'biergarten', 'ice_cream'].includes(t.amenity) ? t.amenity : null;
  if (placeKind && t.name) {
    const p = pointOf(el);
    if (p && p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY) {
      places.push({ id: `${el.type}/${el.id}`, kind: placeKind, name: t.name, pos: rp(p), cuisine: t.cuisine, hours: t.opening_hours });
    }
  }
}

// Parties de bâtiment (`building:part=yes`) : dessinées seulement quand aucun bâtiment ordinaire ne les recouvre
// (le Palais de justice n'existe dans OSM que sous cette forme) ; les socles et marches (moins de 2 m) sont ignorés
let drawnParts = 0;
for (const el of deferredParts) {
  const t = el.tags;
  if ((num(t.height) ?? 99) < 2) continue;
  for (const poly of polygonsOf(el)) {
    const c = clipPoly(poly);
    if (!c) continue;
    const mid = centroid(c.outer);
    if (buildings.some((b) => pointInRing(mid[0], mid[1], b.outer))) continue;
    const before = buildings.length;
    addBuilding({ ...el, geometry: el.geometry, members: el.members }, t);
    drawnParts += buildings.length - before;
    break;
  }
}
if (drawnParts) console.log(`  ${drawnParts} parties de bâtiment dessinées (aucun bâtiment ordinaire dessus)`);

// ---------------------------------------------------------------------------
// 4 ter. Hauteurs réelles IGN BD TOPO (remplacent les hauteurs OSM ou estimées)
// ---------------------------------------------------------------------------
// --offline réutilise le cache ; ajouter --bdtopo pour (re)télécharger BD TOPO même en mode hors ligne OSM
const bdtopo = await loadBdTopo({ bbox: CONFIG.bbox, cachePath: resolve(ROOT, 'data/raw/bdtopo.json'), offline: OFFLINE && !process.argv.includes('--bdtopo') });
const bd = applyBdTopo(bdtopo, buildings, project);
const stillEstimated = buildings.filter((b) => estimatedIds.has(b.id) && b.hSrc !== 'bdtopo').length;

// ---------------------------------------------------------------------------
// 4 quater. Relief du terrain (RGE ALTI, sinon interpolation des sols BD TOPO)
// ---------------------------------------------------------------------------
const unproject = (x, y) => [lat0 + y / M_PER_DEG_LAT, lon0 + x / M_PER_DEG_LON];
const groundPts = buildings
  .filter((b) => b.ground != null)
  .map((b) => {
    const c = b.outer.reduce((s, p) => [s[0] + p[0], s[1] + p[1]], [0, 0]);
    return [c[0] / b.outer.length, c[1] / b.outer.length, b.ground];
  });
const terrainRaw = await loadTerrain({
  bounds: { minX, minY, maxX, maxY },
  step: CONFIG.terrainStep ?? 10,
  unproject,
  cachePath: resolve(ROOT, 'data/raw/terrain.json'),
  offline: OFFLINE && !process.argv.includes('--relief'),
  fallbackPoints: groundPts,
});
let terrain = null;
if (terrainRaw) {
  const base = Math.floor(Math.min(...terrainRaw.z));
  const ex = CONFIG.terrainExaggeration ?? 1;
  terrain = {
    x0: r1(terrainRaw.x0), y0: r1(terrainRaw.y0), step: terrainRaw.step, nx: terrainRaw.nx, ny: terrainRaw.ny,
    base, exaggeration: ex, source: terrainRaw.source,
    // hauteurs relatives au point le plus bas, en décimètres (entiers : fichier plus léger)
    z: terrainRaw.z.map((v) => Math.round((v - base) * ex * 10)),
  };
}

// ---------------------------------------------------------------------------
// 4 bis. Squelette droit des toits (toits à pans pour toutes les formes, y compris en L et avec cour)
// ---------------------------------------------------------------------------
// La librairie (CGAL compilé en WebAssembly) est prévue pour le navigateur : petites cales pour Node
globalThis.self ??= globalThis;
globalThis.window ??= globalThis;
const { SkeletonBuilder } = createRequire(import.meta.url)('straight-skeleton');
await SkeletonBuilder.init();

const closeRing = (r) => {
  const out = r.filter((p, i) => i === 0 || p[0] !== r[i - 1][0] || p[1] !== r[i - 1][1]);
  if (out.length > 1 && out[0][0] === out.at(-1)[0] && out[0][1] === out.at(-1)[1]) out.pop();
  return out.length >= 3 ? [...out, out[0]] : null;
};
let skeletons = 0, skeletonFailures = 0, rectRoofs = 0;
for (const b of buildings) {
  const choice = chooseRoof(b, Math.abs(area(b.outer)));
  if (choice.kind === 'rect') { b.rect = choice.rect; rectRoofs++; continue; }
  if (choice.kind === 'flat') continue;
  const outer = closeRing(normRing(b.outer, true));
  if (!outer) continue;
  const holes = b.holes.map((h) => closeRing(normRing(h, false))).filter(Boolean);
  try {
    const sk = SkeletonBuilder.buildFromPolygon([outer, ...holes]);
    if (!sk || !sk.polygons.length) { skeletonFailures++; continue; }
    // Allègement : les premiers sommets du squelette sont ceux de l'emprise (déjà stockés).
    // On ne garde que les sommets intérieurs ; n = nombre de sommets d'emprise à reprendre.
    const rings = [outer, ...holes].map((r) => r.slice(0, -1));
    const ringPts = rings.flat();
    const prefixOk = ringPts.every((p, i) => sk.vertices[i] && Math.abs(sk.vertices[i][0] - p[0]) < 1e-3 && Math.abs(sk.vertices[i][1] - p[1]) < 1e-3);
    const verts = sk.vertices.map(([x, y, d]) => [r1(x), r1(y), r1(d)]);
    if (prefixOk) {
      b.outer = rings[0];
      b.holes = rings.slice(1);
      b.skel = { n: ringPts.length, v: verts.slice(ringPts.length), f: sk.polygons };
    } else {
      b.skel = { n: 0, v: verts, f: sk.polygons };
    }
    skeletons++;
  } catch {
    skeletonFailures++;
  }
}

// ---------------------------------------------------------------------------
// 5. Ancrage des points d'intérêt (coordonnées issues d'OSM, jamais inventées)
// ---------------------------------------------------------------------------
function pointOf(el) {
  if (el.type === 'node') return project(el.lat, el.lon);
  if (el.type === 'way' && el.geometry) {
    const pts = geomToPts(el.geometry);
    const closed = el.geometry.length > 3 && el.geometry[0].lat === el.geometry.at(-1).lat && el.geometry[0].lon === el.geometry.at(-1).lon;
    if (closed) return centroid(pts);
    return pointAlong(pts, 0.5); // rue : milieu de la ligne
  }
  if (el.bounds) return project((el.bounds.minlat + el.bounds.maxlat) / 2, (el.bounds.minlon + el.bounds.maxlon) / 2);
  return null;
}
function centroid(pts) {
  let x = 0, y = 0;
  for (const p of pts) { x += p[0]; y += p[1]; }
  return [x / pts.length, y / pts.length];
}
function pointAlong(pts, f) {
  const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
  let target = lens.reduce((a, b) => a + b, 0) * f;
  for (let i = 0; i < lens.length; i++) {
    if (target <= lens[i]) { const t = target / lens[i]; return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t]; }
    target -= lens[i];
  }
  return pts.at(-1);
}
const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim();

function lengthOf(el) {
  if (el.type !== 'way' || !el.geometry) return 0;
  const pts = geomToPts(el.geometry);
  return pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);
}

const anchors = {};
const missing = [];
for (const poi of POIS) {
  const needle = norm(poi.osm.match);
  const cands = raw.elements.filter((el) => norm(el.tags?.name).includes(needle));
  if (!cands.length) { missing.push(poi.id); continue; }
  const score = (el) => {
    let s = 0;
    for (const [k, v] of Object.entries(poi.osm.prefer ?? {})) if (el.tags[k] && (v === '*' || el.tags[k] === v)) s += 10;
    if (norm(el.tags.name) === needle) s += 5;
    return s + Math.min(lengthOf(el) / 100, 3); // à égalité, la rue la plus longue
  };
  cands.sort((a, b) => score(b) - score(a));
  const p = pointOf(cands[0]);
  if (!p) { missing.push(poi.id); continue; }
  anchors[poi.id] = { pos: rp(p), osm: `${cands[0].type}/${cands[0].id}`, osmName: cands[0].tags.name };
}

// ---------------------------------------------------------------------------
// 6. Écriture
// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// 5 bis. Étiquettes : noms des parcs et des cours d'eau
// ---------------------------------------------------------------------------
/** Point intérieur le plus éloigné des bords (échantillonnage), pour poser l'étiquette. */
function labelPoint(ring) {
  const xs = ring.map((p) => p[0]), ys = ring.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = null, bestD = -1;
  const N = 16;
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) {
    const p = [x0 + ((x1 - x0) * i) / N, y0 + ((y1 - y0) * j) / N];
    if (!pointInRing(p[0], p[1], ring)) continue;
    let d = Infinity;
    for (let k = 0; k < ring.length; k++) d = Math.min(d, distToSegment(p, ring[k], ring[(k + 1) % ring.length]));
    if (d > bestD) { bestD = d; best = p; }
  }
  return best ? { pos: best, room: bestD } : null;
}
const labels = [];
const seen = new Set();
for (const a of [...areas].filter((a) => a.name).sort((a, b) => Math.abs(area(b.outer)) - Math.abs(area(a.outer)))) {
  if (seen.has(a.name) || Math.abs(area(a.outer)) < 600) continue;
  const lp = labelPoint(a.outer);
  if (!lp) continue;
  seen.add(a.name);
  labels.push({ text: a.name, kind: 'park', pos: rp(lp.pos), size: r1(Math.max(6, Math.min(16, lp.room * 0.45))) });
}
const waterByName = new Map();
for (const w of water) {
  if (w.kind !== 'line' || !w.name) continue;
  const len = w.pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - w.pts[i][0], p[1] - w.pts[i][1]), 0);
  if (len > (waterByName.get(w.name)?.len ?? 0)) waterByName.set(w.name, { w, len });
}
for (const [name, { w, len }] of waterByName) {
  if (len < 60) continue;
  labels.push({ text: name, kind: 'water', pos: rp(pointAlong(w.pts, 0.5)), size: 8 });
}

// ---------------------------------------------------------------------------
// 5 ter. Noms de rues (EP002-US001) : un nom par rue, posé sur sa partie la plus droite
// ---------------------------------------------------------------------------
const streets = buildStreetLabels(roads, CONFIG.streetNames);

// ---------------------------------------------------------------------------
// 5 quater. Parkings (EP006-US001)
// ---------------------------------------------------------------------------
const parkingData = buildParkings(raw.elements, {
  polygonsOf, clipPoly, area, project, rp, centroid, norm,
  inside: (p) => p[0] >= minX && p[0] <= maxX && p[1] >= minY && p[1] <= maxY,
});

const city = {
  generatedAt: new Date().toISOString(),
  osmDate: raw.osm3s?.timestamp_osm_base,
  attribution: ['© contributeurs OpenStreetMap (ODbL)', bd.matched && 'Hauteurs BD TOPO © IGN', terrain?.source === 'rgealti' && 'Relief RGE ALTI © IGN'].filter(Boolean).join(' · '),
  origin: { lat: lat0, lon: lon0 },
  bounds: { minX: r1(minX), minY: r1(minY), maxX: r1(maxX), maxY: r1(maxY) },
  buildings, roads, areas, water, trees, places, anchors, labels, streetLabels: streets.labels, parkings: parkingData.parkings, terrain,
  stats: { estimatedHeights: stillEstimated, bdtopoMatched: bd.matched, rectRoofs, skeletons },
};
await mkdir(dirname(OUT_PATH), { recursive: true });
await writeFile(OUT_PATH, JSON.stringify(city));

const kb = Math.round(JSON.stringify(city).length / 1024);
console.log(`✓ public/data/city.json (${kb} Ko)`);
console.log(`  socle : ${Math.round(maxX - minX)} m × ${Math.round(maxY - minY)} m`);
console.log(`  ${buildings.length} bâtiments : ${bd.matched} hauteurs IGN BD TOPO${bd.fields.length ? ` (${bd.fields.join(', ')})` : ''}, ${stillEstimated} encore estimées`);
console.log(terrain ? `  relief : ${terrain.nx}×${terrain.ny} points (pas de ${terrain.step} m), source ${terrain.source}, dénivelé ${(Math.max(...terrain.z) / 10).toFixed(0)} m au-dessus de ${terrain.base} m` : '  relief : aucun');
console.log(`  toits : ${rectRoofs} rectangulaires, ${skeletons} par squelette droit${skeletonFailures ? ` (${skeletonFailures} échecs → toit plat)` : ''}, ${buildings.length - rectRoofs - skeletons} plats`);
console.log(`  ${roads.length} tronçons de rue, ${areas.length} zones, ${water.length} éléments d'eau, ${trees.length} arbres`);
console.log(`  ${streets.labels.length} noms de rues sur ${streets.names} noms de voies${streets.dropped.length ? ` ; ${streets.dropped.length} sans emplacement (${[...new Set(streets.dropped.map((d) => d.why))].join(' / ')})` : ''}`);
{
  const pk = parkingData.parkings, st = parkingData.stats;
  const off = pk.filter((x) => x.kind !== 'street');
  const by = (k) => off.filter((x) => x.kind === k).length;
  console.log(`  ${pk.length} parkings exportés sur ${st.osm} dans OSM : ${off.length} hors voirie (${by('surface')} de surface, ${by('underground')} souterrains, ${by('multi-storey')} silos), ${st.street} de voirie ; ${st.merged} nœuds fusionnés, ${st.tinyDropped} petites poches écartées`);
  console.log(`    hors voirie : ${off.filter((x) => x.name).length} nommés, ${off.filter((x) => x.capacity).length} avec capacité, ${off.filter((x) => x.est).length} capacités estimées (≈ aire / 28), ${off.filter((x) => x.fee !== undefined).length} avec tarif, ${st.privateDropped} privés écartés, ${st.overlapDropped} doublons nus écartés, ${st.fromEntrances} parking(s) connu(s) par leurs seules entrées`);
}
console.log(`  ${places.length} bars / cafés / restaurants, ${labels.length} étiquettes (${labels.map((l) => l.text).join(', ')})`);
for (const [id, a] of Object.entries(anchors)) console.log(`  POI ${id.padEnd(16)} → ${a.osm} « ${a.osmName} »`);
if (missing.length) {
  console.warn(`⚠ POI non trouvés dans OSM : ${missing.join(', ')}`);
  console.warn('  Ajuste "osm.match" dans src/content/pois.json ou ajoute "pos": [x, y] à la main (mètres).');
}
