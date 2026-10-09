import * as THREE from 'three';

/**
 * Particules (itération 35) : nuage de fumée quand un éléphant disparaît, étincelles quand il se pose
 * sur la fontaine, feux d'artifice. Un seul objet THREE.Points par système (un appel de rendu),
 * positions calculées sur le processeur : quelques centaines de particules au plus.
 */
export interface EmitOptions {
  count: number;
  /** Vitesse initiale en m/s : [min, max], direction au hasard */
  speed: [number, number];
  /** Poussée vers le haut ajoutée à la vitesse (m/s) */
  up?: number;
  /** Durée de vie (s) : [min, max] */
  life: [number, number];
  /** Taille à l'écran (m) au départ ; la particule grossit de `grow` × sa taille en fin de vie */
  size: number;
  grow?: number;
  colors: THREE.ColorRepresentation[];
  /** Pesanteur (m/s², positive = vers le bas) et freinage (par seconde) */
  gravity?: number;
  drag?: number;
  /** Rayon du point d'émission (m) */
  spread?: number;
  /** Vitesse ajoutée à toutes les particules (m/s, x / y / z de Three.js) : le vent, pour la fumée des cheminées */
  drift?: [number, number, number];
}

export interface Particles {
  points: THREE.Points;
  emit(at: THREE.Vector3, o: EmitOptions): void;
  update(dt: number): void;
  /** Nombre de particules vivantes */
  alive(): number;
}

export function createParticles(max: number, additive: boolean): Particles {
  const pos = new Float32Array(max * 3);
  const col = new Float32Array(max * 3);
  const alpha = new Float32Array(max);
  const size = new Float32Array(max);
  const vel = new Float32Array(max * 3);
  const life = new Float32Array(max); // restant
  const life0 = new Float32Array(max);
  const size0 = new Float32Array(max);
  const grow = new Float32Array(max);
  const grav = new Float32Array(max);
  const drag = new Float32Array(max);
  let n = 0; // particules actives, rangées en tête de tableau

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage));
  geo.setDrawRange(0, 0);
  const mat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    uniforms: { uScale: { value: 700 } },
    vertexShader: /* glsl */ `
      attribute vec3 aColor; attribute float aAlpha; attribute float aSize;
      uniform float uScale;
      varying vec3 vColor; varying float vAlpha;
      void main() {
        vColor = aColor; vAlpha = aAlpha;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = aSize * uScale / max(0.1, -mv.z);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vColor; varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5) * 2.0;
        if (d > 1.0) discard;
        gl_FragColor = vec4(vColor, vAlpha * (1.0 - d * d));
      }`,
  });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  points.renderOrder = 5;
  const c = new THREE.Color();
  const attrs = (['position', 'aColor', 'aAlpha', 'aSize'] as const).map((name) => geo.getAttribute(name) as THREE.BufferAttribute);
  const colorAttr = attrs[1];
  let colorDirty = false; // les couleurs ne changent qu'à l'émission et quand une particule meurt
  let drawn = 0; // particules envoyées à la carte graphique à la dernière image

  // Taille à l'écran : suit la hauteur de la zone de rendu
  const bufferSize = new THREE.Vector2();
  points.onBeforeRender = (renderer) => {
    mat.uniforms.uScale.value = renderer.getDrawingBufferSize(bufferSize).y * 0.9;
  };

  return {
    points,
    emit(at, o) {
      for (let k = 0; k < o.count && n < max; k++, n++) {
        const i = n;
        const sp = o.spread ?? 0;
        pos[i * 3] = at.x + (Math.random() - 0.5) * sp * 2;
        pos[i * 3 + 1] = at.y + (Math.random() - 0.5) * sp;
        pos[i * 3 + 2] = at.z + (Math.random() - 0.5) * sp * 2;
        // Direction au hasard sur la sphère
        const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u);
        const v = o.speed[0] + Math.random() * (o.speed[1] - o.speed[0]);
        const [wx, wy, wz] = o.drift ?? [0, 0, 0];
        vel[i * 3] = r * Math.cos(a) * v + wx;
        vel[i * 3 + 1] = u * v + (o.up ?? 0) + wy;
        vel[i * 3 + 2] = r * Math.sin(a) * v + wz;
        life[i] = life0[i] = o.life[0] + Math.random() * (o.life[1] - o.life[0]);
        size0[i] = o.size * (0.7 + Math.random() * 0.6);
        grow[i] = o.grow ?? 0;
        grav[i] = o.gravity ?? 0;
        drag[i] = o.drag ?? 0;
        c.set(o.colors[Math.floor(Math.random() * o.colors.length)]);
        col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
        colorDirty = true;
      }
    },
    update(dt) {
      if (n === 0 && drawn === 0) return; // rien à animer ni à envoyer
      for (let i = 0; i < n; i++) {
        life[i] -= dt;
        if (life[i] <= 0) {
          // On remplace la particule morte par la dernière active
          n--;
          if (i !== n) {
            for (let k = 0; k < 3; k++) {
              pos[i * 3 + k] = pos[n * 3 + k];
              col[i * 3 + k] = col[n * 3 + k];
              vel[i * 3 + k] = vel[n * 3 + k];
            }
            colorDirty = true;
            life[i] = life[n]; life0[i] = life0[n]; size0[i] = size0[n]; grow[i] = grow[n]; grav[i] = grav[n]; drag[i] = drag[n];
            i--;
          }
          continue;
        }
        const f = Math.max(0, 1 - drag[i] * dt);
        vel[i * 3] *= f; vel[i * 3 + 1] = vel[i * 3 + 1] * f - grav[i] * dt; vel[i * 3 + 2] *= f;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] += vel[i * 3 + 1] * dt; pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
        const k = 1 - life[i] / life0[i]; // 0 → 1
        alpha[i] = k < 0.1 ? k / 0.1 : 1 - (k - 0.1) / 0.9;
        size[i] = size0[i] * (1 + grow[i] * k);
      }
      geo.setDrawRange(0, n);
      points.visible = n > 0;
      drawn = n;
      if (n === 0) return;
      // Seules les n premières particules sont envoyées, et les couleurs seulement si elles ont changé
      for (const a of attrs) {
        if (a === colorAttr && !colorDirty) continue;
        a.addUpdateRange(0, n * a.itemSize);
        a.needsUpdate = true;
      }
      colorDirty = false;
    },
    alive: () => n,
  };
}

// Couleurs saturées : les étincelles restent visibles de jour sur les tons clairs du diorama
const FIREWORK_COLORS: THREE.ColorRepresentation[][] = [
  ['#ffc400', '#ff8f00', '#ffe066'],
  ['#ff2e63', '#ff6b8b', '#ffd23f'],
  ['#1fa2ff', '#4cc9f0', '#ffffff'],
  ['#2ec46d', '#7bd88f', '#ffd23f'],
  ['#9d4edd', '#c77dff', '#ff6b8b'],
];

/** Feux d'artifice : une fusée monte en laissant une traînée, puis éclate en étincelles qui retombent. */
export function createFireworks(sparks: Particles) {
  const rockets: { p: THREE.Vector3; v: THREE.Vector3; fuse: number; delay: number; colors: THREE.ColorRepresentation[]; big: boolean }[] = [];
  return {
    /** Lance une fusée depuis `from`, après `delay` secondes ; big = plus haute et plus grosse */
    launch(from: THREE.Vector3, delay = 0, big = false) {
      rockets.push({
        p: from.clone(),
        v: new THREE.Vector3((Math.random() - 0.5) * 8, big ? 42 : 34, (Math.random() - 0.5) * 8),
        fuse: (big ? 1.2 : 0.9) + Math.random() * 0.3,
        delay,
        colors: FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)],
        big,
      });
    },
    /** Fusées en attente ou en vol */
    pending: () => rockets.length,
    update(dt: number) {
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        if (r.delay > 0) { r.delay -= dt; continue; }
        r.fuse -= dt;
        r.v.y -= 9 * dt;
        r.p.addScaledVector(r.v, dt);
        sparks.emit(r.p, { count: 2, speed: [0.2, 1], life: [0.3, 0.6], size: 0.9, colors: ['#ffd23f', '#ffb000'], gravity: 2 });
        if (r.fuse <= 0) {
          sparks.emit(r.p, { count: r.big ? 160 : 110, speed: r.big ? [14, 22] : [10, 16], life: [1.2, 2], size: r.big ? 2.6 : 2, colors: r.colors, gravity: 5, drag: 1.1 });
          rockets.splice(i, 1);
        }
      }
    },
  };
}
