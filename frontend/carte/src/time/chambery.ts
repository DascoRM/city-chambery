/**
 * Heure de Chambéry (fuseau Europe/Paris), quel que soit le fuseau de l'appareil du visiteur.
 */
export const CHAMBERY = { lat: 45.5658, lon: 5.9205, timeZone: 'Europe/Paris' };

export interface LocalDate { y: number; m: number; d: number } // m : 1-12

const partsFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: CHAMBERY.timeZone, year: 'numeric', month: 'numeric', day: 'numeric',
  hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23',
});
const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: CHAMBERY.timeZone, timeZoneName: 'shortOffset' });

/** Date et heure décimale à Chambéry pour un instant donné. */
export function chamberyClock(at: Date = new Date()): LocalDate & { hour: number } {
  const p = Object.fromEntries(partsFmt.formatToParts(at).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hour: +p.hour + +p.minute / 60 + +p.second / 3600 };
}

/** Décalage (minutes) de Chambéry par rapport à UTC à cet instant (+60 l'hiver, +120 l'été). */
function offsetMinutes(at: Date): number {
  const s = offsetFmt.formatToParts(at).find((x) => x.type === 'timeZoneName')?.value ?? 'GMT+1';
  const m = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(s);
  return m ? (m[1] === '-' ? -1 : 1) * (+m[2] * 60 + +(m[3] ?? 0)) : 0;
}

/** Instant correspondant à une date et une heure décimale « à Chambéry ». */
export function chamberyInstant(day: LocalDate, hour: number): Date {
  const h = Math.floor(hour), min = Math.round((hour - h) * 60);
  const guess = Date.UTC(day.y, day.m - 1, day.d, h, min);
  const off = offsetMinutes(new Date(guess - 120 * 60000)); // proche de l'instant visé
  return new Date(guess - off * 60000);
}
