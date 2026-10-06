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
  lines: string[];
  source: string;
}

const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

export function parkingCard(p: Parking, generatedAt: string): ParkingCardData {
  const date = new Date(generatedAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  const lines: string[] = [];
  if (p.capacity) {
    lines.push(`🚗 ${fmt(texts.capacity.known, { n: p.capacity })}`);
    if (p.disabled) lines.push(`♿ dont ${p.disabled} pour les personnes à mobilité réduite`);
  } else if (p.est) lines.push(`🚗 ${fmt(texts.capacity.estimated, { n: p.est })} <small>(${texts.capacity.estimatedNote})</small>`);
  else lines.push(`❓ ${texts.capacity.unknown}`);
  const h = p.maxHeight ? parseFloat(p.maxHeight.replace(',', '.')) : NaN;
  if (Number.isFinite(h)) lines.push(`↕ Hauteur maximale : ${h.toLocaleString('fr-FR')} m`);
  return {
    id: p.id,
    title: p.name ?? texts.unnamed,
    kind: texts.kinds[p.kind],
    fee: p.fee === true ? 'paid' : p.fee === false ? 'free' : 'unknown',
    color: parkingColor(p),
    lines,
    source: fmt(texts.sourceNote, { date }),
  };
}

export const feeLabel = (f: ParkingCardData['fee']) => texts.fee[f];
