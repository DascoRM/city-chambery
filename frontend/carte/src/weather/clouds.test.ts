import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { WEATHER_PRESETS } from '../../../../contrat/meteo.js';
import { CLOUD_COUNT, cloudShare, createClouds } from './clouds';

const BOUNDS = { minX: -662.4, minY: -583.4, maxX: 662.4, maxY: 583.4 }; // socle de city.json

describe('nuages de maquette (EP009-US010)', () => {
  it('aucun par ciel dégagé ni sous 20 % de nuages, comme le ciel ; quelques-uns par éclaircies, tous par temps couvert', () => {
    expect(cloudShare(WEATHER_PRESETS.clear.cloudCover, 0, 12)).toBe(0);
    expect(cloudShare(0.2, 0, 12)).toBe(0);
    const partly = cloudShare(WEATHER_PRESETS.partly.cloudCover, 0, 12);
    expect(partly).toBeGreaterThan(2);
    expect(partly).toBeLessThan(6);
    expect(cloudShare(WEATHER_PRESETS.cloudy.cloudCover, 0, 12)).toBe(12);
    expect(cloudShare(WEATHER_PRESETS.rain.cloudCover, 0, 12)).toBe(12);
  });
  it('nombre croissant avec la couverture, sans saut', () => {
    for (let c = 0; c < 1; c += 0.01) {
      expect(cloudShare(c + 0.01, 0, 12)).toBeGreaterThanOrEqual(cloudShare(c, 0, 12));
      expect(cloudShare(c + 0.01, 0, 12) - cloudShare(c, 0, 12)).toBeLessThan(0.2);
    }
  });
  it('effacés par le brouillard (ils flotteraient, nets, au-dessus) ; aucun en qualité basse', () => {
    expect(cloudShare(1, WEATHER_PRESETS.fog.fog, 12)).toBe(0);
    expect(CLOUD_COUNT.low).toBe(0);
    expect(cloudShare(1, 0, CLOUD_COUNT.low)).toBe(0);
    expect(CLOUD_COUNT).toEqual({ low: 0, medium: 6, high: 12 });
  });
  it('un seul maillage instancié, posé hors du socle au départ, entre 130 et 260 m au-dessus du sol, toujours la même ronde', () => {
    const at = () => {
      const scene = new THREE.Scene();
      createClouds(scene, 12, BOUNDS, 250);
      const mesh = scene.getObjectByName('clouds') as THREE.InstancedMesh;
      const m = new THREE.Matrix4(), p = new THREE.Vector3();
      return Array.from({ length: mesh.count }, (_, i) => { mesh.getMatrixAt(i, m); return p.setFromMatrixPosition(m).toArray(); });
    };
    const a = at();
    expect(a.length).toBe(12);
    for (const [px, py, pz] of a) {
      expect(Math.max(Math.abs(px) - BOUNDS.maxX, Math.abs(pz) - BOUNDS.maxY)).toBeGreaterThanOrEqual(180);
      expect(py).toBeGreaterThanOrEqual(250 + 130);
      expect(py).toBeLessThanOrEqual(250 + 260);
    }
    expect(at()).toEqual(a);
  });
});
