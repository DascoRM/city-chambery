import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Effet tilt-shift (« effet maquette ») : une bande horizontale nette autour du point visé,
 * le haut et le bas de l'image de plus en plus flous, comme une photo de maquette à faible
 * profondeur de champ.
 *
 * Chaîne de rendu (itération 29, allégée pour les écrans haute densité) :
 *  1. la scène est dessinée une fois, anticrénelée (MSAA), dans une texture pleine résolution ;
 *  2. le flou gaussien séparable (horizontal puis vertical) est calculé en DEMI-résolution,
 *     sans anticrénelage (un flou n'en a pas besoin) : 4 fois moins de pixels ;
 *  3. une seule passe finale mélange l'image nette et l'image floue selon la distance à la bande,
 *     puis applique le rendu des tons et la conversion de couleurs vers l'écran ;
 *  4. les étiquettes (parcs, rivière) sont dessinées par-dessus, nettes.
 * Avant : 4 passes plein écran sur des textures anticrénelées (EffectComposer).
 */

/** Poids de flou selon la position verticale : 0 dans la bande nette, 1 loin de la bande. */
const WEIGHT_GLSL = /* glsl */ `
  uniform float uFocus, uBand, uFalloff;
  float blurWeight(float y) { return smoothstep(uBand, uBand + uFalloff, abs(y - uFocus)); }
`;

const blurMaterial = (dir: THREE.Vector2) =>
  new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: null as THREE.Texture | null },
      uDir: { value: dir },
      uTexel: { value: new THREE.Vector2(1 / 512, 1 / 512) },
      uFocus: { value: 0.5 },
      uBand: { value: 0.1 },
      uFalloff: { value: 0.35 },
      uMaxBlur: { value: 3.0 }, // rayon maximal, en pixels de la texture demi-résolution
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform vec2 uDir, uTexel;
      uniform float uMaxBlur;
      varying vec2 vUv;
      ${WEIGHT_GLSL}
      void main() {
        float r = blurWeight(vUv.y) * uMaxBlur;
        if (r < 0.05) { gl_FragColor = texture2D(tDiffuse, vUv); return; }
        // Gaussienne à 9 échantillons, étalée sur le rayon r
        vec2 st = uDir * uTexel * (r / 4.0);
        vec4 sum = texture2D(tDiffuse, vUv) * 0.2270270;
        sum += texture2D(tDiffuse, vUv + st * 1.0) * 0.1945946;
        sum += texture2D(tDiffuse, vUv - st * 1.0) * 0.1945946;
        sum += texture2D(tDiffuse, vUv + st * 2.0) * 0.1216216;
        sum += texture2D(tDiffuse, vUv - st * 2.0) * 0.1216216;
        sum += texture2D(tDiffuse, vUv + st * 3.0) * 0.0540541;
        sum += texture2D(tDiffuse, vUv - st * 3.0) * 0.0540541;
        sum += texture2D(tDiffuse, vUv + st * 4.0) * 0.0162162;
        sum += texture2D(tDiffuse, vUv - st * 4.0) * 0.0162162;
        gl_FragColor = sum;
      }`,
    depthTest: false,
    depthWrite: false,
  });

/**
 * Passe finale : net ↔ flou selon la bande, puis rendu des tons + conversion sRGB (vers l'écran).
 * Météo (EP009), posé dès le démarrage et inactif par défaut (image identique au bit près) ; le régler ensuite ne recompile rien :
 *  - `uUnpremult` (0..1) : correction des couleurs prémultipliées par l'alpha (bords anticrénelés du socle, particules sur le fond
 *    transparent) : division par l'alpha avant le rendu des tons et la conversion sRGB, qui ne sont pas linéaires, puis
 *    multiplication après. Sans elle, avec le brouillard, les bords sont plus clairs que le fond (liseré clair autour du socle). À
 *    n'activer qu'avec le brouillard (US006) : elle éteint en partie les halos des bars posés sur le fond, la nuit (lueur
 *    additive : son alpha n'est pas une couverture) ;
 *  - `uVeil` (voile, couleur d'écran `uVeilColor`) et `uFlash` (éclair), pondérés par la couverture : le fond de page n'est pas touché.
 */
const compositeMaterial = () =>
  new THREE.ShaderMaterial({
    uniforms: {
      tSharp: { value: null as THREE.Texture | null },
      tBlur: { value: null as THREE.Texture | null },
      uFocus: { value: 0.5 },
      uBand: { value: 0.1 },
      uFalloff: { value: 0.35 },
      uMix: { value: 1.0 }, // 0 = tout net (effet coupé), 1 = effet complet
      uUnpremult: { value: 0 }, // correction des couleurs prémultipliées : 0 = aucune (par défaut), 1 = complète
      uVeil: { value: 0 }, // 0 = pas de voile, 1 = couleur du voile partout
      uVeilColor: { value: new THREE.Vector3() }, // couleur d'écran (sRGB 0..1) : celle du fond de page
      uFlash: { value: 0 }, // éclair : 0 = aucun
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tSharp, tBlur;
      uniform float uMix, uUnpremult, uVeil, uFlash;
      uniform vec3 uVeilColor;
      varying vec2 vUv;
      ${WEIGHT_GLSL}
      void main() {
        // Le flou « prend le dessus » vite hors de la bande (comme l'ancien flou à rayon variable)
        float w = clamp(blurWeight(vUv.y) * 4.0, 0.0, 1.0) * uMix;
        gl_FragColor = mix(texture2D(tSharp, vUv), texture2D(tBlur, vUv), w);
        float a = min(gl_FragColor.a, 1.0), k = a > 0.0 ? mix(1.0, a, uUnpremult) : 1.0;
        gl_FragColor.rgb /= k;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        gl_FragColor.rgb = mix(gl_FragColor.rgb * k, uVeilColor * a, uVeil) + uFlash * a * vec3(0.85, 0.9, 1.0);
      }`,
    depthTest: false,
    depthWrite: false,
  });

export function createTiltShift(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  camera: THREE.PerspectiveCamera,
  overlay: THREE.Object3D,
) {
  const rtOpts = { type: THREE.HalfFloatType, depthBuffer: false };
  const sceneRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const halfA = new THREE.WebGLRenderTarget(1, 1, rtOpts);
  const halfB = new THREE.WebGLRenderTarget(1, 1, rtOpts);

  const blurH = blurMaterial(new THREE.Vector2(1, 0));
  const blurV = blurMaterial(new THREE.Vector2(0, 1));
  const composite = compositeMaterial();
  const quad = new FullScreenQuad();

  // Les étiquettes restent nettes : scène à part, dessinée par-dessus le résultat
  const overlayScene = new THREE.Scene();
  overlayScene.add(overlay);

  let enabled = true;
  const projected = new THREE.Vector3();

  const setSize = (w: number, h: number) => {
    const pr = renderer.getPixelRatio();
    const W = Math.max(1, Math.round(w * pr)), H = Math.max(1, Math.round(h * pr));
    sceneRT.setSize(W, H);
    // Anticrénelage ×4 à densité 1 ; ×2 sur écran haute densité (les pixels y sont déjà petits)
    sceneRT.samples = pr >= 1.5 ? 2 : 4;
    const hw = Math.max(1, Math.round(W / 2)), hh = Math.max(1, Math.round(H / 2));
    halfA.setSize(hw, hh);
    halfB.setSize(hw, hh);
    for (const m of [blurH, blurV]) m.uniforms.uTexel.value.set(1 / hw, 1 / hh);
  };
  setSize(renderer.domElement.clientWidth || window.innerWidth, renderer.domElement.clientHeight || window.innerHeight);

  /** À appeler à chaque image : cale la bande nette sur le point visé et dose le flou selon le zoom. */
  const update = (focus: THREE.Vector3, zoomRef: number) => {
    projected.copy(focus).project(camera);
    const focusY = THREE.MathUtils.clamp((projected.y + 1) / 2, 0.2, 0.8);
    // Plus on est loin, plus l'effet maquette est marqué ; de près il s'estompe
    const dist = camera.position.distanceTo(focus);
    const strength = THREE.MathUtils.clamp(dist / zoomRef, 0.25, 1);
    // Même rayon à l'écran qu'avant (7 px × densité), exprimé en pixels demi-résolution
    const maxBlur = (7 * renderer.getPixelRatio() * strength) / 2;
    blurH.uniforms.uFocus.value = blurV.uniforms.uFocus.value = composite.uniforms.uFocus.value = focusY;
    blurH.uniforms.uMaxBlur.value = blurV.uniforms.uMaxBlur.value = maxBlur;
  };

  const pass = (material: THREE.ShaderMaterial, target: THREE.WebGLRenderTarget | null) => {
    quad.material = material;
    renderer.setRenderTarget(target);
    quad.render(renderer);
  };

  const render = () => {
    // 1. Scène nette, anticrénelée
    renderer.setRenderTarget(sceneRT);
    renderer.clear();
    renderer.render(scene, camera);
    if (enabled) {
      // 2. Flou en demi-résolution
      blurH.uniforms.tDiffuse.value = sceneRT.texture;
      pass(blurH, halfA);
      blurV.uniforms.tDiffuse.value = halfA.texture;
      pass(blurV, halfB);
    }
    // 3. Mélange net / flou + sortie écran
    composite.uniforms.tSharp.value = sceneRT.texture;
    composite.uniforms.tBlur.value = (enabled ? halfB : sceneRT).texture;
    composite.uniforms.uMix.value = enabled ? 1 : 0;
    pass(composite, null);
    // 4. Étiquettes par-dessus
    renderer.autoClear = false;
    renderer.render(overlayScene, camera);
    renderer.autoClear = true;
  };

  return {
    render,
    update,
    setSize,
    setEnabled: (v: boolean) => (enabled = v),
    /** Météo (EP009) : correction prémultipliée (US006), voile (couleur d'écran sRGB 0..1) et éclair (US008), de 0 à 1 ; tout à 0 : image inchangée */
    setWeather: (w: { unpremult?: number; veil?: number; veilColor?: readonly [number, number, number]; flash?: number }) => {
      const u = composite.uniforms;
      if (w.unpremult !== undefined) u.uUnpremult.value = w.unpremult;
      if (w.veil !== undefined) u.uVeil.value = w.veil;
      if (w.veilColor) u.uVeilColor.value.set(...w.veilColor);
      if (w.flash !== undefined) u.uFlash.value = w.flash;
    },
    isEnabled: () => enabled,
  };
}
