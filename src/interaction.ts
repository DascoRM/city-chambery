import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { Place, PlacedPoi, Ticker } from './types';
import type { Hunt } from './game/hunt';
import { screenRay } from './scene/geo';
import { installTwoFingerGestures } from './scene/touch';

/** Ce qui est sous la souris ou le doigt : un lieu d'histoire, un bar / café / restaurant, ou rien */
export type Hit = { poi: PlacedPoi } | { place: Place; index: number } | null;

/** Outil de placement (dev uniquement, src/dev/placement.ts) : il passe avant tout le reste */
export interface PlacementTool {
  handleClick(x: number, y: number): boolean;
  isActive(): boolean;
}

export interface InteractionOptions {
  canvas: HTMLCanvasElement;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  /** Rectangle du canevas à l'écran (mis en cache par main.ts) */
  canvasRect(): DOMRect;
  pois: PlacedPoi[];
  /** Zones de clic fixes des épingles (une catégorie masquée passe à l'échelle 0) */
  targets: THREE.Object3D[];
  /** Sol et bâtiments : point visé par le double toucher */
  ground: THREE.Object3D;
  zoomTo(p: THREE.Vector3): void;
  hunt: Hunt | null;
  placement: PlacementTool | null;
  tooltip(text: string | null, x?: number, y?: number): void;
  /** Clic ou toucher (hors éléphant et outil de placement) */
  onSelect(hit: Hit): void;
  /** Souris qui survole (hors éléphant) */
  onHover(hit: Hit, x: number, y: number): void;
  /** Souris qui quitte la carte */
  onLeave(): void;
}

/**
 * Sélection à la souris / au doigt : clic, survol, double toucher (zoom), gestes à deux doigts.
 * Renvoie le module à animer : le survol est traité une fois par image, pas à chaque mouvement de souris.
 */
export function installInteraction(o: InteractionOptions): Ticker {
  const { canvas, camera, controls, hunt, placement } = o;
  const raycaster = new THREE.Raycaster();

  const pick = (clientX: number, clientY: number): Hit => {
    const hit = screenRay(raycaster, camera, o.canvasRect(), clientX, clientY).intersectObjects(o.targets, false)[0];
    if (!hit) return null;
    if (hit.object.userData.poiId) return { poi: o.pois.find((p) => p.id === hit.object.userData.poiId)! };
    const places = hit.object.userData.places as Place[] | undefined;
    if (places && hit.instanceId !== undefined) return { place: places[hit.instanceId], index: hit.instanceId };
    return null;
  };

  // Tactile : gestes à deux doigts (pincer, tourner, incliner) ; un doigt = déplacer (stage.ts)
  installTwoFingerGestures(canvas, camera, controls);
  // Double toucher : zoom vers l'endroit touché
  let lastTap: { t: number; x: number; y: number } | null = null;
  const zoomAtScreen = (clientX: number, clientY: number) => {
    const hit = screenRay(raycaster, camera, o.canvasRect(), clientX, clientY).intersectObject(o.ground, true)[0];
    o.zoomTo(hit ? hit.point : controls.target.clone()); // hors du socle : zoom sur le centre de la vue
  };

  let down: { x: number; y: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
  canvas.addEventListener('pointerup', (e) => {
    if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    if (e.pointerType === 'touch') {
      const now = performance.now();
      if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) {
        lastTap = null;
        zoomAtScreen(e.clientX, e.clientY);
        return;
      }
      lastTap = { t: now, x: e.clientX, y: e.clientY };
    }
    if (placement?.handleClick(e.clientX, e.clientY)) return;
    if (hunt?.click(e.clientX, e.clientY)) { o.tooltip(null); return; }
    o.onSelect(pick(e.clientX, e.clientY));
  });
  let hoverQueued: PointerEvent | null = null;
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') hoverQueued = e;
  });
  canvas.addEventListener('pointerleave', () => {
    o.tooltip(null);
    o.onLeave();
  });

  return {
    update() {
      if (!hoverQueued) return;
      const e = hoverQueued;
      hoverQueued = null;
      if (placement?.isActive()) return o.tooltip(null);
      // L'éléphant d'abord : survolé, il fuit (ou, épuisé, attend le clic)
      const el = hunt?.pointerMove(e.clientX, e.clientY);
      if (el) {
        canvas.style.cursor = 'pointer';
        o.tooltip(el.state() === 'tired' ? '🐘 Épuisé ! Clique pour le ramener à la fontaine' : null, e.clientX, e.clientY);
        return;
      }
      const h = pick(e.clientX, e.clientY);
      canvas.style.cursor = h ? 'pointer' : 'grab';
      o.onHover(h, e.clientX, e.clientY);
    },
  };
}
