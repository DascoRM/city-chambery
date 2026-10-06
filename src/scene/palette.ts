/** Palette du diorama : tons chauds des façades sardes/savoyardes, socle façon maquette. */
export const PALETTE = {
  ground: '#cdd6ae',
  street: '#f1e9da',
  footway: '#e6dcc8',
  plaza: '#ece2cf',
  green: '#a6c886',
  water: '#6fb1d6',
  waterDeep: '#3f86b5',
  bank: '#b9ad95',
  bridge: '#e4d8c3',
  /** Couche « Parkings » (EP006) : lavande, pour ne se confondre ni avec l'eau, ni avec les espaces verts */
  parking: { surface: '#b3a3df', 'multi-storey': '#8f7bc7', street: '#d3c8ea', private: '#dedae8', hatch: '#6f5fa8' },
  soilTop: '#8b6a4f',
  soilBottom: '#6c513f',
  plinth: '#3b2f29',
  walls: ['#f2d7a6', '#eec39a', '#f6e2d8', '#f4e3c3', '#e7c9a9', '#f3dbcf', '#f0d2b4', '#e8d7ba', '#d9b99b', '#f3cfa0', '#efd7cd', '#efdcc0'],
  roofs: ['#504f4e', '#949cad', '#8e8984', '#a6a09f', '#7f7a76', '#bbb0ac'],
  monumentWall: '#ebe4d3',
  monumentRoof: '#6f7378',
  canopy: ['#6f9e55', '#7fae5f', '#5f8f4a', '#8bb86a'],
  canopyAutumn: ['#d98a3d', '#e3a84e', '#c8703a', '#9fa352'], // automne (itération 31) ; un arbre sur 4 encore vert-jaune
  canopyBare: ['#8b7866', '#7d6b5b', '#968474', '#86725f'], // hiver : petite couronne de branches nues
  trunk: '#7a5a42',
  poi: '#f4b73f',
  poiFound: '#2a9d8f',
};

/**
 * Catégories des lieux (bars, cafés, restaurants) : une couleur par catégorie, reprise par
 * l'épingle 3D, le halo de nuit, la fiche au survol et la légende. Couleurs choisies pour ne pas
 * se confondre avec les gemmes des lieux d'histoire (or, puis turquoise une fois découvertes).
 * Les types OSM (amenity) sont regroupés : pub, biergarten et boîte de nuit → Bar ; glacier → Café.
 */
export interface PlaceCategory { id: string; label: string; color: string; kinds: string[] }
export const PLACE_CATEGORIES: PlaceCategory[] = [
  { id: 'bar', label: 'Bar', color: '#8e5bd6', kinds: ['bar', 'pub', 'biergarten', 'nightclub'] },
  { id: 'cafe', label: 'Café', color: '#2f7fd0', kinds: ['cafe', 'ice_cream'] },
  { id: 'restaurant', label: 'Restaurant', color: '#e0662f', kinds: ['restaurant'] },
];
const OTHER: PlaceCategory = { id: 'other', label: 'Lieu', color: '#8a7f76', kinds: [] };
export const placeCategory = (kind: string): PlaceCategory => PLACE_CATEGORIES.find((c) => c.kinds.includes(kind)) ?? OTHER;

/** Libellé précis du type OSM (affiché sous le nom dans la fiche). */
export const PLACE_KIND_LABEL: Record<string, string> = {
  bar: 'Bar', pub: 'Pub', nightclub: 'Boîte de nuit', biergarten: 'Biergarten', cafe: 'Café', ice_cream: 'Glacier', restaurant: 'Restaurant',
};

/** Pseudo-aléatoire déterministe (même bâtiment → même couleur à chaque chargement). */
export function rand(seed: number): number {
  // Hachage entier (type « lowbias32 ») : des identifiants proches donnent des valeurs très différentes
  let x = Math.floor(seed) >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}
