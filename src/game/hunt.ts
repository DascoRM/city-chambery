import * as THREE from 'three';
import type { Escape, Herd, Elephant } from '../scene/mascot';
import type { Particles } from '../scene/particles';
import type { Pt } from '../types';

/**
 * Mini-jeu « Ramène les éléphants à la fontaine » (itération 35).
 *
 * Les quatre éléphants de la fontaine se sont échappés et se promènent dans les rues.
 * - La souris sur un éléphant le fait sursauter et trotter plus vite (itération 37) ; cliquer dessus (ou le
 *   toucher) le fait disparaître dans un nuage : il nargue le joueur dans une bulle, avec un indice (la rue
 *   où il réapparaît, sinon la direction), puis réapparaît plus loin.
 * - Après 1 à 5 fuites (au hasard), il réapparaît épuisé : assis, des étoiles au-dessus de la tête.
 *   Un clic l'attrape : il s'envole vers sa place sur la fontaine, se change en bronze dans une gerbe
 *   d'étincelles, et un feu d'artifice part. Points à chaque éléphant, bonus quand la fontaine est complète.
 * - Fontaine complète : grand feu d'artifice ; après `restartSeconds`, ils s'échappent de nouveau.
 * La partie en cours est gardée dans le navigateur (src/state/herd.ts).
 */
export interface Hunt {
  /** Souris qui bouge (coordonnées écran) ; renvoie l'éléphant survolé, s'il y en a un */
  pointerMove(clientX: number, clientY: number): Elephant | null;
  /** Clic ou toucher ; renvoie true si le geste concernait un éléphant */
  click(clientX: number, clientY: number): boolean;
  update(dt: number): void;
}

export interface HuntOptions {
  herd: Herd;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  /** Les quatre éléphants de bronze de la fontaine, dans l'ordre des places */
  slots: THREE.Object3D[];
  smoke: Particles;
  sparks: Particles;
  fireworks: { launch(from: THREE.Vector3, delay?: number, big?: boolean): void };
  returned: Set<number>;
  points: number;
  gain: number;
  bonus: number;
  restartSeconds: number;
  /** Durée d'affichage de la bulle (s) */
  bubbleSeconds: number;
  taunts: string[];
  /** Bulle de texte ancrée sur un point de la scène */
  bubble(text: string | null, x?: number, y?: number): void;
  onReturned(returned: Set<number>): void;
  onScore(total: number, gained: number, text: string): void;
  onComplete(): void;
  onRestart(): void;
  flyTo(x: number, z: number): void;
}

const ARTICLE_F = /^(rue|place|avenue|allée|impasse|montée|promenade|route|ruelle|traverse|cour)\b/i;
const ARTICLE_M = /^(boulevard|quai|faubourg|chemin|passage|square|cours|pont|parvis|jardin|clos|carré)\b/i;
/** « Rue de Boigne » → « la rue de Boigne » ; nom sans type reconnu → entre guillemets */
function withArticle(name: string): string {
  const lower = name.charAt(0).toLowerCase() + name.slice(1);
  if (ARTICLE_F.test(name)) return `la ${lower}`;
  if (ARTICLE_M.test(name)) return `le ${lower}`;
  return `« ${name} »`;
}
const DIRS = ["l'est", 'le nord-est', 'le nord', 'le nord-ouest', "l'ouest", 'le sud-ouest', 'le sud', 'le sud-est'];
function direction(a: Pt, b: Pt): string {
  const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
  return DIRS[((Math.round(ang / (Math.PI / 4)) % 8) + 8) % 8];
}

export function createHunt(o: HuntOptions): Hunt {
  const { herd, camera, canvas } = o;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  let total = o.points;
  let restartIn = -1;
  let bubbleAt: THREE.Vector3 | null = null;
  let bubbleLeft = 0;
  /** Places qui apparaissent (transformation en bronze) : temps écoulé depuis l'arrivée */
  const pops = new Map<number, number>();

  // Partie sauvegardée : les éléphants déjà ramenés restent sur la fontaine
  herd.elephants.forEach((e) => {
    const home = o.returned.has(e.id);
    if (home) e.setHome();
    if (o.slots[e.id]) o.slots[e.id].visible = home;
  });

  const pickElephant = (clientX: number, clientY: number): Elephant | null => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(herd.elephants.filter((e) => e.group.visible).map((e) => e.hit), false);
    const id = hits[0]?.object.userData.elephant as number | undefined;
    return id === undefined ? null : herd.elephants[id];
  };

  const showBubble = (text: string, at: THREE.Vector3) => {
    bubbleAt = at;
    bubbleLeft = o.bubbleSeconds;
    o.bubble(text);
  };

  const escape = (e: Elephant) => {
    const esc: Escape | null = e.escape();
    if (!esc) return;
    const at = new THREE.Vector3(esc.from[0], e.height(), -esc.from[1]);
    o.smoke.emit(at.clone().setY(at.y + 2), { count: 40, speed: [1, 3.5], up: 1.5, life: [0.8, 1.4], size: 2.2, grow: 1.6, colors: ['#f3efe6', '#e2dccf', '#cfc7b8'], drag: 2.5, spread: 1.5 });
    const taunt = o.taunts[Math.floor(Math.random() * o.taunts.length)] ?? 'Raté !';
    const where = esc.road ? `vers ${withArticle(esc.road)}` : `vers ${direction(esc.from, esc.to)}`;
    const tail = esc.tired ? `Je file ${where}… mais je suis épuisé 😮‍💨` : `Je file ${where} 🐘`;
    showBubble(`${taunt}\n${tail}`, at.clone().setY(at.y + 6));
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
    let gained = o.gain;
    if (complete) gained += o.bonus;
    total += gained;
    o.onScore(total, gained, complete
      ? `🎉 La fontaine est complète ! Les Quatre sans cul sont de retour · +${gained} points`
      : `🐘 De retour sur la fontaine ! ${o.returned.size} / ${herd.elephants.length} · +${gained} points`);
    for (let i = 0; i < (complete ? 3 : 2); i++) o.fireworks.launch(base, i * 0.35);
    if (complete) {
      for (let i = 0; i < 12; i++) o.fireworks.launch(base, 1 + i * 0.4, true);
      o.onComplete();
      restartIn = o.restartSeconds;
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
      if (e.state() === 'walk') escape(e);
      else if (e.state() === 'tired') {
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
        o.flyTo(target.x, target.z);
      }
      return true;
    },
    update(dt) {
      // Bulle : suit son point d'ancrage à l'écran, puis s'efface
      if (bubbleAt) {
        bubbleLeft -= dt;
        if (bubbleLeft <= 0) { bubbleAt = null; o.bubble(null); }
        else {
          tmp.copy(bubbleAt).project(camera);
          const r = canvas.getBoundingClientRect();
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
