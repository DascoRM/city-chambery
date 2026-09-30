import * as THREE from 'three';
import type { Mascot, MascotMode } from '../scene/mascot';
import type { Pt } from '../types';

/**
 * Mini-jeu « Attrape l'éléphant » (itération 34).
 *
 * - La souris (ou le doigt) qui s'approche de l'éléphant le fait fuir, plus vite qu'en promenade.
 * - Cliquer sur lui sans l'avoir coincé le fait sprinter.
 * - Le but : le pousser dans un cul-de-sac (ou un coin où toutes les issues passent par la souris).
 *   Coincé, il rebondit sur place pendant quelques secondes : un clic l'attrape et rapporte des points.
 *
 * Ce module traduit la souris en position sur la carte et gère le score ; les déplacements et
 * les animations sont dans scene/mascot.ts.
 */
export interface CatchGame {
  /** Mouvement de la souris (coordonnées écran) ; renvoie true si elle survole l'éléphant */
  pointerMove(clientX: number, clientY: number): boolean;
  /** Toucher sur mobile : la menace reste là un court instant */
  touch(clientX: number, clientY: number): void;
  pointerLeave(): void;
  /** Clic : renvoie true si le clic concernait l'éléphant (on ne l'utilise pas pour autre chose) */
  click(clientX: number, clientY: number): boolean;
  update(dt: number): void;
}

export function createCatchGame(opts: {
  mascot: Mascot;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  /** Points déjà gagnés */
  points: number;
  /** Points par capture (mascot.json, game.points) */
  gain: number;
  onScore(total: number, gained: number): void;
  onMode(mode: MascotMode): void;
}): CatchGame {
  const { mascot, camera, canvas } = opts;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitV = new THREE.Vector3();
  let total = opts.points;
  let touchLeft = 0;
  let lastMode: MascotMode = mascot.mode();

  const ray = (clientX: number, clientY: number) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
  };
  /** Point de la carte sous la souris, à l'altitude de l'éléphant (plan horizontal : pas besoin du relief) */
  const worldAt = (clientX: number, clientY: number): Pt | null => {
    ray(clientX, clientY);
    plane.constant = -mascot.height();
    if (!raycaster.ray.intersectPlane(plane, hitV)) return null;
    return [hitV.x, -hitV.z];
  };
  const onElephant = (clientX: number, clientY: number) => {
    if (!mascot.group.visible) return false;
    ray(clientX, clientY);
    return raycaster.intersectObject(mascot.hit, false).length > 0;
  };

  return {
    pointerMove(x, y) {
      touchLeft = 0;
      const over = onElephant(x, y);
      // Survol direct : il fuit même si le point au sol calculé est un peu loin (vue rasante)
      mascot.setThreat(over ? mascot.position() : worldAt(x, y));
      return over;
    },
    touch(x, y) {
      touchLeft = 1.5;
      mascot.setThreat(onElephant(x, y) ? mascot.position() : worldAt(x, y));
    },
    pointerLeave() {
      if (touchLeft <= 0) mascot.setThreat(null);
    },
    click(x, y) {
      if (!onElephant(x, y)) return false;
      if (mascot.tryCatch()) {
        const gained = opts.gain;
        total += gained;
        opts.onScore(total, gained);
      }
      return true;
    },
    update(dt) {
      if (touchLeft > 0) {
        touchLeft -= dt;
        if (touchLeft <= 0) mascot.setThreat(null);
      }
      const m = mascot.mode();
      if (m !== lastMode) {
        lastMode = m;
        opts.onMode(m);
      }
    },
  };
}
