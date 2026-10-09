import * as THREE from 'three';
import type { CityData, Ticker } from '../types';

/**
 * Pluie PROTOTYPE pour la mesure sur téléphone (EP009-US001) : `?debug&rain=2500`. Chargée à la demande (chunk à part),
 * jamais sans `?debug`. Ce n'est pas la pluie finale (US005 : deux nappes, sol mouillé, intensité), mais elle coûte la même
 * chose au processeur graphique : un seul appel de rendu, positions calculées dans le vertex shader à partir du temps
 * (aucune mise à jour des sommets par le processeur), tampon fixe.
 *  - Une traînée = un quadrilatère (4 sommets), épaisseur constante en pixels (élargie perpendiculairement au trait à l'écran).
 *  - Boîte ancrée dans le monde autour du point regardé (`mod`) : les gouttes ne glissent pas quand on déplace la carte.
 *  - Au-dessus du socle seulement (D11) : une goutte hors du socle est écartée dans le vertex shader, sans coût.
 *  - Elle apparaît 2 s après son chargement, pour que le compteur montre l'éventuel à-coup de son apparition (« pire »).
 */
export function installRainProto(o: {
  scene: THREE.Scene; camera: THREE.Camera; focus(): THREE.Vector3; bounds: CityData['bounds']; count: number;
}): Ticker & { mesh: THREE.Mesh; count: number } {
  const count = Math.round(THREE.MathUtils.clamp(o.count, 1, 50000));
  const seeds = new Float32Array(count * 4 * 4);
  const corners = new Float32Array(count * 4 * 2);
  const index = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const s = [Math.random(), Math.random(), Math.random(), Math.random()];
    for (let k = 0; k < 4; k++) {
      seeds.set(s, (i * 4 + k) * 4);
      corners.set([k >> 1, k & 1 ? 1 : -1], (i * 4 + k) * 2);
    }
    const b = i * 4;
    index.set([b, b + 1, b + 2, b + 2, b + 1, b + 3], i * 6);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 4 * 3), 3)); // inutilisé (three.js l'exige)
  geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 4));
  geo.setAttribute('aCorner', new THREE.BufferAttribute(corners, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));

  const b = o.bounds;
  const uniforms = {
    uTime: { value: 0 },
    uCenter: { value: new THREE.Vector3() },
    uHalf: { value: new THREE.Vector2(300, 150) },
    uFall: { value: 60 },
    uWind: { value: new THREE.Vector2(6, -3) },
    uLen: { value: 8 },
    uWidth: { value: 1.4 },
    uRes: { value: new THREE.Vector2(1280, 800) },
    uOpacity: { value: 0.45 },
    uColor: { value: new THREE.Color('#dfe8f2') },
    uBounds: { value: new THREE.Vector4(b.minX, b.maxX, -b.maxY, -b.minY) }, // socle : minX, maxX, minZ, maxZ (repère three.js)
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide, // l'orientation du quadrilatère dépend du sens du trait à l'écran
    vertexShader: /* glsl */ `
      attribute vec4 aSeed; attribute vec2 aCorner;
      uniform float uTime, uFall, uLen, uWidth, uOpacity;
      uniform vec3 uCenter; uniform vec2 uHalf, uWind, uRes; uniform vec4 uBounds;
      varying float vAlpha; varying float vSide; varying float vAlong;
      void main() {
        float speed = uFall * (0.85 + 0.3 * aSeed.w);
        vec3 vel = vec3(uWind.x, -speed, uWind.y);
        float B = uHalf.x, H = uHalf.y;
        vec3 p = vec3(aSeed.x * 2.0 * B, aSeed.z * H, aSeed.y * 2.0 * B) + vel * uTime;
        p.xz = uCenter.xz + mod(p.xz - uCenter.xz + B, 2.0 * B) - B;
        p.y = uCenter.y + mod(p.y - uCenter.y, H);
        // Au-dessus du socle seulement (D11), fondu sur 25 m au bord
        float inside = min(min(p.x - uBounds.x, uBounds.y - p.x), min(p.z - uBounds.z, uBounds.w - p.z));
        if (inside < 0.0) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); vAlpha = 0.0; vSide = 0.0; vAlong = 0.0; return; }
        vec3 tail = p - normalize(vel) * uLen;
        vec2 e = abs(p.xz - uCenter.xz) / B;
        float edge = 1.0 - smoothstep(0.7, 1.0, max(e.x, e.y));
        float topFade = 1.0 - smoothstep(0.75, 1.0, (p.y - uCenter.y) / H);
        vec4 c0 = projectionMatrix * viewMatrix * vec4(p, 1.0);
        vec4 c1 = projectionMatrix * viewMatrix * vec4(tail, 1.0);
        vec4 c = mix(c0, c1, aCorner.x);
        vec2 d = c1.xy / c1.w * uRes - c0.xy / c0.w * uRes;
        vec2 dir = length(d) > 1e-4 ? normalize(d) : vec2(0.0, 1.0);
        c.xy += vec2(-dir.y, dir.x) * aCorner.y * uWidth / uRes * c.w;
        gl_Position = c;
        vAlpha = uOpacity * edge * topFade * smoothstep(0.0, 25.0, inside);
        vSide = aCorner.y; vAlong = aCorner.x;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      varying float vAlpha; varying float vSide; varying float vAlong;
      void main() {
        gl_FragColor = vec4(uColor, vAlpha * (1.0 - vSide * vSide) * mix(1.0, 0.2, vAlong));
      }`,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'rain-proto';
  mesh.frustumCulled = false; // positions calculées dans le shader : la boîte englobante ne veut rien dire
  mesh.renderOrder = 6;
  mesh.visible = false;
  const size = new THREE.Vector2();
  mesh.onBeforeRender = (renderer) => uniforms.uRes.value.copy(renderer.getDrawingBufferSize(size));
  o.scene.add(mesh);
  window.setTimeout(() => { mesh.visible = true; }, 2000);

  let B = 0;
  return {
    mesh,
    count,
    update(_dt, t) {
      if (!mesh.visible) return;
      const f = o.focus(), cam = o.camera.position;
      const dist = cam.distanceTo(f);
      uniforms.uTime.value = t;
      uniforms.uCenter.value.copy(f);
      // Boîte proportionnelle à la distance (densité à l'écran à peu près constante), recalculée par paliers de 25 %
      const want = THREE.MathUtils.clamp(dist * 0.45, 80, 800);
      if (!B || Math.abs(want - B) / B > 0.25) B = want;
      uniforms.uHalf.value.set(B, Math.min(B * 0.6, (cam.y - f.y) * 0.6));
      uniforms.uLen.value = THREE.MathUtils.clamp(dist * 0.01, 2.5, 30);
      uniforms.uFall.value = THREE.MathUtils.clamp(dist * 0.12, 25, 320);
    },
  };
}
export type RainProto = ReturnType<typeof installRainProto>;
