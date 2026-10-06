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
}
export interface ParkingEdits {
  overrides?: Record<string, ParkingOverride>;
  added?: (Partial<Parking> & { id: string; kind: ParkingKind; pos: Pt; note?: string })[];
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
    if (edited.length) out.edited = edited;
    return out;
  });
  for (const a of edits.added ?? []) {
    if (!a || typeof a.id !== 'string' || !KINDS.has(a.kind) || !isPt(a.pos)) { bad(`ajout sans identifiant, type ou position valide (${JSON.stringify(a)?.slice(0, 80)})`); continue; }
    if (known.has(a.id)) { bad(`ajout « ${a.id} » : identifiant déjà pris`); continue; }
    list.push({ access: 'public', ...a, added: true, posFixed: true } as Parking);
  }
  data.parkings = list;
}
