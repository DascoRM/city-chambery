import * as THREE from 'three';
import type { CityData, Pt, Ticker } from '../types';
import { pointInPoly } from './geo';

/**
 * Drapeaux (EP001-US006) : seulement le château et l'hôtel de ville (décision de Dasco), chacun avec une source :
 * l'ancrage OSM `chateau`, et le bâtiment OSM de l'hôtel de ville. Motif « savoie » : croix blanche sur fond rouge.
 *
 * Le mât est posé sur le point le plus haut du bâtiment (ou du monument modélisé) près de l'emplacement : un rayon
 * vertical est lancé sur une petite grille autour du point, on garde le plus haut. Le drapeau flotte dans le sens
 * du vent (le même que la fumée des cheminées), avec des ondulations qui partent du mât (dans le shader).
 * Pas d'ombre propre pour le tissu (il bouge) ; pas une cible de clic ; ne force pas la pleine vitesse.
 */
export interface FlagSpec {
  id: string;
  /** Ancrage OSM (data.anchors) ou identifiant de bâtiment OSM : l'un des deux */
  anchor?: string;
  building?: number;
  design: 'savoie';
  /** Hauteur du mât au-dessus du toit (m) et largeur du drapeau (m) */
  mast: number;
  width: number;
}

/** Drapeau de la Savoie : croix blanche pleine sur fond rouge (proportions 2:3) */
function savoieTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 192; c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#d2232a';
  g.fillRect(0, 0, 192, 128);
  g.fillStyle = '#ffffff';
  const t = 26; // épaisseur de la croix
  g.fillRect(0, (128 - t) / 2, 192, t);
  g.fillRect((192 - t) / 2, 0, t, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function buildFlags(
  specs: FlagSpec[], data: CityData,
  ctx: { targets: THREE.Object3D[]; wind: { towards: number; speed: number } },
): (Ticker & { group: THREE.Group; placed: { id: string; x: number; y: number; top: number }[] }) | null {
  const group = new THREE.Group();
  group.name = 'flags';
  const placed: { id: string; x: number; y: number; top: number }[] = [];
  const ray = new THREE.Raycaster();
  const down = new THREE.Vector3(0, -1, 0);
  for (const t of ctx.targets) t.updateMatrixWorld(true);
  /** Point le plus haut des objets visés sur une grille de rayon r autour de (x, y) (dans un contour si donné) */
  const highest = (x: number, y: number, r: number, ring?: { outer: Pt[]; holes: Pt[][] }) => {
    let best: { x: number; y: number; h: number } | null = null;
    for (let i = -4; i <= 4; i++)
      for (let j = -4; j <= 4; j++) {
        const px = x + (i / 4) * r, py = y + (j / 4) * r;
        if (ring && !pointInPoly(px, py, ring)) continue;
        ray.set(new THREE.Vector3(px, 500, -py), down);
        const hit = ray.intersectObjects(ctx.targets, true).find((h) => (h.object as THREE.Mesh).isMesh && h.object.visible);
        if (hit && (!best || hit.point.y > best.h + 0.05)) best = { x: px, y: py, h: hit.point.y };
      }
    return best;
  };

  const tex = savoieTexture();
  const uniforms = { uTime: { value: 0 }, uStrength: { value: 1 } };
  const clothMat = new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide, roughness: 0.8 });
  clothMat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uStrength;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        // Ondulation : nulle au mât (x = 0), plus forte au bord libre ; vagues qui partent du mât
        float k = clamp(position.x / FLAG_W, 0.0, 1.0);
        float w = sin(position.x * 2.4 - uTime * 6.0) * 0.18 + sin(position.x * 4.1 - uTime * 8.3 + position.y * 2.0) * 0.07;
        transformed.z += w * k * uStrength;
        transformed.y -= 0.12 * k * k * (1.2 - uStrength); // le bord libre retombe un peu quand le vent faiblit`);
  };
  clothMat.customProgramCacheKey = () => 'flag-cloth';
  const poleMat = new THREE.MeshStandardMaterial({ color: '#e8e4dc', metalness: 0.4, roughness: 0.4 });
  const windAngle = (ctx.wind.towards * Math.PI) / 180;

  for (const s of specs) {
    let x: number, y: number, ring: { outer: Pt[]; holes: Pt[][] } | undefined;
    if (s.building !== undefined) {
      const b = data.buildings.find((bb) => bb.id === s.building);
      if (!b) { console.warn(`[drapeaux] bâtiment ${s.building} introuvable (${s.id})`); continue; }
      ring = b;
      x = b.outer.reduce((t, p) => t + p[0], 0) / b.outer.length;
      y = b.outer.reduce((t, p) => t + p[1], 0) / b.outer.length;
    } else if (s.anchor && data.anchors[s.anchor]) {
      [x, y] = data.anchors[s.anchor].pos;
    } else { console.warn(`[drapeaux] « ${s.id} » sans emplacement`); continue; }
    const top = highest(x, y, ring ? 12 : 9, ring);
    if (!top) { console.warn(`[drapeaux] « ${s.id} » : aucun toit trouvé`); continue; }

    const W = s.width, H = W * (2 / 3);
    const flag = new THREE.Group();
    flag.name = `flag-${s.id}`;
    flag.position.set(top.x, top.h, -top.y);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, s.mast, 8).translate(0, s.mast / 2, 0), poleMat);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8).translate(0, s.mast + 0.1, 0), poleMat);
    pole.castShadow = knob.castShadow = true;
    // Tissu : plan subdivisé, bord gauche contre le mât, tourné dans le sens du vent (+X local = sous le vent)
    const geo = new THREE.PlaneGeometry(W, H, 16, 6).translate(W / 2, s.mast - H / 2 - 0.15, 0);
    const mat = clothMat.clone();
    mat.onBeforeCompile = (shader, r) => { clothMat.onBeforeCompile(shader, r); shader.vertexShader = shader.vertexShader.replace('FLAG_W', W.toFixed(2)); };
    mat.customProgramCacheKey = () => `flag-cloth-${W}`;
    const cloth = new THREE.Mesh(geo, mat);
    cloth.rotation.y = windAngle; // Three.js : rotation autour de Y depuis +X vers -Z = vers le nord, comme l'angle du vent
    cloth.castShadow = false;
    flag.add(pole, knob, cloth);
    group.add(flag);
    placed.push({ id: s.id, x: top.x, y: top.y, top: top.h });
  }
  if (!placed.length) return null;

  let t = 0;
  return {
    group, placed,
    update(dt) {
      t += dt;
      uniforms.uTime.value = t;
      // Vent qui varie lentement : le drapeau claque plus ou moins
      uniforms.uStrength.value = 0.75 + 0.25 * Math.sin(t * 0.35) + 0.1 * Math.sin(t * 1.3);
    },
  };
}
