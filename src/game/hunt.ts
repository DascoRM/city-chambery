import * as THREE from 'three';
import type { Herd, Elephant, MascotConfig } from '../scene/mascot';
import type { Particles } from '../scene/particles';
import { screenRay } from '../scene/geo';

/**
 * Mini-jeu « Ramène les éléphants à la fontaine » (itération 35).
 *
 * Les quatre éléphants de la fontaine se sont échappés et se promènent dans les rues.
 * - La souris sur un éléphant le fait sursauter et trotter plus vite (itération 37).
 * - Un clic (ou un toucher) le fait **sprinter** quelques secondes, en se moquant de vous dans une bulle, puis
 *   il s'arrête (itération 65 : plus de disparition ni de nombre de fuites).
 * - Un 2e clic **pendant le sprint** l'attrape (avec la probabilité `catchChance`, sinon il se moque) : il s'envole
 *   vers sa place sur la fontaine, se change en bronze dans une gerbe d'étincelles, et un feu d'artifice part.
 *   Points à chaque éléphant, bonus quand la fontaine est complète.
 * - Fontaine complète : grand feu d'artifice ; après `restartSeconds`, ils s'échappent de nouveau.
 * La partie en cours est gardée dans le navigateur (src/state/herd.ts).
 */
export interface Hunt {
  /** Souris qui bouge (coordonnées écran) ; renvoie l'éléphant survolé, s'il y en a un */
  pointerMove(clientX: number, clientY: number): Elephant | null;
  /** Clic ou toucher ; renvoie true si le geste concernait un éléphant */
  click(clientX: number, clientY: number): boolean;
  update(dt: number): void;
  /** Bulle affichée, statue qui sort du socle, éléphant qui disparaît ou qui vole */
  moving(): boolean;
}

export interface HuntOptions {
  herd: Herd;
  camera: THREE.Camera;
  /** Rectangle du canevas à l'écran (mis en cache par main.ts : pas de relecture à chaque image) */
  canvasRect(): DOMRect;
  /** Les quatre éléphants de bronze de la fontaine, dans l'ordre des places */
  slots: THREE.Object3D[];
  smoke: Particles;
  sparks: Particles;
  fireworks: { launch(from: THREE.Vector3, delay?: number, big?: boolean): void };
  returned: Set<number>;
  points: number;
  /** Réglages du jeu (src/content/mascot.json, bloc game) */
  game: Pick<MascotConfig['game'], 'points' | 'bonus' | 'restartSeconds' | 'bubbleSeconds' | 'taunts' | 'missTaunts' | 'catchChance'>;
  /** Bulle de texte ancrée sur un point de la scène */
  bubble(text: string | null, x?: number, y?: number): void;
  onReturned(returned: Set<number>): void;
  onScore(total: number, gained: number, text: string): void;
  onRestart(): void;
  flyTo(x: number, z: number): void;
  /** Quelques secondes après l'arrivée sur la fontaine : la caméra peut revenir (mode balade) */
  release?(): void;
}

export function createHunt(o: HuntOptions): Hunt {
  const { herd, camera } = o;
  const raycaster = new THREE.Raycaster();
  const tmp = new THREE.Vector3();
  let total = o.points;
  let restartIn = -1;
  let bubbleAt: THREE.Vector3 | null = null;
  let bubbleLeft = 0;
  /** L'éléphant qui parle : la bulle le suit pendant son sprint */
  let bubbleOf: Elephant | null = null;
  /** Places qui apparaissent (transformation en bronze) : temps écoulé depuis l'arrivée */
  const pops = new Map<number, number>();

  // Partie sauvegardée : les éléphants déjà ramenés restent sur la fontaine
  herd.elephants.forEach((e) => {
    const home = o.returned.has(e.id);
    if (home) e.setHome();
    if (o.slots[e.id]) o.slots[e.id].visible = home;
  });

  const pickElephant = (clientX: number, clientY: number): Elephant | null => {
    const hits = screenRay(raycaster, camera, o.canvasRect(), clientX, clientY).intersectObjects(herd.elephants.filter((e) => e.group.visible).map((e) => e.hit), false);
    const id = hits[0]?.object.userData.elephant as number | undefined;
    return id === undefined ? null : herd.elephants[id];
  };

  const showBubble = (text: string, e: Elephant) => {
    bubbleOf = e;
    bubbleAt = new THREE.Vector3(e.position()[0], e.height() + 6, -e.position()[1]);
    bubbleLeft = o.game.bubbleSeconds;
    o.bubble(text);
  };

  const pick = (list: string[], fallback: string) => list[Math.floor(Math.random() * list.length)] ?? fallback;

  /** Premier clic : il détale (un peu de poussière) et se moque de vous */
  const chase = (e: Elephant) => {
    if (!e.sprint()) return;
    const at = new THREE.Vector3(e.position()[0], e.height(), -e.position()[1]);
    o.smoke.emit(at.clone().setY(at.y + 1), { count: 18, speed: [1, 3], up: 1, life: [0.6, 1.1], size: 1.8, grow: 1.4, colors: ['#f3efe6', '#e2dccf', '#cfc7b8'], drag: 2.5, spread: 1.2 });
    showBubble(pick(o.game.taunts, 'Trop lent !'), e);
  };

  /** Deuxième clic pendant le sprint : il s'envole vers sa place sur la fontaine (ou il se moque) */
  const grab = (e: Elephant) => {
    if (Math.random() >= o.game.catchChance) {
      showBubble(pick(o.game.missTaunts, 'Raté !'), e);
      return;
    }
    const slot = o.slots[e.id];
    const target = slot ? new THREE.Box3().setFromObject(slot, true).getCenter(new THREE.Vector3()) : e.group.position.clone();
    if (slot) {
      // La place n'est pas encore visible : on vise le centre de sa forme
      slot.visible = true;
      new THREE.Box3().setFromObject(slot, true).getCenter(target);
      slot.visible = false;
    }
    e.catchTo(target, () => land(e));
    o.bubble(null);
    bubbleAt = null;
    bubbleOf = null;
    o.flyTo(target.x, target.z);
  };

  const land = (e: Elephant) => {
    const slot = o.slots[e.id];
    const center = slot ? new THREE.Box3().setFromObject(slot, true).getCenter(new THREE.Vector3()) : tmp;
    if (slot) {
      slot.visible = true;
      slot.scale.setScalar(0.01);
      pops.set(e.id, 0);
    }
    o.sparks.emit(center, { count: 70, speed: [3, 7], up: 2, life: [0.6, 1.2], size: 0.8, colors: ['#ffd23f', '#fff3b0', '#e8a33d'], gravity: 4, drag: 1.5, spread: 1 });
    o.returned.add(e.id);
    o.onReturned(o.returned);
    const base = center.clone().setY(center.y - 2);
    const complete = o.returned.size >= herd.elephants.length;
    let gained = o.game.points;
    if (complete) gained += o.game.bonus;
    total += gained;
    o.onScore(total, gained, complete
      ? `🎉 La fontaine est complète ! Les Quatre sans cul sont de retour · +${gained} points`
      : `🐘 De retour sur la fontaine ! ${o.returned.size} / ${herd.elephants.length} · +${gained} points`);
    for (let i = 0; i < (complete ? 3 : 2); i++) o.fireworks.launch(base, i * 0.35);
    window.setTimeout(() => o.release?.(), 2500); // le temps du feu d'artifice
    if (complete) {
      for (let i = 0; i < 12; i++) o.fireworks.launch(base, 1 + i * 0.4, true);
      restartIn = o.game.restartSeconds;
    }
  };

  return {
    pointerMove(x, y) {
      const e = pickElephant(x, y);
      if (e?.state() === 'walk') e.startle();
      return e;
    },
    click(x, y) {
      const e = pickElephant(x, y);
      if (!e) return false;
      if (e.state() === 'walk') chase(e);
      else if (e.state() === 'sprint') grab(e);
      return true;
    },
    moving: () => bubbleAt !== null || pops.size > 0 || herd.elephants.some((e) => e.state() === 'sprint' || e.state() === 'flying'),
    update(dt) {
      // Bulle : suit son point d'ancrage à l'écran, puis s'efface
      if (bubbleAt) {
        bubbleLeft -= dt;
        if (bubbleOf && bubbleOf.state() === 'sprint') bubbleAt.set(bubbleOf.position()[0], bubbleOf.height() + 6, -bubbleOf.position()[1]);
        if (bubbleLeft <= 0) { bubbleAt = null; bubbleOf = null; o.bubble(null); }
        else {
          tmp.copy(bubbleAt).project(camera);
          const r = o.canvasRect();
          if (tmp.z < 1) o.bubble('', r.left + ((tmp.x + 1) / 2) * r.width, r.top + ((1 - tmp.y) / 2) * r.height);
          else o.bubble('', -9999, -9999);
        }
      }
      // Transformation en bronze : la statue sort du socle avec un rebond
      for (const [id, t0] of pops) {
        const t = t0 + dt;
        const k = Math.min(1, t / 0.7);
        const s = k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + 0.3 * Math.sin(k * Math.PI)) : 1;
        o.slots[id].scale.setScalar(Math.max(0.01, s));
        if (k >= 1) pops.delete(id); else pops.set(id, t);
      }
      // Fontaine complète : après un moment, ils s'échappent de nouveau
      if (restartIn > 0) {
        restartIn -= dt;
        if (restartIn <= 0) {
          herd.elephants.forEach((e) => {
            const slot = o.slots[e.id];
            if (slot) {
              const c = new THREE.Box3().setFromObject(slot, true).getCenter(new THREE.Vector3());
              o.smoke.emit(c, { count: 30, speed: [1, 3], up: 1, life: [0.8, 1.3], size: 2, grow: 1.5, colors: ['#f3efe6', '#e2dccf'], drag: 2.5, spread: 1 });
              slot.visible = false;
            }
            e.release();
          });
          o.returned.clear();
          o.onReturned(o.returned);
          o.onRestart();
        }
      }
    },
  };
}
