import { CHAMBERY, chamberyClock, chamberyInstant, type LocalDate } from './chambery';
import { sunTimes } from './sun';
import { foliageOf, seasonDate, seasonOf, type Foliage, type Season, type SeasonChoice } from './seasons';

/**
 * Horloge du diorama (itération 31).
 *  - « Direct » (par défaut) : l'heure et la date réelles de Chambéry, relues toutes les minutes.
 *    Le soleil n'avance que d'environ 0,25° par minute : une mise à jour (et un recalcul des ombres)
 *    par minute suffit, c'est la fréquence retenue.
 *  - Manuel : l'heure choisie avec le curseur, figée.
 *  - Lecture ▶ : une journée défile en 2 minutes.
 * La saison est « auto » (date du jour) ou choisie : la date devient alors une date typique de
 * cette saison (course du soleil et feuillage de la saison), l'heure reste celle du mode en cours.
 */
export type ClockMode = 'live' | 'manual' | 'playing';

export interface ClockState {
  mode: ClockMode;
  day: LocalDate;
  hour: number;
  season: SeasonChoice;
  /** Saison effective (celle du jour en mode auto). */
  current: Season;
  foliage: Foliage;
  /** Lever et coucher du soleil ce jour-là (heures décimales, null s'il n'y en a pas). */
  sun: { rise: number | null; set: number | null };
}

const LIVE_REFRESH_S = 60;
const DAY_IN_SECONDS = 120; // lecture : une journée en 2 minutes
const SEASONS: SeasonChoice[] = ['auto', 'spring', 'summer', 'autumn', 'winter'];

export function createClock(now: () => Date = () => new Date()) {
  const sunCache = new Map<string, ClockState['sun']>();
  const sunOf = (day: LocalDate) => {
    const k = `${day.y}-${day.m}-${day.d}`;
    if (!sunCache.has(k)) sunCache.set(k, sunTimes((h) => chamberyInstant(day, h), CHAMBERY.lat, CHAMBERY.lon));
    return sunCache.get(k)!;
  };

  let mode: ClockMode = 'live';
  let season: SeasonChoice = 'auto';
  const real = chamberyClock(now());
  let today: LocalDate = { y: real.y, m: real.m, d: real.d };
  let hour = real.hour;
  let sinceRefresh = 0;
  const listeners: ((s: ClockState) => void)[] = [];

  const day = (): LocalDate => (season === 'auto' ? today : seasonDate(season, today.y));
  const state = (): ClockState => {
    const d = day();
    return { mode, day: d, hour, season, current: seasonOf(d), foliage: foliageOf(d), sun: sunOf(d) };
  };
  const emit = () => { const s = state(); listeners.forEach((f) => f(s)); };

  /** Relit l'heure réelle ; true si la minute (ou la date) a changé. */
  const readReal = () => {
    const r = chamberyClock(now());
    const changed = Math.floor(r.hour * 60) !== Math.floor(hour * 60) || r.d !== today.d || r.m !== today.m || r.y !== today.y;
    today = { y: r.y, m: r.m, d: r.d };
    hour = r.hour;
    return changed;
  };

  return {
    state,
    onChange(f: (s: ClockState) => void) { listeners.push(f); f(state()); },
    /** Revenir à l'heure réelle de Chambéry. */
    live() { mode = 'live'; readReal(); sinceRefresh = 0; emit(); },
    /** Heure choisie à la main (quitte le direct et la lecture). */
    setHour(h: number) { mode = 'manual'; hour = ((h % 24) + 24) % 24; emit(); },
    /** Lecture ▶ / pause ❚❚ (la pause fige l'heure atteinte). */
    setPlaying(p: boolean) { mode = p ? 'playing' : 'manual'; emit(); },
    setSeason(s: SeasonChoice) { season = s; emit(); },
    /** Saison suivante : Auto → Printemps → Été → Automne → Hiver → Auto. */
    nextSeason() { season = SEASONS[(SEASONS.indexOf(season) + 1) % SEASONS.length]; emit(); },
    update(dt: number) {
      if (mode === 'playing') {
        hour = (hour + (dt * 24) / DAY_IN_SECONDS) % 24;
        emit();
      } else if (mode === 'live') {
        sinceRefresh += dt;
        if (sinceRefresh < LIVE_REFRESH_S) return;
        sinceRefresh = 0;
        if (readReal()) emit();
      }
    },
  };
}
