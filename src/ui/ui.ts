import type { Place, PlacedPoi } from '../types';
import { PLACE_CATEGORIES, PLACE_KIND_LABEL, placeCategory } from '../scene/palette';
import type { ClockState } from '../time/clock';
import type { OpenState } from '../time/openinghours';
import { SEASON_LABEL } from '../time/seasons';

/** 7.5 → « 07:30 » */
const hhmm = (h: number) => { const t = Math.floor(h * 60 + 1e-6) % 1440; return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
const OPEN_LINE: Record<OpenState, string> = {
  open: '<p class="pc-open is-open">● Ouvert à cette heure</p>',
  closed: '<p class="pc-open is-closed">● Fermé à cette heure</p>',
  unknown: '<p class="pc-open">Horaires inconnus : lieu laissé allumé</p>',
};

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
  /** Heure choisie au curseur (quitte le direct). */
  onHour(hour: number): void;
  onPlay(playing: boolean): void;
  /** Bouton « Direct » : revenir à l'heure réelle de Chambéry. */
  onLive(): void;
  /** Puce saison : saison suivante (Auto → Printemps → Été → Automne → Hiver). */
  onSeason(): void;
  onReset(): void;
  /** La fiche d'un lieu a été fermée (bouton ✕ ou Échap). */
  onPlaceClosed(): void;
  /** Boussole touchée : remettre le nord en haut. */
  onCompass(): void;
  /** Bouton « ? » : rouvrir le lobby (accueil). */
  onLobby?(): void;
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
      <p class="points" title="Points gagnés en ramenant les éléphants à la fontaine" aria-live="polite">🐘 <b>0</b> <span>points</span> <i class="herd" title="Éléphants ramenés sur la fontaine"></i></p>
    </header>

    <nav class="tools">
      <button class="btn" data-action="journal" aria-expanded="false">📜 Journal</button>
      <div class="btn legend-box" role="group" aria-label="Lieux affichés">${PLACE_CATEGORIES.map((c) => `<label class="legend" style="--cat:${c.color}" title="Afficher / masquer : ${c.label}s"><input type="checkbox" data-category="${c.id}" checked /><i></i>${c.label}s</label>`).join('')}</div>
      <div class="btn time" title="Heure de Chambéry">
        <button class="play" data-action="play" aria-label="Faire défiler la journée">▶</button>
        <input type="range" min="0" max="24" step="0.25" value="16" data-action="hour" aria-label="Heure" />
        <span class="time-label">16:00</span>
        <span class="sun-times" aria-label="Lever et coucher du soleil"></span>
        <button class="live" data-action="live" aria-pressed="true" title="Suivre l'heure réelle de Chambéry">Direct</button>
        <button class="season" data-action="season" title="Saison : automatique (date du jour) ou choisie"></button>
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
    <button class="help card" data-action="lobby" aria-label="À propos : revoir l'accueil" title="Revoir l'accueil">?</button>
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
  const showPlaceCard = (p: Place, pin: boolean, status: OpenState = 'unknown') => {
    hideHint();
    pinned = pin || (pinned && shownPlace === p);
    if (shownPlace === p && !placeCard.hidden) return setPlaceStatus(status);
    shownPlace = p;
    const cat = placeCategory(p.kind);
    const kind = PLACE_KIND_LABEL[p.kind] ?? cat.label;
    placeCard.style.setProperty('--cat', cat.color);
    placeBody.innerHTML = `
      <p class="pc-cat"><i></i>${esc(cat.label)}${kind !== cat.label ? ` · ${esc(kind)}` : ''}</p>
      <h3 class="pc-title">${esc(p.name)}</h3>
      ${p.cuisine ? `<p class="pc-line">🍽 Cuisine ${esc(cuisineFr(p.cuisine))}</p>` : ''}
      ${p.hours ? `<p class="pc-line">🕑 ${esc(hoursFr(p.hours))}</p>` : ''}
      <div class="pc-status">${OPEN_LINE[status]}</div>
      <p class="pc-src">OpenStreetMap · à vérifier sur place</p>`;
    lastStatus = status + p.id;
    placeCard.hidden = false;
    // Rejoue l'animation (rebond du titre) à chaque nouveau lieu
    placeCard.classList.remove('pop');
    void placeCard.offsetWidth;
    placeCard.classList.add('pop');
    cardSize = null;
  };
  /** Met à jour la ligne « ouvert / fermé » de la fiche affichée (l'heure a changé). */
  let lastStatus = '';
  const setPlaceStatus = (status: OpenState) => {
    const el = placeBody.querySelector<HTMLElement>('.pc-status');
    if (el && lastStatus !== status + (shownPlace?.id ?? '')) {
      el.innerHTML = OPEN_LINE[status];
      lastStatus = status + (shownPlace?.id ?? '');
      cardSize = null;
    }
  };
  const hidePlaceCard = () => {
    placeCard.hidden = true;
    shownPlace = null;
    pinned = false;
  };
  // La fiche suit son épingle à chaque image : sa taille est mesurée une fois (nouveau contenu,
  // redimensionnement), et le style n'est réécrit que s'il change. Relire offsetWidth après avoir
  // écrit le style forcerait le navigateur à recalculer la mise en page à chaque image.
  let cardSize: { w: number; h: number } | null = null;
  let cardStyle = '';
  window.addEventListener('resize', () => { cardSize = null; });
  /** Place la fiche à côté du point (x, y) de l'écran : à droite sur ordinateur, au-dessus sur mobile. */
  const movePlaceCard = (x: number, y: number, visible: boolean) => {
    if (placeCard.hidden) return;
    cardSize ??= { w: placeCard.offsetWidth, h: placeCard.offsetHeight };
    const { w, h: hgt } = cardSize, W = window.innerWidth, H = window.innerHeight, m = 12;
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
    const style = `${Math.round(left)}|${Math.round(top)}|${visible}`;
    if (style === cardStyle) return;
    cardStyle = style;
    placeCard.style.visibility = visible ? 'visible' : 'hidden';
    placeCard.style.left = `${Math.round(left)}px`;
    placeCard.style.top = `${Math.round(top)}px`;
  };

  // Derrière le lobby, personne ne lirait le message : il attend l'entrée sur la carte (flushFlash)
  let pendingFlash = '';
  const showFlash = (msg: string) => {
    toast.textContent = msg;
    toast.classList.add('show');
    window.setTimeout(() => toast.classList.remove('show'), 2600);
  };
  const flash = (msg: string) => {
    if (root.classList.contains('lobby-open')) pendingFlash = msg;
    else showFlash(msg);
  };
  const flushFlash = () => {
    if (pendingFlash) showFlash(pendingFlash);
    pendingFlash = '';
  };

  const showTooltip = (text: string | null, x = 0, y = 0) => {
    if (!text) { tooltip.hidden = true; return; }
    tooltip.textContent = text;
    tooltip.style.transform = `translate(${x + 14}px, ${y + 14}px)`;
    tooltip.hidden = false;
  };

  const bubbleEl = document.createElement('div');
  bubbleEl.className = 'elephant-bubble';
  bubbleEl.setAttribute('aria-live', 'polite');
  root.appendChild(bubbleEl);
  let lastBubblePos = '';

  const hideHint = () => hint.classList.add('gone');
  /** Réaffiche l'aide quelques secondes (à l'entrée sur la carte : le lobby n'explique pas les gestes). */
  const showHint = () => {
    hint.classList.remove('gone');
    window.setTimeout(hideHint, 9000);
  };
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
    if (action === 'lobby') h.onLobby?.();
  });
  const hourIn = root.querySelector<HTMLInputElement>('[data-action="hour"]')!;
  const playBtn = root.querySelector<HTMLButtonElement>('[data-action="play"]')!;
  const liveBtn = root.querySelector<HTMLButtonElement>('[data-action="live"]')!;
  const seasonBtn = root.querySelector<HTMLButtonElement>('[data-action="season"]')!;
  const timeLabel = root.querySelector<HTMLElement>('.time-label')!;
  const sunTimesEl = root.querySelector<HTMLElement>('.sun-times')!;
  const timeBox = root.querySelector<HTMLElement>('.time')!;
  let playing = false;
  hourIn.addEventListener('input', () => h.onHour(Number(hourIn.value)));
  playBtn.addEventListener('click', () => h.onPlay(!playing));
  liveBtn.addEventListener('click', () => h.onLive());
  seasonBtn.addEventListener('click', () => h.onSeason());
  let lastClock = '';
  /** Affiche l'heure, le mode (direct / manuel / lecture), la saison et le lever / coucher du soleil. */
  const setClock = (c: ClockState, night: number) => {
    playing = c.mode === 'playing';
    const label = `${hhmm(c.hour)} ${night > 0.5 ? '🌙' : '☀️'}`;
    if (timeLabel.textContent !== label) timeLabel.textContent = label;
    if (document.activeElement !== hourIn) hourIn.value = String(c.hour);
    document.body.classList.toggle('is-night', night > 0.5);
    const key = `${c.mode}|${c.season}|${c.current}|${c.day.y}-${c.day.m}-${c.day.d}`;
    if (key === lastClock) return; // le reste ne change qu'avec le mode, la saison ou la date
    lastClock = key;
    playBtn.textContent = playing ? '❚❚' : '▶';
    playBtn.setAttribute('aria-label', playing ? 'Arrêter le défilement' : 'Faire défiler la journée');
    liveBtn.classList.toggle('on', c.mode === 'live');
    liveBtn.setAttribute('aria-pressed', String(c.mode === 'live'));
    const s = SEASON_LABEL[c.current];
    seasonBtn.textContent = c.season === 'auto' ? `${s.icon} Auto` : `${s.icon} ${s.label}`;
    seasonBtn.classList.toggle('on', c.season !== 'auto');
    seasonBtn.title = c.season === 'auto' ? `Saison du jour (${s.label.toLowerCase()}) — toucher pour choisir une saison` : `Saison choisie : ${s.label.toLowerCase()} — toucher pour changer`;
    const rise = c.sun.rise === null ? '—' : hhmm(c.sun.rise), set = c.sun.set === null ? '—' : hhmm(c.sun.set);
    sunTimesEl.textContent = `↑${rise} ↓${set}`;
    const date = new Date(Date.UTC(c.day.y, c.day.m - 1, c.day.d)).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', timeZone: 'UTC' });
    timeBox.title = `Heure de Chambéry${c.mode === 'live' ? ' (en direct)' : ''} · ${date} · lever du soleil ${rise}, coucher ${set}`;
  };

  root.querySelectorAll<HTMLInputElement>('[data-category]').forEach((el) => el.addEventListener('change', () => h.onToggleCategory(el.dataset.category!, el.checked)));
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { panel.hidden = true; journal.hidden = true; if (shownPlace) { hidePlaceCard(); h.onPlaceClosed(); } } });

  return {
    setFound, showPoi, flash, flushFlash, showTooltip, hideHint, showHint, setClock, hidePanel: () => (panel.hidden = true),
    showPlaceCard, hidePlaceCard, movePlaceCard, setPlaceStatus,
    placeCardState: () => ({ place: shownPlace, pinned }),
    /** Éléphants ramenés sur la fontaine */
    setHerd: (n: number, total: number) => {
      $<HTMLElement>('.points .herd').textContent = total ? `· ⛲ ${n} / ${total}` : '';
    },
    /**
     * Bulle de l'éléphant (il nargue le joueur). text : nouveau texte (null = cacher, '' = inchangé) ;
     * x, y : position à l'écran de la pointe de la bulle.
     */
    bubble: (text: string | null, x?: number, y?: number) => {
      if (text === null) { bubbleEl.classList.remove('show'); return; }
      if (text) {
        bubbleEl.textContent = text;
        bubbleEl.classList.remove('show');
        void bubbleEl.offsetWidth; // relance l'animation d'apparition
        bubbleEl.classList.add('show');
      }
      if (x !== undefined && y !== undefined) {
        const pos = `${Math.round(x)}|${Math.round(y)}`;
        if (pos === lastBubblePos) return; // la bulle suit l'éléphant à chaque image : pas d'écriture inutile
        lastBubblePos = pos;
        bubbleEl.style.left = `${Math.round(x)}px`;
        bubbleEl.style.top = `${Math.round(y)}px`;
      }
    },
    /** Compteur de points (mini-jeu de l'éléphant) ; gained > 0 : petite animation */
    setPoints: (n: number, gained = 0) => {
      const el = $<HTMLElement>('.points');
      el.querySelector('b')!.textContent = String(n);
      el.querySelector('span')!.textContent = n > 1 ? 'points' : 'point';
      if (gained > 0) {
        el.classList.remove('pop');
        void el.offsetWidth; // relance l'animation
        el.classList.add('pop');
      }
    },
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
