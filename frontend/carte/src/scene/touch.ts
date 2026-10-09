import * as THREE from 'three';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/**
 * Gestes à deux doigts, comme sur une appli de carte (itération 27) :
 *  - pincer / écarter → zoomer ;
 *  - tourner les deux doigts → faire pivoter la carte autour du point visé ;
 *  - glisser les deux doigts vers le haut / le bas → incliner la vue.
 * Un doigt (déplacer) reste géré par OrbitControls (controls.touches.ONE = PAN, voir stage.ts).
 * Les trois gestes sont combinés : on peut zoomer et tourner en même temps.
 */
export function installTwoFingerGestures(canvas: HTMLElement, camera: THREE.PerspectiveCamera, controls: OrbitControls): void {
  const touches = new Map<number, { x: number; y: number }>();
  let last: { dist: number; angle: number; midY: number } | null = null;

  const measure = () => {
    const [a, b] = [...touches.values()];
    return { dist: Math.hypot(b.x - a.x, b.y - a.y), angle: Math.atan2(b.y - a.y, b.x - a.x), midY: (a.y + b.y) / 2 };
  };

  const offset = new THREE.Vector3(), sph = new THREE.Spherical();

  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch') return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    last = touches.size === 2 ? measure() : null;
  });
  const end = (e: PointerEvent) => {
    if (!touches.delete(e.pointerId)) return;
    last = touches.size === 2 ? measure() : null;
  };
  window.addEventListener('pointerup', end);
  window.addEventListener('pointercancel', end);
  window.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'touch' || !touches.has(e.pointerId)) return;
    touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (touches.size !== 2 || !last) return;
    const now = measure();

    offset.copy(camera.position).sub(controls.target);
    sph.setFromVector3(offset);
    // Zoom : l'écart entre les doigts
    if (now.dist > 10 && last.dist > 10) {
      sph.radius = THREE.MathUtils.clamp(sph.radius * (last.dist / now.dist), controls.minDistance, controls.maxDistance);
    }
    // Rotation : la carte suit la torsion des doigts
    let dA = now.angle - last.angle;
    if (dA > Math.PI) dA -= 2 * Math.PI;
    if (dA < -Math.PI) dA += 2 * Math.PI;
    sph.theta += dA;
    // Inclinaison : glisser vers le haut = vue plus rasante
    sph.phi = THREE.MathUtils.clamp(sph.phi - ((now.midY - last.midY) / window.innerHeight) * Math.PI * 0.8, controls.minPolarAngle, controls.maxPolarAngle);

    offset.setFromSpherical(sph);
    camera.position.copy(controls.target).add(offset);
    camera.lookAt(controls.target);
    controls.update();
    last = now;
  });
}
