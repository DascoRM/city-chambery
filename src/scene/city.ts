import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { CityData, Poly, Pt } from '../types';
import { PALETTE, rand } from './palette';
import { planRoof, planSkeletonRoof, roofGeometry, skeletonRoofGeometry } from './roofs';
import { buildGround, type Terrain } from './terrain';
import { pointInRing } from './geo';
import { FOOT_KINDS, LIFT, roadDistanceIndex } from './roads';
import type { Foliage } from '../time/seasons';

/**
 * Convention : un point OSM projeté [x, y] (est, nord) devient (x, hauteur, -y) dans Three.js.
 */
/** Uniformes partagés avec le cycle jour/nuit (fenêtres éclairées). */
export interface NightUniforms { uNight: { value: number }; uLit: { value: number } }

/** Arbres simples de la ville : emplacements, et masquage de ceux remplacés par des arbres modélisés. */
export interface CityTrees {
  spots: Pt[];
  hide(indices: number[]): void;
  /** Saison (itération 31) : feuillage vert, couleurs d'automne, ou petite couronne nue en hiver. */
  setFoliage(f: Foliage): void;
}

export function buildCity(data: CityData, terrain: Terrain, opts: { hidden?: Set<number> } = {}): { group: THREE.Group; update(t: number): void; night: NightUniforms; trees: CityTrees } {
  const night: NightUniforms = { uNight: { value: 0 }, uLit: { value: 0.45 } };
  const city = new THREE.Group();
  city.name = 'city';
  // Sol en relief (espaces verts, places et plans d'eau peints dessus) + bords du socle
  city.add(buildGround(data, terrain));
  const water = createWaterMaterial();
  city.add(buildFlat(data, water.material, terrain));
  city.add(buildBuildings(data, night, opts.hidden ?? new Set(), terrain));
  const trees = buildTrees(data, terrain);
  if (trees.group) city.add(trees.group);
  return { group: city, update: water.update, night, trees };
}

// ---------------------------------------------------------------------------
// Eau : matériau « résine » brillant avec de petites ondulations animées
// ---------------------------------------------------------------------------
function createWaterMaterial() {
  const uniforms = { uTime: { value: 0 } };
  const material = new THREE.MeshStandardMaterial({ color: PALETTE.water, roughness: 0.18, metalness: 0.1 });
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWorld;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying vec3 vWorld;
        uniform float uTime;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        float w1 = sin(vWorld.x * 0.35 + vWorld.z * 0.22 + uTime * 1.3);
        float w2 = sin(vWorld.x * -0.18 + vWorld.z * 0.41 - uTime * 0.9);
        float ripple = smoothstep(0.75, 1.0, w1 * 0.5 + w2 * 0.5);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${new THREE.Color(PALETTE.waterDeep).toArray().map((v) => v.toFixed(3)).join(', ')}), 0.25 + 0.15 * w2);
        diffuseColor.rgb += ripple * 0.22;`);
  };
  return { material, update: (t: number) => (uniforms.uTime.value = t) };
}

// ---------------------------------------------------------------------------
// Sol : places, espaces verts, eau, rues (tout est à plat, légèrement surélevé)
// ---------------------------------------------------------------------------
function toShape(p: Poly): THREE.Shape {
  const shape = new THREE.Shape(p.outer.map(([x, y]) => new THREE.Vector2(x, y)));
  for (const h of p.holes) shape.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  return shape;
}

/**
 * Ruban posé sur le relief le long d'une polyligne + disques aux jonctions (joints arrondis).
 * Les segments sont redécoupés tous les 4 m pour épouser la pente.
 */
function ribbons(lines: { pts: Pt[]; w: number }[], lift: number, material: THREE.Material | string, terrain: Terrain, extra = 0): THREE.Mesh | null {
  if (!lines.length) return null;
  const pos: number[] = [];
  const H = (x: number, zNeg: number) => terrain.heightAt(x, -zNeg) + lift;
  // Tous les triangles orientés vers le haut (sinon ils sont vus de dos et apparaissent noirs)
  const tri = (ax: number, az: number, bx: number, bz: number, cx: number, cz: number) => {
    const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0;
    const A = [ax, H(ax, az), az], B = [bx, H(bx, bz), bz], C = [cx, H(cx, cz), cz];
    if (up) pos.push(...A, ...B, ...C);
    else pos.push(...A, ...C, ...B);
  };
  const MAX_SEG = 4;
  for (const { pts: raw, w } of lines) {
    const r = w / 2 + extra;
    // Redécoupage
    const pts: Pt[] = [raw[0]];
    for (let i = 1; i < raw.length; i++) {
      const [x1, y1] = raw[i - 1], [x2, y2] = raw[i];
      const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / MAX_SEG));
      for (let k = 1; k <= n; k++) pts.push([x1 + ((x2 - x1) * k) / n, y1 + ((y2 - y1) * k) / n]);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      const len = Math.hypot(x2 - x1, y2 - y1);
      if (len < 0.01) continue;
      const nx = (-(y2 - y1) / len) * r, ny = ((x2 - x1) / len) * r;
      const a = [x1 + nx, -(y1 + ny)], b = [x1 - nx, -(y1 - ny)];
      const c = [x2 + nx, -(y2 + ny)], d = [x2 - nx, -(y2 - ny)];
      tri(a[0], a[1], b[0], b[1], c[0], c[1]);
      tri(c[0], c[1], b[0], b[1], d[0], d[1]);
    }
    // Joints arrondis aux sommets d'origine (les points ajoutés sont alignés)
    for (const [x, py] of raw) {
      const n = 10;
      for (let k = 0; k < n; k++) {
        const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
        tri(x, -py, x + Math.cos(a0) * r, -py - Math.sin(a0) * r, x + Math.cos(a1) * r, -py - Math.sin(a1) * r);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  const mat = typeof material === 'string' ? new THREE.MeshStandardMaterial({ color: material, roughness: 1 }) : material;
  // Décalage de profondeur : évite le scintillement avec le sol sur les pentes
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = -2;
  mat.polygonOffsetUnits = -2;
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/** Marque un sol qui s'éclaire la nuit (lueur des réverbères), dosé par le cycle jour/nuit. */
function glow<T extends THREE.Mesh | null>(mesh: T, amount: number): T {
  if (mesh) mesh.userData.nightGlow = amount;
  return mesh;
}

function buildFlat(data: CityData, waterMat: THREE.Material, terrain: Terrain): THREE.Group {
  const g = new THREE.Group();
  type Line = Extract<CityData['water'][number], { kind: 'line' }>;
  const waterLines = data.water.filter((w): w is Line => w.kind === 'line');
  const roads = data.roads.filter((r) => !r.bridge);
  const bridges = data.roads.filter((r) => r.bridge);
  // Ordre vertical : voir LIFT (scene/roads.ts), partagé avec tout ce qui marche dans les rues
  const parts = [
    glow(ribbons(roads.filter((r) => FOOT_KINDS.has(r.kind)), LIFT.foot, PALETTE.footway, terrain), 0.07),
    glow(ribbons(roads.filter((r) => !FOOT_KINDS.has(r.kind)), LIFT.street, PALETTE.street, terrain), 0.12),
    ribbons(waterLines, LIFT.bank, PALETTE.bank, terrain, 2.2),
    ribbons(waterLines, LIFT.water, waterMat, terrain),
    ribbons(bridges, LIFT.bridge, PALETTE.bridge, terrain, 0.6),
  ];
  for (const p of parts) if (p) g.add(p);
  return g;
}

// ---------------------------------------------------------------------------
// Bâtiments : extrusion des emprises, couleurs par sommet, une seule draw call
// ---------------------------------------------------------------------------
function buildBuildings(data: CityData, night: NightUniforms, hidden: Set<number>, terrain: Terrain): THREE.Mesh {
  const wall = new THREE.Color(), roof = new THREE.Color(), tmp = new THREE.Color();
  const geos: THREE.BufferGeometry[] = [];
  let pitched = 0;
  let skeletonRoofs = 0;
  // Façades côté rue (portes de jour, EP001-US009) : un mur dont l'extérieur est à moins de STREET_DISTANCE m
  // d'une voie et ne touche pas un bâtiment voisin (mur mitoyen)
  const roadDistance = roadDistanceIndex(data.roads);
  const rings = ringGrid(data);
  const insideOther = (x: number, y: number, self: Pt[]) =>
    (rings.get(`${Math.floor(x / RING_CELL)},${Math.floor(y / RING_CELL)}`) ?? []).some((r) => r !== self && pointInRing(x, y, r));
  const faceAttrs = (g: THREE.BufferGeometry, b: { outer: Pt[]; minH: number } | null, base: number) => {
    const n = g.getAttribute('position').count;
    const street = new Float32Array(n), baseY = new Float32Array(n).fill(base);
    if (b && b.minH === 0) {
      const pos = g.getAttribute('position'), nor = g.getAttribute('normal');
      for (let t = 0; t + 2 < n; t += 3) {
        const nx = nor.getX(t), ny = nor.getY(t), nz = nor.getZ(t);
        if (Math.abs(ny) > 0.3) continue;
        const cx = (pos.getX(t) + pos.getX(t + 1) + pos.getX(t + 2)) / 3, cz = (pos.getZ(t) + pos.getZ(t + 1) + pos.getZ(t + 2)) / 3;
        const ox = cx + nx * 1.5, oy = -(cz + nz * 1.5); // un peu devant le mur (plan des données : y = -z)
        if (roadDistance(ox, oy) < STREET_DISTANCE && !insideOther(ox, oy, b.outer)) street[t] = street[t + 1] = street[t + 2] = 1;
      }
    }
    g.setAttribute('aStreet', new THREE.BufferAttribute(street, 1));
    g.setAttribute('aBase', new THREE.BufferAttribute(baseY, 1));
    return g;
  };

  for (const b of data.buildings) {
    if (hidden.has(b.id)) continue; // remplacé par un monument modélisé
    // Petit décalage aléatoire : évite le scintillement entre toits qui se chevauchent à la même hauteur
    // Toit : rectangle (deux pans, quatre pans, pyramide) sinon squelette droit, sinon plat
    const plan = planRoof(b);
    const skel = plan ? null : planSkeletonRoof(b);
    const eave = plan?.eave ?? skel?.eave;
    const depth = eave !== undefined ? Math.max(eave - b.minH, 1) : Math.max(b.h - b.minH, 1) + rand(b.id * 3 + 1) * 0.4;
    let geo: THREE.BufferGeometry;
    try {
      geo = new THREE.ExtrudeGeometry(toShape(b), { depth, bevelEnabled: false });
    } catch {
      continue; // emprise dégénérée
    }
    // Posé sur le point le plus bas du terrain sous l'emprise (côté amont, le pied est enterré)
    const ground = terrain.minUnder(b.outer);
    geo.rotateX(-Math.PI / 2);
    geo.translate(0, b.minH, 0);
    geo.deleteAttribute('uv');

    const monument = ['church', 'cathedral', 'chapel', 'castle', 'public', 'civic', 'government', 'museum'].includes(b.kind);
    wall.set(monument ? PALETTE.monumentWall : PALETTE.walls[Math.floor(rand(b.id) * PALETTE.walls.length)]);
    roof.set(monument ? PALETTE.monumentRoof : PALETTE.roofs[Math.floor(rand(b.id * 7 + 3) * PALETTE.roofs.length)]);

    const pos = geo.getAttribute('position');
    const nor = geo.getAttribute('normal');
    const colors = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      if (nor.getY(i) > 0.7) tmp.copy(roof);
      else {
        // Pied de façade plus sombre : fausse occlusion ambiante, très « maquette »
        const t = THREE.MathUtils.clamp((pos.getY(i) - b.minH) / 6, 0, 1);
        tmp.copy(wall).multiplyScalar(0.72 + 0.28 * t);
      }
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.translate(0, ground, 0);
    geos.push(faceAttrs(geo.index ? geo.toNonIndexed() : geo, b, ground));
    if (plan) {
      pitched++;
      geos.push(faceAttrs(nonIndexed(roofGeometry({ ...plan, eave: b.minH + depth }, roof, wall).translate(0, ground, 0)), null, ground));
    } else if (skel) {
      const g = skeletonRoofGeometry(b, { ...skel, eave: b.minH + depth }, roof);
      if (g) {
        geos.push(faceAttrs(nonIndexed(g.translate(0, ground, 0)), null, ground));
        skeletonRoofs++;
      }
    }
  }

  const merged = geos.length ? mergeGeometries(geos) : new THREE.BufferGeometry();
  const mesh = new THREE.Mesh(merged, windowsMaterial(night));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = 'buildings';
  mesh.userData.pitchedRoofs = pitched;
  mesh.userData.skeletonRoofs = skeletonRoofs;
  return mesh;
}

/**
 * Matériau des bâtiments avec fenêtres éclairées la nuit.
 * Les fenêtres ne sont pas modélisées : une grille (3 m × 3,2 m par étage) est calculée
 * dans le shader à partir de la position sur la façade ; une fenêtre sur deux environ s'allume.
 */
/** Distance maximale (m) entre le devant d'un mur et une voie pour que le mur soit « côté rue » */
const STREET_DISTANCE = 9;
const RING_CELL = 25;
/** Contours des bâtiments rangés par cases de 25 m (boîte englobante) : test « ce point est-il dans un voisin ? » */
function ringGrid(data: CityData): Map<string, Pt[][]> {
  const grid = new Map<string, Pt[][]>();
  for (const b of data.buildings) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of b.outer) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    for (let i = Math.floor(x0 / RING_CELL); i <= Math.floor(x1 / RING_CELL); i++)
      for (let j = Math.floor(y0 / RING_CELL); j <= Math.floor(y1 / RING_CELL); j++) {
        const k = `${i},${j}`;
        const list = grid.get(k);
        if (list) list.push(b.outer); else grid.set(k, [b.outer]);
      }
  }
  return grid;
}
const nonIndexed = (g: THREE.BufferGeometry) => (g.index ? g.toNonIndexed() : g);

function windowsMaterial(night: NightUniforms): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night.uNight;
    shader.uniforms.uLit = night.uLit;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float aStreet;\nattribute float aBase;\nvarying vec3 vWPos;\nvarying vec3 vWNormal;\nvarying float vStreet;\nvarying float vBase;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);\nvStreet = aStreet;\nvBase = aBase;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        varying vec3 vWPos;
        varying vec3 vWNormal;
        varying float vStreet;
        varying float vBase;
        uniform float uNight;
        uniform float uLit;
        float hash21(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }`,
      )
      // Fenêtres (grille de 3 m × 3,2 m sur les murs) : verre sombre de jour (EP001-US009), allumées la nuit
      // selon uLit ; portes au rez-de-chaussée des murs côté rue (vStreet), une case sur trois environ
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        float win = 0.0, door = 0.0;
        vec2 cell = vec2(0.0);
        if (abs(vWNormal.y) < 0.3) {
          vec2 n = normalize(vWNormal.xz);
          float u = dot(vWPos.xz, vec2(-n.y, n.x));        // position le long de la façade
          cell = vec2(floor(u / 3.0), floor(vWPos.y / 3.2));
          vec2 f = vec2(fract(u / 3.0), fract(vWPos.y / 3.2));
          win = step(0.3, f.x) * step(f.x, 0.7) * step(0.35, f.y) * step(f.y, 0.78) * step(1.5, vWPos.y);
          // Encadrement : bande de ≈ 12 cm autour de la vitre
          float frame = step(0.26, f.x) * step(f.x, 0.74) * step(0.31, f.y) * step(f.y, 0.82) * step(1.5, vWPos.y) * (1.0 - win);
          float h = vWPos.y - vBase;                      // hauteur au-dessus du pied du bâtiment
          door = vStreet * step(hash21(vec2(floor(u / 3.0), floor(vBase))), 0.34) * step(0.32, f.x) * step(f.x, 0.68) * step(h, 2.3);
          float noWin = 1.0 - step(h, 3.2) * vStreet * step(hash21(vec2(floor(u / 3.0), floor(vBase))), 0.34); // pas de fenêtre au-dessus d'une porte, au rez-de-chaussée
          win *= noWin;
          frame *= noWin;
          // Vitre claire qui reflète le ciel le jour (plus claire en haut), sombre la nuit quand elle est éteinte
          float gy = clamp((f.y - 0.35) / 0.43, 0.0, 1.0);
          vec3 sky = mix(vec3(0.36, 0.58, 0.82), vec3(0.68, 0.84, 0.97), gy);
          vec3 glass = mix(sky, vec3(0.08, 0.1, 0.16), uNight);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.96, 0.94, 0.89), frame);
          diffuseColor.rgb = mix(diffuseColor.rgb, glass, win);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.2, 0.14), door);
        }`,
      )
      .replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
        if (uNight > 0.01 && win > 0.0) {
          float on = step(hash21(cell + floor(vWPos.xz * 0.02)), uLit);
          vec3 warm = mix(vec3(1.0, 0.72, 0.38), vec3(1.0, 0.86, 0.6), hash21(cell.yx));
          totalEmissiveRadiance += warm * win * on * uNight * 1.25;
        }`,
      );
  };
  return mat;
}

// ---------------------------------------------------------------------------
// Arbres : ceux d'OSM + quelques-uns semés dans les espaces verts
// ---------------------------------------------------------------------------
function buildTrees(data: CityData, terrain: Terrain): CityTrees & { group: THREE.Group | null } {
  const spots: Pt[] = [...data.trees];
  let seed = 1;
  for (const a of data.areas) {
    if (a.kind !== 'green') continue;
    const xs = a.outer.map((p) => p[0]), ys = a.outer.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const target = Math.min(40, Math.floor(((x1 - x0) * (y1 - y0)) / 260));
    for (let k = 0, tries = 0; k < target && tries < target * 6; tries++) {
      const x = x0 + rand(seed++ * 13) * (x1 - x0), y = y0 + rand(seed++ * 17) * (y1 - y0);
      if (pointInRing(x, y, a.outer)) { spots.push([x, y]); k++; }
    }
  }
  if (!spots.length) return { group: null, spots, hide: () => {}, setFoliage: () => {} };

  const canopyGeo = new THREE.IcosahedronGeometry(3.4, 0);
  canopyGeo.translate(0, 7.5, 0);
  const trunkGeo = new THREE.CylinderGeometry(0.5, 0.7, 5, 5);
  trunkGeo.translate(0, 2.5, 0);
  const canopy = new THREE.InstancedMesh(canopyGeo, new THREE.MeshStandardMaterial({ roughness: 0.9, flatShading: true }), spots.length);
  const trunk = new THREE.InstancedMesh(trunkGeo, new THREE.MeshStandardMaterial({ color: PALETTE.trunk, roughness: 1 }), spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), c = new THREE.Color();
  const base: THREE.Matrix4[] = [];
  spots.forEach(([x, y], i) => {
    const r = rand(i * 31 + 7);
    const scale = 0.8 + r * 0.6;
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r * Math.PI * 2);
    m.compose(p.set(x, terrain.heightAt(x, y), -y), q, s.setScalar(scale));
    base.push(m.clone());
    trunk.setMatrixAt(i, m);
  });
  canopy.castShadow = trunk.castShadow = true;
  const g = new THREE.Group();
  g.add(canopy, trunk);
  const zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const hidden = new Set<number>();
  // Hiver : couronne réduite autour du haut du tronc (branches nues)
  const shrink = new THREE.Matrix4().makeTranslation(0, 6.8, 0).multiply(new THREE.Matrix4().makeScale(0.62, 0.7, 0.62)).multiply(new THREE.Matrix4().makeTranslation(0, -7.5, 0));
  const setFoliage = (f: Foliage) => {
    const colors = f === 'autumn' ? PALETTE.canopyAutumn : f === 'bare' ? PALETTE.canopyBare : PALETTE.canopy;
    spots.forEach((_, i) => {
      canopy.setMatrixAt(i, hidden.has(i) ? zero : f === 'bare' ? m.multiplyMatrices(base[i], shrink) : base[i]);
      canopy.setColorAt(i, c.set(colors[i % colors.length]));
    });
    canopy.instanceMatrix.needsUpdate = true;
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
    canopy.computeBoundingSphere();
  };
  setFoliage('green');
  const hide = (indices: number[]) => {
    for (const i of indices) { hidden.add(i); canopy.setMatrixAt(i, zero); trunk.setMatrixAt(i, zero); }
    canopy.instanceMatrix.needsUpdate = trunk.instanceMatrix.needsUpdate = true;
    canopy.computeBoundingSphere(); trunk.computeBoundingSphere();
  };
  return { group: g, spots, hide, setFoliage };
}
