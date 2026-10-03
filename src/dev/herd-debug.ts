import * as THREE from 'three';
import type { ElephantState, Herd } from '../scene/mascot';
import type { Pt } from '../types';

/**
 * Mode debug des éléphants (itération 36), actif avec ?debug dans l'adresse, comme le compteur de perf.
 * - Un grand faisceau coloré au-dessus de chaque éléphant, visible de loin et à travers les bâtiments.
 * - Un panneau : état, distance à la fontaine ; « Voir » y amène la caméra, « Sprint » le fait détaler
 *   comme un clic (pour tester le 2e clic qui l'attrape).
 */
const COLORS: Record<ElephantState, string> = {
  walk: '#1fa2ff', sprint: '#ffc400', flying: '#2ec46d', home: '#2ec46d',
};
const LABELS: Record<ElephantState, string> = {
  walk: 'se promène', sprint: 'sprinte', flying: 'en vol', home: 'sur la fontaine',
};

export function installHerdDebug(opts: { root: HTMLElement; scene: THREE.Scene; herd: Herd; home: Pt; flyTo(x: number, z: number): void }) {
  const { herd } = opts;
  const beams = herd.elephants.map(() => {
    // Faisceau + boule au sommet, dessinés par-dessus les bâtiments
    const mat = new THREE.MeshBasicMaterial({ color: COLORS.walk, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 90, 10).translate(0, 50, 0), mat);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(5, 16, 12).translate(0, 98, 0), mat);
    ball.renderOrder = m.renderOrder = 10;
    m.add(ball);
    opts.scene.add(m);
    return m;
  });

  const panel = document.createElement('div');
  panel.className = 'herd-debug card';
  panel.innerHTML = `<p class="eyebrow">Debug · éléphants</p><ul></ul>`;
  opts.root.appendChild(panel);
  const list = panel.querySelector('ul')!;
  list.innerHTML = herd.elephants
    .map((e) => `<li data-id="${e.id}"><i></i><span></span><button data-act="see">Voir</button><button data-act="sprint">Sprint</button></li>`)
    .join('');
  list.addEventListener('click', (ev) => {
    const btn = (ev.target as HTMLElement).closest('button');
    const li = btn?.closest('li');
    if (!btn || !li) return;
    const e = herd.elephants[Number(li.dataset.id)];
    if (btn.dataset.act === 'see') opts.flyTo(e.group.position.x, e.group.position.z);
    else e.sprint();
  });

  let acc = 0;
  return {
    update(dt: number) {
      herd.elephants.forEach((e, i) => {
        const st = e.state();
        const b = beams[i];
        b.visible = st !== 'home';
        b.position.copy(e.group.position);
        (b.material as THREE.MeshBasicMaterial).color.set(COLORS[st]);
      });
      acc += dt;
      if (acc < 0.4) return;
      acc = 0;
      herd.elephants.forEach((e) => {
        const li = list.children[e.id] as HTMLElement;
        const st = e.state();
        const [x, y] = e.position();
        const d = Math.round(Math.hypot(x - opts.home[0], y - opts.home[1]));
        (li.querySelector('i') as HTMLElement).style.background = COLORS[st];
        li.querySelector('span')!.textContent = `#${e.id + 1} ${LABELS[st]}${st === 'home' ? '' : st === 'sprint' ? ` · ${e.sprintLeft().toFixed(1)} s · ${d} m` : ` · ${d} m`}`;
        (li.querySelector('[data-act="sprint"]') as HTMLButtonElement).disabled = st !== 'walk';
        (li.querySelector('[data-act="see"]') as HTMLButtonElement).disabled = st === 'home';
      });
    },
  };
}
