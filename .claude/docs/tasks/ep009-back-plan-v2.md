# Plan back / contrat / admin : la météo gérée par le back (EP009, v2)

Rédigé le 09/10/2026 par un agent chercheur (aucun fichier du dépôt modifié, sauf ce plan). Demande de Dasco :
« La météo, je veux que ça soit géré par le back et affiché sur le front. » Ce plan remplace, pour le back, le contrat et
l'administration, [meteo-back-plan.md](meteo-back-plan.md) (08/10, écrit avant EP010). Le rendu 3D reste dans le plan front.

Légende : **[vérifié]** = lu sur une page officielle ou testé le 09/10/2026 ; **[prototype]** = codé et testé dans une copie
temporaire du dépôt (pas dans le dépôt) ; **[non vérifié]** = à confirmer.

Le prototype complet (contrat, client, normalisation, service, routes, stockage du forçage, 19 tests, contrôle du build) est
dans `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/ep009-back/repo/`
(dossier temporaire de la session : `contrat/meteo.ts`, `backend/src/meteo/*.ts`, `scripts/check-api-esm.mjs`). L'agent
principal peut s'en servir pendant cette session ; l'essentiel du code est recopié ci-dessous.

---

## 0. En bref

- **Source : Open-Meteo, mais le modèle ICON du DWD (`icon_seamless`), pas AROME.** Testé le 09/10 : avec
  `meteofrance_seamless`, la visibilité et le potentiel d'éclair reviennent `null`, et sur 1 434 h (août à octobre) AROME
  n'a donné **aucune** heure de brouillard ni d'orage, même le soir de l'orage du 08/09 (code « forte pluie »). ICON donne
  la visibilité et 21 h d'orage sur 12 jours. `best_match` suit déjà ICON à Chambéry (1 525 h sur 1 753).
- **Route `GET /api/weather`** dans `backend/src/meteo/` : coordonnées fixes, 10 variables (= 1 appel compté par
  Open-Meteo), réponse amont validée par Zod, relevé gardé 10 min en mémoire, une seule requête amont en vol, repli « stale »
  jusqu'à 3 h puis 503 `meteo-indisponible`. En-tête `public, max-age=0, s-maxage=60, stale-while-revalidate=300`
  (même principe que `/api/parkings/edits`). Le `no-store` global **n'écrase déjà plus** l'en-tête d'une route
  (`backend/src/app.ts` ligne 67) : la consigne de la spec « retirer le no-store global » est périmée.
- **Contrat `contrat/meteo.ts`** (zod/mini, ≈ 1,3 Ko gzip de plus dans la carte, mesuré) : réponse publique, forçage,
  écran admin, valeurs types de démo **partagées** par `?weather=` (carte) et le forçage (admin), libellés français.
- **« Géré par le back » côté administration** : un écran « Météo » (ce que voient les visiteurs, relevé brut, erreurs de la
  source, compteurs de l'instance) et un **forçage pour les démos** (ou une **coupure**), limité dans le temps, vu par tous
  les visiteurs. Rangé dans la table **existante** `app_meta` : **aucune migration**, donc aucun conflit avec les migrations
  d'EP008. Lecture en base bornée (≤ 2 par heure et par instance sans forçage). Seuils réglables dans l'admin : déconseillés.
- **Effort back / contrat / admin : 2,5 à 3,25 j** (US003 : 1,5 à 2 j ; US012 nouvelle : 1 à 1,25 j), plus 0,5 j
  pour les prévisions horaires si D4 l'exige (US013, facultative). **0 €** tant que le projet reste non commercial.
- **Prototype [prototype]** : `tsc` du back et du contrat OK, **81 tests** (back, contrat, outillage) OK dont 19 nouveaux,
  `check-api-esm` OK avec et sans les variables d'environnement de Vercel, `check-boundaries` OK.
- **Non vérifié** : le comportement réel sur Vercel (cache du CDN, instances), les réveils de Neon mesurés, les limites
  d'Open-Meteo **par adresse IP** sur les IP partagées de Vercel, la fiabilité de l'orage et du brouillard face à des
  observations, l'hiver (neige, brouillard) : les données testées couvrent août à octobre.

---

## 1. Open-Meteo aujourd'hui (vérifié le 09/10/2026)

### 1.1 Conditions, quotas, licence [vérifié]
| Point | Ce que disent les pages officielles |
|---|---|
| Usage gratuit | Non commercial seulement. Exemples donnés : « private or non-profit websites or apps that do not have subscriptions or advertising ». Commercial : « Operating websites or apps that have subscriptions or display advertisements » ([conditions](https://open-meteo.com/en/terms)) |
| Quotas gratuits | 600 appels/min, 5 000/h, 10 000/jour, 300 000/mois ([tarifs](https://open-meteo.com/en/pricing)) |
| Poids d'un appel | « One API call corresponds to one HTTP API request », mais plus de 10 variables ou plus de 2 semaines comptent comme plusieurs appels (« 2 weeks of data with 15 weather variables will be calculated as 1.5 API calls ») ([tarifs](https://open-meteo.com/en/pricing)) |
| Limite par adresse IP | Les limites s'appliquent **par adresse IP** ; formule `max(variables/10, variables/10 × jours/7) × lieux` (mainteneur, [ticket 438](https://github.com/open-meteo/open-meteo/issues/438), 2023). Les fonctions Vercel sortent par des IP **partagées** : risque de 429 causés par d'autres projets [non vérifié en pratique] |
| Garantie | « …their uninterrupted provision are not guaranteed » ; aucune garantie de service sur le gratuit |
| Payant | Clé d'API, `customer-api.open-meteo.com`, objectif 99,9 % ; prix non affiché sur la page officielle ; ≈ 29 €/mois pour 1 M d'appels d'après des pages tierces [non vérifié] |
| Licence | **CC BY 4.0** : « You must give appropriate credit, provide a link to the licence, and indicate if changes were made » ; lien « Weather data by Open-Meteo.com » **à côté de l'endroit où les données sont affichées** ([licence](https://open-meteo.com/en/licence)). Sources listées : DWD, Météo-France, ECMWF en CC BY |
| `current` | « Current conditions are based on 15-minutely weather model data » ; `interval` = durée des cumuls ; les cumuls (`precipitation`, `snowfall`) portent sur les 15 min précédentes ; neige en cm, « divide by 7 » pour l'équivalent en eau (7 cm = 10 mm) ([doc](https://open-meteo.com/en/docs)) |
| Erreurs | HTTP 400 avec `{"error": true, "reason": "…"}` ; testé : `{"reason":"Invalid value: Cannot initialize MultiDomains from invalid String value modele_inconnu","error":true}` |
| Modèles | AROME France HD 0,01° (≈ 1,5 km), données à 15 min natives, « reduced set of native fields » ([Météo-France](https://open-meteo.com/en/docs/meteofrance-api)) ; ICON-D2 0,02° (≈ 2 km), potentiel d'éclair « only available in ICON D2 » ([DWD](https://open-meteo.com/en/docs/dwd-api)). La page DWD dit que ICON-D2 couvre « Germany, Switzerland, Austria », mais l'appel `models=icon_d2` renvoie bien des valeurs pour Chambéry (voir 1.3) |

### 1.2 Appels de test réels [vérifié]
**Aux coordonnées demandées, modèle AROME** (09/10/2026, 10 h 01 UTC, HTTP 200 en 0,89 s, 814 octets ; aucun en-tête
`Cache-Control` ni de quota dans la réponse) :
```
curl "https://api.open-meteo.com/v1/forecast?latitude=45.5646&longitude=5.9178&current=temperature_2m,is_day,weather_code,cloud_cover,precipitation,rain,showers,snowfall,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility,cape,lightning_potential&models=meteofrance_seamless&timezone=UTC&timeformat=unixtime"
```
```json
{"latitude":45.559998,"longitude":5.92,"generationtime_ms":288.27,"utc_offset_seconds":0,"timezone":"GMT","elevation":286.0,
 "current_units":{"time":"unixtime","interval":"seconds","temperature_2m":"°C","is_day":"","weather_code":"wmo code","cloud_cover":"%",
   "precipitation":"mm","rain":"mm","showers":"mm","snowfall":"cm","wind_speed_10m":"km/h","wind_direction_10m":"°",
   "wind_gusts_10m":"km/h","visibility":"undefined","cape":"J/kg","lightning_potential":"undefined"},
 "current":{"time":1791540000,"interval":900,"temperature_2m":12.7,"is_day":1,"weather_code":1,"cloud_cover":21,"precipitation":0.0,
   "rain":0.0,"showers":0.0,"snowfall":0.0,"wind_speed_10m":11.2,"wind_direction_10m":285,"wind_gusts_10m":32.4,
   "visibility":null,"cape":0.0,"lightning_potential":null}}
```
**Même requête, `models=icon_seamless`** (10 h 05 UTC, HTTP 200 en 1,90 s, 803 octets) :
```json
{"latitude":45.56,"longitude":5.9199996,"generationtime_ms":517.03,"elevation":286.0,
 "current_units":{"…":"…","visibility":"m","cape":"J/kg","lightning_potential":"J/kg"},
 "current":{"time":1791540000,"interval":900,"temperature_2m":12.8,"is_day":1,"weather_code":2,"cloud_cover":71,"precipitation":0.0,
   "rain":0.0,"showers":0.0,"snowfall":0.0,"wind_speed_10m":14.1,"wind_direction_10m":257,"wind_gusts_10m":29.9,
   "visibility":33040.0,"cape":0.0,"lightning_potential":0.0}}
```
`1791540000` = 09/10/2026 10:00 UTC : le pas de 15 min en cours (à 10 h 01 comme à 10 h 05). Délais mesurés : 0,6 à 1,9 s.

**Coordonnées.** Les coordonnées du plan du 08/10 (45,5646 ; 5,9178) n'ont pas de source dans le dépôt. Celles du projet
sont le centre de l'emprise de `frontend/carte/diorama.config.json` (45,56575 ; 5,9205), arrondi dans `CHAMBERY`
(`frontend/carte/src/time/chambery.ts` ligne 4 : 45,5658 ; 5,9205). **Recommandé : ces dernières** (règle 1 : rien
d'inventé). Testé : elles tombent dans la même maille ICON (45,56 ; 5,92), mêmes valeurs (altitude 283 m au lieu de 286).

### 1.3 Quel modèle ? [vérifié]
Valeurs `current` du même instant (10 h 00 UTC) selon le modèle :

| `models=` | Maille | Code | Nuages | Visibilité | Potentiel d'éclair |
|---|---|---|---|---|---|
| `meteofrance_seamless` | 45,56 ; 5,92 | 1 | 21 % | `null` | `null` |
| `meteofrance_arome_france_hd` | 45,56 ; 5,92 | `null` | `null` | `null` | `null` |
| `meteofrance_arome_france` | 45,575 ; 5,925 | 1 | 21 % | `null` | `null` |
| `meteofrance_arpege_europe` | 45,6 ; 5,9 | 2 | 75 % | `null` | `null` |
| `icon_seamless` / `icon_d2` | 45,56 ; 5,92 | 2 | 71 % | 33 040 m | 0 |
| `ecmwf_ifs025` | 45,5 ; 6,0 | 3 | 100 % | `null` | `null` |
| `best_match` (défaut) | 45,557 ; 5,915 | 2 | 71 % | 33 040 m | 0 |

Historique horaire (`past_days=92`, 4 modèles, un appel de 76 s) :

| | AROME (`meteofrance_seamless`) | ICON (`icon_seamless`) |
|---|---|---|
| Heures disponibles | 1 434 (11/08 → 09/10) | 1 531 (07/08 → 09/10) |
| Codes de brouillard (45, 48) | **0 h** | 1 h ; visibilité < 1 km : 4 h |
| Codes d'orage (95 à 99) | **0 h** | **21 h sur 12 jours** ; potentiel d'éclair > 0 : 3 h |
| Visibilité fournie | 0 h | 1 461 h |
| Bruine (51 à 55) | 40 h | 0 h (pluie et averses) |

Exemple : le 08/09 à 22 h UTC, ICON dit 99 (orage avec grêle, 12 mm, potentiel d'éclair 19,8 J/kg), AROME dit 65 (forte
pluie, 17,4 mm). Avec AROME, l'orage (US008) et le brouillard (US006) ne se déclencheraient donc jamais avec la météo réelle.
`best_match` donne le même code qu'ICON 1 525 h sur 1 753 et la même température 1 516 h : à Chambéry, c'est ICON.

**Recommandation : `models=icon_seamless`** (ICON-D2 2 km, puis ICON-EU 7 km, puis le global : repli dans le même
fournisseur), écrit en dur dans une constante et renvoyé dans la réponse (`model`). Plutôt que `best_match` : même résultat
aujourd'hui, mais un choix explicite ne change pas sans prévenir (et l'attribution reste juste). Changer de modèle = une ligne.
Réserve : fiabilité de l'orage et du brouillard d'ICON **non comparée à des observations** ; l'hiver n'a pas été testé.

### 1.4 Ce qui change par rapport au plan du 08/10
- Modèle ICON (DWD) au lieu d'AROME ; attribution « Open-Meteo.com, modèle ICON du DWD » ; la question de la licence des
  données Météo-France tombe.
- `current` donne des cumuls sur 15 min : **mm/h = cumul × 3600 / `interval`** (× 4), pas le cumul tel quel.
- 10 variables au plus par requête pour rester à 1 appel compté (on retire `is_day`, `rain`, `showers`, `cape`).
- Nouveau risque : les quotas par IP sur les IP partagées de Vercel (repli prévu ; secours MET Norway en option).

---

## 2. Ce qu'EP010 a changé (à reporter dans la spec EP009)

| Spec du 08/10 | Aujourd'hui |
|---|---|
| US003 « retirer le `no-store` global de `backend/src/app.ts` » | **Inutile** : le middleware (lignes 65 à 68) ne pose `no-store` que si la route n'a pas choisi son en-tête (ligne 67) ; `/api/parkings/edits` s'en sert déjà (ligne 80) [vérifié, testé] |
| US003 « dépend de EP008-US001 (socle API) » | Socle livré et déplacé dans `backend/` par EP010 : plus de dépendance |
| Règle 3 : coordonnées dans `src/time/chambery.ts` | `frontend/carte/src/time/chambery.ts` ; le back **ne peut pas l'importer** (règle 7) : constante propre au back, avec sa source en commentaire |
| Contrat JSON v1 décrit en prose | `contrat/meteo.ts` en **zod/mini**, lu par le back, la carte (validation, D12 d'EP010) et l'admin |
| US011 « `/api/admin/status` montre le dernier relevé » | Route dédiée **`/api/admin/weather`** : on ne touche ni `/status` ni `contrat/sante.ts` (EP008 les fera évoluer) |
| Forçage serveur « avec jeton » | **Session** d'administration (cookie, `requireSession`, `sameOriginWrites`) |
| Tests dans `server/*.test.ts` | `backend/src/meteo/*.test.ts` (projet Vitest `back`, `vitest.config.ts` ligne 14) |
| Contrôle du build | `scripts/check-api-esm.mjs` doit charger la route compilée (section 7.2) |
| Pi / Coolify | Pas d'API sur le Pi : nginx répond 404 JSON sur `/api/` (`deploy/nginx.conf` lignes 57 à 61) ; la carte du Pi reste sans météo, c'est voulu |

---

## 3. Décisions : recommandations chiffrées

| # | Question | Recommandation | Chiffres |
|---|---|---|---|
| D1 | Quel lot ? | **Côté back : engager US003 tout de suite** (aucun risque de fluidité, débloque la météo réelle), puis US012. Le choix Démo / MVP / Complet reste dicté par la mesure sur téléphone (US001, front) | Back : 1,5 à 2 j (US003) + 1 à 1,25 j (US012) = **2,5 à 3,25 j** ; MVP de la spec ≈ 12 j, + US012 ≈ 13 à 13,5 j (front non réestimé ici) |
| D2 | Non commercial ? | **Oui, à reconfirmer** : Open-Meteo gratuit et Vercel Hobby l'exigent tous les deux | Sinon : Open-Meteo payant ≈ 29 €/mois [non vérifié] + Vercel Pro 20 $/mois par membre ; ou MET Norway (gratuit, commercial permis, `User-Agent` obligatoire) : +0,5 j |
| D3 | Source | **Open-Meteo seul, modèle ICON (`icon_seamless`)** ; pas de secours au départ | AROME : 0 h de brouillard et d'orage sur 1 434 h. Secours MET Norway : +0,5 j, à décider si l'écran admin montre des 429 répétés |
| D4 | Direct ou prévisions ? | **v1 : Direct seulement** ; hors Direct la météo passe en « simulée ». Prévisions : US013 plus tard | US013 : +0,5 j back (+ front à chiffrer), +720 appels amont/mois (1 par heure) |
| D5 | Décorative ou aussi dans les fiches / le jeu ? | **Décorative + puce** (condition, température, âge du relevé, Direct / Forcée) | 0 j back (le contrat porte déjà condition et température) ; fiches ou jeu : textes à écrire et relire, +0,5 à 1 j front |
| D6 | Forçage pour les démos | **Les deux** : `?weather=` (carte, US002) pour régler le rendu ; **forçage et coupure depuis l'admin** (US012) pour que tous les amis voient la même météo | US012 : 1 à 1,25 j ; 0 migration ; Neon : ≈ 0 à 10 CU-h/mois selon l'usage, 30 au pire (section 6.3) |
| D7 (nouvelle) | Seuils de rendu réglables dans l'admin ? | **Non** : constantes nommées dans `backend/src/meteo/normalize.ts`, calibrées avec Dasco en `?debug` | Sinon +1 j (stockage, formulaire, invalidation) et des états incohérents possibles |
| D8 (nouvelle) | Où ranger le forçage ? | **`app_meta`** (clé `meteo.forcage`, valeur JSON validée par le contrat) | Table dédiée : +0,25 j et une migration qui se heurte aux `0002` / `0003` d'EP008 |
| D9 (nouvelle) | Libellé de la condition | **Valeurs continues** pour la présence de pluie, neige, brouillard ; **code de la source** pour bruine ou pluie et pour le ciel par temps sec | Sur 1 531 h d'ICON : libellé identique à celui de la source 1 506 h (98 %) au lieu de 1 250 h (82 %) avec la seule couverture nuageuse [prototype] |

---

## 4. Contrat `contrat/meteo.ts`

### 4.1 Code proposé [prototype : `tsc -p contrat` OK, tests du contrat OK]
```ts
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
  fog: { cloudCover: 1, rainIntensity: 0, snowIntensity: 0, fog: 0.8, thunder: false },
  drizzle: { cloudCover: 1, rainIntensity: 0.15, snowIntensity: 0, fog: 0, thunder: false },
  rain: { cloudCover: 1, rainIntensity: 0.5, snowIntensity: 0, fog: 0, thunder: false },
  snow: { cloudCover: 1, rainIntensity: 0, snowIntensity: 0.6, fog: 0, thunder: false },
  sleet: { cloudCover: 1, rainIntensity: 0.3, snowIntensity: 0.3, fog: 0, thunder: false },
  thunder: { cloudCover: 1, rainIntensity: 0.85, snowIntensity: 0, fog: 0, thunder: true },
};

const unit = z.number().check(z.gte(0), z.lte(1));
const isoDate = z.iso.datetime({ offset: true });

/** Crédit à afficher à côté de la météo (CC BY 4.0 : crédit, lien vers la licence, modifications signalées) */
export const weatherAttribution = z.object({ text: z.string(), url: z.string(), licence: z.string(), licenceUrl: z.string() });
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
  /** Orage déduit du code WMO (95 à 99), pas mesuré */
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
    startedAt: isoDate, upstreamCalls: z.number(), upstreamFailures: z.number(),
    lastError: z.nullable(z.string()), lastErrorAt: z.nullable(isoDate),
  }),
  config: z.object({ lat: z.number(), lon: z.number(), model: z.string(), freshS: z.number(), cdnMaxAgeS: z.number() }),
});
export type AdminWeatherResponse = z.infer<typeof adminWeatherResponse>;
```

### 4.2 Choix, et écarts avec le format du plan front v1
- **Noms du contrat « JSON v1 » du 08/10 gardés** (`condition`, `temperatureC`, `cloudCover`, `precipMmH`, `rainIntensity`,
  `snowIntensity`, `windKmh`, `windGustKmh`, `windFromDeg`, `visibilityM`, `fog`, `thunder`, `observedAt`, `stale`,
  `forced`), comme l'avait arbitré la spec. Le plan front v1 (§ 6 : `code`, `windSpeed` en m/s, `hourly`…) est dépassé.
- **Retirés** : `ageSec` (faux dès que le CDN sert la réponse 60 s plus tard : la carte calcule l'âge avec `observedAt`) ;
  `isDay` (la carte calcule déjà le soleil, `frontend/carte/src/time/sun.ts` : une seule source de vérité).
- **Ajoutés** : `source` (`admin` si forcée), `forcedUntil`, `attribution` en objet (lien et licence, `null` si forcée),
  `temperatureC` nullable (une météo forcée n'invente pas de température).
- **`observedAt` reste le nom, mais c'est l'heure de validité du modèle**, pas une observation : la puce de la carte doit dire
  « modèle ICON, 10 h 00 » ou « il y a 5 min », jamais « observé » (règle 1).
- `v: z.literal(1)` : ne changer `v` que pour un changement incompatible ; ajouter un champ ne casse rien (objets ouverts).
  Une carte ancienne (gardée par le service worker) qui reçoit une réponse qu'elle ne comprend pas reste au ciel par défaut.
- **Valeurs types et libellés dans le contrat** : `?weather=snow` (carte) et le forçage « neige » (admin) donnent exactement
  le même rendu. C'est de la donnée, pas de la logique : le contrat reste « zod seulement » (`scripts/check-boundaries.mjs`
  ligne 58).
- Poids : contrat météo + contrat parkings, minifiés pour le navigateur : 43,6 Ko (10,8 Ko gzip) contre 38,2 Ko (9,5 Ko
  gzip) sans la météo : **+1,3 Ko gzip** [prototype, mesuré avec Vite en mode bibliothèque].

### 4.3 Erreurs (`contrat/erreurs.ts`, lignes 10 à 14)
Ajouter **sur une ligne à part** (moins de conflits avec EP008, qui ajoute aussi des codes) :
```ts
  'meteo-indisponible', 'meteo-desactivee', // EP009
```
`meteo-indisponible` : pas de relevé de moins de 3 h ; `meteo-desactivee` : coupée depuis l'administration. Côté admin,
`frontend/admin/src/api.ts` (`errorMessage`, lignes 28 à 44) n'en a pas besoin : `GET /api/admin/weather` répond 200 avec
`publicCode`. Ajouter les noms de champs du formulaire à `FIELD` (lignes 47 à 49) : `mode`, `condition`, `intensity`
(intensité), `minutes` (durée), `windKmh` (vent), `windFromDeg` (direction du vent).

### 4.4 Si D4 = prévisions (US013, facultative)
```ts
export const weatherHour = z.object({ at: isoDate, condition: weatherCondition, temperatureC: z.number(), cloudCover: unit,
  precipMmH: z.number(), rainIntensity: unit, snowIntensity: unit, windKmh: z.number(), windFromDeg: z.number(), fog: unit, thunder: z.boolean() });
/** GET /api/weather/forecast : 24 h passées et 24 h à venir, même normalisation (interval = 3600) */
export const weatherForecast = z.object({ v: z.literal(1), model: z.string(), fetchedAt: isoDate, stale: z.boolean(),
  hours: z.array(weatherHour), attribution: weatherAttribution });
```
Amont : `hourly=` les mêmes 10 variables, `past_hours=24&forecast_hours=24` (poids 1 appel), relu au plus toutes les
60 min (les modèles changent toutes les 1 à 3 h), `s-maxage=600`.

---

## 5. Route `GET /api/weather`

### 5.1 Fichiers
| Fichier | Rôle |
|---|---|
| `contrat/meteo.ts` (nouveau) | Formats (section 4) |
| `contrat/erreurs.ts` | +1 ligne (4.3) |
| `backend/src/meteo/open-meteo.ts` (nouveau) | Point fixe, modèle, URL, schéma Zod de la réponse amont, appel avec délai, erreurs typées |
| `backend/src/meteo/normalize.ts` (nouveau) | Relevé brut → réponse du contrat ; seuils nommés ; météo forcée à partir de `WEATHER_PRESETS` |
| `backend/src/meteo/service.ts` (nouveau) | Cache mémoire, requête unique, repli, cache négatif, lecture bornée du forçage, compteurs |
| `backend/src/meteo/routes.ts` (nouveau) | Routes Hono publique et admin |
| `backend/src/meteo/override-store.ts` (nouveau, US012) | Forçage dans `app_meta` + journal |
| `backend/src/meteo/meteo.test.ts` (nouveau) | Tests (section 7.1) ; un sous-dossier : moins de conflits avec les fichiers à plat d'EP008 |
| `backend/src/app.ts` | 7 lignes (5.6) |
| `scripts/check-api-esm.mjs` | 1 bloc (7.2) |
| `contrat/contrat.test.ts` | Tests du contrat météo |
| `README.md` | Licences (ligne 619 et suivantes), API (ligne 525 et suivantes), structure du code (ligne 480 environ) |
| `vercel.json`, `tsconfig.json`, `vitest.config.ts`, `check-boundaries.mjs`, `package.json` | **Rien** : aucune dépendance ni variable d'environnement nouvelles, aucune clé |

### 5.2 Client Open-Meteo (`backend/src/meteo/open-meteo.ts`) [prototype]
- `WEATHER_POINT = { lat: 45.5658, lon: 5.9205 }` avec sa source en commentaire (section 1.2) ; `WEATHER_MODEL = 'icon_seamless'`.
- Variables (10, donc 1 appel) : `temperature_2m, weather_code, cloud_cover, precipitation, snowfall, wind_speed_10m,
  wind_direction_10m, wind_gusts_10m, visibility, lightning_potential` ; `timeformat=unixtime`, `timezone=GMT`.
- `fetch(url, { signal: AbortSignal.timeout(4000), headers: { 'user-agent': 'chambery-diorama-api' } })`.
- Schéma Zod de la réponse amont : obligatoires `latitude`, `longitude`, `current.time` (entier), `interval` (60 à 3600),
  `temperature_2m` (−40 à 50 °C), `cloud_cover` (0 à 100), `precipitation` (0 à 200), `wind_speed_10m` (0 à 300),
  `wind_direction_10m` (0 à 360) ; facultatifs et nullables : `weather_code` (0 à 99), `snowfall`, `wind_gusts_10m`,
  `visibility`, `lightning_potential`, `elevation`. Un champ manquant ou aberrant fait rejeter tout le relevé.
- Pas de 15 min trop vieux (> 2 h) ou dans le futur (> 15 min) : rejeté (`perime`).
- Erreurs typées, sans donnée du visiteur : `reseau`, `delai`, `http-NNN`, `format`, `perime`.
- **Aucun paramètre de la requête publique n'est transmis** : `/api/weather?latitude=48.85` appelle quand même Chambéry (testé).

### 5.3 Normalisation (`backend/src/meteo/normalize.ts`) [prototype]
Toutes les valeurs ci-dessous sont des **choix de rendu à calibrer avec Dasco**, pas des faits météo.

| Sortie | Règle |
|---|---|
| `precipMmH` | `precipitation × 3600 / interval` |
| neige (équivalent en eau) | `snowfall (cm) × 10 / 7 × 3600 / interval` ; part de neige `share = neige / précipitations` |
| `snowIntensity` / `rainIntensity` | Neige seulement si `temperature_2m ≤ 2 °C` (règle 5) ; échelle logarithmique `ln(1 + mm/h) / ln(1 + plein)`, plein = 8 mm/h (pluie), 3 mm/h d'eau (neige) ; 0 sous 0,1 mm/h |
| `fog` | Visibilité : `ln(5000 / v) / ln(5000 / 200)` bornée à 0..1 (1 km → 0,5, la définition du brouillard) ; sans visibilité : 0,7 si code 45 ou 48, sinon 0 |
| `thunder` | Code 95 à 99 seulement ; le potentiel d'éclair reste dans le relevé brut (admin) : pas d'éclair « en temps réel » |
| `condition` | Orage › neige (froid, part ≥ 0,7) › pluie et neige (froid, part > 0,3) › bruine ou pluie (code de la source ; sans code : < 0,5 mm/h = bruine) › brouillard (`fog ≥ 0,5`) › ciel par le code 0 à 3 (sans code : nuages < 25 % dégagé, < 75 % éclaircies, sinon couvert) |
| `cloudCover` | `cloud_cover / 100` |
| `windKmh`, `windGustKmh`, `windFromDeg` | Tels quels (km/h, degrés d'où vient le vent) |
| `observedAt` | `current.time` (pas de 15 min de la source) en ISO |

Essai sur la réponse réelle d'ICON du 09/10 10 h 00 [prototype] : `condition: 'partly'`, `temperatureC: 12.8`,
`cloudCover: 0.71`, `precipMmH: 0`, `windKmh: 14.1`, `windGustKmh: 29.9`, `windFromDeg: 257`, `visibilityM: 33040`, `fog: 0`,
`thunder: false`, conforme au contrat.

### 5.4 Cache, requête unique, repli (`backend/src/meteo/service.ts`) [prototype]
Un service par instance de fonction, créé par `createApp` (donc une fois par chargement de `api/index.ts`, ligne 9) ; rien
n'est appelé au chargement du module.

| Constante | Valeur | Rôle |
|---|---|---|
| `FRESH_MS` | 10 min | Relevé réutilisé (la source avance par pas de 15 min) |
| `RETRY_MS` | 60 s | Après un échec, pas de nouvel appel amont (cache négatif : on ne martèle pas la source) |
| `WEATHER_MAX_AGE_S` (contrat) | 3 h | Au-delà (mesuré depuis le pas de la source), 503 `meteo-indisponible` |
| `UPSTREAM_TIMEOUT_MS` | 4 s | Délai de l'appel amont (mesuré : 0,6 à 1,9 s) |
| `OVERRIDE_IDLE_MS` / `OVERRIDE_ACTIVE_MS` | 30 min / 2 min | Relecture du forçage en base sans forçage connu / pendant un forçage (US012) |
| `OVERRIDE_READ_TIMEOUT_MS` | 1,5 s | Attente maximale de la base ; au-delà, état connu et nouvel essai dans 60 s |
| `CDN_MAX_AGE_S` | 60 s | `s-maxage` |

```ts
async function ensureFresh() {                 // relit la source si le relevé a plus de 10 min
  const t = now();
  if (last && t - last.fetchedAtMs < FRESH_MS) return;
  if (t - lastFailureAt < RETRY_MS) return;    // échec il y a moins de 60 s
  inflight ??= refresh().finally(() => { inflight = null; }); // une seule requête amont en vol par instance
  await inflight;
}
async function current(): Promise<WeatherResult> {
  const o = await currentOverride();           // US012 ; sans base : null
  if (o?.mode === 'coupee') return { ok: false, code: 'meteo-desactivee' };
  if (o?.mode === 'forcee' && o.condition) return { ok: true, body: forcedResponse({ ...o, condition: o.condition }) };
  await ensureFresh();
  if (!last || now() / 1000 - last.upstream.current.time > WEATHER_MAX_AGE_S) return { ok: false, code: 'meteo-indisponible' };
  return { ok: true, body: { ...normalize(last.upstream, last.fetchedAtMs), stale: now() - last.fetchedAtMs >= FRESH_MS } };
}
```
Échelle de repli : relevé frais (< 10 min) → source relue → si elle échoue, dernier bon relevé `stale: true` tant que son pas a
moins de 3 h → sinon 503. Une erreur amont est comptée et écrite une fois dans les journaux (`console.warn('[meteo] …')`,
comme `[parkings]`), jamais avec une donnée du visiteur.

Amélioration facultative (non prototypée) : quand la lecture du forçage a dépassé 1,5 s (base qui se réveille), répondre
avec `Cache-Control: no-store` plutôt que de laisser le CDN garder 60 s une réponse qui ignore peut-être un forçage.

### 5.5 En-têtes HTTP et CDN de Vercel
- 200 : `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300` (posé par la route : le middleware
  global n'y touche pas). Le CDN de Vercel garde la réponse 60 s **par région** et la sert encore 5 min pendant qu'il la
  revalide en arrière-plan ; le navigateur ne reçoit que `public, max-age=0` (« the Vercel CDN strips `s-maxage` and
  `stale-while-revalidate` from the response before sending it to the browser ») [vérifié dans la doc, à constater sur
  la prévisualisation].
- 503 : pas d'en-tête posé par la route, donc `no-store` (middleware, ligne 67) ; de toute façon Vercel ne met en cache que
  les statuts 200, 404, 410, 301, 302, 307, 308 [vérifié dans la doc].
- **Pas de `stale-if-error`** : le CDN servirait l'ancienne météo à la place d'un 503 voulu (météo coupée).
- Conditions du CDN respectées : `GET`, pas d'`Authorization`, pas de `Set-Cookie` (le cookie admin est limité à
  `/api/admin`), pas de `Vary: Cookie` [vérifié dans la doc ; `Set-Cookie` absent : testé].
- Purge du CDN par étiquette (`Vercel-Cache-Tag` + `invalidateByTag` de `@vercel/functions`) : disponible sur tous les
  plans, mais **inutile** avec `s-maxage=60` et ajouterait une dépendance propre à Vercel (ADR-001).
- Une requête avec une chaîne de requête différente (`?x=1`) est une autre entrée du cache : elle coûte une invocation,
  jamais un appel amont (cache mémoire). Même exposition que les autres routes publiques.

### 5.6 `backend/src/app.ts`, ligne par ligne [prototype]
```diff
@@ ligne 17 (imports)
 import { addParking, listEdits, recentLog, removeEdit, saveOverride, type Db } from './parkings.js';
+import { createWeatherService, type WeatherDeps } from './meteo/service.js';
+import { weatherAdminRoutes, weatherRoutes } from './meteo/routes.js';
+import { overrideStore } from './meteo/override-store.js';            // US012
@@ lignes 54 à 59 (AppDeps)
   now?: () => number;
+  /** Météo (EP009) : accès à la source (tests : source simulée, sans réseau) */
+  weather?: Pick<WeatherDeps, 'fetch'>;
 }
@@ ligne 63 (après getDb)
   const getDb = deps.db ?? (() => { … });
+  const weatherStore = () => { const db = getDb(); return db ? overrideStore(db) : null; };   // US012
+  const weather = createWeatherService({ fetch: deps.weather?.fetch, now: deps.now, overrides: weatherStore });
@@ après la ligne 82 (fin de GET /parkings/edits)
+  // Météo de Chambéry (EP009) : mise en cache par Vercel 60 s ; la source n'est jamais appelée plus d'une fois en 10 min
+  app.route('/weather', weatherRoutes(weather));
@@ après la ligne 115 (admin.get('/ping'))
+  admin.route('/weather', weatherAdminRoutes(weather, weatherStore)); // EP009-US012 : état, forçage pour les démos
```
- Lignes 65 à 68 (`no-store`) : **inchangées**.
- `now` (ligne 92) est déclaré après les routes publiques : le service reçoit `deps.now` (par défaut `Date.now`).
- Les middlewares du routeur admin (lignes 96 à 98 : administration configurée, même origine, session) s'appliquent au
  sous-routeur `/weather` : vérifié par un test (401 sans session).
- Routes (`backend/src/meteo/routes.ts`) :
```ts
export const PUBLIC_CACHE = `public, max-age=0, s-maxage=${CDN_MAX_AGE_S}, stale-while-revalidate=300`;
export function weatherRoutes(service: WeatherService) {
  const r = new Hono();
  r.get('/', async (c) => {
    const result = await service.current();
    if (!result.ok) return c.json(errorBody(result.code === 'meteo-desactivee' ? 'météo désactivée par l’administration' : 'météo indisponible', result.code), 503);
    c.header('Cache-Control', PUBLIC_CACHE);
    return c.json(result.body satisfies WeatherResponse);
  });
  return r;
}
```

### 5.7 Ce que la carte en fait (pour le plan front)
- Valide avec `weatherResponse.safeParse` (D12) ; refus, 503, 404 (le Pi), délai de 3 s ou hors ligne : **ciel par défaut**.
- Applique aussi `WEATHER_MAX_AGE_S` à `observedAt` (le CDN peut servir une réponse jusqu'à 6 min après sa création).
- Affiche `attribution` (texte + liens) à côté de la puce météo, et le crédit fixe « Météo : Open-Meteo.com (CC BY 4.0) »
  dans les crédits en bas à droite (règle 5) ; « Météo forcée (démo) » quand `forced`, sans température.
- Suggestion pour le front : relire toutes les 15 min **seulement si l'onglet est visible et qu'il y a eu une interaction
  dans les 30 dernières minutes** (un onglet oublié ouvert ne réveille ni la fonction ni la base, section 6.3).

---

## 6. « Géré par le back » : l'administration de la météo

### 6.1 Ce que l'administration doit pouvoir faire
| Fonction | Recommandation | Jours |
|---|---|---|
| Écran « Météo » : ce que voient les visiteurs (condition, température, âge, `stale`, `forced`), relevé brut de la source (point de grille, valeurs d'Open-Meteo), dernière erreur et compteurs **de l'instance** | **Oui** (comprendre un rendu, voir une panne ou des 429) | 0,5 (back 0,15 ; admin 0,35) |
| Forcer une météo pour les démos (condition, intensité, vent, durée 5 min à 6 h, note), vue par **tous** les visiteurs, fin automatique ; « Revenir à la météo réelle » | **Oui** | 0,5 à 0,75 (back 0,35 ; admin 0,25 ; vérification sur la prévisualisation) |
| Couper la météo (même formulaire, mode « coupée ») : la route répond 503 `meteo-desactivee` | **Oui** (coupe-circuit, presque gratuit avec le forçage) | inclus |
| Seuils de rendu réglables | **Non** (D7) | +1 |
| Appels amont « du jour / du mois » exacts | **Non** : il faudrait écrire en base à chaque appel amont (réveils de Neon). Compteurs de l'instance + plafond théorique affiché (≤ 6 appels/h par instance, ≤ 1,5 % du quota mensuel) | — |
| Choisir la source ou le modèle depuis l'admin | **Non** : une constante, changée par un commit | — |

### 6.2 Où ranger le forçage : analyse
Le forçage doit être vu par toutes les instances de la fonction (Vercel en lance plusieurs, et en recrée à froid) et par
tous les visiteurs (derrière un CDN), coûter 0 €, et ne pas ralentir la route publique.

| Option | Pour | Contre | Verdict |
|---|---|---|---|
| Mémoire de l'instance seule | Gratuit, instantané | Perdu au redémarrage ; invisible des autres instances ; le CDN peut garder la réponse d'une instance qui ne sait rien. **Insuffisant sur Vercel** | Non (sert seulement d'accélérateur) |
| `?weather=` dans le lien partagé | 0 back, 0 réseau | Seulement pour qui a le lien ; perdu au rechargement sans le paramètre | Oui pour régler le rendu (US002), pas pour une démo à plusieurs |
| Table dédiée `weather_override` (Neon) | Contraintes SQL (`CHECK`) comme le veut EP008 | Migration `0002` en concurrence avec les `0002` / `0003` d'EP008 (journal Drizzle en conflit) ; +0,25 j | Plus tard si besoin |
| **`app_meta`** (table existante depuis la migration `0000`, clé `meteo.forcage`, valeur JSON) | **Aucune migration**, déjà en production, validée par le contrat à l'écriture et à la lecture | Pas de contrainte SQL sur le JSON (une valeur écrite à la main hors contrat est ignorée : météo réelle) | **Recommandé** |
| Vercel Global Config (ex-Edge Config) | Lu sans réveiller Neon ; 100 000 lectures et 100 écritures par mois sur Hobby [vérifié] | Propre à Vercel (ADR-001) ; écrire demande un jeton d'API Vercel puissant en variable d'environnement | Non |
| Vercel Runtime Cache (`getCache` de `@vercel/functions`) | Partagé entre instances d'une région, tous les plans [vérifié] | Éphémère (peut être évincé), usage facturé, propre à Vercel, nouvelle dépendance | Non |

**Lecture bornée** (recommandée, prototypée) : la route publique relit `app_meta` **au plus toutes les 30 min par
instance** quand aucun forçage n'est connu, toutes les 2 min pendant un forçage (une fin anticipée se voit vite), jamais plus
de 1,5 s d'attente ; l'écriture depuis l'admin met aussi à jour la mémoire de l'instance qui la reçoit. Comme toute l'API est
**une seule fonction** (`api/index.ts`), à faible trafic la même instance sert l'admin et les visiteurs : le forçage est en
pratique visible tout de suite, puis 60 s de cache du CDN. **Garanti** : 30 min au plus pour une autre instance déjà chaude
(une instance qui démarre lit la base tout de suite) [prototype : test « vue par une autre instance »].

### 6.3 Coût en réveils de Neon [estimation, non mesuré]
Neon gratuit : 100 CU-h par projet et par mois, mise en veille après 5 min (non réglable en gratuit), calcul suspendu jusqu'au
mois suivant si le quota est épuisé [vérifié]. Un réveil coûte au moins 5 min × 0,25 CU ≈ 0,021 CU-h (≈ 4 800 réveils isolés
par mois). La route publique est très appelée, mais **le CDN et la mémoire filtrent** : la base n'est lue que lors d'une
invocation (≤ 1 par minute et par région), et seulement si la dernière lecture de l'instance a plus de 30 min.

| Scénario | Lectures de `app_meta` | Coût Neon de la météo |
|---|---|---|
| Sans US012 (pas de forçage) | 0 | **0** |
| 10 visites courtes par jour | ≤ 10/jour, le plus souvent dans le même réveil que `/api/parkings/edits` (même chargement) | ≈ 0 ; borne haute 6 CU-h/mois |
| Un onglet visible 8 h/jour (relecture toutes les 15 min) | 16/jour | ≈ 10 CU-h/mois (10 % du quota) |
| Un onglet visible 24 h/24 | 48/jour | ≈ 30 CU-h/mois (30 %) |
| Une démo forcée de 2 h | toutes les 2 min | ≈ 0,5 CU-h par démo |

Leviers si la mesure inquiète : relecture toutes les 60 min (scénarios 3 et 4 divisés par 2) ; côté carte, arrêt des
relectures après 30 min sans interaction (scénarios 3 et 4 ≈ 0). À mesurer avec le risque R1 d'EP008 (une semaine dans la
console Neon avant la production).

### 6.4 Routes admin (montées sous `admin`, donc session, même origine, JSON)
| Route | Réponse |
|---|---|
| `GET /api/admin/weather` | 200 `adminWeatherResponse` (`no-store` par défaut) |
| `PUT /api/admin/weather/override` | corps `weatherOverrideInput` → 200 `weatherOverride` ; 400 `donnees-invalides` ; 503 `base-indisponible` sans base |
| `DELETE /api/admin/weather/override` | 204 ; 404 `introuvable` s'il n'y avait pas de forçage ; 503 sans base |

`by` = `c.get('session').sub` (`admin` aujourd'hui ; l'identifiant du compte après EP008-US011 / US012).

### 6.5 Écran « Météo » de l'administration (non prototypé)
- `frontend/admin/src/pages/Meteo.tsx` (nouveau) + `Meteo.test.tsx` ; onglet « Météo » (`Layout.tsx`, tableau `PAGES`
  lignes 6 à 9) et route `/meteo` (`App.tsx`, lignes 46 et 47).
- `useQuery(['admin', 'meteo'], () => api('GET', '/api/admin/weather', { schema: adminWeatherResponse }))`, actualisation
  toutes les 60 s quand la page est ouverte.
- Cartes : « Ce que voient les visiteurs » (libellé `WEATHER_CONDITION_FR`, température, âge calculé avec `observedAt`,
  pastilles Direct / Ancien relevé / Forcée / Coupée / Indisponible) ; « Relevé brut » (point de grille, valeurs et unités
  d'Open-Meteo, `fetchedAt`) ; « Cette instance de l'API » (démarrée à…, appels amont, échecs, dernière erreur, avec la
  mention « compteurs depuis le démarrage de cette instance, ce ne sont pas des totaux ») ; « Forcer la météo ».
- Formulaire (React Hook Form, validé par `weatherOverrideInput`) : Forcer / Couper ; condition (9 libellés) ; intensité
  (curseur 0 à 1, facultatif) ; vent (km/h, direction, facultatifs) ; durée (15 min, 30 min, 1 h, 2 h, 4 h, 6 h ; 1 h par
  défaut) ; note. Avertissement : « Visible par tous les visiteurs d'ici 1 à 2 minutes ; retour automatique à la fin. »
  Bouton « Revenir à la météo réelle ».
- Pendant un forçage, l'écran gagne à montrer aussi le relevé réel : le service doit alors relire la source pour la vue admin
  (le prototype ne le fait pas : `current()` s'arrête au forçage).
- Aucun HTML construit à partir de données (règle `noRawHtml` de `check-boundaries.mjs`).

### 6.6 Journal
- **Aujourd'hui** : une ligne dans `edit_log` (`target: 'meteo'`, actions `meteo-forcee`, `meteo-coupee`, `meteo-reelle`,
  `data` = le forçage, `source` = la note) [prototype]. **Problème constaté au test** : la page Parkings affiche tout
  `edit_log` (`recentLog`, `backend/src/parkings.ts` lignes 62 à 64) : y exclure `target = 'meteo'` (1 ligne) ; l'écran
  Météo peut lister ses 10 dernières lignes.
- **Après EP008-US013** : `audit_log` avec `table_name: 'app_meta'`, `row_id: 'meteo.forcage'`, action `update` ou
  `delete`, `before` / `after`, `actor_id` (le compte) ; pas de source (ce n'est pas un contenu éditorial).

---

## 7. Tests et contrôles du build

### 7.1 Vitest, sans réseau [prototype : 19 tests, tous verts]
`backend/src/meteo/meteo.test.ts` (source simulée par une fausse fonction `fetch` qui compte les appels ; horloge réglable
par `deps.now`, comme `session.test.ts` ; base PGlite migrée, comme `parkings.test.ts`) :
1. **Correspondance WMO** : les 28 codes documentés ont un libellé ; 53 → bruine, 61 → pluie, 96 → orage ; code inconnu → aucun.
2. **mm/h** : 0,5 mm en 15 min (code 61) → 2 mm/h, `rain` ; 0,05 mm (code 53) → bruine ; 0,04 mm/h → rien de visible.
3. **Neige et température** : neige à 0 °C → `snow` ; la même à 4 °C → `snowIntensity: 0`, pluie ; mélange → `sleet`.
4. **Brouillard** : 200 m → 1 ; 1 km → 0,5 ; 5 km → 0 ; 300 m → `fog` ; visibilité `null` + code 45 → 0,7.
5. **Orage** : seulement les codes 95 à 99 (potentiel d'éclair seul : pas d'orage).
6. **Contrat** : la réponse normalisée passe `weatherResponse` ; `observedAt` = pas de la source.
7. **Client** : coordonnées fixes, modèle, ≤ 10 variables ; refus d'une température à 80 °C, d'un champ manquant, d'une
   réponse qui n'est pas du JSON, d'un 429, d'un pas de plus de 2 h, d'un délai dépassé, d'une erreur réseau.
8. **Route** : 200, en-tête de cache exact, pas de `Set-Cookie`, paramètres de requête ignorés.
9. **Cache et requête unique** : 50 requêtes simultanées puis 50 en 10 min → **1 appel amont** ; à 10 min → 2e appel.
10. **Panne** : relevé `stale` ; pas de nouvel appel dans les 60 s ; au-delà de 3 h, 503 `meteo-indisponible` avec `no-store`.
11. **Jamais de relevé** : 503 tout de suite.
12. **Admin** : 401 sans session ; 400 sans condition, durée hors 5 à 360 min, condition inconnue.
13. **Forçage** : vu tout de suite (sans appel amont), **vu par une autre instance** qui partage la base, journalisé, fin
    automatique après la durée.
14. **Coupure** : 503 `meteo-desactivee` ; `DELETE` → 204 puis météo réelle ; second `DELETE` → 404.
15. **Écran admin** : conforme à `adminWeatherResponse`, `no-store`, point de grille et compteur d'appels.
16. **Valeur illisible en base** (écrite à la main) : ignorée, météo réelle.

`contrat/contrat.test.ts` : la réponse tolère un champ en plus ; refuse une intensité > 1, une condition inconnue, une date
illisible, `v: 2` ; le forçage exige une condition pour `forcee`, refuse 2 min et un champ inconnu (`lat`).
`frontend/admin/src/pages/Meteo.test.tsx` (à écrire, US012) : affichage des états, corps du `PUT` conforme au contrat,
`DELETE`, message « forcée ».

### 7.2 `scripts/check-api-esm.mjs` [prototype]
Vercel injecte les variables d'environnement pendant le build : l'application réelle (`mod.default`, ligne 25) appellerait
Open-Meteo et lirait la base de production. On vérifie donc la route compilée **avec une source simulée et sans base**, après
la ligne 46 :
```js
  // Météo (EP009) : la route se charge et respecte le contrat, avec une source SIMULÉE et sans base (pendant le build, Vercel
  // injecte les variables d'environnement : l'application réelle `mod.default` appellerait Open-Meteo et lirait la base)
  const { weatherResponse } = await import(pathToFileURL(join(out, 'contrat/meteo.js')).href);
  const step = Math.floor(Date.now() / 900_000) * 900;
  const fakeSource = async () => Response.json({ latitude: 45.56, longitude: 5.92, elevation: 286, current: { time: step, interval: 900, temperature_2m: 12, weather_code: 3, cloud_cover: 90, precipitation: 0, snowfall: 0, wind_speed_10m: 10, wind_direction_10m: 270, wind_gusts_10m: 20, visibility: 20000, lightning_potential: 0 } });
  const meteo = await createApp({}, { weather: { fetch: fakeSource } }).fetch(new Request('http://localhost/api/weather'));
  const meteoBody = await meteo.json();
  if (meteo.status !== 200 || !weatherResponse.safeParse(meteoBody).success || !/s-maxage=/.test(meteo.headers.get('cache-control') ?? '')) {
    throw new Error(`/api/weather : ${meteo.status} ${meteo.headers.get('cache-control')} ${JSON.stringify(meteoBody)}`);
  }
```
et compléter le message de la ligne 47 (« ; /api/weather conforme (source simulée) »). Vérifié : passe sans variable, et
avec `ADMIN_TOKEN` et un `DATABASE_URL` injoignable (comme sur Vercel) sans attendre ni appeler le réseau.

### 7.3 Vérifications sur la prévisualisation (`preview/EP009-meteo`) [à faire]
```bash
B="x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET"; U=https://<prévisualisation>/api/weather
curl -sS -D - -o /dev/null -H "$B" $U | grep -iE 'cache-control|x-vercel-cache|age'   # 1re fois : MISS
sleep 5; curl -sS -D - -o /dev/null -H "$B" $U | grep -iE 'cache-control|x-vercel-cache|age'   # attendu : HIT, cache-control « public, max-age=0 »
curl -sS -H "$B" $U | head -c 600                                                        # le JSON du contrat
```
Puis, avec une base de prévisualisation (`DATABASE_URL_PREVIEW`), forcer la neige depuis l'admin et regarder la route.

---

## 8. Coûts, attributions, RGPD

### 8.1 Coûts (0 €) [quotas vérifiés, volumes estimés]
| Poste | Volume | Gratuit | Part |
|---|---|---|---|
| Appels à Open-Meteo | ≤ 6/h par instance avec du trafic ; 1 instance active 24 h/24 : 4 320/mois ; 2 : 8 640 | 300 000/mois, 10 000/jour (par IP) | ≤ 1,5 % (≤ 3 %) |
| Invocations Vercel (route météo) | ≤ 1/min par région avec du trafic (CDN 60 s) : ≤ 43 200/mois en trafic continu | 1 000 000 | ≤ 4,3 % |
| Requêtes CDN | 1 au chargement + 1 par 15 min et par onglet visible | 1 000 000 | négligeable |
| CPU actif | quelques ms par invocation [non mesuré] ; l'attente réseau ne compte pas | 4 h | ≈ quelques % |
| Neon (US012 seulement) | section 6.3 | 100 CU-h | 0 à 10 %, 30 % au pire |
| Payant si commercial | Open-Meteo ≈ 29 €/mois [non vérifié] + Vercel Pro 20 $/mois par membre | | |
Sans le CDN (si `s-maxage` ne marchait pas sur la fonction) : une invocation par lecture de la météo, soit quelques milliers
par mois pour 100 amis : toujours très loin du million.

### 8.2 Attributions (règle 5)
- **README, section Licences** (ligne 619 et suivantes) : « Météo : Open-Meteo.com (https://open-meteo.com), **CC BY 4.0** ;
  modèle ICON du Deutscher Wetterdienst (CC BY 4.0 d'après Open-Meteo) ; données adaptées pour le diorama (intensités,
  libellés) ». Ajouter la route dans la section API (ligne 525 et suivantes) et `contrat/meteo.ts`, `backend/src/meteo/` dans
  la structure du code.
- **Dans la carte** (front) : le champ `attribution` à côté de la puce météo (Open-Meteo demande le lien « à côté de
  l'endroit où les données sont affichées ») et un crédit fixe en bas à droite avec les autres.
- Texte proposé (`ATTRIBUTION` dans `normalize.ts`) : « Météo : Open-Meteo.com, modèle ICON du DWD (données adaptées pour
  le diorama) », lien `https://open-meteo.com/`, licence `https://creativecommons.org/licenses/by/4.0/`.

### 8.3 RGPD
- Aucune donnée du visiteur ne part chez Open-Meteo : coordonnées fixes, appel fait par le serveur (son IP, pas celle du
  visiteur), aucun paramètre transmis. Jamais de géolocalisation.
- La route publique ne pose aucun cookie et n'écrit rien. Les journaux de Vercel gardent déjà les IP (comme aujourd'hui).
- Forçage : enregistre l'auteur (`by`) et une note libre : y mettre un motif, pas de donnée personnelle (à dire dans
  l'écran). Le journal des forçages entre dans l'inventaire d'EP008-US009 (données personnelles).

---

## 9. Coordination avec EP008 (session parallèle, `docs/EP008-v2-admin`)

EP008 v2 (spec validée le 09/10) : comptes admin en base (US011), sessions en base (US012), sources et `audit_log` (US013),
parkings par tables (US014), lieux (US015) ; migrations `0002` (schéma) et `0003` (données) prévues.

| Fichier | EP009 (ce plan) | EP008 v2 | Risque | Parade |
|---|---|---|---|---|
| `backend/src/app.ts` | +7 lignes, aux endroits de la section 5.6 | connexion (99 à 109), session (96 à 98, 114), routes parkings (130 à 162) réécrites ; nouvelles routes | conflits de lignes voisines | lignes d'ancrage stables (`/parkings/edits` publique, `ping`) ; le second à fusionner replace 2 lignes |
| `backend/src/session.ts`, `contrat/session.ts` | rien ; utilise `SessionVariables` et `c.get('session').sub` | session en base, `SessionInfo` enrichie | type de session | après EP008 : `by` = identifiant du compte |
| `contrat/erreurs.ts` | +1 ligne commentée `// EP009` | nouveaux codes (version, précondition…) | conflit trivial | une ligne par chantier |
| Migrations Drizzle, `db/schema.ts` | **rien** (`app_meta` existe depuis `0000`) | `0002`, `0003` (+ `0004`) | aucun | ne pas créer de table météo ; **EP008 garde `app_meta`** |
| `edit_log` → `audit_log` | lignes `target = 'meteo'` si US012 passe avant EP008-US013 | recopie `edit_log` dans `audit_log` (US013) avec un `CHECK` sur l'action | lignes météo refusées par le `CHECK` | prévenir EP008 : `meteo-*` → `table_name 'app_meta'`, `row_id 'meteo.forcage'`, action `update` / `delete` |
| `backend/src/parkings.ts` | type `Db` importé ; +1 ligne dans `recentLog` | réécrit (US014) | import cassé | qu'EP008 garde un export `Db` (ou le déplace dans `db/client.ts` : 1 import à changer) |
| `scripts/check-api-esm.mjs` | +1 bloc après la ligne 46 | lignes 39 à 46 (connexion par mot de passe) | conflit voisin | bloc météo autonome, avant le message final |
| `frontend/admin/src/App.tsx`, `Layout.tsx`, `api.ts` | +1 route, +1 onglet, +6 noms de champs | nouvelles pages, connexion refaite | conflits de listes | triviaux |
| `README.md`, documents de suivi | Licences, API | administration | conflits habituels en tête des fichiers de suivi | fusionner à la main |

**Ordre conseillé** : EP009-US003 peut passer **avant** EP008 (indépendante, petit diff dans `app.ts`). Pour EP009-US012 :
si EP008-US011 à US013 sont en cours, la faire **après EP008-US013** (journal avec auteur, `audit_log`) ; sinon la faire
avec `edit_log` et ajouter la correspondance ci-dessus au plan d'EP008. Les deux epics partent de `main` ; la seconde à
fusionner se rebase. Rien ne va dans `main` sans l'accord de Dasco (fusion = production).

---

## 10. Découpage en user stories (back, contrat, admin)

Numérotation : on garde US001 à US011 de la spec ; **US003 est réécrite**, **US012 et US013 sont nouvelles**. US011 perd
« le suivi dans l'admin » (passé dans US012) ; US002 et US004 utilisent le contrat (valeurs types, libellés, `attribution`,
`WEATHER_MAX_AGE_S`).

| ID | User story | Domaine | Jours | Dépend de | Parallèle au front ? |
|---|---|---|---|---|---|
| US003 | Contrat météo et route `/api/weather` (ICON, cache, repli, tests, contrôle du build) | Contrat, API | 1,5 à 2 | — | **Oui** : avec US001, US002, US006 |
| US012 | Météo dans l'administration : écran, forçage pour les démos, coupure | API, admin | 1 à 1,25 | US003 ; de préférence EP008-US013 | **Oui** : avec US005 et la suite |
| US013 (facultative, D4) | Prévisions heure par heure `/api/weather/forecast` | Contrat, API | 0,5 (+ front) | US003 | Oui |

**Premier commit d'US003 : le contrat seul** (`contrat/meteo.ts`, codes d'erreur, tests du contrat, 0,25 j), fusionné tout
de suite dans `feat/EP009-meteo` : le front code `?weather=` (US002) avec `WEATHER_PRESETS`, `WEATHER_CONDITION_FR` et le
type `WeatherResponse` sans attendre la route. US004 (côté site) a besoin d'US003 fusionnée (ou de `npm run api:dev`, qui
appelle la vraie source en local).

### US003 — Contrat météo et route `/api/weather`
**En tant que** visiteur, **je veux** que le diorama reçoive la météo de Chambéry par le back, **afin que** la source soit
appelée une fois pour tous, sans clé, sans ma position, et que la carte marche quand elle tombe.

- [ ] **Given** la source disponible, **When** `GET /api/weather`, **Then** 200 conforme à `weatherResponse`,
  `source: 'open-meteo'`, `model: 'icon_seamless'`, `observedAt` = pas de 15 min de la source,
  `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`, aucun `Set-Cookie`.
- [ ] **Given** 100 requêtes en 10 min sur une instance, dont 50 simultanées, **Then** un seul appel à Open-Meteo.
- [ ] **Given** `?latitude=48.85&longitude=2.35`, **Then** l'appel amont garde 45,5658 ; 5,9205.
- [ ] **Given** la source en panne (réseau, 4 s, HTTP 4xx ou 5xx, réponse hors schéma ou aberrante, pas de plus de 2 h),
  **Then** dernier bon relevé avec `stale: true` tant que son pas a moins de 3 h, sans nouvel appel amont avant 60 s ;
  ensuite, ou sans relevé, 503 `meteo-indisponible` avec `no-store`.
- [ ] **Given** 0,5 mm en 15 min et le code 61, **Then** `precipMmH: 2`, `condition: 'rain'` ; **Given** de la neige
  annoncée à 4 °C, **Then** `snowIntensity: 0` et de la pluie ; **Given** 300 m de visibilité, **Then** `condition: 'fog'`.
- [ ] **Given** `npm run build`, **Then** `check-api-esm` charge la route compilée et vérifie le contrat avec une source
  simulée, sans réseau ni base ; `check-boundaries` passe ; `npm test` passe.
- [ ] **Given** la prévisualisation, **When** deux `curl` à quelques secondes, **Then** `x-vercel-cache: MISS` puis `HIT`,
  et le navigateur reçoit `public, max-age=0`.
- [ ] **Given** le README, **Then** la licence (Open-Meteo CC BY 4.0, modèle ICON du DWD) et la route sont documentées.

Risques : quotas par IP partagée (R1) ; CDN non constaté (R3) ; seuils (R5). Dasco : trancher D2, D3, D7, D9 ; relire les
libellés français.

### US012 — Météo dans l'administration : écran, forçage, coupure
**En tant que** Dasco, **je veux** voir la météo que reçoivent les visiteurs et pouvoir en forcer une pour une démo (ou la
couper), **afin de** montrer la neige ou l'orage à tous les amis en même temps, et réagir à une panne.

- [ ] **Given** aucune session, **When** `GET /api/admin/weather` ou `PUT /api/admin/weather/override`, **Then** 401.
- [ ] **Given** une session, **When** `GET /api/admin/weather`, **Then** 200 conforme à `adminWeatherResponse` (réponse
  publique, relevé brut et point de grille, forçage, compteurs de l'instance présentés comme tels), `no-store`.
- [ ] **Given** une session, **When** `PUT { mode: 'forcee', condition: 'snow', intensity: 0.9, minutes: 30, note }`,
  **Then** la réponse publique devient `forced: true`, `source: 'admin'`, `condition: 'snow'`, `temperatureC: null`,
  `attribution: null`, tout de suite sur cette instance, au plus 30 min après sur une autre instance chaude, et au plus
  60 s de cache CDN en plus pour les visiteurs.
- [ ] **Given** la durée écoulée, **Then** retour à la météo réelle sans action ni écriture.
- [ ] **Given** `PUT { mode: 'coupee', minutes: 60 }`, **Then** `GET /api/weather` → 503 `meteo-desactivee` (la carte
  garde son ciel par défaut).
- [ ] **Given** `DELETE /api/admin/weather/override`, **Then** 204 et météo réelle ; sans forçage, 404.
- [ ] **Given** une valeur illisible dans `app_meta`, **Then** ignorée (météo réelle) et signalée dans les journaux.
- [ ] **Given** la base indisponible, **Then** `PUT` et `DELETE` → 503 `base-indisponible`, et la route publique continue
  sans forçage après 1,5 s au plus.
- [ ] **Given** chaque changement, **Then** une ligne de journal (section 6.6), absente du journal des parkings.
- [ ] **Given** l'écran « Météo », **Then** état, relevé brut, formulaire validé par le contrat, « Revenir à la météo
  réelle », avertissement « visible par tous d'ici 1 à 2 minutes ».
- [ ] **Given** la prévisualisation avec sa base, **When** Dasco force la neige 15 min, **Then** son téléphone la montre en
  moins de 2 min (avec US004 côté carte).

Risques : réveils de Neon (R4) ; conflits avec EP008 (R7). Dasco : trancher D6 et D8 ; vérifier que la prévisualisation a
`DATABASE_URL_PREVIEW` ; essayer le forçage sur son téléphone.

### US013 — Prévisions heure par heure (facultative, si D4 = oui)
- [ ] **Given** `GET /api/weather/forecast`, **Then** 200 `weatherForecast` : 48 pas horaires (24 h passées, 24 h à venir),
  même normalisation, `s-maxage=600`, source relue au plus toutes les 60 min, même repli.
- [ ] **Given** la carte hors Direct dans cette fenêtre, **Then** elle prend l'heure la plus proche ; hors fenêtre, « simulée ».

### Ce que Dasco devra faire
1. Trancher D1 à D9 (section 3), et **reconfirmer l'usage non commercial**.
2. Rien à configurer : **pas de clé**, pas de variable d'environnement, **pas de migration** (`app_meta` existe déjà).
3. Valider les seuils de rendu et les libellés sur la prévisualisation (avec `?weather=` et le forçage).
4. Vérifier que la prévisualisation a une base (`DATABASE_URL_PREVIEW`) pour essayer US012.
5. Donner son accord pour fusionner dans `main` (production).
6. Après une semaine en production : regarder la consommation de Neon (avec le risque R1 d'EP008).

---

## 11. Risques
| # | Risque | Parade |
|---|---|---|
| R1 | **Quotas d'Open-Meteo par adresse IP** ; les fonctions Vercel sortent par des IP partagées : des 429 dus à d'autres projets sont possibles [non vérifié en pratique] | Repli « stale » 3 h, cache négatif 60 s ; l'écran admin montre `http-429` ; secours MET Norway (+0,5 j) ou clé payante si ça arrive |
| R2 | ICON-D2 en bord de domaine, ou Open-Meteo qui change la composition de ses modèles | `icon_seamless` retombe sur ICON-EU ; visibilité `null` gérée (brouillard par le code) ; modèle dans la réponse et l'admin |
| R3 | Cache du CDN non constaté sur une fonction Hono | Vérification `x-vercel-cache` sur la prévisualisation (7.3) ; sans CDN, les volumes restent faibles (8.1) |
| R4 | Réveils de Neon dus à la lecture du forçage | Bornée (6.3) ; mesure d'une semaine ; leviers : 60 min, arrêt des relectures côté carte après inactivité |
| R5 | Les seuils sont des choix de rendu ; la condition peut contredire l'appli météo du téléphone | Libellé aligné sur le code de la source (D9, 98 % d'accord) ; valeurs brutes dans l'admin ; calibrage avec Dasco |
| R6 | Une prévision présentée comme une observation (règle 1) | `observedAt` documenté comme heure de validité ; la puce dit « modèle », jamais « observé » |
| R7 | Conflits avec EP008 | Section 9 |
| R8 | Service gratuit sans garantie ; conditions qui changent | Relire les conditions avant la production ; la carte marche sans météo |
| R9 | Hiver non testé (neige, brouillard de la cluse) : données d'août à octobre seulement | Revoir les seuils au premier épisode (relevé brut dans l'admin) |
| R10 | Horloge du visiteur fausse (âge du relevé) | Écart de quelques minutes sans effet ; la règle des 3 h est aussi appliquée par le back |

---

## 12. Vérifié / non vérifié

**Vérifié le 09/10/2026**
- Pages officielles d'Open-Meteo (conditions, tarifs, licence, documentation, Météo-France, DWD) : citations de la section 1.1.
- Appels réels : AROME et ICON aux coordonnées demandées et à celles du projet (même maille), 8 modèles comparés, historique
  de 92 jours (1 434 h AROME, 1 531 h ICON), format d'erreur 400, délais de 0,6 à 1,9 s, aucun en-tête de cache amont.
- Documentation Vercel (mise à jour en septembre 2026) : critères du CDN, `s-maxage` retiré pour le navigateur, cache par
  région, purge sur tous les plans, Runtime Cache, quotas Hobby ; tarifs Neon (100 CU-h, veille à 5 min non réglable en gratuit).
- Dans le code : `no-store` déjà non écrasant (`app.ts` ligne 67) ; `app_meta` créée par la migration `0000` ; nginx du Pi
  en 404 sur `/api/` ; service worker sans cache pour `/api/` (`frontend/carte/vite.config.ts` ligne 135, pas de
  `runtimeCaching` pour l'API).
- Prototype dans une copie temporaire : `tsc -p .` et `tsc -p contrat` OK ; 81 tests (back, contrat, outillage) OK dont 19
  nouveaux ; `check-api-esm` OK sans variable et avec `ADMIN_TOKEN` + `DATABASE_URL` injoignable ; `check-boundaries` OK ;
  normalisation essayée sur les réponses réelles ; contrat +1,3 Ko gzip.

**Non vérifié**
- Comportement sur un vrai déploiement Vercel : `HIT` / `MISS`, `stale-while-revalidate`, région des fonctions, démarrages
  à froid, réutilisation des instances.
- Temps de réveil et consommation réelle de Neon (estimations seulement).
- 429 dus aux IP partagées de Vercel.
- Fiabilité de l'orage et du brouillard d'ICON face à des observations ; comportement en hiver.
- Prix payant d'Open-Meteo (pages tierces seulement).
- Couverture d'ICON-D2 : la doc dit Allemagne, Suisse, Autriche, mais les données existent pour Chambéry.
- CPU actif par invocation.
- L'écran « Météo » de l'admin (non prototypé).

---

## 13. Sources (consultées le 09/10/2026)
- Open-Meteo, conditions : https://open-meteo.com/en/terms
- Open-Meteo, tarifs et poids des appels : https://open-meteo.com/en/pricing
- Open-Meteo, licence et attribution : https://open-meteo.com/en/licence
- Open-Meteo, documentation de l'API (`current`, cumuls, codes WMO, erreurs) : https://open-meteo.com/en/docs
- Open-Meteo, modèles Météo-France : https://open-meteo.com/en/docs/meteofrance-api
- Open-Meteo, modèles DWD ICON : https://open-meteo.com/en/docs/dwd-api
- Limites par IP et poids des requêtes (mainteneur) : https://github.com/open-meteo/open-meteo/issues/438
- Prix payant (pages tierces) : https://openmeteo.substack.com/p/api-subscriptions-for-commercial , https://apis.io/plans/open-meteo/open-meteo-plans-pricing/
- Vercel, cache du CDN : https://vercel.com/docs/caching/cdn-cache
- Vercel, purge et étiquettes : https://vercel.com/docs/caching/cdn-cache/purge
- Vercel, Runtime Cache : https://vercel.com/docs/caching/runtime-cache
- Vercel, plan Hobby : https://vercel.com/docs/plans/hobby
- Neon, tarifs : https://neon.com/pricing
- Appels de test d'Open-Meteo pour Chambéry : 09/10/2026, de 10 h 01 à 10 h 10 UTC (section 1.2)

---

## 14. Réponse à Dasco : relevé planifié ou à la demande ?

Question de Dasco (09/10) : « Pourquoi ce n'est pas le back-end qui a un scheduler qui tourne le matin, l'après-midi et le
soir pour connaître la météo, mettra à jour dans le back-end (via enum avec un mapper) et mettra à jour la carte plutôt que
d'avoir un appel pour chaque client qui se connecte ? »

### 14.1 Ce que fait déjà le plan
- **Les visiteurs n'appellent jamais Open-Meteo.** Ils appellent notre route `/api/weather`, exactement comme ils liraient le
  résultat d'un relevé planifié : dans les deux cas, la carte doit lire la météo quelque part (au chargement, puis toutes les
  15 min si l'onglet est visible). Le nombre de requêtes des visiteurs est donc le même dans les deux modèles.
- **Le back appelle Open-Meteo au plus une fois toutes les 10 min par instance**, et seulement si quelqu'un regarde :
  0 appel un jour sans visiteur, 1 appel si 100 amis arrivent en même temps (testé : 50 requêtes simultanées puis 50 en
  10 min → 1 appel). Le CDN de Vercel sert en plus la même réponse pendant 60 s.
- **Ce qui est vrai dans la remarque de Dasco** : à faible trafic (visites espacées de plus de 10 min, instances de fonction
  qui redémarrent), c'est à peu près **un appel à Open-Meteo par visite** (≈ 10 par jour pour 10 visites), et le premier
  visiteur attend la source (0,6 à 1,9 s mesurés). La carte, elle, n'attend pas : la météo arrive en fondu.
- **Pourquoi ce n'est pas un problème** : les appels à Open-Meteo sont la ressource **la plus abondante** du projet
  (10 000 par jour, 300 000 par mois, gratuits) ; le pire cas du plan est 144 par jour et par instance (≤ 1,5 % du quota).
  La ressource rare, c'est le calcul de Neon (100 CU-h par mois), qu'un relevé planifié rangé en base consommerait davantage
  (14.4).

### 14.2 L'enum et le « mapper » : déjà dans le plan
C'est exactement ce que fait le back du plan, à chaque relevé :
- l'énumération `weatherCondition` (9 valeurs : `clear`, `partly`, `cloudy`, `fog`, `drizzle`, `rain`, `snow`, `sleet`,
  `thunder`) dans le contrat partagé `contrat/meteo.ts`, avec ses libellés français (`WEATHER_CONDITION_FR`) ;
- la correspondance des 28 codes WMO d'Open-Meteo vers cette énumération (`conditionFromWmo`, testée code par code) et le
  calcul des intensités 0..1 à partir des valeurs continues (`normalize`), dans `backend/src/meteo/normalize.ts` ;
- la carte ne voit **jamais** un code WMO ni la réponse d'Open-Meteo : seulement le format du contrat, qu'elle vérifie.
La seule différence entre les deux idées est donc **le moment** où le back interroge la source : à heures fixes, ou quand
quelqu'un regarde (avec un cache).

### 14.3 Planifier avec nos services gratuits [vérifié le 09/10/2026]
| Moyen | Limites | Fiabilité | Ce qu'il faudrait |
|---|---|---|---|
| **Vercel Cron Jobs (Hobby)** | 100 tâches par projet, mais **chacune une fois par jour au plus** (une expression plus fréquente **fait échouer le déploiement**) ; heure **à ±59 min** (« `0 1 * * *` se déclenche entre 1 h 00 et 1 h 59 ») ; UTC ; appel `GET` sur le déploiement **de production** seulement ([limites](https://vercel.com/docs/cron-jobs/usage-and-pricing), [fonctionnement](https://vercel.com/docs/cron-jobs)) | « best effort » : pas de nouvel essai si l'appel échoue, une exécution peut manquer ou être doublée ([gestion](https://vercel.com/docs/cron-jobs/manage-cron-jobs)) | 3 entrées `crons` dans `vercel.json` (matin, après-midi, soir), une variable `CRON_SECRET` (Vercel l'envoie en `Authorization: Bearer`), une route de rafraîchissement qui la vérifie, du code idempotent |
| (contournement) 24 tâches quotidiennes à des heures différentes | Permis par la lettre de la doc (100 tâches, chacune quotidienne), contraire à son esprit ; heure toujours à ±59 min | [non essayé] | Déconseillé |
| **GitHub Actions planifiée** | Toutes les 5 min au plus ; « can be delayed during periods of high loads… the start of every hour… some queued jobs may be dropped » ; dépôt **public** (`DascoRM/city-chambery`, vérifié) : minutes gratuites, mais tâches planifiées **désactivées après 60 jours sans activité** du dépôt ([doc](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows), [facturation](https://docs.github.com/en/billing/concepts/product-billing/github-actions)) | Retards et oublis possibles, sans garantie | Un fichier `.github/workflows/meteo.yml` qui appelle une route protégée de l'API avec un secret (secret GitHub + même valeur dans Vercel) |
| **Coolify / Pi** | Pas encore déployé ; pas d'API sur le Pi par décision (ADR-002, règle 5) | Dépend de la box et du courant | Un conteneur « cron » qui appelle la route de Vercel |

### 14.4 Où ranger le résultat pour que la carte le lise
| Où | Écritures (3 par jour) | Lecture par la carte | Limites et coût | Verdict |
|---|---|---|---|---|
| Mémoire de la fonction | Une tâche planifiée « réchauffe » l'instance qu'elle touche, pas celle qui servira le visiteur suivant ; elle appelle l'adresse du déploiement (`*.vercel.app`), a priori une autre entrée du cache du CDN [non vérifié] | — | — | Inutile seule |
| Base Neon (`app_meta`) | 3 réveils par jour (≈ 2 CU-h/mois) | Chaque instance qui démarre doit lire la base : **un réveil de Neon par visite isolée** (plus de 1,5 s constaté sur `/api/parkings/edits`, d'où le délai de 4 s de la carte ; ≈ 0,02 CU-h) au lieu d'un appel à Open-Meteo (0,6 à 1,9 s, gratuit) | Échange une ressource abondante contre la ressource rare | Non |
| Global Config (ex-Edge Config) de Vercel | Hobby : **100 écritures par mois** (3 par jour = 90 : juste ; toutes les heures = 720 : impossible) | 100 000 lectures par mois | Propre à Vercel (ADR-001) ; écrire demande un jeton d'API Vercel puissant | Non |
| Vercel Blob (fichier public `meteo.json`) | Hobby : 2 000 écritures par mois (3 par jour : oui ; toutes les 30 min : 1 440, oui ; toutes les 15 min : 2 880, non) ; dépassement = Blob coupé 30 jours ([tarifs](https://vercel.com/docs/vercel-blob/usage-and-pricing)) | La carte lit le fichier directement, sans fonction ni base (10 000 lectures non mises en cache et 10 Go par mois) | Propre à Vercel, jeton `BLOB_READ_WRITE_TOKEN`, autre domaine (CORS à vérifier) ; seul avantage réel : la carte du Pi pourrait l'afficher | Pas maintenant |
| Fichier statique du site | Un redéploiement par relevé (plusieurs minutes, service worker invalidé) | — | — | Non |

### 14.5 Fraîcheur : ce que ça change pour la « météo en direct » [simulé]
Simulation sur les 1 530 h de l'historique horaire d'ICON (7 août → 9 octobre 2026) : on compare ce que la carte
afficherait (le dernier relevé planifié) à la valeur du modèle à l'heure même. C'est l'effet du retard seul, pas la
précision du modèle.

| Relevé | Âge du relevé (moyen / maximum) | Relevé de plus de 3 h | Condition différente | Heures de pluie ratées | Pluie affichée à tort | Heures d'orage ratées |
|---|---|---|---|---|---|---|
| 3 par jour (8 h, 14 h, 20 h) | 4,0 h / 11 h | **50 % du temps** | **39 %** | **54 sur 101 (53 %)** | 31 h | **21 sur 21** |
| 1 par jour (Vercel Hobby, une tâche) | 11,5 h / 23 h | 83 % | 48 % | 58 sur 101 (57 %) | 77 h | 21 sur 21 |
| À la demande (plan) | ≤ 10 min | 0 | ≈ 0 | ≈ 0 | ≈ 0 | ≈ 0 |

- Avec 3 relevés par jour, la règle 1 de l'epic (« un relevé de plus de 3 h n'est jamais montré comme actuel ») ferait
  disparaître la météo **la moitié du temps** ; sans cette règle, la carte montrerait le brouillard de 8 h jusqu'à 14 h sous
  le soleil, raterait une averse sur deux et **aucun orage** (ils durent 1 à 2 h, rarement pile à l'heure du relevé).
- Variante « relever la prévision heure par heure » à heures fixes : avec la prévision **de la veille** (une tâche par
  jour), l'API des anciens calculs d'Open-Meteo donne **36 % des heures de pluie ratées**, 58 h de pluie annoncée à tort,
  **20 heures d'orage ratées sur 21** et 18 h d'orage annoncé à tort (1 464 h comparées). Avec 3 relevés par jour, l'écart
  serait plus faible, mais **non mesuré**.
- Conclusion : la « météo en direct » deviendrait « la météo du matin ». Seuls les états lents (ciel couvert toute la
  journée, neige tenue) resteraient justes.

### 14.6 Coûts comparés (0 € dans tous les cas)
| | À la demande (plan) | Planifié 3 fois par jour + base | Planifié + fichier Blob |
|---|---|---|---|
| Appels à Open-Meteo | ≤ 1 par visite isolée, ≤ 6 par heure et par instance, 0 sans visiteur (≤ 1,5 % du quota) | 3 par jour (+ un appel de secours si la base est vide) | 3 par jour |
| Invocations Vercel | ≤ 1 par visite (CDN 60 s) | Pareil, + 3 par jour | 3 par jour (la carte lit le Blob) |
| Réveils de Neon | 0 (hors forçage US012) | 3 par jour + ≈ 1 par visite isolée | 0 |
| Fraîcheur | ≤ 10 min (+ 1 min de CDN) | 0 à 11 h | 0 à 11 h |
| À construire en plus | rien | route protégée, `CRON_SECRET`, 3 tâches, stockage, repli, tests ; vérification en production seulement (les tâches n'y tournent qu'en production) : ≈ +0,75 à 1 j | pareil + Blob, jeton, lecture côté carte, CORS : ≈ +1 à 1,5 j |

### 14.7 Recommandation
**Garder le relevé à la demande, mis en cache, comme mécanisme principal** : il est plus frais (10 min au lieu de 4 h en
moyenne), plus simple (ni secret, ni tâche planifiée, ni stockage), et ne réveille pas Neon. Ce que la question de Dasco
apporte au plan :
1. **L'enum et le mapper côté back** : déjà là (14.2) ; à écrire noir sur blanc dans la spec EP009 pour que ce soit clair.
2. **« Ne pas faire attendre ni rater le premier visiteur »** : un relevé planifié ne l'empêcherait pas sur Vercel (il
   réchauffe une autre instance). La vraie parade, intégrée au plan : côté carte, **délai de 8 s au lieu de 3 s** pour la
   météo (elle n'empêche rien de s'afficher, attendre ne coûte rien) **et un nouvel essai après 60 s** en cas d'échec, au
   lieu d'attendre la relecture suivante 15 min plus tard. Démarrage à froid + source lente (jusqu'à 1,9 s mesurés) peuvent
   en effet dépasser 3 s. À reporter dans le plan front (US004).
3. **Un relevé planifié a sa place plus tard pour l'historique** (un graphique dans l'admin, « il a plu hier ») : une seule
   tâche Vercel par jour, gratuite, qui range la journée écoulée (Open-Meteo la donne en un appel avec `past_days=1`) ;
   1 réveil de Neon par jour. Pas utile maintenant : Open-Meteo garde déjà 92 jours d'historique consultable.
4. Si un jour l'écran admin montre des pannes fréquentes de la source, garder un « dernier bon relevé » en base, lu par les
   instances qui démarrent, rendrait le repli de 3 h efficace même à froid (aujourd'hui il ne sert qu'à une instance
   chaude). C'est une option, à décider sur mesure.

Sources de cette section, consultées le 09/10/2026 : Vercel Cron Jobs (https://vercel.com/docs/cron-jobs ,
https://vercel.com/docs/cron-jobs/usage-and-pricing , https://vercel.com/docs/cron-jobs/manage-cron-jobs), Vercel Blob
(https://vercel.com/docs/vercel-blob/usage-and-pricing), Vercel Hobby (https://vercel.com/docs/plans/hobby), GitHub Actions
(https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows ,
https://docs.github.com/en/billing/concepts/product-billing/github-actions), Open-Meteo, anciens calculs
(`https://previous-runs-api.open-meteo.com/v1/forecast`, variables `*_previous_day1`, modèle `icon_seamless`, 60 jours).
