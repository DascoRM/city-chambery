import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { CityData, HeightFn } from '../types';

/** Renderer, caméra, lumières et contrôles — la « scène de maquettiste ». */
export function createStage(container: HTMLElement, bounds: CityData['bounds'], heightAt: HeightFn = () => 0) {
  // Pas d'anticrénelage ici : l'image passe par l'effet maquette (tiltshift.ts), qui a sa propre
  // cible de rendu anticrénelée (samples: 4). Celui du renderer ne servirait qu'à la copie finale.
  const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5)); // ajustée ensuite par scene/quality.ts
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // Ombres recalculées seulement quand le soleil bouge (curseur d'heure, lecture ▶) ou quand la scène
  // change (voir daynight.ts et main.ts), pas à chaque image : la scène est statique le reste du temps.
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.setClearColor(0x000000, 0);
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const W = bounds.maxX - bounds.minX;
  const D = bounds.maxY - bounds.minY;
  const size = Math.max(W, D);

  // Focale longue = effet « maquette » (peu de déformation de perspective)
  const camera = new THREE.PerspectiveCamera(30, container.clientWidth / container.clientHeight, 5, size * 10);
  // Vue d'ensemble : tout le socle est visible, quelle que soit la forme de l'écran
  const aspect = container.clientWidth / container.clientHeight;
  const dist = size * 2.15 * Math.max(1, 1.3 / aspect);
  camera.position.copy(new THREE.Vector3(-0.42, 0.72, 0.56).normalize().multiplyScalar(dist));

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.minDistance = 70; // assez près pour lire une rue (avant : 120) ; en dessous, un téléphone ne montre plus qu'un toit
  controls.maxDistance = Math.max(dist * 1.2, size * 3);
  controls.minPolarAngle = 0.12;
  controls.maxPolarAngle = 1.22; // on ne passe jamais sous le socle
  controls.screenSpacePanning = false;
  // Tactile, comme une carte : un doigt déplace ; les gestes à deux doigts (pincer, tourner,
  // incliner) sont gérés par scene/touch.ts, d'où TWO désactivé ici (-1 = aucun geste)
  controls.touches = { ONE: THREE.TOUCH.PAN, TWO: -1 as unknown as THREE.TOUCH };
  controls.target.set(-size * 0.04, 0, size * 0.06); // léger décalage : le bord proche paraît plus grand
  camera.position.add(controls.target);
  controls.update();

  // Lumière : ciel chaud + soleil rasant d'après-midi qui dessine les rues
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x6b5a4a, 1.1);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffe2b8, 2.4);
  sun.position.set(-size * 0.45, size * 0.8, size * 0.35);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const s = size * 0.62;
  Object.assign(sun.shadow.camera, { left: -s, right: s, top: s, bottom: -s, near: 10, far: size * 3 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun);
  const fill = new THREE.DirectionalLight(0xc8dcff, 0.35);
  fill.position.set(size, size * 0.4, -size);
  scene.add(fill);

  const clampTarget = () => {
    const t = controls.target;
    t.x = THREE.MathUtils.clamp(t.x, bounds.minX, bounds.maxX);
    t.z = THREE.MathUtils.clamp(t.z, -bounds.maxY, -bounds.minY);
    t.y = heightAt(t.x, -t.z); // la cible suit le relief
    // De près, la caméra reste au-dessus des toits (≈ 30 m au-dessus du sol) : elle ne rentre ni dans
    // un bâtiment ni dans une colline ; au zoom maximum, la vue plonge donc davantage sur les rues
    const floor = heightAt(camera.position.x, -camera.position.z) + 30;
    if (camera.position.y < floor) camera.position.y = floor;
  };

  window.addEventListener('resize', () => {
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });

  // Vol de caméra vers un point (interrompu dès que l'utilisateur reprend la main)
  let flight: { target: THREE.Vector3; pos: THREE.Vector3 } | null = null;
  let turn: { from: number; to: number; t: number } | null = null; // rotation vers le nord
  controls.addEventListener('start', () => { flight = null; turn = null; });
  const flyTo = (x: number, z: number, distance = 380) => {
    const target = new THREE.Vector3(x, heightAt(x, -z), z);
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    const pos = target.clone().addScaledVector(dir, distance * 0.75);
    pos.y = target.y + distance * 0.7; // au-dessus du sol visé (relief), pas au-dessus de 0
    flight = { target, pos };
  };
  /** Zoom vers un point du monde en gardant l'angle de vue (double toucher). */
  const zoomTo = (point: THREE.Vector3, factor = 0.45) => {
    const offset = camera.position.clone().sub(controls.target);
    const len = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
    flight = { target: point.clone(), pos: point.clone().addScaledVector(offset.normalize(), len) };
  };
  /** Vol vers un point avec une distance et une inclinaison données (mode balade) ; garde le cap de la vue */
  const flyToView = (x: number, z: number, distance: number, polarDeg: number) => {
    const target = new THREE.Vector3(x, heightAt(x, -z), z);
    const dir = camera.position.clone().sub(controls.target).setY(0).normalize();
    const polar = THREE.MathUtils.degToRad(polarDeg);
    const pos = target.clone().addScaledVector(dir, distance * Math.sin(polar));
    pos.y = target.y + distance * Math.cos(polar);
    flight = { target, pos };
  };
  /**
   * Suivi d'un point (mode balade) : la cible et la caméra se translatent du même vecteur, donc cap, zoom et
   * inclinaison ne changent pas ; la caméra suit aussi le dénivelé. `k` : part de l'écart rattrapée à cette image (0 à 1).
   */
  const follow = (x: number, z: number, k: number) => {
    const t = controls.target;
    const gap = Math.hypot(x - t.x, z - t.z);
    if (gap < 0.05) { if (gap === 0) return; k = 1; } // seuil d'arrêt : la caméra s'arrête franchement
    const dx = (x - t.x) * k, dz = (z - t.z) * k;
    const ny = heightAt(t.x + dx, -(t.z + dz));
    const dy = ny - t.y;
    t.set(t.x + dx, ny, t.z + dz);
    camera.position.set(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz);
  };
  /** Distance (m) de la cible au point suivi, pour savoir si la caméra a fini de le rattraper */
  const followGap = (x: number, z: number) => Math.hypot(x - controls.target.x, z - controls.target.z);
  /** Limites de zoom (le mode balade s'approche plus que la carte libre) */
  const setLimits = (min: number, max: number) => { controls.minDistance = min; controls.maxDistance = max; };
  const limits = () => ({ min: controls.minDistance, max: controls.maxDistance });
  const isFlying = () => flight !== null;
  /** Cap de la vue en degrés : 0 = nord en haut, 90 = est en haut… (sens horaire). */
  const heading = () => { // appelé à chaque image : pas de vecteur créé
    return THREE.MathUtils.radToDeg(Math.atan2(camera.position.x - controls.target.x, camera.position.z - controls.target.z));
  };
  /** Remet le nord en haut en tournant autour du point visé (boussole). */
  const resetNorth = () => {
    flight = null;
    const o = camera.position.clone().sub(controls.target);
    turn = { from: Math.atan2(o.x, o.z), to: 0, t: 0 };
  };
  const updateFlight = (dt: number) => {
    if (turn) {
      turn.t = Math.min(1, turn.t + dt / 0.6);
      const e = 1 - (1 - turn.t) ** 3;
      const o = camera.position.clone().sub(controls.target);
      const r = Math.hypot(o.x, o.z), a = turn.from + (turn.to - turn.from) * e;
      camera.position.set(controls.target.x + r * Math.sin(a), camera.position.y, controls.target.z + r * Math.cos(a));
      if (turn.t >= 1) turn = null;
    }
    if (!flight) return;
    const k = 1 - Math.exp(-dt * 3.2);
    controls.target.lerp(flight.target, k);
    camera.position.lerp(flight.pos, k);
    if (camera.position.distanceTo(flight.pos) < 0.5) flight = null;
  };

  return { renderer, scene, camera, controls, clampTarget, flyTo, flyToView, follow, followGap, setLimits, limits, isFlying, zoomTo, heading, resetNorth, updateFlight, size, lights: { sun, hemi, fill } };
}
