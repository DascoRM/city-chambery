import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { weatherSurface, weatherUniforms } from './weather-surface';

/** Faux shader : le morceau du fragment standard que le crochet modifie */
const shader = () => ({
  uniforms: {} as Record<string, { value: unknown }>,
  vertexShader: '#include <common>\nvoid main() {}',
  fragmentShader: '#include <common>\nvoid main() {\n#include <emissivemap_fragment>\n#include <lights_physical_fragment>\n}',
});

describe('crochet « sol mouillé » posé au démarrage (EP009-US005)', () => {
  it('ajoute l’uniforme partagé et le calcul juste après l’émissif, sans toucher au reste', () => {
    const s = shader();
    const mat = weatherSurface(new THREE.MeshStandardMaterial());
    mat.onBeforeCompile(s as never, {} as never);
    expect(s.uniforms.uWet).toBe(weatherUniforms.uWet);
    expect(s.fragmentShader).toMatch(/uniform float uWet;/);
    expect(s.fragmentShader.indexOf('if (uWet > 0.0)')).toBeGreaterThan(s.fragmentShader.indexOf('#include <emissivemap_fragment>'));
    expect(s.fragmentShader.indexOf('if (uWet > 0.0)')).toBeLessThan(s.fragmentShader.indexOf('#include <lights_physical_fragment>'));
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
    expect(s.fragmentShader).toMatch(/uniform float uWet;/);
    expect(mat.customProgramCacheKey()).toBe('road-asphalt|wet');
  });
  it('par beau temps, l’uniforme vaut 0 : la branche n’est pas prise', () => {
    expect(weatherUniforms.uWet.value).toBe(0);
  });
});
