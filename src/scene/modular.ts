import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { Building, CityData, Pt } from '../types';
import { segDist2 } from './geo';
import { dataUrl } from '../dataurl';
import type { NightUniforms } from './city';

/**
 * Essai (itération 47) : UN bâtiment reconstruit avec les modules du pack de bâtiments, pour juger si le
 * style du pack s'intègre au diorama. Le bâtiment OSM est caché (main.ts) et remplacé par un assemblage :
 * anneau de modules cubiques (fenêtres sur les faces extérieures, porte et balcon sur la façade côté rue,
 * pilastres pleins aux angles) et toit à deux pans d'ardoise.
 *
 * Le rectangle est le plus petit rectangle orienté qui contient le contour ; les modules sont étirés pour
 * le remplir exactement. Décor d'essai : pas un relevé du vrai bâtiment.
 */
export interface ModularConfig {
  /** Identifiant OSM du bâtiment à reconstruire ; null = désactivé */
  id: number | null;
  /** Largeur visée d'un module (m) */
  module: number;
  /** Hauteur d'un étage (m) */
  floor: number;
  /** Hauteur du toit (m), quand la hauteur de gouttière du bâtiment n'est pas connue */
  roofHeight: number;
}

/** Dimensions des pièces telles que converties (m), à l'échelle 1 : cube de mur et module de toit */
const WALL = { w: 4.2, h: 2.63, d: 4.2 };
const ROOF = { w: 4.58, h: 2.18, d: 4.2 };
const PIECES = ['wall-block', 'wall-window', 'wall-windows', 'wall-door', 'wall-balcony', 'roof-gable', 'roof-gable-end'];

/** Plus petit rectangle orienté contenant le contour : centre, longueur (L ≥ W), largeur, angle de l'axe L (radians) */
function orientedBox(ring: Pt[]): { cx: number; cy: number; L: number; W: number; angle: number } {
  let best: { area: number; cx: number; cy: number; L: number; W: number; angle: number } | null = null;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
    const c = Math.cos(-ang), s = Math.sin(-ang);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (const [x, y] of ring) { const u = x * c - y * s, v = x * s + y * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const area = (u1 - u0) * (v1 - v0);
    if (!best || area < best.area) {
      const mu = (u0 + u1) / 2, mv = (v0 + v1) / 2;
      const cx = mu * Math.cos(ang) - mv * Math.sin(ang), cy = mu * Math.sin(ang) + mv * Math.cos(ang);
      const long = u1 - u0 >= v1 - v0;
      best = { area, cx, cy, L: long ? u1 - u0 : v1 - v0, W: long ? v1 - v0 : u1 - u0, angle: long ? ang : ang + Math.PI / 2 };
    }
  }
  return best!;
}

export async function buildModularBuilding(o: {
  data: CityData;
  minUnder(ring: Pt[]): number;
  /** Éclairage de nuit de la ville : les fenêtres (faces bleues) s'allument comme celles des autres bâtiments */
  night: NightUniforms;
  config: ModularConfig;
}): Promise<{ group: THREE.Group; building: Building; info: Record<string, number | string> } | null> {
  const { data, config: cfg } = o;
  if (cfg.id === null) return null;
  const building = data.buildings.find((b) => b.id === cfg.id);
  if (!building) throw new Error(`bâtiment ${cfg.id} introuvable`);

  const gltf = await new GLTFLoader().loadAsync(dataUrl('models/buildings/details.glb'));
  const geometries = new Map<string, THREE.BufferGeometry>();
  gltf.scene.traverse((m) => { if ((m as THREE.Mesh).isMesh) geometries.set(m.name, (m as THREE.Mesh).geometry); });
  for (const name of PIECES) if (!geometries.has(name)) throw new Error(`pièce « ${name} » absente de details.glb (npm run buildings)`);

  const box = orientedBox(building.outer);
  const { cx, cy, L, W, angle } = box;
  const n = Math.max(3, Math.round(L / cfg.module)); // modules le long de L
  const m = Math.max(3, Math.round(W / cfg.module)); // modules le long de W
  const floors = Math.max(2, Math.round(building.eave !== undefined ? building.eave / cfg.floor : building.h / cfg.floor));
  const wallH = building.eave ?? building.h;
  const sy = wallH / (floors * WALL.h);
  const base = o.minUnder(building.outer);

  // Côté de la façade : celui dont la normale extérieure regarde vers la voie la plus proche
  let road: Pt | null = null, bestD = Infinity;
  for (const r of data.roads) {
    if (r.kind === 'steps') continue;
    for (let k = 1; k < r.pts.length; k++) {
      const d2 = segDist2(cx, cy, r.pts[k - 1][0], r.pts[k - 1][1], r.pts[k][0], r.pts[k][1]);
      if (d2 < bestD) { bestD = d2; road = r.pts[k]; }
    }
  }
  const toRoad = road ? Math.atan2(road[1] - cy, road[0] - cx) : angle + Math.PI / 2;
  // 4 côtés : normale extérieure à angle + k·90° ; on garde celui le plus proche de la direction de la voie
  let frontSide = 0, bestDot = -Infinity;
  for (let k = 0; k < 4; k++) { const dot = Math.cos(angle + (k * Math.PI) / 2 - toRoad); if (dot > bestDot) { bestDot = dot; frontSide = k; } }
  // k : 0 = +u (bout +L), 1 = +v (côté +W), 2 = -u, 3 = -v

  const up = new THREE.Vector3(0, 1, 0);
  const q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), mat = new THREE.Matrix4();
  const lists = new Map<string, THREE.Matrix4[]>();
  const add = (piece: string, matrix: THREE.Matrix4) => { if (!lists.has(piece)) lists.set(piece, []); lists.get(piece)!.push(matrix); };
  const cosA = Math.cos(angle), sinA = Math.sin(angle);
  /** Repère local (u le long de L, v le long de W, origine au centre) → monde (x = est, z = -nord) */
  const world = (u: number, v: number, y: number) => p.set(cx + u * cosA - v * sinA, y, -(cy + u * sinA + v * cosA));
  /** Rotation pour que +Z local regarde vers l'angle `phi` (plan des données : x = est, y = nord) */
  const facing = (phi: number) => q.setFromAxisAngle(up, Math.atan2(Math.cos(phi), -Math.sin(phi)));

  const cellL = L / n, cellW = W / m;
  for (let f = 0; f < floors; f++) {
    const y = base + f * WALL.h * sy;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < m; j++) {
        const onU = i === 0 || i === n - 1, onV = j === 0 || j === m - 1;
        if (!onU && !onV) continue; // intérieur : vide
        const u = -L / 2 + (i + 0.5) * cellL, v = -W / 2 + (j + 0.5) * cellW;
        const corner = onU && onV;
        // Côté de la cellule (0 = +u, 1 = +v, 2 = -u, 3 = -v) ; les angles sont pleins
        const side = corner ? -1 : i === n - 1 ? 0 : j === m - 1 ? 1 : i === 0 ? 2 : 3;
        let piece = 'wall-block';
        if (!corner) {
          const tangentIndex = side === 0 || side === 2 ? j : i; // position le long du côté (1 .. count-2)
          const count = side === 0 || side === 2 ? m : n;
          const middle = Math.floor(count / 2);
          if (side === frontSide && f === 0 && tangentIndex === middle) piece = 'wall-door';
          else if (side === frontSide && f === 1 && tangentIndex === middle) piece = 'wall-balcony';
          else piece = (tangentIndex + f) % 2 === 0 ? 'wall-window' : 'wall-windows';
        }
        const phi = corner ? angle : angle + (side * Math.PI) / 2;
        facing(phi);
        const tangent = side === 0 || side === 2 ? cellW : cellL;
        const normal = side === 0 || side === 2 ? cellL : cellW;
        s.set(tangent / WALL.w, sy, normal / WALL.d);
        world(u, v, y);
        add(piece, mat.compose(p, q, s).clone());
      }
    }
  }

  // Toit à deux pans : faîtage le long de L, un module de toit par tranche de L ; les bouts ferment le pignon
  const roofY = base + floors * WALL.h * sy;
  const roofH = building.h - wallH > 1.5 ? building.h - wallH : cfg.roofHeight; // la vraie hauteur de toit quand on la connaît
  const roofSy = roofH / ROOF.h;
  for (let i = 0; i < n; i++) {
    const u = -L / 2 + (i + 0.5) * cellL;
    facing(angle); // +Z local → le long de L
    s.set(W / WALL.w, roofSy, cellL / ROOF.d);
    world(u, 0, roofY);
    const matrix = mat.compose(p, q, s).clone();
    if (i === 0 || i === n - 1) {
      // bout : la pièce « roof-gable-end » regarde vers l'extérieur de son bout
      facing(i === 0 ? angle + Math.PI : angle);
      add('roof-gable-end', mat.compose(p, q, s).clone());
    } else add('roof-gable', matrix);
  }

  const group = new THREE.Group();
  group.name = 'modular-building';
  const roofMaterial = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
  // Murs seulement (l'ardoise bleutée des toits serait prise pour des fenêtres) : la nuit, les faces bleues (fenêtres) brillent : même uNight / uLit que les fenêtres de la ville (city.ts)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = o.night.uNight;
    shader.uniforms.uLit = o.night.uLit;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vModPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvModPos = (modelMatrix * instanceMatrix * vec4(position, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;\nuniform float uLit;\nvarying vec3 vModPos;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
#ifdef USE_COLOR
        float win = step(0.06, vColor.b - vColor.r);
        float on = step(fract(sin(dot(floor(vModPos / vec3(1.6, 2.6, 1.6)), vec3(12.9898, 78.233, 37.719))) * 43758.5453), uLit * 2.2);
        totalEmissiveRadiance += vec3(1.0, 0.8, 0.5) * win * on * uNight * 1.25;
#endif`);
  };
  material.customProgramCacheKey = () => 'modular-building';
  for (const [piece, matrices] of lists) {
    const inst = new THREE.InstancedMesh(geometries.get(piece)!, piece.startsWith('roof-') ? roofMaterial : material, matrices.length);
    matrices.forEach((mx, k) => inst.setMatrixAt(k, mx));
    inst.castShadow = true;
    inst.receiveShadow = false; // sur des modules étirés, la réception d'ombre donne une trame de points
    inst.name = `modular-${piece}`;
    inst.computeBoundingSphere();
    group.add(inst);
  }
  const info = { id: building.id, L: +L.toFixed(1), W: +W.toFixed(1), modulesL: n, modulesW: m, floors, wallH, roofH: +(building.h - wallH), frontSide, pieces: [...lists.entries()].map(([k, v]) => `${k}:${v.length}`).join(' ') };
  return { group, building, info };
}
