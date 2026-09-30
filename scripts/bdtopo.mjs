/**
 * Hauteurs réelles des bâtiments depuis IGN BD TOPO (service WFS de la Géoplateforme).
 *
 * - Téléchargement de la couche BDTOPO_V3:batiment sur l'emprise du diorama (cache : data/raw/bdtopo.json).
 * - Association de chaque bâtiment OSM au bâtiment BD TOPO qui le recouvre le plus
 *   (échantillonnage de points à l'intérieur de l'emprise OSM).
 * - Si le service ne répond pas, on garde les hauteurs actuelles (OSM ou estimées).
 *
 * Champs utilisés, détectés automatiquement (noms à confirmer sur les vraies données) :
 *   hauteur (m), altitude_minimale_sol, altitude_maximale_toit (m NGF).
 * Licence : BD TOPO © IGN, Licence Ouverte Etalab 2.0 (attribution requise).
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';
import { pointInRing } from './geo.mjs';

const WFS = process.env.BDTOPO_WFS_URL ?? 'https://data.geopf.fr/wfs/ows';
const LAYER = 'BDTOPO_V3:batiment';
const PAGE = 1000;

export async function loadBdTopo({ bbox, cachePath, offline }) {
  if (offline || process.env.NO_BDTOPO) {
    if (existsSync(cachePath)) return JSON.parse(await readFile(cachePath, 'utf8'));
    return null;
  }
  const { south, west, north, east } = bbox;
  const features = [];
  try {
    for (let start = 0; start < 50_000; start += PAGE) {
      const url =
        `${WFS}?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature&TYPENAMES=${LAYER}` +
        `&OUTPUTFORMAT=application/json&SRSNAME=EPSG:4326&COUNT=${PAGE}&STARTINDEX=${start}` +
        `&BBOX=${south},${west},${north},${east},urn:ogc:def:crs:EPSG::4326`;
      const res = await fetch(url, { headers: { 'User-Agent': 'carte-chambery-poc/0.1' } });
      if (!res.ok) throw new Error(`WFS ${res.status} ${res.statusText} — ${(await res.text()).slice(0, 300)}`);
      const page = await res.json();
      features.push(...(page.features ?? []));
      process.stdout.write(`\r  BD TOPO : ${features.length} bâtiments reçus…`);
      if (!page.features || page.features.length < PAGE) break;
    }
    process.stdout.write('\n');
  } catch (err) {
    console.warn(`\n⚠ BD TOPO indisponible (${err.message}).`);
    if (existsSync(cachePath)) {
      console.warn('  → utilisation du cache data/raw/bdtopo.json');
      return JSON.parse(await readFile(cachePath, 'utf8'));
    }
    console.warn('  → on garde les hauteurs OSM / estimées.');
    return null;
  }
  const fc = { type: 'FeatureCollection', features };
  await mkdir(dirname(cachePath), { recursive: true });
  await writeFile(cachePath, JSON.stringify(fc));
  return fc;
}

/** Première valeur numérique trouvée parmi plusieurs noms de champs possibles. */
function field(props, names) {
  for (const n of names) {
    for (const k of Object.keys(props)) {
      if (k.toLowerCase() === n) {
        // Attention : Number(null) vaut 0 ; un champ vide doit rester « absent »
        if (props[k] === null || props[k] === undefined || props[k] === '') continue;
        const v = Number(props[k]);
        if (Number.isFinite(v)) return v;
      }
    }
  }
  return null;
}

/**
 * Associe chaque bâtiment OSM à un bâtiment BD TOPO et met à jour sa hauteur.
 * @param project (lat, lon) → [x, y] en mètres (même projection que le diorama)
 */
export function applyBdTopo(fc, buildings, project) {
  if (!fc?.features?.length) return { matched: 0, total: buildings.length, fields: [] };

  // Ordre des axes : on détecte si les coordonnées sont (lat, lon) au lieu de (lon, lat)
  const first = fc.features.find((f) => f.geometry)?.geometry;
  const sample = first?.type === 'MultiPolygon' ? first.coordinates[0][0][0] : first?.coordinates?.[0]?.[0];
  const latFirst = sample && Math.abs(sample[0]) > Math.abs(sample[1]) && Math.abs(sample[0]) < 90 && Math.abs(sample[1]) < 30;

  const usedFields = new Set();
  const items = [];
  for (const f of fc.features) {
    if (!f.geometry) continue;
    const polys = f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [f.geometry.coordinates];
    const p = f.properties ?? {};
    const hauteur = field(p, ['hauteur']);
    const solMin = field(p, ['altitude_minimale_sol', 'z_min_sol']);
    const toitMax = field(p, ['altitude_maximale_toit', 'z_max_toit']);
    if (hauteur != null) usedFields.add('hauteur');
    if (solMin != null && toitMax != null) usedFields.add('altitudes sol/toit');
    for (const poly of polys) {
      const ring = poly[0].map(([a, b]) => (latFirst ? project(a, b) : project(b, a)));
      const xs = ring.map((q) => q[0]), ys = ring.map((q) => q[1]);
      items.push({ ring, hauteur, solMin, toitMax, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] });
    }
  }

  // Grille d'index spatial (cellules de 25 m)
  const CELL = 25;
  const grid = new Map();
  const key = (i, j) => `${i}:${j}`;
  items.forEach((it, idx) => {
    for (let i = Math.floor(it.box[0] / CELL); i <= Math.floor(it.box[2] / CELL); i++)
      for (let j = Math.floor(it.box[1] / CELL); j <= Math.floor(it.box[3] / CELL); j++) {
        const k = key(i, j);
        if (!grid.has(k)) grid.set(k, []);
        grid.get(k).push(idx);
      }
  });

  let matched = 0;
  for (const b of buildings) {
    const xs = b.outer.map((q) => q[0]), ys = b.outer.map((q) => q[1]);
    const [x0, y0, x1, y1] = [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
    // Points échantillons à l'intérieur de l'emprise OSM
    const pts = [];
    const N = 6;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
      const x = x0 + ((i + 0.5) / N) * (x1 - x0), y = y0 + ((j + 0.5) / N) * (y1 - y0);
      if (pointInRing(x, y, b.outer)) pts.push([x, y]);
    }
    if (!pts.length) continue;
    const votes = new Map();
    for (const [x, y] of pts) {
      for (const idx of grid.get(key(Math.floor(x / CELL), Math.floor(y / CELL))) ?? []) {
        const it = items[idx];
        if (x < it.box[0] || x > it.box[2] || y < it.box[1] || y > it.box[3]) continue;
        if (pointInRing(x, y, it.ring)) votes.set(idx, (votes.get(idx) ?? 0) + 1);
      }
    }
    let best = -1, bestV = 0;
    for (const [idx, v] of votes) if (v > bestV) { best = idx; bestV = v; }
    // Il faut qu'au moins un tiers de l'emprise OSM soit couverte par ce bâtiment BD TOPO
    if (best < 0 || bestV < pts.length / 3) continue;
    const it = items[best];
    const top = it.solMin != null && it.toitMax != null ? it.toitMax - it.solMin : null;
    if (it.hauteur == null && top == null) continue;
    const eave = it.hauteur ?? null;
    const total = top ?? eave;
    if (!total || total < 2 || total > 120) continue;
    b.h = Math.round(total * 10) / 10;
    if (eave && top && top - eave > 0.5) {
      b.eave = Math.round(eave * 10) / 10;
      b.roofH = Math.round((top - eave) * 10) / 10;
    } else if (eave) {
      b.eave = Math.round(eave * 10) / 10;
    }
    if (it.solMin != null) b.ground = Math.round(it.solMin * 10) / 10; // altitude du sol (pour le futur relief)
    b.hSrc = 'bdtopo';
    matched++;
  }
  return { matched, total: buildings.length, fields: [...usedFields] };
}
