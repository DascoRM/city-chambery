import type { CityData, Parking, ParkingKind, Pt } from '../types';

/**
 * Retouches manuelles des parkings (EP006) : `src/content/parkings.json` → `overrides` (par identifiant OpenStreetMap)
 * et `added` (parkings absents d'OSM). Appliquées au chargement sur les données de `city.json` : on corrige ou on
 * complète sans relancer le script de données (recharger la page suffit). Rien n'est inventé : ce qu'on ajoute ici
 * doit venir d'une source (la note de la fiche peut la citer).
 */
export interface ParkingOverride {
  /** Retirer ce parking (n'existe pas, doublon…) */
  hide?: boolean;
  name?: string;
  fee?: boolean;
  capacity?: number;
  kind?: ParkingKind;
  /** Nouvelle position (m) du panneau */
  pos?: Pt;
  /** Phrase affichée dans la fiche (source à citer) */
  note?: string;
  /** Source de la retouche (obligatoire depuis l'administration, EP008) */
  source?: string;
}
export interface ParkingEdits {
  overrides?: Record<string, ParkingOverride>;
  added?: (Partial<Parking> & { id: string; kind: ParkingKind; pos: Pt; note?: string; source?: string })[];
}

/**
 * Fusionne les retouches du fichier (`parkings.json`) et celles publiées par l'administration (base, EP008-US006) :
 * pour un même parking, l'administration l'emporte ; les ajouts sont réunis (l'administration l'emporte à identifiant égal).
 */
export function mergeParkingEdits(file: ParkingEdits, published: ParkingEdits | null): ParkingEdits {
  if (!published) return file;
  const added = new Map((file.added ?? []).map((a) => [a.id, a]));
  for (const a of published.added ?? []) added.set(a.id, a);
  return { overrides: { ...(file.overrides ?? {}), ...(published.overrides ?? {}) }, added: [...added.values()] };
}

/** Retouches publiées par l'administration (`/api/parkings/edits`) ; null si l'API ne répond pas vite (le site part sans) */
export async function fetchPublishedEdits(timeoutMs = 1500): Promise<ParkingEdits | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch('/api/parkings/edits', { signal: ctrl.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as ParkingEdits;
    return body && typeof body === 'object' ? body : null;
  } catch {
    return null; // hors ligne, API absente (développement sans `npm run api:dev`), délai dépassé
  } finally {
    clearTimeout(timer);
  }
}

const KINDS = new Set<string>(['underground', 'multi-storey', 'surface', 'street']);
const isPt = (p: unknown): p is Pt => Array.isArray(p) && p.length === 2 && p.every((v) => typeof v === 'number' && Number.isFinite(v));

/** Retouche invalide : on l'ignore et on le dit dans la console, le site ne plante jamais à cause de ce fichier */
const bad = (what: string) => console.warn(`[parkings] retouche ignorée : ${what}`);

export function applyParkingEdits(data: CityData, edits: ParkingEdits): void {
  const over = edits.overrides ?? {};
  const known = new Set((data.parkings ?? []).map((p) => p.id));
  for (const id of Object.keys(over)) if (!known.has(id)) bad(`« ${id} » n'existe pas dans les données`);
  const list = (data.parkings ?? []).filter((p) => !over[p.id]?.hide).map((p) => {
    const o = over[p.id];
    if (!o) return p;
    const out: Parking = { ...p };
    const edited: string[] = [];
    if (typeof o.name === 'string') { out.name = o.name; edited.push('name'); }
    if (typeof o.fee === 'boolean') { out.fee = o.fee; edited.push('fee'); }
    if (typeof o.capacity === 'number' && o.capacity > 0) { out.capacity = o.capacity; delete out.est; edited.push('capacity'); } // remplace l'estimation
    if (o.kind) {
      if (KINDS.has(o.kind)) { out.kind = o.kind; edited.push('kind'); if (o.kind !== 'surface') delete out.est; } else bad(`type « ${o.kind} » inconnu (${p.id})`);
    }
    if (o.pos !== undefined) {
      if (isPt(o.pos)) { out.pos = o.pos; out.posFixed = true; edited.push('pos'); } else bad(`pos invalide (${p.id})`);
    }
    if (typeof o.note === 'string') out.note = o.note;
    if (typeof o.source === 'string' && o.source.trim()) out.editSource = o.source.trim();
    if (edited.length) out.edited = edited;
    return out;
  });
  for (const a of edits.added ?? []) {
    if (!a || typeof a.id !== 'string' || !KINDS.has(a.kind) || !isPt(a.pos)) { bad(`ajout sans identifiant, type ou position valide (${JSON.stringify(a)?.slice(0, 80)})`); continue; }
    if (known.has(a.id)) { bad(`ajout « ${a.id} » : identifiant déjà pris`); continue; }
    const { source, ...rest } = a;
    list.push({ access: 'public', ...rest, added: true, posFixed: true, ...(source?.trim() ? { editSource: source.trim() } : {}) } as Parking);
  }
  data.parkings = list;
}
