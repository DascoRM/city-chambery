import * as THREE from 'three';
import type { HeightFn, StreetLabel, Ticker } from '../types';
import type { NightUniforms } from './city';
import { roadLift } from './roads';

/**
 * Noms de rues peints au sol (EP002-US002 et US003).
 *
 * Tous les noms sont dessinés dans une seule texture (atlas) et posés sur un seul maillage : un appel de
 * rendu pour toute la ville. Chaque nom est un ruban qui épouse le relief le long de la rue (les
 * emplacements, l'angle et la taille viennent du script de données, `scripts/street-names.mjs`).
 *
 * Ils n'apparaissent qu'en zoomant : l'opacité dépend de la distance entre la caméra et le centre de
 * la vue (fondu continu, donc stable quand on ne bouge plus), et rien n'est ni construit ni dessiné
 * tant que la caméra est loin.
 */
export interface StreetNamesConfig {
  fadeStart: number;
  fadeEnd: number;
  nightGlow: number;
  ink: string;
  halo: string;
}

const FONT_FAMILY = 'Inter, system-ui, sans-serif';
const ATLAS_W = 2048;
const ATLAS_H = 2048;
const LIFT = 0.05; // au-dessus du ruban de la rue
const MAX_SEG = 3; // m : un ruban est redécoupé pour suivre la pente
const PREBUILD = 60; // m avant le début du fondu, on prépare la texture (sans la montrer)

interface Cell { label: StreetLabel; x: number; y: number; w: number; h: number }

/** Place tous les noms dans l'atlas (rangées successives) ; null si ça ne tient pas à cette taille de police. */
function pack(ctx: CanvasRenderingContext2D, labels: StreetLabel[], px: number): { cells: Cell[]; height: number } | null {
  ctx.font = `700 ${px}px ${FONT_FAMILY}`;
  const pad = Math.ceil(px * 0.2);
  const h = Math.ceil(px * 1.25) + pad * 2;
  const cells: Cell[] = [];
  let x = 0, y = 0;
  for (const label of labels) {
    const w = Math.ceil(ctx.measureText(label.text.toLocaleUpperCase('fr')).width) + pad * 2;
    if (w > ATLAS_W) return null;
    if (x + w > ATLAS_W) { x = 0; y += h; }
    if (y + h > ATLAS_H) return null;
    cells.push({ label, x, y, w, h });
    x += w;
  }
  return { cells, height: y + h };
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

  const build = async () => {
    try {
      await document.fonts.load(`700 40px Inter`);
    } catch {
      /* police indisponible : la police système prend le relais */
    }
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    // Plus grosse police qui tient dans l'atlas (mémoire d'abord : ≤ 2048 × 2048)
    let packed: ReturnType<typeof pack> = null;
    let px = 44;
    for (; px >= 20; px -= 4) {
      packed = pack(ctx, labels, px);
      if (packed) break;
    }
    if (!packed) { console.warn('[noms de rues] atlas trop petit, non affichés'); state = 'ready'; return; }
    canvas.width = ATLAS_W;
    canvas.height = packed.height;
    ctx.font = `700 ${px}px ${FONT_FAMILY}`;
    if ('letterSpacing' in ctx) (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${(px * 0.06).toFixed(1)}px`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    const pad = Math.ceil(px * 0.2);
    for (const c of packed.cells) {
      const text = c.label.text.toLocaleUpperCase('fr');
      ctx.lineWidth = px * 0.28;
      ctx.strokeStyle = cfg.halo;
      ctx.strokeText(text, c.x + c.w / 2, c.y + c.h / 2);
      ctx.fillStyle = cfg.ink;
      ctx.fillText(text, c.x + c.w / 2, c.y + c.h / 2);
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;

    const pos: number[] = [], uv: number[] = [], idx: number[] = [];
    for (const c of packed.cells) {
      const { label } = c;
      const th = (Math.PI * label.angle) / 180;
      const d = [Math.cos(th), Math.sin(th)], n = [-Math.sin(th), Math.cos(th)]; // dans le plan, n vers le haut du texte
      let k = label.size / px; // mètres par pixel
      // La police réelle est un peu plus large que l'estimation du script : on réduit pour tenir dans la rue
      const textW = (c.w - pad * 2) * k;
      if (textW > label.len * 1.12) k *= (label.len * 1.12) / textW;
      const W = c.w * k, H = c.h * k;
      const segs = Math.min(40, Math.max(1, Math.ceil(W / MAX_SEG)));
      const lift = roadLift(label.kind, label.bridge) + LIFT;
      const base = pos.length / 3;
      for (let i = 0; i <= segs; i++) {
        for (let j = 0; j <= 1; j++) {
          const u = i / segs, v = j;
          const a = (u - 0.5) * W, b = (v - 0.5) * H;
          const x = label.pos[0] + d[0] * a + n[0] * b;
          const y = label.pos[1] + d[1] * a + n[1] * b;
          pos.push(x, heightAt(x, y) + lift, -y);
          uv.push((c.x + u * c.w) / ATLAS_W, 1 - (c.y + (1 - v) * c.h) / canvas.height);
        }
      }
      for (let i = 0; i < segs; i++) {
        const a = base + i * 2, b = a + 1, cI = a + 2, dI = a + 3;
        idx.push(a, cI, b, b, cI, dI); // vers le haut
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
    geo.setIndex(idx);
    material = new THREE.MeshStandardMaterial({
      map: tex, transparent: true, opacity: 0, roughness: 1, metalness: 0, depthWrite: false,
      emissive: new THREE.Color(0xffffff), emissiveMap: tex, emissiveIntensity: 0,
    });
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
    if (debug) console.info(`[noms de rues] ${packed.cells.length} noms, atlas ${ATLAS_W}×${canvas.height}, police ${px} px, ${pos.length / 3} sommets`);
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
      material.emissiveIntensity = night.uNight.value * cfg.nightGlow;
    }
  };

  return { group, update, opacity: () => current };
}
