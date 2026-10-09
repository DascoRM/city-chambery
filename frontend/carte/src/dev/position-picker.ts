/**
 * Outil de position (mode `?debug`, production comprise) : cliquer sur la carte donne la position (mètres du diorama),
 * l'altitude, le bâtiment, le parking et la rue les plus proches, et copie un extrait JSON prêt à coller
 * (fiche d'un lieu, retouche de parking, position d'un monument). Il remplace la conversation quand il faut
 * « dire où » quelque chose se trouve : on clique, on colle.
 * Le grand outil de placement (`placement.ts`, qui écrit `pois.json`) reste réservé à `npm run dev`.
 */
import * as THREE from 'three';
import type { CityData, Pt } from '../types';
import { pointInPoly, screenRay } from '../scene/geo';
import type { PlacementTool } from '../interaction';

interface Deps {
  root: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  canvas: HTMLCanvasElement;
  pickTargets: THREE.Object3D;
  data: CityData;
  heightAt(x: number, y: number): number;
  flash(text: string): void;
}

const r1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function installPositionPicker(d: Deps): PlacementTool {
  const ray = new THREE.Raycaster();
  let active = false;
  const picks: { pos: Pt; where: string }[] = [];

  const btn = document.createElement('button');
  btn.className = 'btn picker-btn';
  btn.textContent = '📍 Position';
  btn.title = 'Mode debug : cliquer sur la carte pour lire et copier une position (touche P)';
  btn.setAttribute('aria-pressed', 'false');
  d.root.querySelector('.tools')?.appendChild(btn);

  const panel = document.createElement('div');
  panel.className = 'picker-panel card';
  panel.hidden = true;
  d.root.appendChild(panel);

  // Repère posé sur le dernier point cliqué
  const marker = new THREE.Mesh(
    new THREE.RingGeometry(1.2, 1.9, 24).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0xff2e93, depthTest: false, transparent: true, opacity: 0.95 }),
  );
  marker.renderOrder = 10;
  marker.visible = false;
  d.scene.add(marker);

  const nearestStreet = (p: Pt) => {
    let best = Infinity, name = '';
    for (const r of d.data.roads) {
      if (!r.name) continue;
      for (let i = 1; i < r.pts.length; i++) {
        const [ax, ay] = r.pts[i - 1], [bx, by] = r.pts[i];
        const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
        const t = l2 ? Math.max(0, Math.min(1, ((p[0] - ax) * dx + (p[1] - ay) * dy) / l2)) : 0;
        const dist = Math.hypot(p[0] - ax - dx * t, p[1] - ay - dy * t);
        if (dist < best) { best = dist; name = r.name; }
      }
    }
    return best < 40 ? `${name} (à ${Math.round(best)} m)` : null;
  };

  const describe = (p: Pt) => {
    const lines: string[] = [];
    const b = d.data.buildings.find((x) => pointInPoly(p[0], p[1], x));
    if (b) lines.push(`bâtiment ${b.name ? `« ${b.name} » ` : ''}OSM ${b.id} (${b.kind}, ${b.h} m)`);
    const pk = (d.data.parkings ?? []).find((x) => x.outer && pointInPoly(p[0], p[1], { outer: x.outer, holes: x.holes ?? [] }));
    if (pk) lines.push(`parking ${pk.name ? `« ${pk.name} » ` : ''}${pk.id}`);
    const street = nearestStreet(p);
    if (street) lines.push(`rue : ${street}`);
    return lines;
  };

  const render = () => {
    panel.hidden = !active;
    panel.innerHTML = `<b>📍 Position</b> <button class="icon" data-act="close" aria-label="Fermer">✕</button>
      <p class="picker-help">Clique sur la carte : la position est copiée. Colle-la dans la conversation.</p>
      ${picks.map((p, i) => `<div class="picker-row"><code>[${p.pos[0]}, ${p.pos[1]}]</code><button class="link" data-act="copy" data-i="${i}">copier</button><small>${esc(p.where)}</small></div>`).join('') || '<p class="picker-help">Aucun point pour l’instant.</p>'}`;
  };
  panel.addEventListener('click', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!t) return;
    if (t.dataset.act === 'close') toggle(false);
    if (t.dataset.act === 'copy') copy(picks[Number(t.dataset.i)]);
  });

  const text = (p: { pos: Pt; where: string }) => `{ "pos": [${p.pos[0]}, ${p.pos[1]}] }${p.where ? ` // ${p.where}` : ''}`;
  const copy = async (p: { pos: Pt; where: string }) => {
    try { await navigator.clipboard.writeText(text(p)); d.flash(`📍 Copié : [${p.pos[0]}, ${p.pos[1]}]`); }
    catch { d.flash(`📍 [${p.pos[0]}, ${p.pos[1]}] (copie impossible : recopie à la main)`); }
  };

  const toggle = (on = !active) => {
    active = on;
    btn.classList.toggle('on', active);
    btn.setAttribute('aria-pressed', String(active));
    d.canvas.style.cursor = active ? 'crosshair' : '';
    if (!active) marker.visible = false;
    render();
  };
  btn.addEventListener('click', () => toggle());
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'p' && !e.metaKey && !e.ctrlKey && !(e.target instanceof HTMLInputElement)) toggle();
    if (e.key === 'Escape' && active) toggle(false);
  });

  return {
    isActive: () => active,
    handleClick(x, y) {
      if (!active) return false;
      const r = d.canvas.getBoundingClientRect();
      const hit = screenRay(ray, d.camera, r, x, y).intersectObject(d.pickTargets, true)[0];
      if (!hit) return true;
      const pos: Pt = [r1(hit.point.x), r1(-hit.point.z)];
      const where = describe(pos).join(' · ');
      picks.unshift({ pos, where });
      picks.length = Math.min(picks.length, 6);
      marker.position.set(hit.point.x, hit.point.y + 0.3, hit.point.z);
      marker.visible = true;
      render();
      void copy(picks[0]);
      return true; // le clic est consommé : ni lieu, ni éléphant, ni marche de l'avatar
    },
  };
}
