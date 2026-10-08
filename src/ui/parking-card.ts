import type { Parking } from '../types';
import texts from '../content/parkings.json';
import { parkingColor } from '../scene/terrain';

/** Contenu de la fiche d'un parking (EP006-US003) : chaque chiffre dit d'où il vient ; l'inconnu est assumé */
export interface ParkingCardData {
  id: string;
  title: string;
  kind: string;
  fee: 'paid' | 'free' | 'unknown';
  color: string;
  /** Lignes de texte brut (la fiche les échappe) ; `small` : précision entre parenthèses */
  lines: { text: string; small?: string }[];
  source: string;
}

// Textes par défaut : le fichier de contenu peut être vide ou incomplet sans casser la fiche
type Dict = Record<string, string>;
const txt = texts as unknown as { kinds?: Dict; fee?: Dict; capacity?: Dict; access?: Dict; unnamed?: string; sourceNote?: string; sourceEdited?: string; sourceAdded?: string };
const merge = (base: Dict, over?: Dict): Dict => ({ ...base, ...over });
const T = {
  kinds: merge({ underground: 'Parking souterrain', 'multi-storey': 'Parking en silo', surface: 'Parking de surface', street: 'Stationnement le long de la rue' }, txt.kinds),
  fee: merge({ paid: 'Payant', free: 'Gratuit', unknown: 'Tarif inconnu' }, txt.fee),
  capacity: merge({ known: '{n} places', estimated: '≈ {n} places', estimatedNote: "estimé d'après la surface", unknown: 'Nombre de places inconnu : celui-là garde son secret' }, txt.capacity),
  access: merge({ subscribers: 'Réservé aux abonnés', customers: 'Réservé aux clients' }, txt.access),
  unnamed: txt.unnamed ?? 'Parking sans nom',
  sourceNote: txt.sourceNote ?? 'Source : OpenStreetMap, relevé du {date}. À vérifier sur place.',
  sourceEdited: txt.sourceEdited ?? 'Source : OpenStreetMap, relevé du {date}, et retouche manuelle ({fields}). À vérifier sur place.',
  sourceAdded: txt.sourceAdded ?? "Parking ajouté à la main (absent d'OpenStreetMap). À vérifier sur place.",
};

const FIELD_LABEL: Record<string, string> = { name: 'nom', fee: 'tarif', capacity: 'places', kind: 'type', pos: 'position' };
const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

export function parkingCard(p: Parking, osmDate: string): ParkingCardData {
  const d = new Date(osmDate);
  const date = Number.isNaN(d.getTime()) ? 'date inconnue' : d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines: ParkingCardData['lines'] = [];
  if (p.capacity) {
    lines.push({ text: `🚗 ${fmt(T.capacity.known, { n: p.capacity })}` });
    if (p.disabled) lines.push({ text: `♿ dont ${p.disabled} pour les personnes à mobilité réduite` });
  } else if (p.est) lines.push({ text: `🚗 ${fmt(T.capacity.estimated, { n: p.est })}`, small: `(${T.capacity.estimatedNote})` });
  else lines.push({ text: `❓ ${T.capacity.unknown}` });
  const h = p.maxHeight ? parseFloat(p.maxHeight.replace(',', '.')) : NaN;
  if (Number.isFinite(h)) lines.push({ text: `↕ Hauteur maximale : ${h.toLocaleString('fr-FR')} m` });
  if (T.access[p.access]) lines.push({ text: `🔑 ${T.access[p.access]}` });
  if (p.note) lines.push({ text: `📝 ${p.note}` });
  const by = p.editSource ? ` Source de la retouche : ${p.editSource}.` : '';
  const source = (p.added ? T.sourceAdded
    : p.edited?.length ? fmt(T.sourceEdited, { date, fields: p.edited.map((f) => FIELD_LABEL[f] ?? f).join(', ') })
    : fmt(T.sourceNote, { date })) + (p.added || p.edited?.length ? by : '');
  return {
    id: p.id,
    title: p.name ?? T.unnamed,
    kind: T.kinds[p.kind] ?? T.kinds.surface,
    fee: p.fee === true ? 'paid' : p.fee === false ? 'free' : 'unknown',
    color: parkingColor(p),
    lines,
    source,
  };
}

export const feeLabel = (f: ParkingCardData['fee']) => T.fee[f];
