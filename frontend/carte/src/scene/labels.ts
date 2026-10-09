import * as THREE from 'three';
import type { HeightFn, Label } from '../types';

const STYLE = {
  park: { color: '#355e2b', halo: 'rgba(250, 246, 232, 0.92)' },
  water: { color: '#1f5d88', halo: 'rgba(240, 248, 252, 0.92)' },
};
const FONT_FAMILY = 'Fraunces, Georgia, serif';

/** Texte dessiné sur un canvas, affiché en sprite (toujours face à la caméra). */
function makeSprite(label: Label, ground = 0): THREE.Sprite {
  const style = STYLE[label.kind];
  const px = 64; // résolution du texte
  const font = `italic 600 ${px}px ${FONT_FAMILY}`;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(label.text).width) + px * 0.6;
  const h = Math.ceil(px * 1.5);
  canvas.width = w;
  canvas.height = h;
  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = px * 0.22;
  ctx.strokeStyle = style.halo;
  ctx.strokeText(label.text, w / 2, h / 2);
  ctx.fillStyle = style.color;
  ctx.fillText(label.text, w / 2, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
  const sprite = new THREE.Sprite(mat);
  const worldH = Math.min(label.size, 11) * 1.25;
  sprite.scale.set((worldH * w) / h, worldH, 1);
  sprite.userData.baseScale = sprite.scale.clone();
  sprite.position.set(label.pos[0], ground + (label.kind === 'park' ? 16 : 8), -label.pos[1]);
  sprite.renderOrder = 10;
  sprite.userData.label = label;
  return sprite;
}

/**
 * Noms des parcs et cours d'eau. Les petits parcs n'apparaissent qu'en s'approchant,
 * pour ne pas surcharger la vue d'ensemble.
 */
export async function buildLabels(labels: Label[], heightAt: HeightFn = () => 0) {
  try {
    await document.fonts.load(`italic 600 64px Fraunces`);
  } catch {
    /* police indisponible : Georgia prend le relais */
  }
  const root = new THREE.Group();
  root.name = 'labels';
  const sprites = labels.map((l) => makeSprite(l, heightAt(l.pos[0], l.pos[1])));
  root.add(...sprites);

  const tmp = new THREE.Vector3();
  const update = (camera: THREE.Camera) => {
    for (const s of sprites) {
      const { size } = s.userData.label as Label;
      const d = camera.position.distanceTo(tmp.copy(s.position));
      // Portée d'affichage proportionnelle à la taille du parc
      const reach = 500 + size * 90;
      const o = THREE.MathUtils.clamp((reach - d) / 250, 0, 1);
      (s.material as THREE.SpriteMaterial).opacity = o;
      // De très près, on réduit l'étiquette pour qu'elle ne masque pas la scène
      s.scale.copy(s.userData.baseScale as THREE.Vector3).multiplyScalar(THREE.MathUtils.clamp(d / 450, 0.35, 1));
      s.visible = o > 0.01;
    }
  };
  return { root, update };
}
