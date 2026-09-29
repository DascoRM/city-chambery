import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { CityData, PlacedPoi, Pt } from '../types';
import { buildElephantsFountain } from './models/elephants';
import { buildCathedrale } from './models/cathedrale';
import { buildChateau } from './models/chateau';
import { buildCarreCurial } from './models/carrecurial';
import { dataUrl } from '../dataurl';

/**
 * Monuments modélisés (src/content/models.json).
 *
 * source :
 *  - "procedural:<nom>" → modèle généré en code (voir PROCEDURAL ci-dessous) ;
 *  - "models/<fichier>.glb" → fichier glTF dans public/models/ (export Blender).
 * Convention glTF : unité = mètre, origine au centre de la base, axe Y vers le haut.
 *
 * Position : "pos" [x, y] en mètres si présent, sinon la position du lieu "poi".
 * rotation : degrés, sens trigonométrique vu du ciel (0 = axe +X = vers l'est).
 * hideOsm : identifiants OSM des bâtiments à masquer sous le modèle.
 */
export interface ModelEntry {
  id: string;
  source: string;
  poi?: string;
  pos?: Pt;
  rotation?: number;
  scale?: number;
  hideOsm?: number[];
}

/** Contexte passé aux modèles générés en code (ex. : intensité de la nuit pour la mise en lumière). */
export interface ModelContext {
  night: { value: number };
  data?: CityData;
  /** Altitude du sol (relief) en coordonnées OSM projetées */
  heightAt?: (x: number, y: number) => number;
  /** Altitude la plus basse sous une emprise */
  minUnder?: (ring: Pt[]) => number;
  /** Altitude du sol à l'emplacement du modèle (renseignée par buildModels) */
  ground?: number;
}

const PROCEDURAL: Record<string, (ctx: ModelContext) => THREE.Object3D> = {
  'fontaine-elephants': buildElephantsFountain,
  cathedrale: buildCathedrale,
  chateau: buildChateau,
  'carre-curial': buildCarreCurial,
};

export function hiddenBuildings(entries: ModelEntry[]): Set<number> {
  return new Set(entries.flatMap((e) => e.hideOsm ?? []));
}

export async function buildModels(entries: ModelEntry[], pois: PlacedPoi[], ctx: ModelContext): Promise<THREE.Group> {
  const root = new THREE.Group();
  root.name = 'models';
  const loader = new GLTFLoader();

  await Promise.all(
    entries.map(async (e) => {
      const pos = e.pos ?? pois.find((p) => p.id === e.poi)?.position;
      if (!pos) {
        console.warn(`[modèle] « ${e.id} » sans position (ni pos, ni poi trouvé)`);
        return;
      }
      let obj: THREE.Object3D;
      try {
        if (e.source.startsWith('procedural:')) {
          const make = PROCEDURAL[e.source.slice('procedural:'.length)];
          if (!make) throw new Error(`modèle procédural inconnu : ${e.source}`);
          const ground = e.pos && e.pos[0] === 0 && e.pos[1] === 0 ? 0 : (ctx.heightAt?.(pos[0], pos[1]) ?? 0);
          obj = make({ ...ctx, ground });
        } else {
          const gltf = await loader.loadAsync(dataUrl(e.source));
          obj = gltf.scene;
          obj.traverse((o) => {
            if ((o as THREE.Mesh).isMesh) o.castShadow = o.receiveShadow = true;
          });
        }
      } catch (err) {
        console.warn(`[modèle] « ${e.id} » non chargé :`, err);
        return;
      }
      const holder = new THREE.Group();
      holder.name = e.id;
      // Modèles en coordonnées absolues (pos [0, 0]) : ils gèrent eux-mêmes le relief
      const absolute = pos[0] === 0 && pos[1] === 0;
      holder.position.set(pos[0], absolute ? 0 : (ctx.heightAt?.(pos[0], pos[1]) ?? 0), -pos[1]);
      holder.rotation.y = THREE.MathUtils.degToRad(e.rotation ?? 0);
      holder.scale.setScalar(e.scale ?? 1);
      holder.add(obj);
      root.add(holder);
    }),
  );
  return root;
}
