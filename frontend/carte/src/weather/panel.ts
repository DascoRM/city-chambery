import type { PanelView } from './state';

/**
 * Panneau de la puce météo (EP009) : ouvert au-dessus de la puce (tiroir en bas de l'écran sous 720 px). Construit avec
 * l'API du DOM et `textContent` : aucun HTML n'est fabriqué à partir des données.
 */
export interface PanelState extends PanelView { enabled: boolean; reduced: boolean; systemReduced: boolean }

export function createWeatherPanel(root: HTMLElement, h: {
  /** La puce, pour poser le panneau au-dessus */
  anchor(): HTMLElement | null;
  onClose(): void;
  onBackToLive(): void;
  onEnabled(on: boolean): void;
  onReduced(on: boolean): void;
}) {
  const make = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  };
  const toggle = (text: string, on: (v: boolean) => void) => {
    const label = make('label', 'wp-toggle'), input = make('input');
    input.type = 'checkbox';
    input.addEventListener('change', () => on(input.checked));
    label.append(input, text);
    return { label, input };
  };

  const el = make('section', 'weather-panel card');
  el.hidden = true;
  el.setAttribute('aria-label', 'Météo');
  const close = make('button', 'icon close', '✕');
  close.setAttribute('aria-label', 'Fermer');
  const title = make('h2');
  const body = make('div', 'wp-body');
  const live = make('button', 'btn wp-live', 'Revenir au direct');
  const enabled = toggle('Afficher la météo', h.onEnabled);
  const reduced = toggle('Effets réduits (ni éclairs ni balancement, pluie ralentie)', h.onReduced);
  el.append(close, title, body, live, enabled.label, reduced.label);
  root.appendChild(el);

  /** Au-dessus de la puce sur ordinateur ; sous 720 px, le style en fait un tiroir en bas de l'écran */
  const place = () => {
    const a = h.anchor();
    if (!a || innerWidth <= 720) { el.style.left = el.style.bottom = ''; return; }
    const r = a.getBoundingClientRect();
    el.style.left = `${Math.round(Math.max(16, Math.min(innerWidth - el.offsetWidth - 16, r.left - 8)))}px`;
    el.style.bottom = `${Math.round(innerHeight - r.top + 10)}px`;
  };
  const hide = () => {
    if (el.hidden) return;
    el.hidden = true;
    h.onClose();
  };
  close.addEventListener('click', hide);
  live.addEventListener('click', () => h.onBackToLive());
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide(); });
  window.addEventListener('resize', () => { if (!el.hidden) place(); });

  return {
    isOpen: () => !el.hidden,
    open() { el.hidden = false; place(); },
    close: hide,
    render(v: PanelState) {
      title.textContent = v.title;
      body.replaceChildren(...v.lines.map((l) => make('p', '', l)));
      live.hidden = !v.backToLive;
      enabled.input.checked = v.enabled;
      reduced.input.checked = v.reduced || v.systemReduced;
      reduced.input.disabled = v.systemReduced; // réglage du système (prefers-reduced-motion) : il l'emporte
      reduced.label.hidden = !v.enabled;
    },
  };
}
