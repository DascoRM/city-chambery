# EP009 - US003 - Contrat météo et route `/api/weather`

## User Story

**En tant que** visiteur,
**je veux** que le diorama reçoive la météo de Chambéry par notre back,
**afin que** la source soit appelée une fois pour tous, sans clé ni position du visiteur, et que la carte marche même quand la source tombe.

---

## Critères d'acceptation

**Premier commit : le contrat seul**, fusionné tout de suite dans la branche d'epic (il débloque la carte)
- [ ] **Given** `contrat/meteo.ts`, **Then** il exporte `weatherCondition` (9 valeurs), `WEATHER_CONDITION_FR`, `WEATHER_PRESETS`, `WEATHER_MAX_AGE_S`, `weatherResponse`, `weatherOverrideInput`, `weatherOverride` et `adminWeatherResponse` ; `contrat/erreurs.ts` gagne `meteo-indisponible` et `meteo-desactivee`, sur une ligne à part
- [ ] **Given** les tests du contrat, **Then** la réponse tolère un champ en plus et refuse une intensité supérieure à 1, une condition inconnue, une date illisible, `v: 2` ; le forçage exige une condition pour `forcee`, refuse 2 min et un champ inconnu

**La route**
- [ ] **Given** la source disponible, **When** `GET /api/weather`, **Then** 200 conforme à `weatherResponse`, `source: 'open-meteo'`, `model: 'icon_seamless'`, `observedAt` = pas de 15 min de la source, `Cache-Control: public, max-age=0, s-maxage=60, stale-while-revalidate=300`, aucun `Set-Cookie`
- [ ] **Given** 100 requêtes en 10 min sur une instance, dont 50 simultanées, **Then** un seul appel à Open-Meteo
- [ ] **Given** `?latitude=48.85&longitude=2.35`, **Then** l'appel à la source garde 45,5658 ; 5,9205
- [ ] **Given** la source en panne (réseau, délai de 4 s, HTTP 4xx ou 5xx, réponse hors schéma ou aberrante, pas de plus de 2 h), **Then** dernier bon relevé avec `stale: true` tant que son pas a moins de 3 h, sans nouvel appel à la source avant 60 s ; ensuite, ou sans aucun relevé, 503 `meteo-indisponible` avec `no-store`
- [ ] **Given** 0,5 mm en 15 min et le code 61, **Then** `precipMmH: 2` et `condition: 'rain'` ; **Given** de la neige annoncée à 4 °C, **Then** `snowIntensity: 0` et de la pluie ; **Given** 300 m de visibilité, **Then** `condition: 'fog'`
- [ ] **Given** les 28 codes WMO documentés, **Then** chacun a sa condition (53 → bruine, 61 → pluie, 96 → orage) ; un code inconnu n'en donne aucune
- [ ] **Given** `npm run build`, **Then** `check-api-esm` charge la route compilée et vérifie le contrat avec une source simulée, sans réseau ni base, aussi avec les variables de Vercel ; `check-boundaries` et `npm test` passent
- [ ] **Given** la prévisualisation, **When** deux `curl` à quelques secondes d'écart, **Then** `x-vercel-cache: MISS` puis `HIT`, et le navigateur reçoit `public, max-age=0`
- [ ] **Given** le README, **Then** la licence (Open-Meteo, CC BY 4.0, modèle ICON du DWD) et la route sont documentées

---

## Règles métier
Voir l'[epic](epic.md), règles 1, 3, 4, 5, 6 et 11.

| Règle | Description |
|-------|-------------|
| R1 | 10 variables par requête au plus : Open-Meteo compte alors 1 appel |
| R2 | mm/h = cumul × 3600 / `interval` : Open-Meteo donne des cumuls sur 15 min |
| R3 | Pas de `stale-if-error` : le CDN servirait l'ancienne météo à la place d'un 503 voulu (météo coupée) |
| R4 | Ni dépendance, ni variable d'environnement, ni clé nouvelle ; rien n'est appelé au chargement du module |
| R5 | Une erreur de la source est journalisée une fois (`[meteo] …`), jamais avec une donnée du visiteur |
| R6 | Fichiers dans un sous-dossier `backend/src/meteo/` (moins de conflits avec EP008) ; `backend/src/app.ts` : 7 lignes ; le `no-store` global reste tel quel (il n'écrase déjà plus l'en-tête d'une route) |

---

## API

### Endpoint
```
GET /api/weather
```

### Erreurs
| Code | Corps | Cause |
|------|-------|-------|
| 503 | `{ error, code: 'meteo-indisponible' }` | Aucun relevé de moins de 3 h |
| 503 | `{ error, code: 'meteo-desactivee' }` | Météo coupée depuis l'admin (US012) |

---

## Cas limites

| Cas | Comportement attendu |
|-----|---------------------|
| Instance qui démarre avec une source lente | Le premier visiteur attend la source (0,6 à 1,9 s mesurés) ; la carte attend jusqu'à 8 s (US004) |
| Refus 429 (IP partagée de Vercel) | Repli « stale » ; erreur `http-429` visible dans l'écran admin (US012) |
| Visibilité absente du modèle | Brouillard déduit du code (45 ou 48 → 0,7) |
| Carte du Pi | Pas d'API : nginx répond 404, la carte reste sans météo |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 à 2 (dont contrat 0,25) |
| Complexité | Medium |
| Dépend de | — (socle d'EP010, en production) |

Détail technique : [plan back v2](../../../tasks/ep009-back-plan-v2.md) § 1 (Open-Meteo vérifié, choix du modèle), § 4 (code du contrat), § 5 (client, normalisation, cache, en-têtes, `app.ts` ligne par ligne), § 7 (tests, `check-api-esm`) et § 11 (risques).

---

## Checklist dev
- [ ] Branche `feat/EP009-US003-contrat-et-route` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test`
- [ ] Prévisualisation `preview/EP009-meteo` : JSON du contrat, cache du CDN (`MISS` puis `HIT`)
- [ ] README (API, Licences, structure du code) ; FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco (libellés français, seuils)

---

**Priorité** : High
**Status** : 🔄 In Progress
