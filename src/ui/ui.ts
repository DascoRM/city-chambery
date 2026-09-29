import type { Place, PlacedPoi } from '../types';
import { PLACE_CATEGORIES, PLACE_KIND_LABEL, placeCategory } from '../scene/palette';

/** Cuisines OSM les plus courantes à Chambéry, en français (les autres restent telles quelles). */
const CUISINE: Record<string, string> = {
  italian: 'italienne', italian_pizza: 'pizza', pizza: 'pizza', regional: 'régionale', local: 'locale', french: 'française',
  indian: 'indienne', asian: 'asiatique', japanese: 'japonaise', sushi: 'sushis', thai: 'thaïe', ramen: 'ramen',
  crepe: 'crêpes', pancake: 'pancakes', burger: 'burgers', kebab: 'kebab', french_tacos: 'tacos', falafel: 'falafels',
  moroccan: 'marocaine', tunisian: 'tunisienne', world: 'du monde', barbecue: 'barbecue', tapas: 'tapas', pasta: 'pâtes',
  brunch: 'brunch', coffee_shop: 'café', tea: 'thé', bubble_tea: 'bubble tea', ice_cream: 'glaces', cake: 'pâtisseries',
  chocolate: 'chocolat', juice: 'jus', donut: 'donuts',
};
const cuisineFr = (c: string) => c.split(';').map((x) => CUISINE[x.trim()] ?? x.trim().replace(/_/g, ' ')).join(', ');

/** Horaires OSM (opening_hours) avec les jours en français ; le format reste celui d'OSM. */
const DAYS: Record<string, string> = { Mo: 'lun', Tu: 'mar', We: 'mer', Th: 'jeu', Fr: 'ven', Sa: 'sam', Su: 'dim', PH: 'fériés', off: 'fermé' };
const hoursFr = (h: string) => h.replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH|off)\b/g, (d) => DAYS[d]).replace(/;\s*/g, ' · ');

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export interface UiHandlers {
  onJournalPick(id: string): void;
  /** Affiche / masque une catégorie de lieux (bar, cafe, restaurant). */
  onToggleCategory(category: string, visible: boolean): void;
  onHour(hour: number): void;
  onPlay(playing: boolean): void;
  onReset(): void;
  /** La fiche d'un lieu a été fermée (bouton ✕ ou Échap). */
  onPlaceClosed(): void;
  /** Boussole touchée : remettre le nord en haut. */
  onCompass(): void;
}

export function createUi(root: HTMLElement, pois: PlacedPoi[], attribution: string, h: UiHandlers) {
  root.insertAdjacentHTML(
    'beforeend',
    `
    <header class="hud card">
      <p class="eyebrow">Diorama</p>
      <h1>Chambéry</h1>
      <p class="sub">Centre historique</p>
      <div class="progress" aria-live="polite">
        <div class="bar"><span></span></div>
        <p class="count"></p>
      </div>
    </header>

    <nav class="tools">
      <button class="btn" data-action="journal" aria-expanded="false">📜 Journal</button>
      <div class="btn legend-box" role="group" aria-label="Lieux affichés">${PLACE_CATEGORIES.map((c) => `<label class="legend" style="--cat:${c.color}" title="Afficher / masquer : ${c.label}s"><input type="checkbox" data-category="${c.id}" checked /><i></i>${c.label}s</label>`).join('')}</div>
      <div class="btn time" title="Heure de la journée">
        <button class="play" data-action="play" aria-label="Faire défiler la journée">▶</button>
        <input type="range" min="0" max="24" step="0.25" value="16" data-action="hour" aria-label="Heure" />
        <span class="time-label">16:00</span>
      </div>
    </nav>

    <section class="journal card" hidden>
      <div class="journal-head"><h2>Journal d'exploration</h2><button class="icon" data-action="close-journal" aria-label="Fermer">✕</button></div>
      <ul></ul>
      <button class="link" data-action="reset">Recommencer l'exploration</button>
    </section>

    <aside class="panel card" hidden>
      <button class="icon close" data-action="close-panel" aria-label="Fermer">✕</button>
      <div class="panel-body"></div>
    </aside>

    <div class="place-card card" hidden>
      <button class="icon close" data-action="close-place" aria-label="Fermer">✕</button>
      <div class="place-body"></div>
    </div>

    <div class="hint card">${
      matchMedia('(pointer: coarse)').matches
        ? '1 doigt : se déplacer · 2 doigts : zoomer, pivoter, incliner · double touche : zoomer · touche les <b>✦</b>'
        : 'Glisse pour tourner · clic droit pour déplacer · molette pour zoomer · touche les <b>✦</b> pour découvrir l\'histoire'
    }</div>
    <button class="compass card" data-action="compass" aria-label="Boussole : remettre le nord en haut" title="Remettre le nord en haut">
      <svg viewBox="0 0 40 40" aria-hidden="true"><g class="needle"><path d="M20 5 L25 20 L15 20 Z" fill="#d1492e"/><path d="M20 35 L25 20 L15 20 Z" fill="#b9ab98"/><text x="20" y="4.6" text-anchor="middle" font-size="6.5" font-weight="700" fill="#2d2622">N</text></g></svg>
    </button>
    <div class="toast" role="status"></div>
    <div class="tooltip" hidden></div>
    <footer class="attribution">${esc(attribution)}<span class="long"> · Textes : sources citées dans chaque fiche</span></footer>
  `,
  );

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector(sel) as T;
  const panel = $<HTMLElement>('.panel');
  const panelBody = $<HTMLElement>('.panel-body');
  const journal = $<HTMLElement>('.journal');
  const journalBtn = $<HTMLButtonElement>('[data-action="journal"]');
  const toast = $<HTMLElement>('.toast');
  const tooltip = $<HTMLElement>('.tooltip');
  const hint = $<HTMLElement>('.hint');
  const needle = $<HTMLElement>('.compass .needle');
  let lastHeading = '';
  const placeCard = $<HTMLElement>('.place-card');
  const placeBody = $<HTMLElement>('.place-body');
  let found = new Set<string>();

  const renderProgress = () => {
    const n = pois.filter((p) => found.has(p.id)).length;
    $<HTMLElement>('.bar span').style.width = `${pois.length ? (n / pois.length) * 100 : 0}%`;
    $<HTMLElement>('.count').textContent = `${n} / ${pois.length} lieux découverts`;
  };

  const renderJournal = () => {
    $<HTMLElement>('.journal ul').innerHTML = pois
      .map((p) =>
        found.has(p.id)
          ? `<li><button data-poi="${p.id}"><span class="dot found"></span><span><b>${esc(p.title)}</b><small>${esc(p.era)}</small></span></button></li>`
          : `<li class="locked"><span class="dot"></span><span><b>Lieu mystère</b><small>Trouve le ✦ sur la carte</small></span></li>`,
      )
      .join('');
  };

  const setFound = (ids: Set<string>) => {
    found = ids;
    renderProgress();
    renderJournal();
  };

  const showPoi = (p: PlacedPoi, isNew: boolean) => {
    hideHint();
    panelBody.innerHTML = `
      <p class="eyebrow">${esc(p.era)}${isNew ? ' · <span class="new">Nouveau !</span>' : ''}</p>
      <h2>${esc(p.title)}</h2>
      <p class="lead">${esc(p.summary)}</p>
      <p>${esc(p.story)}</p>
      ${p.anecdote ? `<div class="anecdote"><b>Le saviez-vous ?</b><p>${esc(p.anecdote)}</p></div>` : ''}
      <p class="sources">Sources : ${p.sources.map((s) => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`).join(' · ')}</p>`;
    panel.hidden = false;
    panel.scrollTop = 0;
  };

  // --- Fiche des bars, cafés, restaurants : petite carte à côté de l'épingle -----------------
  let shownPlace: Place | null = null;
  let pinned = false;
  /** Affiche la fiche (survol) ; pinned = elle reste ouverte (clic, ou toucher sur mobile). */
  const showPlaceCard = (p: Place, pin: boolean) => {
    hideHint();
    pinned = pin || (pinned && shownPlace === p);
    if (shownPlace === p && !placeCard.hidden) return;
    shownPlace = p;
    const cat = placeCategory(p.kind);
    const kind = PLACE_KIND_LABEL[p.kind] ?? cat.label;
    placeCard.style.setProperty('--cat', cat.color);
    placeBody.innerHTML = `
      <p class="pc-cat"><i></i>${esc(cat.label)}${kind !== cat.label ? ` · ${esc(kind)}` : ''}</p>
      <h3 class="pc-title">${esc(p.name)}</h3>
      ${p.cuisine ? `<p class="pc-line">🍽 Cuisine ${esc(cuisineFr(p.cuisine))}</p>` : ''}
      ${p.hours ? `<p class="pc-line">🕑 ${esc(hoursFr(p.hours))}</p>` : ''}
      <p class="pc-src">OpenStreetMap · à vérifier sur place</p>`;
    placeCard.hidden = false;
    // Rejoue l'animation (rebond du titre) à chaque nouveau lieu
    placeCard.classList.remove('pop');
    void placeCard.offsetWidth;
    placeCard.classList.add('pop');
  };
  const hidePlaceCard = () => {
    placeCard.hidden = true;
    shownPlace = null;
    pinned = false;
  };
  /** Place la fiche à côté du point (x, y) de l'écran : à droite sur ordinateur, au-dessus sur mobile. */
  const movePlaceCard = (x: number, y: number, visible: boolean) => {
    if (placeCard.hidden) return;
    placeCard.style.visibility = visible ? 'visible' : 'hidden';
    const w = placeCard.offsetWidth, hgt = placeCard.offsetHeight, W = window.innerWidth, H = window.innerHeight, m = 12;
    let left: number, top: number;
    if (W <= 720) {
      left = x - w / 2;
      top = y - hgt - 18;
      if (top < m) top = y + 18;
    } else {
      left = x + 22;
      if (left + w > W - m) left = x - 22 - w;
      top = y - hgt / 2;
    }
    left = Math.max(m, Math.min(W - w - m, left));
    top = Math.max(m, Math.min(H - hgt - m, top));
    // Position via left/top (et non transform) : la propriété transform reste libre pour les
    // animations CSS de la fiche (rebond de .place-card.pop dans style.css)
    placeCard.style.left = `${Math.round(left)}px`;
    placeCard.style.top = `${Math.round(top)}px`;
  };

  const flash = (msg: string) => {
    toast.textContent = msg;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2600);
  };

  const showTooltip = (text: string | null, x = 0, y = 0) => {
    if (!text) { tooltip.hidden = true; return; }
    tooltip.textContent = text;
    tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
    tooltip.hidden = false;
  };

  const hideHint = () => hint.classList.add('gone');
  window.setTimeout(hideHint, 9000);

  root.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    const action = t.closest<HTMLElement>('[data-action]')?.dataset.action;
    const poiBtn = t.closest<HTMLElement>('[data-poi]');
    if (poiBtn) { h.onJournalPick(poiBtn.dataset.poi!); journal.hidden = true; journalBtn.setAttribute('aria-expanded', 'false'); return; }
    if (action === 'journal') { journal.hidden = !journal.hidden; journalBtn.setAttribute('aria-expanded', String(!journal.hidden)); }
    if (action === 'close-journal') { journal.hidden = true; journalBtn.setAttribute('aria-expanded', 'false'); }
    if (action === 'close-panel') panel.hidden = true;
    if (action === 'close-place') { hidePlaceCard(); h.onPlaceClosed(); }
    if (action === 'reset') h.onReset();
    if (action === 'compass') h.onCompass();
  });
  const hourIn = root.querySelector<HTMLInputElement>('[data-action="hour"]')!;
  const playBtn = root.querySelector<HTMLButtonElement>('[data-action="play"]')!;
  const timeLabel = root.querySelector<HTMLElement>('.time-label')!;
  let playing = false;
  hourIn.addEventListener('input', () => {
    if (playing) { playing = false; playBtn.textContent = '▶'; h.onPlay(false); }
    h.onHour(Number(hourIn.value));
  });
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.textContent = playing ? '❚❚' : '▶';
    h.onPlay(playing);
  });
  const setTime = (hour: number, night: number) => {
    const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60 / 15) * 15;
    timeLabel.textContent = `${hh === 24 ? '00' : String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} ${night > 0.5 ? '🌙' : '☀️'}`;
    if (document.activeElement !== hourIn) hourIn.value = String(hour);
    document.body.classList.toggle('is-night', night > 0.5);
  };

  root.querySelectorAll<HTMLInputElement>('[data-category]').forEach((el) => el.addEventListener('change', () => h.onToggleCategory(el.dataset.category!, el.checked)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panel.hidden = true; journal.hidden = true; if (shownPlace) { hidePlaceCard(); h.onPlaceClosed(); } } });

  return {
    setFound, showPoi, flash, showTooltip, setTime, hidePanel: () => (panel.hidden = true),
    showPlaceCard, hidePlaceCard, movePlaceCard,
    placeCardState: () => ({ place: shownPlace, pinned }),
    /** Oriente l'aiguille de la boussole (cap en degrés, 0 = nord en haut). */
    setHeading: (deg: number) => {
      const v = `rotate(${deg.toFixed(1)}deg)`;
      if (v !== lastHeading) { needle.style.transform = v; lastHeading = v; } // pas d'écriture si rien ne change
    },
  };
}

export function showFatal(root: HTMLElement, title: string, body: string) {
  root.insertAdjacentHTML('beforeend', `<div class="fatal card"><h2>${esc(title)}</h2><p>${body}</p></div>`);
}
