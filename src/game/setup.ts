import * as THREE from 'three';
import type { Herd, MascotConfig } from '../scene/mascot';
import type { Ticker } from '../types';
import { createParticles, createFireworks } from '../scene/particles';
import { createHunt, type Hunt } from './hunt';
import { loadPoints, savePoints } from '../state/points';
import { loadReturned, saveReturned } from '../state/herd';

export interface GameUi {
  setPoints(n: number, gained?: number): void;
  setHerd(n: number, total: number): void;
  flash(text: string): void;
  bubble(text: string | null, x?: number, y?: number): void;
}

export interface GameSetupOptions {
  scene: THREE.Scene;
  camera: THREE.Camera;
  /** Rectangle du canevas à l'écran (mis en cache par main.ts) */
  canvasRect(): DOMRect;
  herd: Herd | null;
  /** La fontaine des éléphants (monument), qui porte les places `elephant-0`, `elephant-1`… */
  fountain: THREE.Object3D | undefined;
  game: MascotConfig['game'];
  ui: GameUi;
  flyTo(x: number, z: number): void;
}

/**
 * Mini-jeu « Ramène les éléphants à la fontaine » (itération 35) : points et partie sauvegardés,
 * places sur la fontaine, particules (fumée, étincelles, feux d'artifice) et message d'accueil.
 * Renvoie le jeu (null s'il est désactivé) et le module à animer, particules comprises.
 */
export function setupGame(o: GameSetupOptions): { hunt: Hunt | null; slots: THREE.Object3D[]; ticker: Ticker } {
  const { herd, ui } = o;
  let points = loadPoints();
  const returned = loadReturned();
  const herdTotal = herd?.elephants.length ?? 0;
  ui.setPoints(points);
  ui.setHerd(returned.size, herdTotal);
  const slots = Array.from({ length: o.game.count }, (_, i) => o.fountain?.getObjectByName(`elephant-${i}`))
    .filter((s): s is THREE.Object3D => !!s);
  if (herd && slots.length !== herdTotal) {
    console.warn(`[mini-jeu] désactivé : ${herdTotal} éléphants dans les rues, ${slots.length} places sur la fontaine`);
  }
  const smoke = createParticles(400, false);
  // Étincelles en mélange normal (et non additif) : visibles aussi de jour, sur fond clair
  const sparks = createParticles(3000, false);
  const fireworks = createFireworks(sparks);
  o.scene.add(smoke.points, sparks.points);
  const hunt: Hunt | null = herd && slots.length === herdTotal
    ? createHunt({
        herd, camera: o.camera, canvasRect: o.canvasRect, slots, smoke, sparks, fireworks, returned, points,
        game: o.game,
        bubble: ui.bubble,
        onReturned: (r) => { saveReturned(r); ui.setHerd(r.size, herdTotal); },
        onScore: (total, gained, text) => {
          points = total;
          savePoints(points);
          ui.setPoints(points, gained);
          ui.flash(text);
        },
        onRestart: () => ui.flash('🐘 Oh non ! Les éléphants se sont encore échappés…'),
        flyTo: o.flyTo,
      })
    : null;
  if (hunt && returned.size < herdTotal) {
    const left = herdTotal - returned.size;
    window.setTimeout(() => ui.flash(returned.size
      ? `🐘 Encore ${left} éléphant${left > 1 ? 's' : ''} à ramener à la fontaine`
      : '🐘 Les quatre éléphants de la fontaine se sont échappés ! Retrouve-les dans les rues'), 2500);
  }
  return {
    hunt,
    slots,
    ticker: {
      update(dt) {
        hunt?.update(dt);
        fireworks.update(dt);
        smoke.update(dt);
        sparks.update(dt);
      },
      moving: () => smoke.alive() > 0 || sparks.alive() > 0 || fireworks.pending() > 0 || !!hunt?.moving(),
    },
  };
}
