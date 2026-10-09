import * as z from 'zod/mini';

/**
 * Retouches des parkings (EP008-US006). Requêtes en objets stricts (un champ inconnu est refusé) ; réponses en objets ouverts
 * (une API plus récente qui ajoute un champ ne casse pas une carte ou une administration plus anciennes). Dates en texte ISO.
 */

const label = (max: number) => z.string().check(z.trim(), z.minLength(1), z.maxLength(max));
const coordinate = z.number().check(z.gte(-5000), z.lte(5000));
const capacity = z.int().check(z.positive(), z.lte(10000));

/** Position dans le diorama, en mètres : [x, y] */
export const point = z.tuple([coordinate, coordinate]);
export const parkingKind = z.enum(['underground', 'multi-storey', 'surface', 'street']);
export type ParkingKind = z.infer<typeof parkingKind>;

/** Identifiant OpenStreetMap d'un parking (`way/123`, `node/456`, `relation/789`) */
export const osmId = z.string().check(z.regex(/^(way|node|relation)\/\d{1,15}$/));
/** Identifiant d'un parking ajouté à la main */
export const customId = z.string().check(z.regex(/^custom\/[a-z0-9-]{2,60}$/));

/** PUT /api/admin/parkings/overrides/:id : seuls les champs présents changent ; la source est obligatoire (rien d'inventé) */
export const overrideInput = z.strictObject({
  hide: z.optional(z.boolean()),
  name: z.optional(label(80)),
  fee: z.optional(z.boolean()),
  capacity: z.optional(capacity),
  kind: z.optional(parkingKind),
  pos: z.optional(point),
  note: z.optional(label(300)),
  source: label(300),
}).check(z.refine((o) => Object.keys(o).some((k) => k !== 'source'), { message: 'aucune retouche (il faut au moins un champ en plus de la source)' }));
export type OverrideInput = z.infer<typeof overrideInput>;

/** POST /api/admin/parkings/added : parking absent d'OpenStreetMap */
export const addedInput = z.strictObject({
  id: customId,
  kind: parkingKind,
  pos: point,
  name: z.optional(label(80)),
  fee: z.optional(z.boolean()),
  capacity: z.optional(capacity),
  note: z.optional(label(300)),
  source: label(300),
});
export type AddedInput = z.infer<typeof addedInput>;

/** Une retouche publiée : ses champs et sa source */
export const publishedOverride = z.object({
  hide: z.optional(z.boolean()),
  name: z.optional(z.string()),
  fee: z.optional(z.boolean()),
  capacity: z.optional(z.number()),
  kind: z.optional(parkingKind),
  pos: z.optional(point),
  note: z.optional(z.string()),
  source: z.string(),
});
export type PublishedOverride = z.infer<typeof publishedOverride>;

/** Un parking ajouté, publié */
export const publishedAdded = z.object({
  id: z.string(),
  kind: parkingKind,
  pos: point,
  name: z.optional(z.string()),
  fee: z.optional(z.boolean()),
  capacity: z.optional(z.number()),
  note: z.optional(z.string()),
  source: z.string(),
});
export type PublishedAdded = z.infer<typeof publishedAdded>;

/** GET /api/parkings/edits (publique, lue par la carte au chargement) : même forme que `content/parkings.json` de la carte */
export const publishedEdits = z.object({
  overrides: z.record(z.string(), publishedOverride),
  added: z.array(publishedAdded),
  updatedAt: z.nullable(z.string()),
});
export type PublishedEdits = z.infer<typeof publishedEdits>;

/** Une ligne du journal des retouches */
export const editLogEntry = z.object({
  id: z.number(),
  target: z.string(),
  action: z.string(),
  data: z.optional(z.unknown()),
  source: z.nullable(z.string()),
  at: z.string(),
});
export type EditLogEntry = z.infer<typeof editLogEntry>;

/** GET /api/admin/parkings/edits : les retouches publiées et le journal */
export const adminParkingEdits = z.extend(publishedEdits, { log: z.array(editLogEntry) });
export type AdminParkingEdits = z.infer<typeof adminParkingEdits>;
