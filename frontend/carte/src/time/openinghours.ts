/**
 * Lecture simplifiée des horaires OpenStreetMap (`opening_hours`), suffisante pour les formes
 * courantes à Chambéry : « Mo-Fr 08:00-19:30; Sa 07:30-19:30; Su,Mo off », « Tu-Sa 11:30-14:00,18:30-22:00 »,
 * « Mo-Sa 17:00-01:30 » (après minuit), « Sep-Jun We-Su … ; Jul-Aug Tu-Su … », « 24/7 ».
 * Non gérés (horaire alors « inconnu », null) : textes libres, horaires propres aux fériés ou vacances,
 * dates précises, semaines, lever/coucher du soleil. Les fermetures ponctuelles (« PH off », « SH off »,
 * « 2026 Aug 16 off ») sont ignorées : on suit alors l'horaire habituel du jour.
 * Règles OSM : « ; » = la règle suivante remplace les précédentes pour ses jours ; « , » devant un jour =
 * règle additionnelle (s'ajoute).
 */
type Span = [number, number]; // minutes depuis minuit ; fin ≤ début = après minuit
interface Rule { months: Set<number> | null; days: Set<number>; spans: Span[]; off: boolean; additional: boolean }
export type Schedule = Rule[];

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function range(list: string[], sel: string): Set<number> | null {
  const out = new Set<number>();
  for (const part of sel.split(',')) {
    const [a, b] = part.split('-').map((s) => list.indexOf(s.trim()));
    if (a < 0 || (b !== undefined && b < 0)) return null;
    if (b === undefined) { out.add(a); continue; }
    for (let i = a; ; i = (i + 1) % list.length) { out.add(i); if (i === b) break; }
  }
  return out;
}

const time = (s: string) => {
  const m = /^(\d{1,2}):(\d{2})\+?$/.exec(s.trim());
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Analyse une valeur `opening_hours` ; null si la forme n'est pas gérée. */
export function parseOpeningHours(raw: string | undefined): Schedule | null {
  if (!raw) return null;
  const src = raw.trim();
  if (src === '24/7') return [{ months: null, days: new Set([0, 1, 2, 3, 4, 5, 6]), spans: [[0, 1440]], off: false, additional: false }];
  // Exceptions ignorées (on suit le jour de la semaine) : « ,PH » (ouvert aussi les fériés), et les
  // fermetures ponctuelles « PH off », « SH off » (vacances scolaires), « 2026 Aug 16 off ».
  const cleaned = src.split(';').map((r) => r.trim().replace(/,\s*PH\b/g, ''))
    .filter((r) => r && !/^(PH|SH)\b/.test(r) && !/^\d{4}\b.*\boff$/.test(r)).join(';');
  if (/"|\bPH\b|\bSH\b|\bweek\b|sunrise|sunset|\d{4}|\[/.test(cleaned)) return null;
  const rules: Rule[] = [];
  for (const ruleText of cleaned.split(';')) {
    // Une règle peut contenir plusieurs sous-règles « jours horaires » séparées par « , » devant un jour
    const pieces = ruleText.split(/(?<=\d|off|closed)\s*,\s*(?=(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|Mo|Tu|We|Th|Fr|Sa|Su)\b)/);
    for (const [pi, piece] of pieces.entries()) {
      let rest = piece.trim().replace(/:\s/, ' ');
      if (!rest) continue;
      let months: Set<number> | null = null;
      const mm = /^((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:-(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec))?(?:,(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)(?:-\w{3})?)*):?\s+/.exec(rest);
      if (mm) { months = range(MONTHS, mm[1]); rest = rest.slice(mm[0].length); if (!months) return null; }
      let days = new Set([0, 1, 2, 3, 4, 5, 6]);
      const dm = /^((?:Mo|Tu|We|Th|Fr|Sa|Su)(?:\s*[-,]\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))*)\s*/.exec(rest);
      if (dm) { const s = range(DAYS, dm[1].replace(/\s/g, '')); if (!s) return null; days = s; rest = rest.slice(dm[0].length); }
      rest = rest.trim();
      if (/^(off|closed)$/.test(rest)) { rules.push({ months, days, spans: [], off: true, additional: pi > 0 }); continue; }
      const spans: Span[] = [];
      for (const t of rest.split(/\s*,\s*/)) {
        const [a, b] = t.split('-');
        const s = time(a ?? ''), e = time(b ?? '');
        if (s === null || e === null) return null;
        spans.push([s, e === 0 ? 1440 : e]);
      }
      if (!spans.length) return null;
      rules.push({ months, days, spans, off: false, additional: pi > 0 });
    }
  }
  return rules.length ? rules : null;
}

/** Plages d'ouverture d'un jour donné (0 = lundi), selon les règles OSM de remplacement / ajout. */
function spansOf(schedule: Schedule, day: number, month: number): Span[] {
  let spans: Span[] = [];
  for (const r of schedule) {
    if (!r.days.has(day) || (r.months && !r.months.has(month))) continue;
    spans = r.off ? [] : r.additional ? [...spans, ...r.spans] : [...r.spans];
  }
  return spans;
}

/**
 * Ouvert à ce moment ? `day` : 0 = lundi ; `minutes` depuis minuit ; `month` : 0 = janvier.
 * Tient compte des plages de la veille qui débordent après minuit.
 */
export function isOpen(schedule: Schedule, day: number, minutes: number, month: number): boolean {
  for (const [s, e] of spansOf(schedule, day, month)) {
    if (e > s ? minutes >= s && minutes < e : minutes >= s) return true;
  }
  for (const [s, e] of spansOf(schedule, (day + 6) % 7, month)) {
    if (e <= s && minutes < e) return true; // plage de la veille qui finit après minuit
  }
  return false;
}

export type OpenState = 'open' | 'closed' | 'unknown';

/**
 * État d'ouverture de chaque lieu à une date et une heure de Chambéry.
 * Les horaires sont analysés une seule fois (cache par texte).
 */
export function createOpenStates(hours: (string | undefined)[]) {
  const schedules = hours.map((h) => parseOpeningHours(h));
  return (day: { y: number; m: number; d: number }, hour: number): OpenState[] => {
    const wd = (new Date(Date.UTC(day.y, day.m - 1, day.d)).getUTCDay() + 6) % 7;
    const minutes = Math.floor(hour * 60);
    return schedules.map((s) => (s ? (isOpen(s, wd, minutes, day.m - 1) ? 'open' : 'closed') : 'unknown'));
  };
}
