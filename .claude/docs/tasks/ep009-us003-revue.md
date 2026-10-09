# Revue EP009-US003 — Contrat météo et route `/api/weather`

Relecture indépendante du 09/10/2026. Branche `feat/EP009-US003-contrat-et-route`, commits `d2496e2` (contrat), `ddbd58a`
(délai des tests PGlite) et `fefe05e` (route) ; diff `a9424e9..fefe05e`. Aucun fichier du dépôt n'a été modifié en dehors de
ce rapport. Les essais ont été faits dans une copie temporaire (`git archive fefe05e`, `node_modules` du dépôt en lien
symbolique, Node 25.2.1), avec des sondes jetables qui n'ont jamais été dans le dépôt.

## En bref
- **Aucun défaut bloquant.** La route respecte le contrat dans tous les cas essayés (plus de 100 000 relevés générés,
  6 124 pas réels d'ICON). Elle n'envoie aucune donnée du visiteur à la source et ne pose pas de cookie. Le bloc météo
  du contrôle du build n'appelle ni Open-Meteo ni la base.
- **2 défauts importants.**
  - I1 : par temps froid, la neige annoncée par la source est rendue en « bruine », « pluie » ou « pluie et neige ».
    C'est le cas de 44 % à 63 % des pas réels codés neige.
  - I2 : le délai de 20 s ne couvre pas les `beforeEach`, or `parkings.test.ts` y démarre PGlite. `npm test` reste instable.
- **9 mineurs.** Documentation du débit d'appels en panne ; 29 codes WMO (97) au lieu de 28 ; deux erreurs mal classées ;
  arrondi du brouillard ; un commentaire faux sur la neige ; imprécisions du README ; trous dans les tests ; cache non calé
  sur les pas de 15 min.
- **À vérifier sur la prévisualisation.** Le cache du CDN, y compris la clé de cache avec la réécriture `/api/:path*`.
  L'effet de `stale-while-revalidate=300` : une réponse peut être servie jusqu'à 6 min, pas 60 s. Le réglage Fluid compute.

---

## Défauts

### Bloquant
Aucun.

### Important

#### I1. Neige annoncée par la source, rendue en bruine, pluie ou « pluie et neige » par temps froid
- **Où.** `backend/src/meteo/normalize.ts:57-61` tire la part de neige de `snowfall`. `normalize.ts:71-75` décide la
  condition. Le code de la source n'y est consulté que pour bruine ou pluie, jamais pour la neige.
- **Scénario.** Il neige faiblement à −3 °C. Sur le pas de 15 min, ICON renvoie `weather_code: 71` (« Slight snowfall »),
  `precipitation: 0.1` mm et `snowfall: 0` cm. Le calcul donne alors :
  - `share = 0`, donc ni `snow` ni `sleet` ;
  - le libellé `snow` n'est ni bruine ni pluie, donc on passe au seuil de mm/h ;
  - 0,4 mm/h < 0,5, donc **`drizzle`**, avec `rainIntensity: 0.15` et `snowIntensity: 0`.

  La carte afficherait « Bruine » et de la pluie par −3 °C, alors que la source dit neige (règle 1 : rien d'inventé).
- **Preuve sur des valeurs réelles d'ICON.** Un appel à Open-Meteo : `minutely_15=precipitation,snowfall,temperature_2m,weather_code`,
  `models=icon_seamless`, `past_days=30`, sur cinq sommets alpins (Jungfraujoch, Mont Blanc, Zugspitze, Säntis, Sonnblick ;
  2 398 à 4 792 m). Les pas ont été rejoués avec `normalize` :

  | Température | Pas avec précipitation | dont code « neige » (71-77, 85, 86) | rendus `snow` | codés neige mais rendus autrement |
  |---|---|---|---|---|
  | ≤ −3 °C | 281 | 273 | 153 | **120 (44 %)** |
  | −3 à 0 °C | 198 | 133 | 49 | **84 (63 %)** |
  | 0 à 2 °C | 224 | 19 | 5 | 14 |

  À ≤ −3 °C, tous pas confondus, cela donne 153 `snow`, 52 `sleet`, 55 `drizzle` et 21 `rain`.
  
  **Cause.** Deux effets se cumulent :
  - les 283 valeurs non nulles de `snowfall` sont toutes des multiples de 0,07 cm, soit 0,1 mm d'eau : la neige est
    arrondie au dixième de mm, comme la précipitation totale ;
  - même en cumul, la neige ne fait que 76 % de la précipitation à ≤ −3 °C (Σ neige × 10/7 ÷ Σ précipitation = 0,76).

  Couples les plus fréquents : `0,1 mm / 0 cm` (55 pas à ≤ −3 °C), `0,2 mm / 0,07 cm` (part 0,5, donc `sleet`). Cas
  reproduits avec `normalize` :

  | Entrée (température, code, précipitation, neige) | Sortie |
  |---|---|
  | −3 °C, 71, 0,1 mm, 0 cm | `drizzle` |
  | −3,1 °C, 71, 0,2 mm, 0,07 cm | `sleet` |
  | −3 °C, 71, 0,3 mm, 0,14 cm | `sleet` |
  | −3,1 °C, 73, 0,2 mm, 0 cm | `rain` |
- **Pourquoi c'est important.** Rien n'est encore affiché (US004), mais c'est du code d'US003, et la neige peut arriver à
  Chambéry avant US007. La lettre de la règle 5 (« présence et force … de la neige tirées des mm/h ») est respectée : c'est
  la règle elle-même qui ne tient pas sur les données réelles d'ICON.
- **Correction proposée (à faire valider par Dasco).** C'est le prolongement de D9 : la présence de précipitation vient des
  mm/h, et son **type** suit le code de la source, comme c'est déjà le cas pour bruine ou pluie.
  - Calculer `label` avant `share`.
  - Quand `cold && label === 'snow'` : `share = 1`, donc condition `snow` et toute la précipitation comptée en neige.
  - Garder la part calculée seulement sans code de la source, ou pour un code de pluie par temps froid (`sleet` si la part
    dépasse 0,3).
  - Au-dessus de 2 °C, rien ne change (règle 6).
  - Ajouter un test avec les quatre couples réels ci-dessus : `snow` attendu pour chacun.

#### I2. Le délai de 20 s ne s'applique pas aux `beforeEach` : `parkings.test.ts` reste instable
- **Où.** `vitest.config.ts:16` ne règle que `testTimeout: 20_000`. Or `backend/src/parkings.test.ts:17-22` démarre PGlite
  et rejoue les migrations dans un `beforeEach`, qui obéit à `hookTimeout` (10 s par défaut). En revanche,
  `admin.test.ts:82` et `db/migrations.test.ts:18` démarrent PGlite dans le test lui-même : ceux-là sont bien couverts.
- **Scénario.** Sur une machine chargée (suite complète en parallèle, autre session ouverte), le premier `beforeEach` de
  `parkings.test.ts` (compilation WebAssembly puis migrations) dépasse 10 s. Le test échoue malgré `ddbd58a`.
- **Preuve.**
  - Une sonde jetable dans le projet `back` (un `beforeEach` de 12 s) échoue en 10 009 ms avec « Hook timed out in 10000ms ».
  - Échec observé une fois sur 5 passages complets de `npx vitest run` :
    `parkings.test.ts > enregistre une retouche puis la publie avec sa source`, à 11 268 ms. C'est sous les 20 s, donc ce
    n'est pas le délai du test. Le message n'a pas été capturé, et l'échec n'a pas été reproduit en 4 autres passages
    complets ni en 6 passages du projet `back` lancés deux par deux.
- **Correction proposée.** Ajouter `hookTimeout: 20_000` à côté de `testTimeout` dans le projet `back`, et compléter le
  commentaire de `vitest.config.ts:14-15`.

### Mineur

#### M1. Pendant une panne, la source est appelée une fois par minute, pas « au plus une fois toutes les 10 min »
- **Où.** `README.md:532`, le commentaire de `backend/src/app.ts:89` et la ligne 18 de l'epic. La logique est dans
  `service.ts:44-50`.
- **Scénario.** La source répond 429 (IP partagée de Vercel, risque R1) ou 5xx en continu. Une instance chaude la rappelle
  alors toutes les 60 s.
- **Preuve.** Sonde : une requête toutes les 5 s pendant 10 min, source en 429, donne **10 appels**.
- **Effet.** Le volume reste faible : 60 appels par heure et par instance au plus, soit environ 14 % du quota journalier
  pour une instance en panne continue. Mais l'affirmation est fausse, et rappeler chaque minute une source qui répond 429
  aggrave le refus sur une IP partagée.
- **Correction.** Écrire « au plus une fois toutes les 10 min par instance quand la source répond, une fois par minute
  quand elle échoue ». Mieux : après un `http-429`, n'essayer de nouveau qu'au bout de 10 min, ou de `Retry-After` s'il est
  présent.

#### M2. Codes WMO : Open-Meteo en documente 29, le code et le test en annoncent 28
- **Où.** Le commentaire de `normalize.ts:38` (« les 28 codes documentés »), la liste de `meteo.test.ts:38-39` (28 codes,
  sans 97) et le critère d'US003 (ligne 23).
- **Constat.** La page de documentation d'Open-Meteo, lue le 09/10/2026, liste 29 codes : 0, 1, 2, 3, 45, 48, 51, 53, 55,
  56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, **97 « Heavy thunderstorm »** et 99. Elle précise :
  « Codes 96 and 99 are only reported by models with an explicit hail forecast, such as DWD ICON or UKMO. All other models
  derive thunderstorms from instability parameters and report codes 95 and 97 ».
  - 97 tombe bien en `thunder` grâce à la plage 95-99, mais il n'est pas testé.
  - Les plages donnent une condition à des codes non documentés (52, 54, 62, 64, 72, 74, 76, 98) et aucune à d'autres
    (50, 58 à 60, 68 à 70, 78, 79, 83, 84). C'est contraire à la lettre du critère « un code inconnu n'en donne aucune »
    (seul le code 30 est testé).
  - Sans effet pratique aujourd'hui : la source n'émet que les codes documentés, et un code sans condition retombe sur les
    mm/h et la couverture nuageuse.
- **Correction.** Une table explicite des 29 codes (`Record<number, WeatherCondition>`) ; un test sur les 29 et sur un code
  non documenté de chaque famille ; remplacer « 28 » dans le commentaire, le test et la spec.

#### M3. Deux erreurs de la source sont mal classées
Elles ne servent qu'au journal aujourd'hui, mais elles seront montrées dans `lastError` de l'écran admin (US012).
- **Où.** `open-meteo.ts:72` et `open-meteo.ts:76`.
- **Scénario 1 : corps qui n'arrive pas.** La source envoie ses en-têtes puis s'arrête. `AbortSignal.timeout` coupe bien à
  4 s, mais `res.json().catch(() => null)` avale l'erreur : le cas est classé **`format`**, sans détail, au lieu de
  `delai`.
  - Preuve avec un serveur HTTP local : corps bloqué → `format` en 4 006 ms ; en-têtes jamais envoyés → `delai` en 4 009 ms.
- **Scénario 2 : heure absurde.** `current.time` vaut par exemple 9 000 000 000 000. C'est un entier sûr, donc le schéma
  l'accepte. Le message d'erreur appelle `new Date(time * 1000).toISOString()`, qui lève une `RangeError` au lieu de
  `WeatherUpstreamError('perime')`. Le service la rattrape et l'écrit telle quelle : « RangeError: Invalid time value ».
  - Preuve : sonde.
- **Correction.**
  - Dans le `catch` de `res.json()` et de `res.text()`, reconnaître `err.name === 'TimeoutError'` et classer en `delai`.
  - Borner `time` dans le schéma (par exemple de 0 à 4 102 444 800, soit l'an 2100), ou écrire le message sans
    `toISOString()`.

#### M4. Condition décidée avant l'arrondi : `fog: 0.5` affiché avec la condition « Couvert »
- **Où.** `normalize.ts:76` compare la valeur brute (`fog >= 0.5`), puis `normalize.ts:98` renvoie `round(fog)`.
- **Scénario.** Avec une visibilité de 1 001 à environ 1 016 m, `fogFromVisibility` vaut entre 0,4997 et 0,4951. La
  condition est donc `cloudy`, mais la réponse dit `fog: 0.5`.
  - Sonde : 999 m et 1 000 m donnent `fog` ; 1 001 m à 1 012 m donnent `cloudy`, toujours avec `fog: 0.5`.
  - Une carte qui lirait « brouillard si `fog` ≥ 0,5 » contredirait le libellé.
- **Correction.** Arrondir `fog` d'abord et décider sur la valeur arrondie, ou arrondir vers le bas.
- Même principe pour la température (2,04 °C est affiché « 2 » mais rendu en pluie). Ce cas reste théorique : Open-Meteo
  donne les températures au dixième (vérifié sur 2 mois de pas de 15 min).

#### M5. Commentaire faux sur l'équivalence de la neige
- **Où.** `normalize.ts:14` : « `SNOW_FULL_MMH = 3` … (≈ 4 cm de neige par heure) ».
- **Constat.** Avec la règle d'Open-Meteo appliquée ligne 57 (« 7 cm snow = 10 mm precipitation water equivalent »),
  3 mm d'eau donnent **2,1 cm** de neige.
- **Correction.** « ≈ 2 cm de neige par heure ».

#### M6. README : imprécisions dans la description de la route (`README.md:532`)
- « pluie et neige (mm/h et intensités de 0 à 1) » : la réponse n'a qu'un `precipMmH` (pluie et neige fondue ensemble),
  plus deux intensités.
- « Réponse mise en cache 60 s par Vercel » : le CDN peut la servir jusqu'à 6 min (60 s + `stale-while-revalidate=300`),
  voir V2.
- « le dernier bon relevé (`stale: true`) est servi jusqu'à 3 h » : les 3 h se comptent depuis l'heure du pas du modèle,
  pas depuis le début de la panne.
- Le débit d'appels, déjà traité en M1.

#### M7. Deux commentaires à préciser
- `open-meteo.ts:7-9` dit que `icon_seamless` est « le seul, parmi ceux essayés, qui donne à Chambéry la visibilité et le
  potentiel d'éclair ». Or le tableau du plan (§ 1.3) montre que `icon_d2` et `best_match` les donnent aussi : c'est le même
  modèle ICON. Écrire plutôt « la famille ICON (que `best_match` suit à Chambéry) ».
- `normalize.ts:8` dit « même libellé que la source 98 % du temps ». Ce chiffre vient du plan, calculé sur l'historique
  **horaire**. Sur les pas de 15 min que lit `current`, le rejeu de 6 124 pas (du 7 août au 9 octobre) donne **96,9 %**.
  Les écarts viennent surtout de pas codés 61 ou 80 avec 0,0 mm, rendus « Couvert » ou « Éclaircies ».

#### M8. Tests : trous, et valeurs que la source ne produit jamais
- `meteo.test.ts:52-54` utilise 0,05 mm et 0,01 mm par pas. La source donne les cumuls au dixième de mm : sur 2 mois, 273
  pas sont non nuls et la plus petite valeur est 0,1. Le vrai cas limite n'est pas testé : 0,1 mm (soit 0,4 mm/h) avec un
  code de ciel (0 à 3) donne `drizzle`.
  - Pour le calibrage (D7) : `PRECIP_MIN_MMH = 0.1` et `DRIZZLE_MAX_MMH = 0.5` ne jouent en pratique qu'à 0,4 mm/h.
- `meteo.test.ts:71` teste « 300 m → fog » avec le code 45. Avec le code 3, le résultat est le même (sonde), mais le test
  ne prouve pas que la visibilité seule suffit.
- `meteo.test.ts:107` simule le délai par une erreur nommée `TimeoutError`. Si `signal: AbortSignal.timeout(...)`
  disparaissait de `open-meteo.ts:67`, aucun test ne le verrait. Il faudrait au moins vérifier que `init.signal` est un
  `AbortSignal`, ou rendre le délai injectable.
- Comportements corrects mais non testés (prouvés par les sondes) :
  - le cache négatif **sans aucun relevé** : 50 requêtes simultanées pendant une panne font 1 appel, puis aucun nouvel
    appel avant 60 s ;
  - un pas dans le futur (plus de 15 min) est refusé en `perime` ;
  - `interval` de 3 600 et de 60 s ;
  - `snowfall`, `weather_code` et rafales absents ou `null` ;
  - I1, qui manque aussi.
- Aucune fragilité trouvée dans les 13 tests météo : l'horloge est injectée, chaque test crée son application, et les
  requêtes simultanées sont déterministes (13 sur 13 à chaque passage).

#### M9. (Suggestion) Le cache de 10 min n'est pas calé sur les pas de 15 min
- **Où.** `service.ts:46`.
- **Scénario.** Un relevé lu à 10 h 14 min 59 s porte sur le pas de 10 h 00. Il est gardé jusqu'à 10 h 24 min 59 s, alors
  que le pas de 10 h 15 existe depuis 10 min.
  - Sonde : le pas de 10 h 00 est encore servi à 10 h 24 min 58 s.
  - Avec le CDN (jusqu'à 6 min, voir V2), un visiteur peut voir un pas remplacé depuis environ 16 min. L'objectif 1 de
    l'epic (« au plus 10 min de retard », ligne 40) n'est donc pas garanti.
- **Piste.** Considérer le relevé périmé dès que le pas suivant existe (`now ≥ (time + interval) × 1000 + 30 s`), avec au
  moins 60 s entre deux appels. On ferait alors 4 appels par heure au plus, au lieu de 6, et le retard se limiterait à
  celui du CDN.
  - L'heure exacte où Open-Meteo bascule d'un pas au suivant n'est pas vérifiée. Un appel à 11 h 57 min 37 s UTC a renvoyé
    le pas de 11 h 45.

### À vérifier

#### V1. Cache du CDN sur la prévisualisation
Critère d'US003, pas encore fait : `MISS` puis `HIT`, et `cache-control: public, max-age=0` côté navigateur.
- **Clé de cache.** Selon Vercel, elle est faite de « The request method / The request URL (query strings are ignored for
  static files) / The host domain / The unique deployment URL / The scheme », plus `Accept` et `Accept-Encoding`. La doc ne
  dit pas si l'URL est celle d'avant ou d'après la réécriture `/api/:path*` → `/api`.
  - Juste après un `HIT` sur `/api/weather`, un `curl` sur `/api/health` doit renvoyer la santé, pas la météo.
- **Prévisualisation protégée.** À constater aussi : le CDN met-il en cache une réponse demandée avec
  `x-vercel-protection-bypass` ?

#### V2. `stale-while-revalidate=300` : une réponse peut vivre 6 min, pas 60 s
- **Ce que dit Vercel.** Après `s-maxage`, « Subsequent requests are served from the cache and revalidated asynchronously
  if the cache is "stale" ». Sur un site peu visité, le premier visiteur après l'expiration reçoit donc la copie périmée,
  jusqu'à 360 s après sa création.
- **Conséquences.**
  - (a) L'objectif « au plus 10 min de retard » n'est pas tenu (voir M9).
  - (b) US012 promet « plus 60 s de cache du CDN » et un avertissement « visible par tous les visiteurs d'ici 1 à
    2 minutes ». Ce n'est pas tenable avec 300 s.
  - (c) La doc ne dit pas ce que fait le CDN quand la revalidation reçoit un 503 `no-store` (météo coupée, ou relevé de
    plus de 3 h). La copie périmée peut rester servie jusqu'à la fin des 300 s : c'est l'effet que R3 voulait éviter en
    écartant `stale-if-error`. Pour US003, ce n'est pas grave, puisque la carte applique elle-même la règle des 3 h (plan
    § 5.7).
- **À trancher avec Dasco.** Garder 300 s (le visiteur attend moins) ou descendre à 60 s (un changement est visible en
  2 min au plus).

#### V3. Fluid compute
- **Ce que dit Vercel.** Fluid compute est actif par défaut pour les projets créés depuis le 23/04/2025.
- **Ce qui manque.** Le réglage du projet reste à confirmer dans le tableau de bord : `vercel.json` n'en dit rien.
- **Risque sans Fluid.** Une instance ne sert qu'une requête à la fois. La requête unique en vol ne joue plus entre
  visiteurs simultanés : 50 visiteurs d'un coup sur un déploiement neuf peuvent démarrer plusieurs instances, donc
  plusieurs appels à la source.

#### V4. Amplification
- **Le CDN se contourne.** Pour une fonction, la chaîne de requête fait partie de la clé de cache. Chaque
  `/api/weather?x=<aléatoire>` coûte donc une invocation, décomptée du quota Hobby.
- **Les appels à la source restent bornés, mais par instance seulement.** Au plus 6 par heure en temps normal, 60 par heure
  en panne, et rien ne borne le nombre d'instances.
- **Ce n'est pas propre à la météo.** Les autres routes publiques ont la même exposition (`/api/health` lit même la base).
- **Parade possible.** Une règle de limitation dans le pare-feu de Vercel (non étudiée).

#### V5. Échec intermittent de `parkings.test.ts` (I2)
Le message n'a pas été capturé. Après la correction, relancer `npx vitest run` sur une machine chargée.

---

## Ce qui est bon
Le code est court, lisible et fidèle au plan : contrat complet (8 exports, codes d'erreur sur une ligne à part) ; cache,
requête unique en vol, cache négatif et repli « stale » corrects ; unités (secondes et millisecondes) justes partout ; 503 en
`no-store` ; pas de `Set-Cookie` ; paramètres de la requête ignorés.

La réponse respecte toujours le contrat. Aucune donnée du visiteur ne part vers la source. Le contrôle du build n'appelle
jamais Open-Meteo : c'est prouvé avec un `fetch` piégé. Licence et route sont documentées dans le README.

## Vérifié / non vérifié

### Vérifié
Tout a été fait sur une copie de `fefe05e`, avec Node 25.2.1.

**Lectures**
- Règles du projet, epic (règles 1 à 13, décisions), US003, US012 (délais annoncés), plan back v2 § 4, 5 et 7.
- Diff `a9424e9..fefe05e`.

**Tests et contrôles du build**
- `npx vitest run --project back backend/src/meteo` : 13 tests sur 13.
- Suite complète : 107 tests sur 107 dans 4 passages sur 5 (voir I2). Les 6 passages du projet `back` lancés deux par deux
  sont tous verts.
- `npm run typecheck` (carte, admin, back, contrat) et `check-boundaries` : OK.
- `check-api-esm`, lancé sans variable, puis avec `VERCEL=1 VERCEL_ENV=preview ADMIN_TOKEN=… DATABASE_URL=<injoignable>`,
  avec un `fetch` global piégé : OK, et **aucun** appel `fetch`. Le bloc météo utilise `createApp({}, …)`, donc aucune base.

**Sondes (16 tests jetables, hors dépôt)**
- Fuzz contre le contrat : 200 000 tirages, dont plus de 100 000 relevés valides. Aucun refus, aucun `NaN`.
- `Infinity` (JSON `1e400`) est refusé par le schéma amont.
- Cas limites de la normalisation : `interval` de 60 et 3 600 s, limite de 2 °C, arrondi du brouillard, codes WMO.
- Délai réel avec un serveur HTTP local : en-têtes bloqués → `delai`, corps bloqué → `format`.
- `RangeError` sur une heure absurde.
- Service : débit d'appels en panne, cache négatif sans relevé, sens de `stale`, calage sur les pas de 15 min.
- Route : `HEAD` répond 200 et passe par le service ; `/api/weather/` et `POST` répondent 404 en `no-store`.

**Open-Meteo : 3 appels le 09/10/2026**

| Appel | Résultat |
|---|---|
| L'URL exacte du code | 200 en 212 ms, sans en-tête de cache. Schéma amont et contrat OK. `time` = début du pas en cours (11 h 45 à 11 h 57 min 37 s UTC). Maille 45,56 ; 5,92 |
| Chambéry, `minutely_15`, 92 jours | Données du 07/08 au 09/10, sans trou. Cumuls au dixième de mm (max 21,1 mm en 15 min), températures au dixième, visibilité max 64 660 m, potentiel d'éclair max 32,5, direction du vent de 2 à 360 : les bornes du schéma ne sont jamais atteintes. Rejeu de 6 124 pas : aucun refus, 96,9 % d'accord sur le libellé |
| Cinq sommets alpins, 30 jours | I1 |

**Documentation**
- Vercel (pages datées de septembre 2026) : cache du CDN, critères (statuts, `set-cookie`, `Vary`), en-têtes
  `Cache-Control` (retrait de `s-maxage` et `stale-while-revalidate` avant le navigateur : le commentaire de
  `routes.ts:7-8` est exact), clés de cache, Fluid compute.
- Open-Meteo : table WMO de 29 codes ; neige « 7 cm = 10 mm » ; pour `current`, `time` est « the moment at which the data
  is valid » et `interval` vaut la somme des 15 min précédentes.
- La conversion de la neige (`× 10 / 7`) et `mm/h = cumul × 3600 / interval` sont justes.

### Non vérifié
- **Tout ce qui se passe sur Vercel** : `MISS` et `HIT`, `stale-while-revalidate`, clé de cache avec la réécriture,
  prévisualisation protégée, Fluid compute, nombre d'instances. `AbortSignal.timeout` n'a été vérifié qu'en local, avec le
  même `fetch` intégré à Node, pas dans le runtime de Vercel.
- **L'hiver à Chambéry.** I1 est montré sur des sommets alpins en octobre (même modèle ICON), pas à Chambéry : les pas de
  15 min disponibles n'y vont que d'août à octobre.
- Le message de l'échec intermittent de `parkings.test.ts`.
- Les refus 429 sur les IP partagées de Vercel.
- **Hors périmètre, à savoir.** Pendant un build de **production** sur Vercel, l'étape `/api/health` de `check-api-esm`
  (EP010) lance un `select 1` sur la base de production si `DATABASE_URL` est injectée pendant le build. Ce n'est pas le
  cas en prévisualisation sans `DATABASE_URL_PREVIEW`. Le bloc météo, lui, n'utilise aucune base.
