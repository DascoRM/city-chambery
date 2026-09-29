import type { LocalDate } from './chambery';

/**
 * Saisons de la végétation à Chambéry (approximation, pas une donnée officielle) :
 * les arbres ne suivent pas le calendrier. Feuillage vert jusqu'à mi-octobre, couleurs d'automne
 * jusqu'à fin novembre, branches nues de décembre à mi-mars.
 * « Printemps » et « été » ont la même végétation ; ils changent la course du soleil.
 */
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export type SeasonChoice = 'auto' | Season;
export type Foliage = 'green' | 'autumn' | 'bare';

export const SEASON_LABEL: Record<Season, { label: string; icon: string }> = {
  spring: { label: 'Printemps', icon: '🌸' },
  summer: { label: 'Été', icon: '🌿' },
  autumn: { label: 'Automne', icon: '🍂' },
  winter: { label: 'Hiver', icon: '❄️' },
};

/** Saison calendaire (équinoxes et solstices arrondis au 21). */
export function seasonOf(day: LocalDate): Season {
  const k = day.m * 100 + day.d;
  if (k >= 321 && k < 621) return 'spring';
  if (k >= 621 && k < 921) return 'summer';
  if (k >= 921 && k < 1221) return 'autumn';
  return 'winter';
}

/** État du feuillage à cette date. */
export function foliageOf(day: LocalDate): Foliage {
  const k = day.m * 100 + day.d;
  if (k >= 1015 && k <= 1130) return 'autumn';
  if (k >= 1201 || k < 315) return 'bare';
  return 'green';
}

/** Date représentative d'une saison choisie à la main (course du soleil de cette saison). */
export function seasonDate(season: Season, year: number): LocalDate {
  return { spring: { y: year, m: 4, d: 20 }, summer: { y: year, m: 7, d: 15 }, autumn: { y: year, m: 10, d: 28 }, winter: { y: year, m: 1, d: 15 } }[season];
}
