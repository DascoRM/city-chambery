import * as z from 'zod/mini';

/**
 * Météo de Chambéry (EP009). La source (Open-Meteo) n'est appelée que par le back ; la carte et l'administration ne lisent
 * que ces formats. Réponses en objets ouverts (une API plus récente peut ajouter un champ), requêtes en objets stricts.
 * Les intensités (0..1) sont des choix de rendu calculés par le back à partir des valeurs continues (mm/h, %, m), pas des
 * faits météo ; les valeurs brutes sont gardées à côté (règle 1 du projet : rien d'inventé).
 */

/** Un relevé plus vieux que ça n'est jamais montré comme actuel (règle 1 de l'epic), ni par le back ni par la carte */
export const WEATHER_MAX_AGE_S = 3 * 3600;

export const weatherCondition = z.enum(['clear', 'partly', 'cloudy', 'fog', 'drizzle', 'rain', 'snow', 'sleet', 'thunder']);
export type WeatherCondition = z.infer<typeof weatherCondition>;

/** Libellés affichés (carte et administration) */
export const WEATHER_CONDITION_FR: Record<WeatherCondition, string> = {
  clear: 'Ciel dégagé', partly: 'Éclaircies', cloudy: 'Couvert', fog: 'Brouillard', drizzle: 'Bruine',
  rain: 'Pluie', snow: 'Neige', sleet: 'Pluie et neige', thunder: 'Orage',
};

/**
 * Valeurs types d'une météo de démonstration, les MÊMES pour `?weather=` (carte, sans réseau) et pour le forçage de
 * l'administration (back) : une démo a le même rendu dans les deux cas. `intensity` remplace l'intensité principale.
 */
export const WEATHER_PRESETS: Record<WeatherCondition, { cloudCover: number; rainIntensity: number; snowIntensity: number; fog: number; thunder: boolean }> = {
  clear: { cloudCover: 0.05, rainIntensity: 0, snowIntensity: 0, fog: 0, thunder: false },
  partly: { cloudCover: 0.45, rainIntensity: 0, snowIntensity: 0, fog: 0, thunder: false },
  cloudy: { cloudCover: 0.95, rainIntensity: 0, snowIntensity: 0, fog: 0, thunder: false },
  fog: { cloudCover: 1, rainIntensity: 0, snowIntensity: 0, fog: 0.6, thunder: false }, // 0,6 : choix de Dasco (09/10), 0,8 noyait la ville de jour
  drizzle: { cloudCover: 1, rainIntensity: 0.15, snowIntensity: 0, fog: 0, thunder: false },
  rain: { cloudCover: 1, rainIntensity: 0.5, snowIntensity: 0, fog: 0, thunder: false },
  snow: { cloudCover: 1, rainIntensity: 0, snowIntensity: 0.6, fog: 0, thunder: false },
  sleet: { cloudCover: 1, rainIntensity: 0.3, snowIntensity: 0.3, fog: 0, thunder: false },
  thunder: { cloudCover: 1, rainIntensity: 0.85, snowIntensity: 0, fog: 0, thunder: true },
};

const unit = z.number().check(z.gte(0), z.lte(1));
const isoDate = z.iso.datetime({ offset: true });

/** Crédit à afficher à côté de la météo (CC BY 4.0 : crédit, lien vers la licence, modifications signalées) */
export const weatherAttribution = z.object({
  text: z.string(),
  url: z.string(),
  licence: z.string(),
  licenceUrl: z.string(),
});
export type WeatherAttribution = z.infer<typeof weatherAttribution>;

/** GET /api/weather (publique, mise en cache par le CDN) */
export const weatherResponse = z.object({
  v: z.literal(1),
  /** `open-meteo` : relevé du modèle ; `admin` : météo forcée depuis l'administration (démo) */
  source: z.enum(['open-meteo', 'admin']),
  /** Modèle météo utilisé (ex. `icon_seamless`) ; null pour une météo forcée */
  model: z.nullable(z.string()),
  /** Heure de validité du pas de 15 min du modèle (ce n'est pas une observation de station) ; début du forçage sinon */
  observedAt: isoDate,
  /** Heure à laquelle le back a interrogé la source */
  fetchedAt: isoDate,
  /** Vrai si la source n'a pas répondu et que le back sert son dernier bon relevé (au plus WEATHER_MAX_AGE_S) */
  stale: z.boolean(),
  forced: z.boolean(),
  /** Fin de la météo forcée */
  forcedUntil: z.optional(isoDate),
  condition: weatherCondition,
  /** null pour une météo forcée (on n'invente pas de température) */
  temperatureC: z.nullable(z.number()),
  cloudCover: unit,
  /** Précipitations, en mm/h (pluie et neige fondue) */
  precipMmH: z.number().check(z.gte(0)),
  rainIntensity: unit,
  snowIntensity: unit,
  windKmh: z.number().check(z.gte(0)),
  windGustKmh: z.nullable(z.number().check(z.gte(0))),
  /** D'où vient le vent, en degrés (convention météo : 270 = vent d'ouest) */
  windFromDeg: z.number().check(z.gte(0), z.lte(360)),
  /** null si le modèle ne la donne pas */
  visibilityM: z.nullable(z.number().check(z.gte(0))),
  /** Brouillard déduit de la visibilité (ou du code WMO 45/48), pas mesuré */
  fog: unit,
  /** Orage déduit du code WMO de la source (95 à 99), pas mesuré : le potentiel d'éclair du modèle n'est pas utilisé */
  thunder: z.boolean(),
  attribution: z.nullable(weatherAttribution),
});
export type WeatherResponse = z.infer<typeof weatherResponse>;

const note = z.string().check(z.trim(), z.minLength(1), z.maxLength(200));

/** PUT /api/admin/weather/override : forcer une météo (démo) ou couper la météo, pour une durée limitée */
export const weatherOverrideInput = z.strictObject({
  mode: z.enum(['forcee', 'coupee']),
  condition: z.optional(weatherCondition),
  /** Intensité de la pluie, de la neige ou du brouillard (sinon la valeur type de la condition) */
  intensity: z.optional(unit),
  windKmh: z.optional(z.number().check(z.gte(0), z.lte(150))),
  windFromDeg: z.optional(z.number().check(z.gte(0), z.lte(360))),
  /** Durée en minutes : 5 min à 6 h, puis retour automatique à la météo réelle */
  minutes: z.int().check(z.gte(5), z.lte(360)),
  note: z.optional(note),
}).check(z.refine((o) => o.mode === 'coupee' || o.condition !== undefined, { message: 'condition obligatoire pour une météo forcée', path: ['condition'] }));
export type WeatherOverrideInput = z.infer<typeof weatherOverrideInput>;

/** Forçage en cours, tel qu'enregistré (base) et montré à l'administration */
export const weatherOverride = z.object({
  mode: z.enum(['forcee', 'coupee']),
  condition: z.optional(weatherCondition),
  intensity: z.optional(unit),
  windKmh: z.optional(z.number()),
  windFromDeg: z.optional(z.number()),
  note: z.optional(z.string()),
  since: isoDate,
  until: isoDate,
  by: z.string(),
});
export type WeatherOverride = z.infer<typeof weatherOverride>;

/** GET /api/admin/weather : ce que voient les visiteurs, le relevé brut, le forçage, l'état de cette instance de l'API */
export const adminWeatherResponse = z.object({
  /** La réponse publique du moment ; null si la météo est indisponible ou coupée (`publicCode` dit pourquoi) */
  public: z.nullable(weatherResponse),
  publicCode: z.nullable(z.enum(['meteo-indisponible', 'meteo-desactivee'])),
  upstream: z.nullable(z.object({
    model: z.string(),
    fetchedAt: isoDate,
    observedAt: isoDate,
    /** Point de grille retenu par la source (pas forcément les coordonnées demandées) */
    grid: z.object({ lat: z.number(), lon: z.number(), elevationM: z.nullable(z.number()) }),
    /** Valeurs brutes de la source (unités d'Open-Meteo), pour comprendre un rendu */
    raw: z.record(z.string(), z.nullable(z.number())),
  })),
  override: z.nullable(weatherOverride),
  /** Compteurs de l'instance de fonction qui répond (perdus à chaque démarrage : ce ne sont pas des totaux) */
  instance: z.object({
    startedAt: isoDate,
    upstreamCalls: z.number(),
    upstreamFailures: z.number(),
    lastError: z.nullable(z.string()),
    lastErrorAt: z.nullable(isoDate),
  }),
  config: z.object({ lat: z.number(), lon: z.number(), model: z.string(), freshS: z.number(), cdnMaxAgeS: z.number() }),
});
export type AdminWeatherResponse = z.infer<typeof adminWeatherResponse>;
