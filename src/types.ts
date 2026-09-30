export type Pt = [number, number]; // mètres : x = est, y = nord

/** Altitude du sol (Three.js y) en un point [x, y] projeté (relief) */
export type HeightFn = (x: number, y: number) => number;

/** Module animé : appelé à chaque image par la boucle de rendu (main.ts), dt et temps écoulé en secondes */
export interface Ticker { update(dt: number, t: number): void }

export interface Poly { outer: Pt[]; holes: Pt[][] }

export interface Building extends Poly {
  id: number; kind: string; h: number; minH: number; name?: string;
  /** Tag OSM roof:shape, s'il existe */
  roof?: string;
  /** Hauteur du toit (tag OSM roof:height, ou calculée depuis BD TOPO) */
  roofH?: number;
  /** Hauteur de la gouttière (BD TOPO) */
  eave?: number;
  /** Altitude du sol (m NGF, BD TOPO) — réservé au futur relief */
  ground?: number;
  /** Source de la hauteur : 'bdtopo' si IGN, sinon OSM ou estimée */
  hSrc?: 'bdtopo';
  /** Toit « rectangle » décidé par le script (scripts/roofs.mjs) */
  rect?: RectRoof;
  /**
   * Squelette droit du toit (calculé par le script). Les n premiers sommets sont ceux de
   * l'emprise (outer puis holes, à distance 0) ; v ne contient que les sommets intérieurs
   * [x, y, distance au bord]. f : faces (indices dans emprise + v).
   */
  skel?: { n: number; v: [number, number, number][]; f: number[][] };
}

export interface RectRoof {
  s: 'gabled' | 'hipped' | 'pyramidal';
  /** Centre, axe principal (unitaire), demi-longueur a, demi-largeur b du rectangle orienté */
  cx: number; cy: number; ux: number; uy: number; a: number; b: number;
  /** Hauteur du toit au-dessus de la gouttière */
  rise: number;
}
export interface Road { kind: string; w: number; pts: Pt[]; name?: string; bridge?: boolean }
export interface Area extends Poly { kind: 'plaza' | 'green'; name?: string }
export type Water = ({ kind: 'line'; w: number; pts: Pt[]; name?: string; covered?: boolean }) | ({ kind: 'area' } & Poly);
export interface Label { text: string; kind: 'park' | 'water'; pos: Pt; size: number }
export interface Place { id: string; kind: string; name: string; pos: Pt; cuisine?: string; hours?: string }

export interface CityData {
  generatedAt: string;
  attribution: string;
  origin: { lat: number; lon: number };
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  buildings: Building[];
  roads: Road[];
  areas: Area[];
  water: Water[];
  trees: Pt[];
  places: Place[];
  anchors: Record<string, { pos: Pt; osm: string; osmName: string }>;
  labels?: Label[];
  /** Relief : grille d'altitudes (décimètres au-dessus de base), pas de step mètres */
  terrain?: { x0: number; y0: number; step: number; nx: number; ny: number; base: number; exaggeration: number; source: string; z: number[] } | null;
  stats: { estimatedHeights: number };
}

export interface Poi {
  id: string;
  title: string;
  era: string;
  category: string;
  summary: string;
  story: string;
  anecdote?: string;
  sources: { label: string; url: string }[];
  osm: { match: string; prefer?: Record<string, string> };
  /** Brouillon : visible seulement en dev (créé par l'outil de placement) */
  draft?: boolean;
  /** Position manuelle (mètres) si l'ancrage OSM échoue */
  pos?: Pt;
}

export interface PlacedPoi extends Poi { position: Pt }
