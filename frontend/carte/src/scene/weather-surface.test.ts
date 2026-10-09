import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { weatherSurface, weatherUniforms } from './weather-surface';

/** Faux shader : le morceau du fragment standard que le crochet modifie */
const shader = () => ({
  uniforms: {} as Record<string, { value: unknown }>,
  vertexShader: '#include <common>\nvoid main() {}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <emissivemap_fragment>\n#include <lights_physical_fragment>\n}',
});

describe('crochets « sol mouillé » et « neige » posés au démarrage (EP009-US005, US007)', () => {
  it('ajoute les uniformes partagés et un seul morceau de calcul juste après l’émissif, sans toucher au reste', () => {
    const s = shader();
    const mat = weatherSurface(new THREE.MeshStandardMaterial());
    mat.onBeforeCompile(s as never, {} as never);
    expect(s.uniforms.uWet).toBe(weatherUniforms.uWet);
    expect(s.uniforms.uSnow).toBe(weatherUniforms.uSnow);
    expect(s.fragmentShader).toMatch(/uniform float uWet, uSnow, uWetK, uSnowK;/);
    const emissive = s.fragmentShader.indexOf('#include <emissivemap_fragment>'), lights = s.fragmentShader.indexOf('#include <lights_physical_fragment>');
    for (const branch of ['if (uWet * uWetK > 0.0)', 'if (uSnow * uSnowK > 0.0)']) {
      expect(s.fragmentShader.indexOf(branch)).toBeGreaterThan(emissive);
      expect(s.fragmentShader.indexOf(branch)).toBeLessThan(lights);
    }
  });
  it('chaque matériau dit combien il se mouille et blanchit, avec le même programme', () => {
    const a = weatherSurface(new THREE.MeshStandardMaterial()), b = weatherSurface(new THREE.MeshStandardMaterial(), { wet: 0, snow: 0.55 });
    const sa = shader(), sb = shader();
    a.onBeforeCompile(sa as never, {} as never);
    b.onBeforeCompile(sb as never, {} as never);
    expect([sa.uniforms.uWetK.value, sa.uniforms.uSnowK.value]).toEqual([1, 1]);
    expect([sb.uniforms.uWetK.value, sb.uniforms.uSnowK.value]).toEqual([0, 0.55]);
    expect(sb.fragmentShader).toBe(sa.fragmentShader); // réglages par uniformes : texte identique
    expect(b.customProgramCacheKey()).toBe(a.customProgramCacheKey());
  });
  it('enchaîne l’onBeforeCompile existant et étend la clé du programme', () => {
    const mat = new THREE.MeshStandardMaterial();
    let called = 0;
    mat.onBeforeCompile = (sh) => { called++; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNight;'); };
    mat.customProgramCacheKey = () => 'road-asphalt';
    weatherSurface(mat);
    const s = shader();
    mat.onBeforeCompile(s as never, {} as never);
    expect(called).toBe(1);
    expect(s.fragmentShader).toMatch(/uniform float uNight;/);
    expect(s.fragmentShader).toMatch(/uniform float uWet, uSnow/);
    expect(mat.customProgramCacheKey()).toBe('road-asphalt|wet');
  });
  it('par beau temps, les uniformes valent 0 : les branches ne sont pas prises', () => {
    expect(weatherUniforms.uWet.value).toBe(0);
    expect(weatherUniforms.uSnow.value).toBe(0);
  });
});
