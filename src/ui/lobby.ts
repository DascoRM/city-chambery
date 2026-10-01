import { saveLobbySkip } from '../state/lobby';
import type { LoadingState } from './loading';

/**
 * Lobby de démarrage (EP004-US003, piste B « Carte vivante ») : un panneau clair posé sur le diorama, qui explique
 * le projet pendant que la ville charge derrière. « Explorer la carte » est grisé jusqu'à ce qu'elle soit prête.
 * Les textes viennent de `src/content/lobby.json` ; les nombres sont lus dans les données, jamais écrits en dur.
 */
export interface LobbyContent {
  eyebrow: string;
  title: string;
  tagline: string;
  cards: { icon: 'gem' | 'ring' | 'sun'; title: string; text: string }[];
  loading: string;
  ready: string;
  enter: string;
  back: string;
  skip: string;
  credits: string;
}

export interface Lobby {
  /** Reçoit la progression du chargement (voir `loading.ts`). */
  setProgress(s: LoadingState): void;
  /** La ville est prête : « Explorer la carte » s'active, le fond laisse voir la ville vivante. */
  setReady(): void;
  setCredits(text: string): void;
  /** Appelé quand le visiteur entre sur la carte (bouton, Entrée). */
  onEnter(fn: () => void): void;
  /** Rouvre le lobby depuis la carte (icône « ? »). */
  open(): void;
  isOpen(): boolean;
  /** Retire le lobby (démarrage raté, par exemple). */
  destroy(): void;
}

const ICONS: Record<LobbyContent['cards'][number]['icon'], string> = {
  gem: '<path d="M12 2.5l6.5 9.5L12 21.5 5.5 12z"/><path d="M5.5 12h13"/>',
  ring: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.8" fill="currentColor"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
};

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const fill = (text: string, vars: Record<string, string>) => text.replace(/\{(\w+)\}/g, (m, k: string) => vars[k] ?? m);

/** Nombres en toutes lettres pour les phrases (« les quatre éléphants »). */
const WORDS = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix'];
export const inWords = (n: number) => WORDS[n] ?? String(n);

export function createLobby(root: HTMLElement, content: LobbyContent, facts: { places: number; elephants: number }, skipInitial: boolean, startOpen = true): Lobby {
  const vars = { lieux: String(facts.places), elephants: inWords(facts.elephants) };
  if (startOpen) root.classList.add('lobby-open');
  root.insertAdjacentHTML(
    'beforeend',
    `
    <div class="lobby"${startOpen ? '' : ' hidden'} role="dialog" aria-modal="true" aria-labelledby="lobby-title">
      <div class="lobby-bg"></div>
      <div class="lobby-veil"></div>
      <div class="lobby-panel">
        <header class="lobby-head">
          <svg class="lobby-gem" viewBox="0 0 24 24" fill="none" stroke="#e3a52d" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 2.5l6.5 9.5L12 21.5 5.5 12z" fill="#f6dc9a"/><path d="M5.5 12h13M12 2.5v19"/></svg>
          <p class="eyebrow">${esc(content.eyebrow)}</p>
          <h1 id="lobby-title">${esc(content.title)}</h1>
          <p class="lobby-tagline">${esc(content.tagline)}</p>
        </header>
        <ul class="lobby-cards">
          ${content.cards
            .map(
              (c) => `<li class="lobby-card"><svg viewBox="0 0 24 24" fill="none" stroke="#b9801a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[c.icon]}</svg><div><h2>${esc(fill(c.title, vars))}</h2><p>${esc(fill(c.text, vars))}</p></div></li>`,
            )
            .join('')}
        </ul>
        <div class="lobby-foot">
          <div class="lobby-progress" aria-live="polite">
            <div class="lobby-progress-row"><span class="lobby-step">${esc(content.loading)}</span><span class="lobby-pct">0 %</span></div>
            <div class="bar"><span></span></div>
          </div>
          <button class="lobby-enter" disabled>${esc(content.enter)}<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
          <div class="lobby-options">
            <label><input type="checkbox" class="lobby-skip"${skipInitial ? ' checked' : ''}>${esc(content.skip)}</label>
            <button class="lobby-credits-btn" aria-expanded="false">${esc(content.credits)}</button>
          </div>
          <p class="lobby-credits" hidden></p>
        </div>
      </div>
    </div>`,
  );

  const el = root.querySelector<HTMLElement>('.lobby')!;
  const enterBtn = el.querySelector<HTMLButtonElement>('.lobby-enter')!;
  const skipBox = el.querySelector<HTMLInputElement>('.lobby-skip')!;
  const creditsBtn = el.querySelector<HTMLButtonElement>('.lobby-credits-btn')!;
  const creditsEl = el.querySelector<HTMLElement>('.lobby-credits')!;
  const stepEl = el.querySelector<HTMLElement>('.lobby-step')!;
  const pctEl = el.querySelector<HTMLElement>('.lobby-pct')!;
  const barEl = el.querySelector<HTMLElement>('.bar span')!;
  const progressEl = el.querySelector<HTMLElement>('.lobby-progress')!;
  const enterLabel = enterBtn.firstChild as Text;
  let enterFn: () => void = () => {};
  let ready = false;
  let opened = startOpen;
  if (!startOpen) enterLabel.textContent = content.back;

  const close = () => {
    if (!ready || !opened) return;
    opened = false;
    el.classList.add('lobby-out');
    root.classList.remove('lobby-open');
    window.setTimeout(() => { if (!opened) el.hidden = true; }, 500);
    enterFn();
  };
  enterBtn.addEventListener('click', close);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });
  skipBox.addEventListener('change', () => saveLobbySkip(skipBox.checked));
  creditsBtn.addEventListener('click', () => {
    creditsEl.hidden = !creditsEl.hidden;
    creditsBtn.setAttribute('aria-expanded', String(!creditsEl.hidden));
  });

  return {
    setProgress(s) {
      barEl.style.width = `${s.pct}%`;
      pctEl.textContent = `${Math.round(s.pct)} %`;
      stepEl.textContent = s.label ? `${content.loading} · ${s.label}` : content.loading;
    },
    setReady() {
      ready = true;
      enterBtn.disabled = false;
      el.classList.add('lobby-ready');
      progressEl.innerHTML = `<div class="lobby-ready-line"><span></span>${esc(content.ready)}</div>`;
      if (opened) enterBtn.focus({ preventScroll: true });
    },
    setCredits(text) {
      creditsEl.textContent = text;
    },
    onEnter(fn) {
      enterFn = fn;
    },
    open() {
      if (opened) return;
      opened = true;
      enterLabel.textContent = content.back;
      el.hidden = false;
      void el.offsetWidth; // relance la transition d'apparition
      el.classList.remove('lobby-out');
      root.classList.add('lobby-open');
      enterBtn.focus({ preventScroll: true });
    },
    isOpen: () => opened,
    destroy() {
      el.remove();
      root.classList.remove('lobby-open');
      opened = false;
    },
  };
}
