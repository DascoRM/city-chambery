import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/**
 * Effet tilt-shift (« effet maquette ») : une bande horizontale nette autour du point visé,
 * le haut et le bas de l'image de plus en plus flous, comme une photo de maquette à faible
 * profondeur de champ. Flou gaussien séparable (horizontal puis vertical), en espace écran.
 *
 * Les étiquettes (parcs, rivière) sont dessinées après le flou pour rester lisibles.
 */
const TiltShiftShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    uDir: { value: new THREE.Vector2(1, 0) },
    uTexel: { value: new THREE.Vector2(1 / 1024, 1 / 1024) },
    uFocus: { value: 0.5 }, // position verticale de la bande nette (0 = bas, 1 = haut)
    uBand: { value: 0.1 }, // demi-hauteur de la bande nette
    uFalloff: { value: 0.35 }, // distance sur laquelle le flou monte au maximum
    uMaxBlur: { value: 6.0 }, // rayon maximal du flou, en pixels
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 uDir, uTexel;
    uniform float uFocus, uBand, uFalloff, uMaxBlur;
    varying vec2 vUv;
    void main() {
      float d = abs(vUv.y - uFocus);
      float r = smoothstep(uBand, uBand + uFalloff, d) * uMaxBlur;
      if (r < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
      // Gaussienne à 9 échantillons, étalée sur le rayon r
      vec2 step = uDir * uTexel * (r / 4.0);
      vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270;
      sum += texture2D(tDiffuse, vUv + step * 1.0) * 0.1945946;
      sum += texture2D(tDiffuse, vUv - step * 1.0) * 0.1945946;
      sum += texture2D(tDiffuse, vUv + step * 2.0) * 0.1216216;
      sum += texture2D(tDiffuse, vUv - step * 2.0) * 0.1216216;
      sum += texture2D(tDiffuse, vUv + step * 3.0) * 0.0540541;
      sum += texture2D(tDiffuse, vUv - step * 3.0) * 0.0540541;
      sum += texture2D(tDiffuse, vUv + step * 4.0) * 0.0162162;
      sum += texture2D(tDiffuse, vUv - step * 4.0) * 0.0162162;
      gl_FragColor = sum;
    }`,
};

export function createTiltShift(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  overlay: THREE.Object3D,
) {
  const size = renderer.getSize(new THREE.Vector2());
  const target = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(size.x, size.y);

  const scenePass = new RenderPass(scene, camera);
  scenePass.clearAlpha = 0; // fond transparent : le dégradé CSS reste visible
  const blurH = new ShaderPass(TiltShiftShader);
  const blurV = new ShaderPass(TiltShiftShader);
  blurV.uniforms.uDir.value.set(0, 1);

  // Les étiquettes restent nettes : scène à part, dessinée par-dessus le flou
  const overlayScene = new THREE.Scene();
  overlayScene.add(overlay);
  const overlayPass = new RenderPass(overlayScene, camera);
  overlayPass.clear = false;

  composer.addPass(scenePass);
  composer.addPass(blurH);
  composer.addPass(blurV);
  composer.addPass(overlayPass);
  composer.addPass(new OutputPass());

  let enabled = true;
  const projected = new THREE.Vector3();

  const setSize = (w: number, h: number) => {
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
  };

  /** À appeler à chaque image : cale la bande nette sur le point visé et dose le flou selon le zoom. */
  const update = (focus: THREE.Vector3, zoomRef: number) => {
    projected.copy(focus).project(camera);
    const focusY = THREE.MathUtils.clamp((projected.y + 1) / 2, 0.2, 0.8);
    // Plus on est loin, plus l'effet maquette est marqué ; de près il s'estompe
    const dist = camera.position.distanceTo(focus);
    const strength = THREE.MathUtils.clamp(dist / zoomRef, 0.25, 1);
    const pr = renderer.getPixelRatio();
    const w = renderer.domElement.width, h = renderer.domElement.height;
    for (const pass of [blurH, blurV]) {
      pass.uniforms.uFocus.value = focusY;
      pass.uniforms.uMaxBlur.value = 7 * pr * strength;
      pass.uniforms.uTexel.value.set(1 / w, 1 / h);
    }
  };

  const render = () => {
    if (enabled) {
      composer.render();
    } else {
      renderer.render(scene, camera);
      renderer.autoClear = false;
      renderer.render(overlayScene, camera);
      renderer.autoClear = true;
    }
  };

  return {
    render,
    update,
    setSize,
    setEnabled: (v: boolean) => (enabled = v),
    isEnabled: () => enabled,
  };
}
