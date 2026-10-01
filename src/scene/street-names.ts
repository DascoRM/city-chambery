import * as THREE from 'three';
import type { HeightFn, StreetLabel, Ticker } from '../types';
import type { NightUniforms } from './city';
import { roadLift } from './roads';

/**
 * Noms de rues peints au sol (EP002-US002 et US003).
 *
 * Les lettres viennent d'un petit atlas de **champ de distance** (une case par lettre utilisée, pas par nom) :
 * le texte reste net à tous les zooms et il n'y a aucune coupure aux extrémités. Chaque lettre est un petit
 * quad posé sur le relief ; tous les quads forment un seul maillage (un appel de rendu pour toute la ville).
 *
 * Lisibilité : chaque nom existe en deux exemplaires de position (normale et tournée de 180° autour de son
 * centre) ; le shader prend celle qui se lit de gauche à droite vue de la caméra, donc le texte n'est jamais
 * à l'envers, quel que soit le cap.
 *
 * Apparition : l'opacité dépend de la distance entre la caméra et le centre de la vue (fondu continu,
 * stable quand on ne bouge plus) ; rien n'est construit ni dessiné tant que la caméra est loin.
 */
export interface StreetNamesConfig {
  fadeStart: number;
  fadeEnd: number;
  nightGlow: number;
  ink: string;
  halo: string;
}

const FONT_FAMILY = 'Inter, system-ui, sans-serif';
const GLYPH_PX = 64; // taille de police dans l'atlas
const SPREAD = 12; // px de champ de distance autour de chaque lettre
const GUTTER = 2; // px entre deux cases
const HALO_PX = 8; // épaisseur du liseré clair, en pixels de l'atlas
const TRACKING = 0.05; // espacement ajouté entre les lettres (em)
const ATLAS_W = 1024;
const LIFT = 0.05; // au-dessus du ruban de la rue
const RIBBON_STEP = 4; // m : pas des sommets du ruban d'une rue (city.ts)
const PREBUILD = 60; // m avant le début du fondu, on prépare l'atlas (sans le montrer)

interface Glyph { ch: string; x: number; y: number; w: number; h: number; adv: number }

/** Transformée en distance euclidienne au carré (Felzenszwalb), pour une ligne ou une colonne. */
function edt1d(f: Float64Array, n: number, d: Float64Array, v: Int32Array, z: Float64Array) {
  const cut = (q: number, p: number) => (f[q] + q * q - (f[p] + p * p)) / (2 * q - 2 * p);
  let k = 0;
  v[0] = 0; z[0] = -1e20; z[1] = 1e20;
  for (let q = 1; q < n; q++) {
    let s = cut(q, v[k]);
    while (s <= z[k]) { k--; s = cut(q, v[k]); }
    k++; v[k] = q; z[k] = s; z[k + 1] = 1e20;
  }
  k = 0;
  for (let q = 0; q < n; q++) {
    while (z[k + 1] < q) k++;
    d[q] = (q - v[k]) * (q - v[k]) + f[v[k]];
  }
}

/** Distance (px) de chaque pixel au plus proche pixel `feature` (là où mask vaut `want`). */
function distanceTo(mask: Uint8Array, w: number, h: number, want: number): Float32Array {
  const INF = 1e12;
  const grid = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) grid[i] = mask[i] === want ? 0 : INF;
  const n = Math.max(w, h);
  const f = new Float64Array(n), d = new Float64Array(n), z = new Float64Array(n + 1), v = new Int32Array(n);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) f[y] = grid[y * w + x];
    edt1d(f, h, d, v, z);
    for (let y = 0; y < h; y++) grid[y * w + x] = d[y];
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) f[x] = grid[y * w + x];
    edt1d(f, w, d, v, z);
    for (let x = 0; x < w; x++) grid[y * w + x] = d[x];
  }
  const out = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = Math.sqrt(grid[i]);
  return out;
}

/** Atlas de champ de distance : une case par caractère. 255 = loin dedans, 0 = loin dehors, 128 = bord. */
function buildGlyphAtlas(chars: string[]): { texture: THREE.DataTexture; glyphs: Map<string, Glyph>; height: number } {
  const probe = document.createElement('canvas').getContext('2d')!;
  probe.font = `700 ${GLYPH_PX}px ${FONT_FAMILY}`;
  const cellH = Math.ceil(GLYPH_PX * 1.25) + SPREAD * 2;
  const glyphs = new Map<string, Glyph>();
  let x = 0, y = 0;
  for (const ch of chars) {
    const adv = probe.measureText(ch).width;
    const w = Math.ceil(adv) + SPREAD * 2;
    if (x + w > ATLAS_W) { x = 0; y += cellH + GUTTER; }
    glyphs.set(ch, { ch, x, y, w, h: cellH, adv });
    x += w + GUTTER;
  }
  const H = y + cellH;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.font = `700 ${GLYPH_PX}px ${FONT_FAMILY}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';
  for (const g of glyphs.values()) ctx.fillText(g.ch, g.x + SPREAD, g.y + g.h / 2);
  const rgba = ctx.getImageData(0, 0, ATLAS_W, H).data;
  const inside = new Uint8Array(ATLAS_W * H);
  for (let i = 0; i < inside.length; i++) inside[i] = rgba[i * 4 + 3] >= 128 ? 1 : 0;
  const toInside = distanceTo(inside, ATLAS_W, H, 1); // des pixels dehors vers la lettre
  const toOutside = distanceTo(inside, ATLAS_W, H, 0); // des pixels dedans vers l'extérieur
  const data = new Uint8Array(ATLAS_W * H * 4);
  for (let i = 0; i < inside.length; i++) {
    // distance signée en pixels : positive dehors, négative dedans (bord à ±0,5 px)
    const signed = inside[i] ? -(toOutside[i] - 0.5) : toInside[i] - 0.5;
    const v = Math.round(255 * Math.min(1, Math.max(0, 0.5 - signed / (2 * SPREAD))));
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = data[i * 4 + 3] = v;
  }
  const texture = new THREE.DataTexture(data, ATLAS_W, H, THREE.RGBAFormat);
  texture.colorSpace = THREE.NoColorSpace; // des distances, pas des couleurs
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.anisotropy = 4;
  texture.flipY = false; // les rangées sont lues de haut en bas, comme le canevas
  texture.needsUpdate = true;
  return { texture, glyphs, height: H };
}

export interface StreetNames extends Ticker {
  group: THREE.Group;
  /** Opacité courante (0 à 1), pour les contrôles et le mode debug */
  opacity(): number;
}

export function buildStreetNames(
  labels: StreetLabel[] | undefined,
  heightAt: HeightFn,
  night: NightUniforms,
  cfg: StreetNamesConfig,
  view: { camera: THREE.Camera; focus: () => THREE.Vector3 },
  debug = false,
): StreetNames | null {
  if (!labels?.length) return null;
  const group = new THREE.Group();
  group.name = 'street-names';
  group.visible = false;

  let state: 'idle' | 'building' | 'ready' = 'idle';
  let material: THREE.MeshStandardMaterial | null = null;
  let current = 0;
  const uniforms = {
    uRight: { value: new THREE.Vector2(1, 0) },
    uInk: { value: new THREE.Color(cfg.ink) },
    uHalo: { value: new THREE.Color(cfg.halo) },
    uGlow: { value: 0 },
    uHaloEdge: { value: 0.5 - HALO_PX / (2 * SPREAD) },
  };

  const build = async () => {
    const t0 = performance.now();
    try {
      await document.fonts.load(`700 ${GLYPH_PX}px Inter`);
    } catch {
      /* police indisponible : la police système prend le relais */
    }
    const texts = labels.map((l) => l.text.toLocaleUpperCase('fr'));
    const chars = [...new Set(texts.join('').split(''))].filter((c) => c.trim());
    const { texture, glyphs, height } = buildGlyphAtlas(chars);

    const pos: number[] = [], flip: number[] = [], dir: number[] = [], uv: number[] = [], idx: number[] = [];
    labels.forEach((label, li) => {
      const text = texts[li];
      const th = (Math.PI * label.angle) / 180;
      const d = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)]; // plan : le long de la rue, et vers le haut du texte
      // Largeur du texte en em ; on réduit si la police réelle dépasse la place trouvée par le script
      const adv = [...text].map((c) => (c.trim() ? glyphs.get(c)!.adv : GLYPH_PX * 0.3) / GLYPH_PX);
      const totalEm = adv.reduce((s, a) => s + a, 0) + TRACKING * (text.length - 1);
      let k = label.size; // mètres par em
      if (totalEm * k > label.len * 1.12) k = (label.len * 1.12) / totalEm;
      const lift = roadLift(label.kind, label.bridge) + LIFT;
      // Hauteur de la chaussée près d'un point : le ruban de la rue relie en ligne droite des sommets posés sur
      // le sol tous les 4 m, aux deux bords ; il passe donc au-dessus du terrain dans un creux, et au-dessous sur
      // une bosse. Le nom se pose au plus haut des sommets voisins, pour n'être ni recouvert ni enfoncé.
      const half = label.w / 2;
      const surface = (a: number, b: number) => {
        let top = -Infinity;
        for (const da of [-RIBBON_STEP, 0, RIBBON_STEP]) {
          for (const db of [-half, half]) {
            const aa = a + da, bb = db; // en travers : les bords de la rue, pas la position de la lettre
            top = Math.max(top, heightAt(label.pos[0] + d[0] * aa + n[0] * bb, label.pos[1] + d[1] * aa + n[1] * bb));
          }
        }
        top = Math.max(top, heightAt(label.pos[0] + d[0] * a + n[0] * b, label.pos[1] + d[1] * a + n[1] * b));
        return top + lift;
      };
      let pen = -(totalEm * k) / 2; // abscisse (m) du début de la lettre, depuis le centre
      [...text].forEach((c, i) => {
        const step = (adv[i] + TRACKING) * k;
        const g = c.trim() ? glyphs.get(c)! : null;
        if (g) {
          const x0 = pen - (SPREAD / GLYPH_PX) * k, x1 = x0 + (g.w / GLYPH_PX) * k; // la case entière, marges comprises
          const hh = (g.h / GLYPH_PX / 2) * k;
          // Une lettre est découpée en carreaux (≈ 1,2 m) dont chaque sommet prend l'altitude de la chaussée :
          // sur une pente qui se courbe, une plaque plate à quatre coins passerait sous le terrain
          const sx = Math.max(1, Math.ceil((x1 - x0) / 1.2)), sy = 1;
          const base = pos.length / 3;
          for (let j = 0; j <= sy; j++) {
            for (let i2 = 0; i2 <= sx; i2++) {
              const a = x0 + ((x1 - x0) * i2) / sx, b = -hh + (2 * hh * j) / sy;
              const px = label.pos[0] + d[0] * a + n[0] * b, py = label.pos[1] + d[1] * a + n[1] * b;
              pos.push(px, surface(a, b), -py);
              // même sommet après une rotation de 180° autour du centre du nom
              flip.push(2 * label.pos[0] - px, surface(-a, -b), -(2 * label.pos[1] - py));
              dir.push(d[0], -d[1]); // sens de lecture dans le repère de la scène (x, z)
              uv.push((g.x + (i2 / sx) * g.w) / ATLAS_W, (g.y + (1 - j / sy) * g.h) / height);
            }
          }
          // face vers le haut : (A, B, C) puis (C, B, D) pour chaque carreau
          for (let j = 0; j < sy; j++) {
            for (let i2 = 0; i2 < sx; i2++) {
              const A = base + j * (sx + 1) + i2, B = A + 1, C = A + sx + 1, D = C + 1;
              idx.push(A, B, C, C, B, D);
            }
          }
        }
        pen += step;
      });
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('posFlip', new THREE.Float32BufferAttribute(flip, 3));
    geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 2));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const up = new Float32Array(pos.length);
    for (let i = 1; i < up.length; i += 3) up[i] = 1;
    geo.setAttribute('normal', new THREE.BufferAttribute(up, 3));
    geo.setIndex(idx);

    material = new THREE.MeshStandardMaterial({ map: texture, transparent: true, opacity: 0, roughness: 1, metalness: 0, depthWrite: false });
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, uniforms);
      shader.vertexShader = shader.vertexShader
        .replace('void main() {', 'attribute vec3 posFlip;\nattribute vec2 aDir;\nuniform vec2 uRight;\nvoid main() {')
        .replace('#include <begin_vertex>', 'vec3 transformed = dot( aDir, uRight ) < 0.0 ? posFlip : position;');
      shader.fragmentShader = shader.fragmentShader
        .replace('void main() {', 'uniform vec3 uInk;\nuniform vec3 uHalo;\nuniform float uGlow;\nuniform float uHaloEdge;\nvoid main() {')
        .replace('#include <map_fragment>', `
          float sd = texture2D( map, vMapUv ).r;
          float aa = max( fwidth( sd ) * 0.75, 0.002 );
          float fill = smoothstep( 0.5 - aa, 0.5 + aa, sd );
          float rim = smoothstep( uHaloEdge - aa, uHaloEdge + aa, sd );
          vec3 glyphCol = mix( uHalo, uInk, fill );
          diffuseColor.rgb *= glyphCol;
          diffuseColor.a *= rim;`)
        .replace('#include <emissivemap_fragment>', 'totalEmissiveRadiance += glyphCol * rim * uGlow;');
    };
    // Au-dessus des rubans de rue sur les pentes (même principe que city.ts, un cran plus fort)
    material.polygonOffset = true;
    material.polygonOffsetFactor = -4;
    material.polygonOffsetUnits = -4;
    const mesh = new THREE.Mesh(geo, material);
    mesh.name = 'street-names-mesh';
    mesh.renderOrder = 2; // après les rues, avant les étiquettes (10)
    mesh.frustumCulled = false;
    group.add(mesh);
    state = 'ready';
    if (debug) console.info(`[noms de rues] ${labels.length} noms, ${chars.length} lettres, atlas ${ATLAS_W}×${height} (${Math.round((ATLAS_W * height * 4 * 1.33) / 1048576)} Mo), ${pos.length / 3} sommets, construit en ${Math.round(performance.now() - t0)} ms`);
  };

  const update = () => {
    const d = view.camera.position.distanceTo(view.focus());
    if (state === 'idle' && d < cfg.fadeStart + PREBUILD) { state = 'building'; void build(); }
    // 0 au-delà de fadeStart, 1 en deçà de fadeEnd, fondu progressif entre les deux
    const raw = THREE.MathUtils.clamp((cfg.fadeStart - d) / Math.max(1, cfg.fadeStart - cfg.fadeEnd), 0, 1);
    current = state === 'ready' ? THREE.MathUtils.smoothstep(raw, 0, 1) : 0;
    const show = current > 0.01 && !!material;
    group.visible = show;
    if (show && material) {
      material.opacity = current;
      uniforms.uGlow.value = night.uNight.value * cfg.nightGlow;
      // côté droit de l'écran, projeté sur le sol : un nom se lit dans le sens où il va vers cette direction
      const e = view.camera.matrixWorld.elements;
      const len = Math.hypot(e[0], e[2]) || 1;
      uniforms.uRight.value.set(e[0] / len, e[2] / len);
    }
  };

  return { group, update, opacity: () => current };
}
