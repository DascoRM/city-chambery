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

export function applyParkingEdits(data: CityData, edits: ParkingEdits): void {
  const over = edits.overrides ?? {};
  const list = (data.parkings ?? []).filter((p) => !over[p.id]?.hide).map((p) => {
    const o = over[p.id];
    if (!o) return p;
    const { hide: _hide, ...rest } = o;
    const out: Parking = { ...p, ...rest };
    // Une capacité fixée à la main remplace l'estimation
    if (rest.capacity) delete out.est;
    return out;
  });
  for (const a of edits.added ?? []) list.push({ access: 'public', ...a } as Parking);
  data.parkings = list;
}
