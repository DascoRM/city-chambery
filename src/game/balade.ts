import type { Pt, Ticker } from '../types';
import type { Avatar } from '../scene/avatar';
import type { RouteFail } from '../scene/avatar-path';
import type { createStage } from '../scene/stage';

/**
 * Mode balade (EP005-US003) : un mode explicite et exclusif, où l'on dirige un avatar et où la caméra le suit.
 * Il possède la caméra tant qu'il est actif : suivi, limites de zoom propres, pas de vol vers les fiches.
 * La carte libre (limites, interface, gestes) revient telle quelle à la sortie.
 */
export interface BaladeConfig {
  camera: {
    /** Distance (m) et inclinaison (degrés depuis la verticale) à l'entrée */
    distance: number;
    polar: number;
    /** Limites de zoom du mode (m) */
    minDistance: number;
    maxDistance: number;
    /** Vitesse de rattrapage de la caméra (1/s) */
    follow: number;
  };
}

export interface BaladeUi {
  setBalade(active: boolean): void;
  /** Bouton « Retrouver mon avatar » */
  setRecenter(visible: boolean): void;
  flash(text: string): void;
}

export interface Balade extends Ticker {
  active(): boolean;
  enter(): void;
  leave(): void;
  toggle(): void;
  /** Ordre de marche vers un point du plan (m) ; false si refusé */
  goTo(x: number, y: number, onArrive?: () => void): boolean;
  recenter(): void;
}

type Stage = ReturnType<typeof createStage>;

export function createBalade(cfg: BaladeConfig, stage: Stage, avatar: Avatar, canvas: HTMLElement, start: Pt, ui: BaladeUi): Balade {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rate = reduced ? cfg.camera.follow * 2 : cfg.camera.follow;
  let on = false;
  let following = true;
  let saved: { min: number; max: number } | null = null;

  // Déplacer la carte (clic droit glissé, un doigt glissé) arrête le suivi sans quitter le mode
  const pointers = new Map<number, { x: number; y: number; moved: boolean }>();
  canvas.addEventListener('pointerdown', (e) => pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, moved: false }));
  const forget = (e: PointerEvent) => { pointers.delete(e.pointerId); };
  window.addEventListener('pointerup', forget);
  window.addEventListener('pointercancel', forget);
  window.addEventListener('pointermove', (e) => {
    if (!on || !following) return;
    const p = pointers.get(e.pointerId);
    if (!p || p.moved || Math.hypot(e.clientX - p.x, e.clientY - p.y) <= 6) return;
    p.moved = true;
    const pan = e.pointerType === 'mouse' ? (e.buttons & 2) !== 0 : pointers.size === 1;
    if (pan) { following = false; ui.setRecenter(true); }
  });

  const enter = () => {
    if (on) return;
    on = true;
    following = true;
    if (!avatar.position()) avatar.place(start[0], start[1]);
    const [x, y] = avatar.position()!;
    saved = stage.limits();
    stage.setLimits(cfg.camera.minDistance, cfg.camera.maxDistance);
    stage.flyToView(x, -y, cfg.camera.distance, cfg.camera.polar);
    ui.setBalade(true);
    ui.setRecenter(false);
  };

  const leave = () => {
    if (!on) return;
    on = false;
    avatar.stop();
    if (saved) stage.setLimits(saved.min, saved.max);
    // Les limites de la carte libre reviennent : si la caméra est plus près que leur minimum, elle recule par un vol
    stage.zoomTo(stage.controls.target, 1);
    ui.setBalade(false);
    ui.setRecenter(false);
  };

  const recenter = () => { following = true; ui.setRecenter(false); };

  return {
    active: () => on,
    enter, leave,
    toggle: () => (on ? leave() : enter()),
    recenter,
    goTo(x, y, onArrive) {
      if (!on) return false;
      const r: true | RouteFail = avatar.goTo(x, y, onArrive);
      if (r !== true) { ui.flash(r === 'far' ? 'Pas par là' : 'Impossible d\'aller là'); return false; }
      recenter(); // un nouvel ordre ramène la caméra sur l'avatar
      return true;
    },
    moving: () => {
      const p = on && following ? avatar.position() : null;
      return !!p && stage.followGap(p[0], -p[1]) > 0.05;
    },
    update(dt) {
      if (!on || !following || stage.isFlying()) return;
      const p = avatar.position();
      if (p) stage.follow(p[0], -p[1], 1 - Math.exp(-dt * rate));
    },
  };
}
