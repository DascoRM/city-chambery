import * as THREE from 'three';

/**
 * Fontaine des Éléphants — version « formes simples » générée en code (itération 9).
 *
 * Repère : origine au centre du bassin, au sol ; unité = mètre ; l'axe des éléphants n°1 est +X.
 *
 * Ce qui vient de sources :
 *  - hauteur totale 17,65 m ; statue du général de Boigne 2,82 m ; quatre éléphants en fonte
 *    réunis par la croupe ; superposition fontaine + colonne + statue (Wikipédia) ;
 *  - bassin circulaire d'environ 13 m de diamètre (contour OpenStreetMap, way 163674338).
 * Ce qui est approximatif (à l'œil, pas de plans) : toutes les autres proportions,
 * la forme des éléphants, du piédestal, de la colonne et de la statue.
 */

const TOTAL_H = 17.65;
const STATUE_H = 2.82;
const BASIN_R = 6.45;

const stone = new THREE.MeshStandardMaterial({ color: '#e6dfd0', roughness: 0.85, flatShading: true });
const stoneDark = new THREE.MeshStandardMaterial({ color: '#cfc6b3', roughness: 0.9, flatShading: true });
const iron = new THREE.MeshStandardMaterial({ color: '#77716a', roughness: 0.55, metalness: 0.15, flatShading: true });
const bronze = new THREE.MeshStandardMaterial({ color: '#6f7058', roughness: 0.5, metalness: 0.2, flatShading: true });
const water = new THREE.MeshStandardMaterial({ color: '#79b8dc', roughness: 0.15, metalness: 0.1 });
const jet = new THREE.MeshStandardMaterial({ color: '#d6ecf8', roughness: 0.1, transparent: true, opacity: 0.7 });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** L'avant d'un éléphant, sortant du piédestal le long de +X (la croupe est « dans » le bloc central). */
function elephantFront(): THREE.Group {
  const g = new THREE.Group();
  const bodyY = 3.7;
  // Corps (demi-ellipsoïde qui dépasse du bloc central)
  const body = mesh(new THREE.SphereGeometry(1, 10, 8), iron, 1.7, bodyY, 0);
  body.scale.set(1.5, 1.25, 1.2);
  g.add(body);
  // Pattes avant
  for (const side of [-0.6, 0.6]) g.add(mesh(new THREE.CylinderGeometry(0.34, 0.4, 1.5, 7), iron, 2.35, 3.0 - 0.45, side));
  // Tête
  const head = mesh(new THREE.SphereGeometry(0.95, 10, 8), iron, 3.15, bodyY + 0.55, 0);
  head.scale.set(1, 1.05, 0.95);
  g.add(head);
  // Oreilles (disques aplatis)
  for (const side of [-1, 1]) {
    const ear = mesh(new THREE.CylinderGeometry(0.85, 0.7, 0.12, 9), iron, 2.9, bodyY + 0.55, side * 0.95);
    ear.rotation.x = Math.PI / 2;
    ear.rotation.z = side * 0.25;
    g.add(ear);
  }
  // Trompe recourbée vers le bassin (elle crache l'eau)
  const trunkCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(3.85, bodyY + 0.3, 0),
    new THREE.Vector3(4.3, bodyY - 0.5, 0),
    new THREE.Vector3(4.45, bodyY - 1.3, 0),
    new THREE.Vector3(4.8, bodyY - 1.75, 0),
  ]);
  g.add(mesh(new THREE.TubeGeometry(trunkCurve, 10, 0.22, 6), iron));
  // Défenses
  for (const side of [-0.35, 0.35]) {
    const tusk = mesh(new THREE.ConeGeometry(0.1, 0.9, 5), stone, 3.85, bodyY - 0.15, side);
    tusk.rotation.z = -Math.PI / 2.6;
    g.add(tusk);
  }
  // Jet d'eau : de la trompe jusqu'au bassin
  const jetCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(4.85, bodyY - 1.8, 0),
    new THREE.Vector3(5.6, bodyY - 1.6, 0),
    new THREE.Vector3(5.7, 0.55, 0),
  );
  const j = mesh(new THREE.TubeGeometry(jetCurve, 8, 0.09, 5), jet);
  j.castShadow = false;
  g.add(j);
  return g;
}

/** Statue schématique du général : socle, jambes, manteau, tête. */
function statue(): THREE.Group {
  const g = new THREE.Group();
  const h = STATUE_H;
  g.add(mesh(new THREE.CylinderGeometry(0.28, 0.32, h * 0.42, 7), bronze, 0, h * 0.21, 0)); // jambes / bas du manteau
  const torso = mesh(new THREE.CylinderGeometry(0.34, 0.3, h * 0.36, 7), bronze, 0, h * 0.6, 0);
  g.add(torso);
  g.add(mesh(new THREE.SphereGeometry(h * 0.075, 8, 6), bronze, 0, h * 0.86, 0)); // tête
  const arm = mesh(new THREE.CylinderGeometry(0.07, 0.07, h * 0.3, 5), bronze, 0.3, h * 0.66, 0);
  arm.rotation.z = -0.5;
  g.add(arm);
  return g;
}

/**
 * Mise en lumière de nuit (effet, pas de vraies lampes : coût quasi nul) :
 * - pierre et fonte éclairées par le bas (lumière chaude qui s'estompe en montant),
 *   statue du général éclairée par son propre projecteur ;
 * - bassin et jets éclairés de l'intérieur (bleu) ;
 * - halo chaud au sol autour de la fontaine.
 */
const WARM = new THREE.Color('#ffd49a');
const AQUA = new THREE.Color('#6fd3ff');
let lit = false;
let groundY = 0; // altitude du sol sous la fontaine (relief)

function uplight(mat: THREE.MeshStandardMaterial, night: { value: number }, strength: number, statueBoost: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying float vLocalY;')
      .replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvLocalY = (modelMatrix * vec4(transformed, 1.0)).y - ' + groundY.toFixed(2) + ';');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
        varying float vLocalY;
        uniform float uNight;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // Hauteur relative (0 = sol, 1 = sommet ; la fontaine peut être agrandie)
        float hRel = clamp(vLocalY / ${(TOTAL_H * 1.6).toFixed(1)}, 0.0, 1.0);
        float up = mix(1.0, 0.25, smoothstep(0.0, 0.75, hRel));
        float statue = smoothstep(0.78, 0.84, vLocalY / ${(TOTAL_H * 1.3).toFixed(1)});
        totalEmissiveRadiance += diffuseColor.rgb * vec3(${WARM.toArray().map((v) => v.toFixed(3)).join(', ')})
          * uNight * (${strength.toFixed(2)} * up + ${statueBoost.toFixed(2)} * statue);`);
  };
  mat.needsUpdate = true;
}

function glowFlat(mat: THREE.MeshStandardMaterial, night: { value: number }, color: THREE.Color, k: number) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uNight = night;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        totalEmissiveRadiance += vec3(${color.toArray().map((v) => v.toFixed(3)).join(', ')}) * uNight * ${k.toFixed(2)};`);
  };
  mat.needsUpdate = true;
}

/** Halo chaud au sol : disque additif au dégradé radial, visible seulement la nuit. */
function groundHalo(night: { value: number }): THREE.Mesh {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const ctx = cv.getContext('2d')!;
  const gr = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,214,160,0.9)');
  gr.addColorStop(0.45, 'rgba(255,200,140,0.45)');
  gr.addColorStop(1, 'rgba(255,190,120,0)');
  ctx.fillStyle = gr;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 });
  const geo = new THREE.PlaneGeometry(BASIN_R * 4.2, BASIN_R * 4.2);
  geo.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.35;
  m.renderOrder = 2;
  // (pas de visible = false ici : un objet masqué n'est plus rendu, donc plus mis à jour)
  m.onBeforeRender = () => {
    mat.opacity = 0.8 * night.value;
  };
  return m;
}

export function buildElephantsFountain(ctx?: { night: { value: number }; ground?: number }): THREE.Group {
  const g = new THREE.Group();
  g.name = 'fontaine-des-elephants';
  if (ctx && !lit) {
    groundY = ctx.ground ?? 0;
    uplight(stone, ctx.night, 0.9, 1.6);
    uplight(stoneDark, ctx.night, 0.9, 1.6);
    uplight(iron, ctx.night, 1.6, 0);
    uplight(bronze, ctx.night, 0.6, 3.2);
    glowFlat(water, ctx.night, AQUA, 0.4);
    glowFlat(jet, ctx.night, AQUA, 0.9);
    lit = true;
  }
  if (ctx) g.add(groundHalo(ctx.night));

  // Bassin circulaire (margelle + eau)
  const rim = new THREE.Shape();
  rim.absarc(0, 0, BASIN_R, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, BASIN_R - 0.5, 0, Math.PI * 2, true);
  rim.holes.push(hole);
  const rimGeo = new THREE.ExtrudeGeometry(rim, { depth: 0.7, bevelEnabled: false, curveSegments: 24 });
  rimGeo.rotateX(-Math.PI / 2);
  g.add(mesh(rimGeo, stoneDark));
  const waterGeo = new THREE.CircleGeometry(BASIN_R - 0.5, 32);
  waterGeo.rotateX(-Math.PI / 2);
  const w = mesh(waterGeo, water, 0, 0.5, 0);
  w.castShadow = false;
  g.add(w);

  // Socle octogonal dans le bassin, puis bloc central d'où sortent les éléphants
  g.add(mesh(new THREE.CylinderGeometry(3.1, 3.3, 2.2, 8), stone, 0, 1.1, 0));
  g.add(mesh(new THREE.BoxGeometry(2.8, 4.2, 2.8), stone, 0, 2.2 + 2.1, 0));
  g.add(mesh(new THREE.BoxGeometry(3.3, 0.4, 3.3), stoneDark, 0, 6.5, 0)); // corniche

  // Les quatre éléphants, dos à dos (« les Quatre sans cul »)
  for (let i = 0; i < 4; i++) {
    const e = elephantFront();
    e.rotation.y = (i * Math.PI) / 2;
    // Nommés pour le mini-jeu : chaque éléphant échappé revient à sa place (src/game/hunt.ts)
    e.name = `elephant-${i}`;
    g.add(e);
  }

  // Colonne : base, fût, chapiteau
  const colBase = 6.7, capital = 14.3;
  g.add(mesh(new THREE.CylinderGeometry(1.0, 1.15, 0.6, 12), stone, 0, colBase + 0.3, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.62, 0.72, capital - colBase - 0.6, 12), stone, 0, (colBase + 0.6 + capital) / 2, 0));
  g.add(mesh(new THREE.BoxGeometry(1.7, 0.5, 1.7), stoneDark, 0, capital + 0.25, 0));
  const statueBase = capital + 0.5;
  g.add(mesh(new THREE.CylinderGeometry(0.55, 0.6, TOTAL_H - STATUE_H - statueBase, 8), stone, 0, (statueBase + TOTAL_H - STATUE_H) / 2, 0));

  // Statue du général de Boigne au sommet (hauteur totale = 17,65 m)
  const s = statue();
  s.position.y = TOTAL_H - STATUE_H;
  g.add(s);
  return g;
}
