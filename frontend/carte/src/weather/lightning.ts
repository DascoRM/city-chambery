import * as THREE from 'three';

/**
 * Éclairs de l'orage (EP009-US008), dans le module météo. L'orage est déduit des codes 95 à 99 de la source (R1) : ces éclairs
 * sont un décor, jamais un relevé « en temps réel ».
 *  - Le planificateur (pur, testé sur 1 000 salves) décide quand ils tombent : des salves de 1 à 3 éclairs espacés d'au moins
 *    0,4 s (donc jamais plus de 3 par seconde, WCAG 2.3.1), 6 à 20 s entre deux salves, amplitude bornée, chaque éclair une seule
 *    impulsion qui décroît en 120 à 250 ms (pas de scintillement dans un éclair). Aucun avec le réduit-mouvement (effects.ts).
 *  - Le trait d'éclair : un ruban brisé de 32 segments, face à la caméra, au-delà du point regardé ; un appel de
 *    rendu pendant 150 ms. Son matériau (couleur unie, sans brouillard) a le même programme que les anneaux des lieux d'histoire :
 *    rien à compiler quand il apparaît.
 */
export const LIGHTNING = {
  /** Écart entre deux éclairs d'une salve (s) : au moins 0,4 s, donc au plus 3 éclairs par seconde */
  gap: [0.4, 0.9],
  /** Entre la fin d'une salve et le début de la suivante (s) */
  pause: [6, 20],
  /** Première salve après l'arrivée de l'orage (s) */
  first: [2, 6],
  /** Éclairs par salve */
  count: [1, 3],
  /** Intensité du flash de la passe finale (R2 : 0,3 à 0,6) */
  amp: [0.3, 0.6],
  /** Durée de la décroissance (s) */
  decay: [0.12, 0.25],
  /** Durée du trait d'éclair (s) */
  bolt: 0.15,
} as const;

export interface Strike { at: number; amp: number; decay: number; bolt: boolean }

const pick = (r: () => number, [a, b]: readonly [number, number]) => a + r() * (b - a);

/** Une salve qui commence à `t` : 1 à 3 éclairs, le premier avec son trait */
export function salvo(t: number, rng: () => number): Strike[] {
  const n = Math.min(LIGHTNING.count[1], LIGHTNING.count[0] + Math.floor(rng() * LIGHTNING.count[1]));
  const out: Strike[] = [];
  for (let i = 0; i < n; i++) {
    out.push({ at: t, amp: pick(rng, LIGHTNING.amp), decay: pick(rng, LIGHTNING.decay), bolt: i === 0 });
    t += pick(rng, LIGHTNING.gap);
  }
  return out;
}

/** Intensité de l'éclair `s` à l'instant t : une impulsion qui décroît, 0 avant et après */
export const flashOf = (s: Strike, t: number) => (t < s.at || t >= s.at + s.decay ? 0 : s.amp * (1 - (t - s.at) / s.decay) ** 2);

/**
 * Planificateur : `step(dt, active)` à chaque image ; active = orage affiché et pas de réduit-mouvement. Renvoie l'intensité du flash
 * (0 hors éclair) et l'éclair qui commence à cette image (pour le trait), sinon null. Inactif : plus rien, tout de suite.
 */
export function createLightning(rng: () => number = Math.random) {
  let t = 0, queue: Strike[] = [], next = -1;
  return {
    step(dt: number, active: boolean): { flash: number; start: Strike | null } {
      t += dt;
      if (!active) { queue = []; next = -1; return { flash: 0, start: null }; }
      if (next < 0) next = t + pick(rng, LIGHTNING.first);
      if (!queue.length && t >= next) {
        queue = salvo(t, rng);
        next = queue[queue.length - 1].at + pick(rng, LIGHTNING.pause);
      }
      let start: Strike | null = null;
      while (queue.length && t >= queue[0].at + queue[0].decay) queue.shift();
      const s = queue[0];
      if (s && t - dt < s.at && t >= s.at) start = s;
      return { flash: s ? flashOf(s, t) : 0, start };
    },
  };
}

/** Points d'un trait d'éclair entre le haut et le bas (déplacement du point milieu), 2^depth segments, dans le plan donné */
export function boltPoints(top: THREE.Vector3, bottom: THREE.Vector3, side: THREE.Vector3, rng: () => number, depth = 5): THREE.Vector3[] {
  let pts = [top.clone(), bottom.clone()];
  let spread = top.distanceTo(bottom) * 0.12;
  for (let k = 0; k < depth; k++) {
    const out = [pts[0]];
    for (let i = 1; i < pts.length; i++) {
      out.push(pts[i - 1].clone().lerp(pts[i], 0.5).addScaledVector(side, (rng() - 0.5) * spread), pts[i]);
    }
    pts = out;
    spread *= 0.55;
  }
  return pts;
}

/** Trait d'éclair : ruban face à la caméra, reconstruit à chaque éclair, un appel de rendu pendant `LIGHTNING.bolt` s */
export function createBolt(scene: THREE.Scene) {
  const N = 33; // 32 segments (2^5) : 33 points, 2 sommets chacun
  const pos = new Float32Array(N * 2 * 3), index: number[] = [];
  for (let i = 0; i < N - 1; i++) index.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 2, 2 * i + 1, 2 * i + 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(N * 6), 3)); // inutilisée, mais sans elle le programme différerait
  geo.setIndex(index);
  geo.setDrawRange(0, 0);
  // Même programme que les anneaux des lieux d'histoire (markers.ts) : compilé dès le démarrage
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#f4f7ff', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  mesh.name = 'lightning-bolt';
  mesh.frustumCulled = false;
  mesh.renderOrder = 7;
  scene.add(mesh);
  const v = new THREE.Vector3(), eye = new THREE.Vector3(), fwd = new THREE.Vector3(), side = new THREE.Vector3(), top = new THREE.Vector3(), bottom = new THREE.Vector3();
  let left = 0;
  return {
    /** Visible à cette image (0 ou 1 appel) */
    visible: () => +(left > 0),
    /**
     * Un éclair tombe à peu près à la distance du point regardé (jusqu'à 15 % au-delà), dans le socle, du haut de l'image jusqu'au sol ;
     * épaisseur de 3 à 6 pixels environ (plus fin vers le pied), quel que soit le zoom.
     */
    strike(camera: THREE.Camera, focus: THREE.Vector3, bounds: { minX: number; maxX: number; minY: number; maxY: number }, rng: () => number) {
      const d = camera.position.distanceTo(focus);
      fwd.subVectors(focus, camera.position).setY(0).normalize();
      side.set(-fwd.z, 0, fwd.x);
      // La caméra plonge vers le sol : un trait vertical monte vers le haut de l'image, il doit partir de la moitié haute de la vue
      bottom.copy(focus).addScaledVector(fwd, d * (0.15 * rng() - 0.03)).addScaledVector(side, d * (rng() - 0.5) * 0.7);
      bottom.x = THREE.MathUtils.clamp(bottom.x, bounds.minX, bounds.maxX);
      bottom.z = THREE.MathUtils.clamp(bottom.z, -bounds.maxY, -bounds.minY);
      bottom.y = focus.y - 20; // le pied, caché par le sol
      top.copy(bottom).addScaledVector(side, d * (rng() - 0.5) * 0.3).setY(focus.y + d * 0.9);
      const pts = boltPoints(top, bottom, side, rng);
      const w = d * 0.0025;
      for (let i = 0; i < N; i++) {
        const p = pts[i], q = pts[Math.min(N - 1, i + 1)], o = pts[Math.max(0, i - 1)];
        // Largeur perpendiculaire au trait et à la direction de la caméra, plus fine vers le pied ; dans cet ordre (caméra × trait),
        // les triangles font face à la caméra (matériau à une face : même programme que les anneaux)
        eye.subVectors(p, camera.position).cross(v.subVectors(q, o)).normalize().multiplyScalar(w * (1.2 - 0.6 * (i / (N - 1))));
        pos.set([p.x - eye.x, p.y - eye.y, p.z - eye.z, p.x + eye.x, p.y + eye.y, p.z + eye.z], i * 6);
      }
      geo.attributes.position.needsUpdate = true;
      geo.setDrawRange(0, index.length);
      left = LIGHTNING.bolt;
    },
    update(dt: number) {
      if (left <= 0) return;
      left -= dt;
      if (left <= 0) geo.setDrawRange(0, 0);
    },
  };
}
