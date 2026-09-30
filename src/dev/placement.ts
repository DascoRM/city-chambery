/**
 * Outil de placement des lieux — chargé uniquement avec `npm run dev`.
 * Touche P (ou bouton 📍) : clic sur la carte → coordonnées `pos` à copier ou à enregistrer
 * directement dans src/content/pois.json.
 */
import * as THREE from 'three';
import type { CityData, PlacedPoi, Pt } from '../types';
import { screenRay } from '../scene/geo';

interface Deps {
  root: HTMLElement;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; update(): void };
  canvas: HTMLCanvasElement;
  pickTargets: THREE.Object3D;
  data: CityData;
  pois: PlacedPoi[];
  movePoiMarker(id: string, pos: Pt): void;
}

const SESSION_KEY = 'chambery-diorama:dev-placement';
const r1 = (v: number) => Math.round(v * 10) / 10;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const slug = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function installPlacementTool(d: Deps) {
  injectStyles();
  const { origin } = d.data;
  const mPerLat = 111_132;
  const mPerLon = 111_320 * Math.cos((origin.lat * Math.PI) / 180);

  // --- Restauration après rechargement (Vite recharge la page quand pois.json change)
  let active = false;
  try {
    const saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? 'null');
    if (saved) {
      d.camera.position.fromArray(saved.cam);
      d.controls.target.fromArray(saved.target);
      d.controls.update();
      active = !!saved.active;
    }
  } catch {
    /* rien */
  }
  const persist = () => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ cam: d.camera.position.toArray(), target: d.controls.target.toArray(), active }));
    } catch {
      /* rien */
    }
  };
  window.addEventListener('beforeunload', persist);

  // --- Épingle de prévisualisation
  const pin = new THREE.Group();
  const pinMat = new THREE.MeshBasicMaterial({ color: '#e0245e', depthTest: false, transparent: true });
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 30, 6).translate(0, 15, 0), pinMat);
  const head = new THREE.Mesh(new THREE.SphereGeometry(3, 12, 8).translate(0, 30, 0), pinMat);
  const cross = new THREE.Mesh(new THREE.RingGeometry(3, 5, 24).rotateX(-Math.PI / 2).translate(0, 0.6, 0), pinMat);
  pin.add(stick, head, cross);
  pin.renderOrder = 20;
  pin.traverse((o) => (o.renderOrder = 20));
  pin.visible = false;
  d.scene.add(pin);

  // --- Panneau
  d.root.insertAdjacentHTML(
    'beforeend',
    `<button class="btn dev-toggle" title="Outil de placement (touche P)">📍 Placement</button>
     <section class="dev-panel card" hidden>
       <div class="dev-head"><b>📍 Placement</b><span class="dev-tag">dev</span></div>
       <p class="dev-help">Clique sur la carte pour poser l'épingle. Les lieux ne sont plus cliquables tant que l'outil est actif.</p>
       <div class="dev-result" hidden>
         <div class="dev-row"><span>pos</span><code class="dev-pos"></code><button class="dev-mini" data-copy="pos">Copier</button></div>
         <div class="dev-row"><span>GPS</span><code class="dev-gps"></code><button class="dev-mini" data-copy="gps">Copier</button></div>
         <label class="dev-label">Affecter à
           <select class="dev-select">
             <option value="">— choisir un lieu —</option>
             ${d.pois.map((p) => `<option value="${p.id}">${esc(p.title)}</option>`).join('')}
             <option value="__new">➕ Nouveau lieu…</option>
           </select>
         </label>
         <div class="dev-new" hidden>
           <input class="dev-title" placeholder="Titre du lieu (ex. Hôtel de Cordon)" />
           <input class="dev-id" placeholder="identifiant" />
         </div>
         <button class="btn dev-save" disabled>Enregistrer dans pois.json</button>
         <p class="dev-msg"></p>
       </div>
     </section>`,
  );
  const $ = <T extends HTMLElement>(s: string) => d.root.querySelector(s) as T;
  const toggleBtn = $<HTMLButtonElement>('.dev-toggle');
  const panel = $<HTMLElement>('.dev-panel');
  const result = $<HTMLElement>('.dev-result');
  const select = $<HTMLSelectElement>('.dev-select');
  const newBox = $<HTMLElement>('.dev-new');
  const titleIn = $<HTMLInputElement>('.dev-title');
  const idIn = $<HTMLInputElement>('.dev-id');
  const saveBtn = $<HTMLButtonElement>('.dev-save');
  const msg = $<HTMLElement>('.dev-msg');

  let current: { pos: Pt; lat: number; lon: number } | null = null;
  const originals = new Map(d.pois.map((p) => [p.id, p.position] as const));
  let previewId = '';

  const setActive = (v: boolean) => {
    active = v;
    panel.hidden = !v;
    toggleBtn.classList.toggle('on', v);
    d.canvas.style.cursor = v ? 'crosshair' : '';
    if (!v) {
      pin.visible = false;
      restorePreview();
    }
    persist();
  };
  const restorePreview = () => {
    if (previewId && originals.has(previewId)) d.movePoiMarker(previewId, originals.get(previewId)!);
    previewId = '';
  };
  const refreshSave = () => {
    const v = select.value;
    saveBtn.disabled = !current || !v || (v === '__new' && (!titleIn.value.trim() || !/^[a-z0-9-]+$/.test(idIn.value)));
  };

  toggleBtn.addEventListener('click', () => setActive(!active));
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'p' || e.key === 'P') && !(e.target instanceof HTMLInputElement)) setActive(!active);
  });

  select.addEventListener('change', () => {
    restorePreview();
    newBox.hidden = select.value !== '__new';
    if (current && select.value && select.value !== '__new') {
      previewId = select.value;
      d.movePoiMarker(previewId, current.pos); // aperçu immédiat de la gemme
    }
    msg.textContent = '';
    refreshSave();
  });
  titleIn.addEventListener('input', () => {
    idIn.value = slug(titleIn.value);
    refreshSave();
  });
  idIn.addEventListener('input', refreshSave);

  d.root.addEventListener('click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-copy]');
    if (!b || !current) return;
    const text = b.dataset.copy === 'pos' ? `"pos": [${current.pos[0]}, ${current.pos[1]}]` : `${current.lat}, ${current.lon}`;
    try {
      await navigator.clipboard.writeText(text);
      b.textContent = 'Copié ✓';
    } catch {
      b.textContent = 'Échec';
    }
    setTimeout(() => (b.textContent = 'Copier'), 1200);
  });

  saveBtn.addEventListener('click', async () => {
    if (!current) return;
    const isNew = select.value === '__new';
    const body = { id: isNew ? idIn.value : select.value, title: titleIn.value, pos: current.pos };
    saveBtn.disabled = true;
    msg.textContent = 'Enregistrement…';
    try {
      const res = await fetch('/__dev/poi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      msg.textContent = json.created ? 'Lieu créé (brouillon) ✓ — rechargement…' : 'Position enregistrée ✓ — rechargement…';
      persist(); // Vite recharge la page : on garde la vue et l'outil ouverts
    } catch (err) {
      msg.textContent = `Erreur : ${(err as Error).message}`;
      refreshSave();
    }
  });

  // --- Clic sur la carte
  const raycaster = new THREE.Raycaster();
  const ground = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const handleClick = (clientX: number, clientY: number): boolean => {
    if (!active) return false;
    screenRay(raycaster, d.camera, d.canvas.getBoundingClientRect(), clientX, clientY);
    const hit = raycaster.intersectObject(d.pickTargets, true)[0];
    const p = hit?.point ?? raycaster.ray.intersectPlane(ground, new THREE.Vector3());
    if (!p) return true;
    const pos: Pt = [r1(p.x), r1(-p.z)];
    const lat = +(origin.lat + pos[1] / mPerLat).toFixed(6);
    const lon = +(origin.lon + pos[0] / mPerLon).toFixed(6);
    current = { pos, lat, lon };
    pin.position.set(p.x, 0, p.z);
    pin.visible = true;
    result.hidden = false;
    $<HTMLElement>('.dev-pos').textContent = `[${pos[0]}, ${pos[1]}]`;
    $<HTMLElement>('.dev-gps').textContent = `${lat}, ${lon}`;
    if (previewId) d.movePoiMarker(previewId, pos);
    msg.textContent = '';
    refreshSave();
    return true; // clic consommé : on n'ouvre pas de fiche
  };

  setActive(active);
  return { handleClick, isActive: () => active };
}

function injectStyles() {
  const css = `
  .dev-toggle { position: absolute; right: 16px; top: 16px; z-index: 5; }
  .dev-toggle.on { background: #e0245e; color: #fff; border-color: #e0245e; }
  .dev-panel { position: absolute; right: 16px; top: 64px; width: 300px; padding: 14px 16px; z-index: 5; font-size: 13px; }
  .dev-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; font-size: 15px; }
  .dev-tag { background: #e0245e; color: #fff; font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 99px; text-transform: uppercase; }
  .dev-help { color: var(--muted); margin: 0 0 10px; line-height: 1.4; }
  .dev-row { display: grid; grid-template-columns: 34px 1fr auto; gap: 8px; align-items: center; margin-bottom: 6px; }
  .dev-row span { color: var(--muted); font-weight: 600; }
  .dev-row code { background: #f1e7d7; padding: 3px 6px; border-radius: 6px; font-size: 12px; overflow-wrap: anywhere; }
  .dev-mini { font: inherit; font-size: 12px; border: 1px solid var(--line); background: #fff; border-radius: 6px; padding: 3px 8px; cursor: pointer; }
  .dev-label { display: block; margin: 10px 0 6px; font-weight: 600; }
  .dev-label select, .dev-new input { display: block; width: 100%; margin-top: 4px; font: inherit; padding: 6px 8px; border: 1px solid var(--line); border-radius: 8px; background: #fff; }
  .dev-new input { margin-bottom: 4px; }
  .dev-save { width: 100%; justify-content: center; margin-top: 6px; box-shadow: none; }
  .dev-save:disabled { opacity: 0.5; cursor: not-allowed; }
  .dev-msg { margin: 8px 0 0; min-height: 1em; font-weight: 600; }
  .panel:not([hidden]) ~ .dev-toggle, .panel:not([hidden]) ~ .dev-panel { right: 432px; }
  @media (max-width: 720px) { .dev-toggle { top: auto; bottom: 76px; } .dev-panel { top: auto; bottom: 120px; left: 16px; right: 16px; width: auto; } }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);
}
