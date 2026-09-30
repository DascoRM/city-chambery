/**
 * Types de voies OSM et hauteur de leurs rubans au-dessus du relief.
 * Une seule source pour le dessin des rues (city.ts) et pour tout ce qui y marche (éléphants,
 * passants) : si une hauteur change ici, ils restent posés sur la chaussée.
 */

/** Voies piétonnes (dessinées en chemin clair, préférées par les promeneurs). */
export const FOOT_KINDS = new Set(['footway', 'path', 'steps', 'cycleway', 'track', 'pedestrian', 'living_street']);

/** Ordre vertical : chemins < rues < berges < eau < ponts (le sol en relief porte les verts, places et plans d'eau). */
export const LIFT = { foot: 0.14, street: 0.18, bank: 0.24, water: 0.3, bridge: 0.9 } as const;

/** Hauteur du ruban d'une voie au-dessus du relief. */
export const roadLift = (kind: string, bridge?: boolean) => (bridge ? LIFT.bridge : FOOT_KINDS.has(kind) ? LIFT.foot : LIFT.street);
