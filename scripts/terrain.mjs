/**
 * Relief du terrain : grille d'altitudes régulière sur l'emprise du diorama.
 *
 * Source principale : service de calcul altimétrique de la Géoplateforme IGN, ressource RGE ALTI
 * (ign_rge_alti_wld), jusqu'à 5 000 points par requête, 5 requêtes/s max (doc cartes.gouv.fr).
 * On envoie des lots plus petits (URL GET raisonnable) et on reste sous 4 requêtes/s.
 * Cache : data/raw/terrain.json.
 *
 * Repli si le service est injoignable : interpolation (pondération inverse à la distance)
 * des altitudes de sol des bâtiments BD TOPO — moins précis entre les bâtiments (parcs, rues larges).
 *
 * Licence : RGE ALTI © IGN, Licence Ouverte Etalab 2.0.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

const API = process.env.ALTI_URL ?? 'https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json';
const BATCH = 150;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * @param bounds  emprise en mètres {minX, minY, maxX, maxY}
 * @param unproject (x, y) → [lat, lon]
 * @param fallbackPoints [[x, y, z], …] altitudes connues (ex. sol BD TOPO) pour le repli
 */
export async function loadTerrain({ bounds, step, unproject, cachePath, offline, fallbackPoints }) {
  const nx = Math.floor((bounds.maxX - bounds.minX) / step) + 1;
  const ny = Math.floor((bounds.maxY - bounds.minY) / step) + 1;
  const grid = { x0: bounds.minX, y0: bounds.minY, step, nx, ny };

  // 1. Cache (même grille)
  if (existsSync(cachePath)) {
    const c = JSON.parse(await readFile(cachePath, 'utf8'));
    if (c.nx === nx && c.ny === ny && c.step === step && c.x0 === grid.x0 && c.y0 === grid.y0 && (offline || c.source === 'rgealti')) {
      return c;
    }
  }

  // 2. Service RGE ALTI
  if (!offline && !process.env.NO_ALTI) {
    try {
      const pts = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) pts.push(unproject(grid.x0 + i * step, grid.y0 + j * step));
      const z = new Array(pts.length);
      for (let k = 0; k < pts.length; k += BATCH) {
        const chunk = pts.slice(k, k + BATCH);
        const url =
          `${API}?lon=${chunk.map((p) => p[1].toFixed(6)).join('|')}&lat=${chunk.map((p) => p[0].toFixed(6)).join('|')}` +
          `&resource=ign_rge_alti_wld&delimiter=|&zonly=true`;
        let tries = 0;
        for (;;) {
          const res = await fetch(url, { headers: { 'User-Agent': 'carte-chambery-poc/0.1' } });
          if (res.ok) {
            const json = await res.json();
            const values = (json.elevations ?? []).map((e) => (typeof e === 'number' ? e : e.z));
            if (values.length !== chunk.length) throw new Error(`réponse incomplète (${values.length}/${chunk.length})`);
            values.forEach((v, n) => (z[k + n] = v));
            break;
          }
          if (res.status === 429 && tries++ < 5) { await sleep(1500); continue; }
          throw new Error(`HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
        }
        process.stdout.write(`\r  Relief RGE ALTI : ${Math.min(k + BATCH, pts.length)} / ${pts.length} points…`);
        await sleep(260); // < 4 requêtes par seconde
      }
      process.stdout.write('\n');
      // Valeurs aberrantes (-99999 = pas de donnée) : remplacées par la médiane
      const valid = z.filter((v) => v > -1000).sort((a, b) => a - b);
      const med = valid[valid.length >> 1];
      const out = { ...grid, source: 'rgealti', z: z.map((v) => (v > -1000 ? v : med)) };
      await mkdir(dirname(cachePath), { recursive: true });
      await writeFile(cachePath, JSON.stringify(out));
      return out;
    } catch (err) {
      console.warn(`\n⚠ Relief RGE ALTI indisponible (${err.message}).`);
    }
  }

  // 3. Repli : interpolation des altitudes de sol BD TOPO
  if (fallbackPoints?.length >= 10) {
    console.warn(`  → relief interpolé depuis ${fallbackPoints.length} altitudes de sol BD TOPO (moins précis).`);
    const z = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) z.push(idw(grid.x0 + i * step, grid.y0 + j * step, fallbackPoints));
    return { ...grid, source: 'bdtopo-idw', z };
  }
  console.warn('  → pas de relief (terrain plat).');
  return null;
}

/** Pondération inverse à la distance sur les 8 points les plus proches. */
function idw(x, y, pts) {
  const near = [];
  for (const p of pts) {
    const d2 = (p[0] - x) ** 2 + (p[1] - y) ** 2;
    if (near.length < 8) { near.push([d2, p[2]]); near.sort((a, b) => a[0] - b[0]); }
    else if (d2 < near[7][0]) { near[7] = [d2, p[2]]; near.sort((a, b) => a[0] - b[0]); }
  }
  let w = 0, s = 0;
  for (const [d2, v] of near) {
    if (d2 < 1) return v;
    const k = 1 / d2;
    w += k; s += k * v;
  }
  return s / w;
}
