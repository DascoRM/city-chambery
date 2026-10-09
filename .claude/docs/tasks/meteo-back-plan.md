# Plan back-end / données : météo en temps réel (étude, rien codé)

Rédigé le 08/10/2026 par un agent chercheur. Question de Dasco : que coûterait une météo réelle sur la carte, rendue en 3D par le front ? Ce document couvre la source de données, l'API, le contrat JSON, les coûts et les risques. Le rendu 3D (pluie, nuages, brouillard) relève du plan front, hors de ce fichier.

Légende : **[vérifié]** = lu sur le site officiel ou testé en direct le 08/10/2026 ; **[non vérifié]** = à confirmer avant de s'engager.

---

## 0. Constats sur l'existant

- Le site est statique ; l'API Hono (`server/app.ts`, `api/[...path].ts`) existe depuis l'US001 d'EP008. Aujourd'hui elle force `Cache-Control: no-store` sur toutes les réponses (middleware global) : une route météo devra **surcharger** cet en-tête, sinon aucun cache CDN n'est possible.
- Le service worker (vite.config.ts, ligne 129) exclut déjà `/api/` du `navigateFallback`. Il n'y a pas de `runtimeCaching` pour l'API : hors-ligne, un `fetch('/api/weather')` échoue simplement. Aucun cache obsolète ne sera servi par erreur.
- Hébergement : Vercel Hobby aujourd'hui (usage **non commercial**, 1 M d'invocations/mois), Coolify sur Pi 5 visé. Contrainte de l'epic : « le site marche sans l'API ». La météo doit suivre la même règle : elle est un **plus**, jamais un prérequis.
- Le ciel actuel suit déjà l'heure réelle et les saisons (cycle jour/nuit). La météo viendrait se superposer à ce système, pas le remplacer.

## 1. Comparatif des sources (Chambéry 45.5646, 5.9178)

| Source | Clé | Gratuit | Usage commercial | Licence / attribution | Champs utiles | Remarques |
|---|---|---|---|---|---|---|
| **Open-Meteo** (api.open-meteo.com) | Non | 600/min, 5 000/h, 10 000/jour, 300 000/mois **[vérifié]** | Non en gratuit ; plans payants dès 1 M appels/mois, prix non relevé **[non vérifié]** | CC BY 4.0, attribution obligatoire **[vérifié]** | Testé en direct : `weather_code` (WMO), `cloud_cover` %, `precipitation`, `rain`, `snowfall`, `wind_speed_10m`, `wind_direction_10m`, `wind_gusts_10m`, `temperature_2m`, `is_day`, `visibility` (m), `cape`, `lightning_potential` (en 15 min) | Pas de clé, JSON simple, intervalle 15 min en Europe centrale. Modèle `meteofrance_seamless` (AROME 1,5 km) disponible. |
| **Météo-France (portail API)** | Oui (compte + jeton) | Gratuit, quotas par minute (valeur exacte **non vérifiée** : la FAQ ne l'a pas rendue) | Licence Ouverte (donc réutilisation commerciale permise en principe) | Licence Ouverte / Etalab, attribution « Météo-France » | AROME/ARPEGE en GRIB2 par point ou zone ; observations de stations | Inscription, jeton à renouveler, formats lourds ; le plus « souverain » mais le plus de travail. |
| **OpenWeatherMap** | Oui | 60 appels/min, 1 M/mois (API météo actuelle) ; One Call 3.0 : 1 000 appels/jour gratuits puis 0,0012 £ **[vérifié]** | Oui, attribution requise **[non vérifié sur la page]** | Attribution + lien | Conditions, nuages %, vent, visibilité, pluie/neige | Carte bancaire demandée pour One Call **[non vérifié]** ; résolution moins fine que AROME. |
| **MET Norway (Locationforecast 2.0)** | Non, mais `User-Agent` identifiable obligatoire | 20 req/s par application ; cache obligatoire (`If-Modified-Since`), coordonnées à 4 décimales **[vérifié]** | Oui (CC BY 4.0 / NLOD) | CC BY 4.0, crédit + lien licence + « modifié ? » **[vérifié]** | `symbol_code`, nuages, vent, précipitations ; liste exacte **non vérifiée** | Aucune garantie de service ; les IP des utilisateurs sont journalisées, d'où l'intérêt d'un proxy. |
| Brightsky / DWD | non | - | - | - | - | Couvre l'Allemagne, hors sujet. Écarté sans test. |

**Point d'attention majeur (licence).** Le projet est « non commercial » aujourd'hui (Vercel Hobby l'exige aussi). Open-Meteo gratuit convient à un site perso sans pub ni abonnement **[vérifié]**. Si un jour le site devient commercial (pub, abonnement), il faudra changer de plan (les deux obligations tombent en même temps : hébergement et météo).

**Constat de test en direct.** Le même instant donne `weather_code` 53 (bruine) avec `meteofrance_seamless` et 61 (pluie faible) avec le modèle par défaut, nuages 100 %, 12,6 °C, vent 11,9 km/h NNO. Les codes divergent d'un modèle à l'autre : pour le rendu, il faut raisonner en **intensité** (mm/h) plus qu'en code. La grille tombe à 45.56 / 5.92 (≈ 600 m de la fontaine) et l'altitude modèle est 286 m : correct pour la vallée.

**Recommandation de source : Open-Meteo, modèle `meteofrance_seamless`** (AROME en France, repli automatique sur le global), en première version. Raisons : zéro clé (rien à stocker ni à renouveler), JSON direct, tous les champs voulus, quota 300 000/mois très au-dessus du besoin (voir §4). Plan B documenté : MET Norway (sans clé, licence commerciale ouverte) derrière la même interface `WeatherProvider`. Météo-France direct : seulement si Dasco tient à la souveraineté ou à l'usage commercial ; surcoût estimé à +2 jours (GRIB2/jeton), **non vérifié**.

Manque : Open-Meteo ne donne pas de « brouillard » explicite. On le déduit : visibilité < 1 000 m ou `weather_code` 45/48. Les éclairs : `weather_code` 95/96/99 (orage) ou `lightning_potential` / CAPE en renfort **[testé : champs existent, fiabilité non vérifiée]**.

## 2. Architecture

### Option A : le navigateur appelle Open-Meteo directement
+ Aucun code serveur, marche aussi sans API/hors du backend.
- Chaque visiteur consomme le quota (limite par IP côté Open-Meteo, mais mêmes règles) ; pas de contrôle central ; mode « météo forcée » côté client seulement ; CORS à vérifier **[non vérifié]** ; pas de repli unique ; la source est liée au code du front (changer de fournisseur = redéployer le site, le service worker garde l'ancien JS).
- Fuit l'IP de chaque visiteur vers un tiers (RGPD léger).

### Option B (recommandée) : proxy/cache via l'API Hono
`GET /api/weather` → une requête amont par fenêtre de cache, pour tous les visiteurs.
+ Un seul appelant amont : ≤ 6 appels/h (cache 10 min) = ≈ 4 400 par mois, soit 1,5 % du quota gratuit, quel que soit le nombre de visiteurs.
+ Le contrat JSON est normalisé côté serveur : changer de fournisseur ne touche pas le front.
+ Mode forcé, repli, journalisation et coupe-circuit centralisés.
+ Pas d'IP visiteur transmise à un tiers ; User-Agent propre pour MET Norway si on y passe.
- Il faut l'API en ligne ; sans elle, pas de météo (acceptable : le site marche sans, ciel par défaut).

### Mise en cache : compatible Vercel ET Pi/Coolify
Ne pas dépendre d'un seul niveau :
1. **Cache mémoire du processus** (variable de module, TTL 10 min, `stale-while-revalidate` maison). Sur le Pi (processus Node long) c'est le vrai cache. Sur Vercel, il survit seulement tant que l'instance est chaude : utile mais non garanti.
2. **En-têtes HTTP** : `Cache-Control: public, s-maxage=600, stale-while-revalidate=900` + `max-age=60` côté navigateur. Sur Vercel, le CDN de bordure sert alors la plupart des requêtes **sans invoquer la fonction** (économise le quota d'invocations). Sur Coolify/Traefik, pas de CDN : c'est le cache mémoire qui sert, ce qui suffit largement (requête quasi gratuite). Il faut retirer le `no-store` global pour cette route uniquement.
3. **Pas de base de données** : la météo est jetable. Éviter d'y toucher (Neon se réveille en 5 min de veille ; inutile ici). Option plus tard : dernière valeur en base pour survivre aux redémarrages ; non nécessaire.
4. **Anti-ruée** : une seule requête amont en vol à la fois (promesse partagée), délai amont 4 s, jamais d'appel amont depuis le front.

### CORS
Même origine (`/api/...` sur le même domaine que le site) : **pas de CORS à configurer**. Si le site est servi sur un autre domaine un jour, whitelister l'origine, pas `*`.

### Protection des quotas
- Aucun paramètre de lieu accepté par la route (coordonnées fixes dans la config serveur) : personne ne peut faire appeler Open-Meteo pour une autre ville ni contourner le cache.
- Plafond d'appels amont : 1 par minute au maximum, quoi qu'il arrive (même si le cache est vide ou en erreur : cache négatif de 60 s pour éviter de marteler).
- Compteur d'appels amont exposé dans `/api/admin/status` (rattaché à l'US005 « usage et quotas » et à l'US008 garde-fous).

## 3. Contrat de données

`GET /api/weather` → 200 JSON (même forme pour les trois origines : réelle, forcée, repli) :

```json
{
  "v": 1,
  "source": "open-meteo",
  "model": "meteofrance_seamless",
  "fetchedAt": "2026-10-08T15:15:00Z",
  "observedAt": "2026-10-08T15:15:00Z",
  "ageSec": 120,
  "stale": false,
  "forced": false,
  "isDay": true,
  "condition": "rain",
  "temperatureC": 12.6,
  "cloudCover": 1.0,
  "precipMmH": 0.5,
  "rainIntensity": 0.25,
  "snowIntensity": 0,
  "windKmh": 11.9,
  "windGustKmh": 23.8,
  "windFromDeg": 331,
  "visibilityM": 22940,
  "fog": 0,
  "thunder": false,
  "attribution": "Météo : Open-Meteo.com (CC BY 4.0), modèle Météo-France AROME"
}
```

- `condition` ∈ `clear | partly | cloudy | fog | drizzle | rain | snow | sleet | thunder` : dérivé du code WMO (0-3, 45/48, 51-57, 61-67, 71-77, 80-82, 85-86, 95-99). Le front ne manipule jamais les codes WMO bruts.
- Intensités 0..1 déjà normalisées côté serveur (le front n'a qu'à moduler particules/opacité) : pluie 0,25 ≈ 0,5 mm/h. Seuils à calibrer au prototype (ils sont des choix de rendu, pas des faits météo).
- `cloudCover` 0..1 ; `fog` 0..1 déduit de la visibilité (1 si < 200 m, 0 si > 5 000 m) ; `thunder` booléen.
- Règle projet n°1 : on n'invente rien, `observedAt` est toujours l'horodatage du fournisseur ; `ageSec` est calculé à la réponse.
- Unités explicites dans le nom des champs. Version `v` pour évoluer sans casser le service worker, qui peut garder un vieux front.
- Validation de la réponse amont avec **Zod** (déjà dans la pile) : un champ manquant ou aberrant (température hors -40..50) = on rejette l'ensemble et on passe au repli.

### Repli si l'API ou la source tombe
Échelle, du mieux au pire :
1. Cache frais (< 15 min) → réponse normale.
2. Source amont en erreur → on sert le dernier bon relevé avec `stale: true` jusqu'à **3 h**.
3. Plus de 3 h ou jamais de relevé → `503 {"error":"indisponible"}` ; le front reprend le **ciel par défaut** (comportement actuel). Il ne doit jamais afficher une météo vieille de plusieurs heures comme actuelle.
4. Option de repli sur MET Norway après 2 échecs d'Open-Meteo : +0,5 jour, à décider (voir §5).

### Hors-ligne (PWA)
- Le front tente `/api/weather` avec un délai de 3 s ; échec = ciel par défaut, sans bandeau d'erreur ; on réessaie toutes les 10 min tant que la page est ouverte et visible (`document.visibilityState`), et au retour du réseau.
- On ne met **pas** la météo dans le cache du service worker (une météo hors-ligne serait fausse). En revanche, le front peut garder le dernier relevé en mémoire pendant la session et l'afficher en le qualifiant d'ancien au-delà de 60 min, ou le laisser tomber. Recommandation : abandon après 60 min.
- Le mode hors-ligne installable reste intact : rien dans le pré-cache ne dépend de la météo.

### Météo forcée (démo / debug / recette)
- Front : `?weather=rain` | `snow` | `thunder` | `fog` | `clear` | `cloudy` (+ `&intensity=0.8&wind=40`), comme `?debug` : zéro appel réseau, `forced: true`. Indispensable : on ne peut pas attendre un orage à Chambéry pour tester le rendu.
- Serveur (admin, plus tard) : `POST /api/admin/weather/force` avec jeton, durée max 2 h, pour montrer la météo aux amis lors de la session de test. Optionnel ; le paramètre d'URL suffit pour démarrer.
- Journal des 24 dernières valeurs obtenues pour reproduire un bug de rendu (en mémoire ; pas de table).

## 4. Coûts

### Euros
| Poste | Montant | Détail |
|---|---|---|
| API Open-Meteo gratuit | 0 € | ≈ 4 400 appels/mois sur 300 000 autorisés (1,5 %) |
| Invocations Vercel | 0 € | Avec cache CDN : très peu d'invocations. Sans cache : 100 amis × 3 visites × 1 appel ≈ 300 + rafraîchissements toutes les 10 min d'une session de 10 min ≈ quelques milliers/mois, face à 1 M gratuit |
| Pi / Coolify | 0 € de plus | Processus déjà prévu |
| Si usage commercial | À chiffrer | Open-Meteo Standard (1 M appels/mois) payant, tarif non relevé ; l'hébergement Vercel Pro aussi |
| Domaine / certificats | 0 € de plus | |

### Effort (jours, sessions d'une demi-journée à une journée, estimations à ± 30 %)
| Proposition de US (dans EP008 ou epic météo) | Jours | Contenu |
|---|---|---|
| M-US1 Route `GET /api/weather` : client Open-Meteo, normalisation, Zod, mapping WMO, seuils | 1 | + règle `Cache-Control` propre, retrait du `no-store` pour cette route |
| M-US2 Cache, repli et plafond d'appels amont | 0,5 | cache mémoire + promesse partagée + `stale` 3 h |
| M-US3 Tests (Vitest, `server/*.test.ts` à la suite des existants) | 0,5 | mapping des 28 codes WMO, réponse amont tronquée/aberrante, panne, cache, plafond, forme du contrat avec un amont simulé (pas d'appel réseau en test) |
| M-US4 Mode forcé (paramètre d'URL + route admin optionnelle) | 0,5 | |
| M-US5 Client front : récupération, relances, repli, attribution (squelette ; rendu 3D à part) | 1 | côté plan front |
| M-US6 Monitoring et doc | 0,5 | compteur dans `/api/admin/status`, README, DECISIONS, ADR court |
| Total back / données | **≈ 3,5 à 4 jours** | Le rendu 3D (particules, nuages, brouillard, éclairs, impact fluidité iPhone ≤ 31 img/s) est le vrai coût et n'est pas dans ce chiffre |

Sans proxy (option A), on économise ≈ 1,5 jour mais on perd contrôle, repli et mode forcé serveur.

### Monitoring
Rien de payant. Endpoint admin existant : dernier relevé, âge, taux d'échec, nombre d'appels amont du jour et du mois, source active. Alerte simple : si `stale` > 1 h, l'écran admin l'affiche en rouge. Surveillance externe (UptimeRobot gratuit sur `/api/health`) optionnelle.

### RGPD
Le proxy n'enregistre aucune donnée personnelle : les coordonnées sont celles de la ville, pas du visiteur (ne jamais utiliser la géolocalisation du visiteur pour la météo : ce serait une donnée personnelle et inutile). Les journaux Vercel/Coolify gardent déjà les IP (à lister dans l'US009 « Données personnelles ») ; en option B, aucune IP ne part vers Open-Meteo ni MET Norway. En option A, l'IP du visiteur part chez le fournisseur : à mentionner dans les mentions légales.

### Attributions à ajouter (règle projet n°5)
- **README, section Licences** : « Données météo : Open-Meteo.com, licence CC BY 4.0 ; modèles Météo-France (AROME/ARPEGE), Licence Ouverte Etalab 2.0 » **[non vérifié : la licence exacte du modèle reprise par Open-Meteo est à relire sur leur page Sources avant publication]**.
- **Dans l'app** : crédit affiché (CC BY l'exige) à côté des crédits OSM/IGN, avec lien vers open-meteo.com ; indication « météo réelle, mise à jour il y a N min » ou « météo simulée » quand elle est forcée.
- Si bascule vers MET Norway : mention CC BY 4.0, lien vers la licence, « modifié ? oui, normalisé ».

## 5. Risques et décisions pour Dasco

Décisions à trancher :
1. **Périmètre produit** : météo seulement décorative (ciel, nuages, pluie) ou aussi dans le jeu/la fiche (« il pleut, 12 °C ») ? Le second ajoute du texte à relire et des cas d'erreur.
2. **Projet toujours non commercial ?** Si oui, Open-Meteo gratuit + Vercel Hobby tiennent. Si l'idée de pub/abonnement existe, prévoir un autre contrat (Open-Meteo payant, ou MET Norway / Météo-France qui autorisent le commercial).
3. **Source** : Open-Meteo (recommandé), MET Norway en secours automatique (+0,5 j) ou non ? Météo-France direct (+2 j, compte et jeton) pour la souveraineté ?
4. **Où ranger le chantier** : nouvelle epic « La ville vit » (EP001 mentionne la météo ? à vérifier) ou US ajoutée à EP008 ? Le back est minuscule ; le gros morceau est le rendu front.
5. **Cible de fraîcheur** : cache 10 min (recommandé) ou 15 min ; l'amont met à jour toutes les 15 min en Europe centrale, descendre sous 10 min ne sert à rien.
6. **Météo forcée en production** : seulement `?weather=` côté client (simple) ou aussi route admin (pour que les amis voient tous la même démo) ?

Risques :
- **Fluidité mobile** (iPhone 12 Pro ≤ 31 img/s mesuré) : pluie/neige en particules ou en shader sont le principal risque du projet, indépendant du back. Prévoir un réglage qualité et une option « désactiver la météo ».
- **Le front ne dépend que du contrat** : le prototype peut démarrer avec `?weather=` forcé avant que le back existe (parallélisation possible).
- **Fiabilité du code WMO** entre modèles (53 contre 61 constaté au même instant) : le rendu doit se fonder sur les mm/h et la couverture nuageuse, le `condition` n'est qu'un libellé.
- **Fournisseur gratuit sans SLA** : Open-Meteo et MET Norway n'offrent aucune garantie sur le gratuit ; le repli « ciel par défaut » rend la panne invisible.
- **Cache Vercel** : le comportement de `s-maxage` + `stale-while-revalidate` sur les fonctions Hono doit être testé sur un déploiement `preview/**` (non vérifié ici : on n'a pas déployé). Sur le Pi, le cache mémoire fait le travail.
- **Collision avec le `no-store` global** de `server/app.ts` (à corriger proprement : le middleware pose l'en-tête avant les routes ; il faut le rendre non écrasant).
- **Données de quotas citées** à relire avant engagement : Open-Meteo peut changer ses limites (page des conditions consultée le 08/10/2026).
- **Éclairs et brouillard** : déduits (code orage, visibilité) et non mesurés ; ne pas promettre « éclair en temps réel ».
- **Coût en mémoire/API sur le Pi** : négligeable (une requête toutes les 10 minutes).

## Sources (consultées le 08/10/2026)
- Open-Meteo, conditions d'utilisation : https://open-meteo.com/en/terms
- Open-Meteo, tarifs : https://open-meteo.com/en/pricing
- Open-Meteo, API Météo-France : https://open-meteo.com/en/docs/meteofrance-api
- MET Norway, conditions d'utilisation : https://api.met.no/doc/TermsOfService
- OpenWeather, tarifs : https://openweathermap.org/price
- Météo-France, portail API et AROME sur data.gouv.fr : https://portail-api.meteofrance.fr ; https://data.gouv.fr/en/datasets/donnees-du-modele-atmospherique-arome-a-aire-limitee-a-haute-resolution
- Test direct de l'API Open-Meteo pour Chambéry (appel du 08/10/2026 17h15 locale)
