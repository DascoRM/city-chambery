import { WEATHER_CONDITION_FR, weatherCondition, type WeatherCondition } from '../../../../contrat/meteo.js';
import type { DebugWeather, WeatherModule } from '../weather/index';

/**
 * Sélecteur de météo (`?debug`, EP009-US002), chargé à la demande : une condition (valeurs types du contrat), des curseurs,
 * et deux façons de l'appliquer :
 *  - « forcer » : comme `?weather=` (à toute heure) ;
 *  - « relevé simulé » : comme un relevé du back en Direct (hors Direct, la carte passe en « simulée »).
 * Équivalent dans la console : `diorama.weather.set({ condition: 'fog', fog: 0.6 })`, `.live({ condition: 'rain', temperatureC: 9 })`,
 * `.set(null)` pour relâcher, `.state()` pour lire l'état.
 */
export function installWeatherDebug(root: HTMLElement, weather: WeatherModule) {
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '') => { const e = document.createElement(tag); if (text) e.textContent = text; return e; };
  const box = el('details');
  box.className = 'weather-debug card';
  const select = el('select'), mode = el('select');
  select.append(new Option('Météo du site (relâcher)', ''), ...weatherCondition.options.map((c) => new Option(WEATHER_CONDITION_FR[c], c)));
  mode.append(new Option('Forcer (comme ?weather=)', 'set'), new Option('Relevé simulé (Direct)', 'live'));
  const values: DebugWeather = {};
  type Slider = 'cloud' | 'rain' | 'snow' | 'fog' | 'storm' | 'wind' | 'windFrom';
  const rows: { key: Slider; input: HTMLInputElement; out: HTMLElement }[] = [];
  const row = (key: Slider, label: string, max: number, step: number) => {
    const line = el('label'), input = el('input'), out = el('output');
    Object.assign(input, { type: 'range', min: '0', max: String(max), step: String(step) });
    input.addEventListener('input', () => { values[key] = Number(input.value); out.textContent = input.value; apply(); });
    line.append(el('span', label), input, out);
    rows.push({ key, input, out });
    return line;
  };
  const apply = () => {
    const v = select.value ? { condition: select.value as WeatherCondition, ...values } : null;
    weather.set(mode.value === 'set' ? v : null);
    weather.live(mode.value === 'live' ? v : null);
  };
  /** Curseurs calés sur les valeurs types de la condition choisie */
  const sync = () => {
    const t = weather.state().target;
    for (const r of rows) {
      const v = r.key === 'wind' ? 10 : r.key === 'windFrom' ? 270 : t[r.key];
      r.input.value = String(v);
      r.out.textContent = String(Math.round(v * 100) / 100);
    }
  };
  select.addEventListener('change', () => { for (const k of Object.keys(values)) delete values[k as keyof DebugWeather]; apply(); sync(); });
  mode.addEventListener('change', apply);
  box.append(
    el('summary', 'Météo (debug)'), select, mode,
    row('cloud', 'Nuages', 1, 0.05), row('rain', 'Pluie', 1, 0.05), row('snow', 'Neige', 1, 0.05), row('fog', 'Brouillard', 1, 0.05),
    row('storm', 'Orage', 1, 1), row('wind', 'Vent km/h', 120, 5), row('windFrom', 'Vient de (°)', 360, 15),
  );
  root.appendChild(box);
  sync();
}
