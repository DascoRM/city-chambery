# Plan EP009-US012 — La météo dans l'administration (prêt à coder)

Rédigé le 09/10/2026 par un agent chercheur. Aucun fichier du dépôt n'a été modifié, sauf ce plan ; aucune opération git
n'a changé l'état du dépôt. Spec : [US012](../specs/epics/EP009-meteo-en-direct/US012-meteo-dans-l-admin.md) ; epic : D6, D8,
règles 1, 11 et 13 ; études : [plan back v2](ep009-back-plan-v2.md) § 6 et § 9, [relecture d'US003](ep009-us003-revue.md).

**Bases lues et essayées :**
- `feat/EP009-meteo` = `29cbd0d` : US003 (route) avec les corrections de la relecture (`dbcc631`), puis US001 et US002 ;
- `feat/EP009-US004-meteo-reelle-carte` = `48ffd36` : US004 (lecture de `/api/weather` par la carte).
- **Pendant l'étude, US004 a été fusionnée** : `feat/EP009-meteo` = `8384d0b` (`c6524c5` et deux commits de documentation).
  Son code est identique à celui de `48ffd36`. Les 4 patchs s'y appliquent en série, et le code obtenu est identique à celui
  de la copie vérifiée [vérifié].

Légende :
- **[copie]** : appliqué et vérifié dans une copie du dépôt (`git archive 48ffd36`, `node_modules` du dépôt en lien symbolique,
  Node 25.2.1) ;
- **[vérifié]** : lu dans le code, sur une branche ou dans une documentation, ou constaté en local ;
- **[non vérifié]** : à constater sur la prévisualisation ou par Dasco.

Les patchs, un par commit, sont aussi dans le dossier temporaire de la session :
`/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/7058533b-187f-4f4d-8d7b-9497ad542537/scratchpad/us012/patches/`
(`git apply` depuis la racine du dépôt). Tout leur code est recopié ci-dessous, tiré des commits vérifiés.

---

## 0. En bref

- **4 commits de code et 1 de documentation.** C1 back : forçage dans `app_meta`, lecture bornée, routes admin, journal.
  C2 : écran « Météo » de l'admin. C3 : fin d'un forçage côté carte. C4 (**facultatif**, question Q1) : la carte relit toutes
  les 2 min. C5 : documents de suivi.
- **Vérifié dans la copie, commit par commit [copie]** :
  - `npm run build` passe à chaque commit ; `npm test` passe : 157 tests au départ, puis 177, 183, 185 et 185 ;
  - `check-api-esm` passe aussi avec les variables de Vercel ;
  - essai local de bout en bout : API sur 8817, admin sur 4211 avec Chrome sans fenêtre et captures, carte sur 4212 ;
  - les 4 commits s'appliquent sur la tête actuelle de `feat/EP009-meteo` (`8384d0b`), où US004 a été fusionnée pendant
    l'étude.
- **Aucun changement du contrat ni de migration.** `contrat/meteo.ts` a déjà `weatherOverrideInput`, `weatherOverride`,
  `adminWeatherResponse` et `WEATHER_PRESETS` ; `contrat/erreurs.ts` a déjà `meteo-desactivee`. `app_meta` existe depuis `0000`.
- **Trois choix de conception en plus de la spec :**
  - le CDN ne sert jamais une météo forcée après sa fin (durée de cache plafonnée au temps restant) ;
  - une réponse donnée avant d'avoir pu lire la base n'est pas mise en cache ;
  - l'écran admin relit toujours la base (il montre l'état écrit, pas celui de l'instance).
- **Carte :** relecture 5 s après `forcedUntil`, jamais plus d'une par 30 s. Entre la fin et la réponse, ciel par défaut sans
  puce, au lieu de « Indisponible ». La scène quitte le forçage à l'heure dite, même sans relecture.
- **EP008, vérifié sur `docs/EP008-v2-admin` (`acde893`)** : sa spec ne parle ni d'`app_meta` ni de la météo.
  - Sa migration de données prévue recopierait les lignes météo d'`edit_log` dans `audit_log` comme des retouches de parkings
    (`parking_overrides`, `insert`), sans erreur.
  - Je recommande **US012 maintenant**, avec `edit_log`, et je donne à EP008 la correspondance SQL et trois demandes (§ 3).
- **Trois questions pour Dasco (§ 2)** : faire relire la carte toutes les 2 min ; US012 avant ou après EP008-US013 ; une base
  pour la prévisualisation.

---

## 1. Point de départ vérifié

### 1.1 Ce qui existe et ce qu'US012 ajoute [vérifié]
| Élément | Aujourd'hui (`29cbd0d` / `48ffd36`) | US012 |
|---|---|---|
| Contrat | `weatherOverrideInput` (`contrat/meteo.ts` l. 91-102), `weatherOverride` (l. 105-116), `adminWeatherResponse` (l. 119-143), `WEATHER_PRESETS` (l. 26-36) ; codes `meteo-indisponible`, `meteo-desactivee` (`contrat/erreurs.ts` l. 14) | **rien à changer** |
| Service | `backend/src/meteo/service.ts` (77 lignes) : relevé renouvelé à chaque pas de 15 min (+30 s), 60 s entre deux appels, 10 min après un 429 ; ni forçage ni compteurs | forçage lu en base (borné), compteurs de l'instance, écriture, vue admin, durée de cache par réponse |
| Normalisation | `normalize.ts` : 29 codes WMO en table, neige par le code par temps froid ; pas de `forcedResponse` | `forcedResponse` (mêmes règles que `presetLook` de la carte) |
| Route publique | `routes.ts` : `PUBLIC_CACHE` = `s-maxage=60, stale-while-revalidate=60` | en-tête calculé (`publicCache`) ; 503 `meteo-desactivee` |
| Routes admin | aucune | `GET /api/admin/weather`, `PUT` et `DELETE /api/admin/weather/override` |
| `app.ts` | l. 68 `createWeatherService({ fetch, now })` ; l. 90 la route ; l. 123 `ping` | 3 lignes changées, 3 ajoutées |
| Journal | `edit_log` ; `recentLog` (`parkings.ts` l. 62-64) montre tout | lignes `target = 'meteo'`, exclues du journal des parkings |
| Admin | Tableau de bord, Parkings | onglet et page « Météo » |
| Carte (US004) | `client.ts` : relecture 15 min ; `state.ts` : forçage fini → « Indisponible » jusqu'à la relecture suivante ; `index.ts` : aucune minuterie pour la fin d'un forçage | relecture 5 s après la fin ; « en attente » au lieu de « Indisponible » ; minuterie de fin |

### 1.2 Ce que la relecture d'US003 change par rapport au prototype du plan v2 [vérifié]
| Prototype du plan v2 | Code d'aujourd'hui | Effet sur US012 |
|---|---|---|
| relevé gardé 10 min | renouvelé à chaque pas de 15 min de la source (+30 s), 60 s au moins entre deux appels | `config.freshS` vaut 900 (le relevé n'est jamais gardé plus de 15 min) |
| `stale-while-revalidate=300` | `=60` : un changement est vu en 2 min au plus | l'avertissement de l'écran parle de 1 à 2 min ; c'est aussi ce qui borne la fin d'un forçage côté CDN |
| 60 s après tout échec | 10 min après un refus 429 | visible dans « Dernière erreur » de l'écran (`http-429 : …`) |
| neige tirée des cm | par temps froid, la neige suit le code de la source | rien (la météo forcée ne passe pas par là) |
| `forcedResponse`, `override-store.ts`, routes admin dans le prototype | **absents du dépôt** | écrits ici, adaptés au code d'aujourd'hui |

---

## 2. Questions pour Dasco

**Q1. Relecture de la carte pendant une démo.**
- *Problème* : la carte relit la météo toutes les 15 min. Une carte **déjà ouverte** au moment où tu forces la neige peut
  mettre jusqu'à 17 min à la montrer (15 min de relecture + 2 min de cache). Pareil si tu reviens à la météo réelle avant la
  fin. La fin prévue, elle, est vue tout de suite (C3). Une carte ouverte **après** le forçage le voit en 2 min au plus.
- *Coût d'une relecture toutes les 2 min* : le cache du CDN répond le plus souvent. Le back ne rappelle la source qu'à chaque
  pas de 15 min et ne relit la base que toutes les 30 min : les appels à Open-Meteo et les réveils de Neon ne changent pas.
  Ce sont surtout des requêtes au CDN, quelques milliers par mois sur 1 million gratuites [estimé]. Une panne garde son attente
  qui s'allonge jusqu'à 15 min.
- *Question* : tes amis auront-ils déjà la carte ouverte quand tu lanceras une démo, et veux-tu qu'elle relise la météo
  toutes les 2 min pour la voir en 4 min au plus ?
- *Proposition* : oui, avec le commit C4. Il change la règle d'US004 « relue dans 15 min » (à reporter dans la spec).

**Q2. US012 avant ou après le journal d'EP008.**
- *Problème* : aujourd'hui, le journal (`edit_log`) ne connaît que « admin » : un seul jeton, partagé. EP008-US013 apportera
  `audit_log`, avec l'auteur (ton compte). C'est environ 3 à 3,5 jours de travail d'EP008 avant (US011, US012, US013), pas
  encore commencés.
- *Question* : préfères-tu avoir l'écran Météo et le forçage pour les démos maintenant, avec le journal actuel (EP008 devra
  recopier ces lignes, § 3), ou attendre le journal d'EP008 pour savoir qui a forcé la météo ?
- *Proposition* : maintenant (variante A, § 3) : il n'y a qu'un administrateur, et l'auteur sera connu dès EP008.

**Q3. Une base pour la prévisualisation.**
- *Problème* : sans `DATABASE_URL_PREVIEW`, la prévisualisation n'a pas de base. Le forçage y répond alors 503 « base
  indisponible », et on ne peut pas essayer US012 avant la production.
- *Question* : la variable `DATABASE_URL_PREVIEW` (branche `preview` de Neon) est-elle bien posée pour l'environnement
  Preview de Vercel, avec les migrations `0000` et `0001` appliquées ?
- *Proposition* : vérifier dans Vercel. `GET /api/health` de la prévisualisation dit `db.status: ok` si c'est le cas.

---

## 3. Coordination avec EP008 (vérifiée sur `docs/EP008-v2-admin`, `acde893`)

### 3.1 Ce que dit EP008 aujourd'hui [vérifié]
- **Aucune mention d'`app_meta` ni de la météo** dans la spec d'EP008 (epic, US011 à US015) ni dans ses plans
  (`ep010-admin-tables-plan.md`, `ep010-progression-plan.md`). La note « EP008 doit garder `app_meta` et prévoir les lignes
  météo dans `audit_log` » n'existe que dans le BACKLOG de la branche EP009 (ligne 107) : EP008 ne la connaît pas.
- **`audit_log` (US013)** : `action` limitée par un `CHECK` à `insert, update, delete, restore, sync, migrate, login,
  login-failed, password, disable, enable`. US013 précise : « `edit_log` est recopié dans `audit_log` (`actor_label = 'admin
  (jeton)'`), puis supprimé avec `parking_edits` (US014) ».
- **Migration de données prévue** (`ep010-admin-tables-plan.md` § 6.1, étape 4) : `table_name` vaut `custom_parkings` si la
  cible commence par `custom/`, sinon **`parking_overrides`** ; `action` vaut `delete` pour `remove`, sinon **`insert`**.
  - Une ligne météo (`target 'meteo'`, `action 'meteo-forcee'`) deviendrait donc `parking_overrides / meteo / insert`.
  - Le `CHECK` l'accepte : **aucune erreur, mais une fausse retouche de parking dans le journal**.
- **EP008-US012** remplace la session JWT (`session.ts`) par une table. Les routes météo n'utilisent que `SessionVariables` et
  `c.get('session').sub` : rien à adapter, sauf l'auteur, qui deviendra l'identifiant du compte.
- **EP008-US014** réécrit `parkings.ts` : le filtre ajouté dans `recentLog` disparaît avec lui. `override-store.ts` n'importe
  pas `parkings.ts` : il déclare son propre type de base.

### 3.2 Recommandation : variante A, US012 maintenant avec `edit_log`
| | A : maintenant, `edit_log` | B : après EP008-US013, `audit_log` |
|---|---|---|
| Quand | tout de suite après US004 | après environ 3 à 3,5 j d'EP008, pas commencés |
| Journal | auteur « admin » (jeton partagé) ; motif dans `data.note` | auteur = le compte, état avant / après |
| Travail pour EP008 | 1 branche de `CASE` dans sa migration `0003`, garder `app_meta`, 1 fonction à basculer | aucun |
| Conflits | `app.ts` (3 lignes), `parkings.ts` (1 ligne), `App.tsx` / `Layout.tsx` (1 ligne chacun), `api.ts` (1 ligne) | les mêmes, plus l'écran de connexion refait par EP008 |

### 3.3 Ce qu'il faut donner à EP008 (variante A)
1. **Garder la table `app_meta`** dans `backend/src/db/schema.ts` (clé `meteo.forcage`) : ne pas la supprimer en réécrivant
   le schéma.
2. **Migration `0003`, étape 4** : recopier les lignes météo vers `app_meta`, avec les colonnes d'US013 :
   ```sql
   -- 4. journal ; les lignes de la météo (EP009-US012, cible 'meteo') concernent la ligne 'meteo.forcage' d'app_meta
   INSERT INTO audit_log (table_name, row_id, action, after, source_id, actor_label, at)
     SELECT CASE WHEN l.target = 'meteo' THEN 'app_meta'
                 WHEN l.target LIKE 'custom/%' THEN 'custom_parkings' ELSE 'parking_overrides' END,
            CASE WHEN l.target = 'meteo' THEN 'meteo.forcage'
                 WHEN l.target LIKE 'custom/%' THEN substr(l.target, 8) ELSE l.target END,
            CASE WHEN l.action IN ('remove', 'meteo-reelle') THEN 'delete'
                 WHEN l.action IN ('meteo-forcee', 'meteo-coupee') THEN 'update' ELSE 'insert' END,
            l.data, s.id, 'admin (jeton)', l.at
     FROM edit_log l LEFT JOIN sources s ON s.kind = 'legacy' AND s.label = left(btrim(l.source), 200);
   ```
   - Les lignes météo ont `source` à NULL : pas de source, ce qui est correct (ce n'est pas un contenu éditorial).
   - À ajouter au test PGlite de la migration (`migrateUpTo`) : une ligne `meteo-forcee` et une ligne `meteo-reelle`.
3. **EP008-US013 bascule un seul appel**, `journal()` dans `backend/src/meteo/override-store.ts` :
   ```ts
   export const journal = (db: Db, action: WeatherLogAction, data: unknown, actor: { id: number; login: string }) =>
     db.insert(auditLog).values({
       tableName: 'app_meta', rowId: OVERRIDE_KEY, action: action === 'meteo-reelle' ? 'delete' : 'update',
       before: null, after: action === 'meteo-reelle' ? null : data, actorId: actor.id, actorLabel: actor.login,
     });
   ```
   L'auteur vient de la session (EP008-US012) ; `routes.ts` passe aujourd'hui `c.get('session').sub`.

### 3.4 Fichiers communs avec EP008
| Fichier | US012 | EP008 v2 | Parade |
|---|---|---|---|
| `backend/src/app.ts` | import l. 19-20 ; l. 68 remplacée par 3 lignes ; 1 ligne après `ping` (l. 123) | connexion (l. 107-117), session (l. 104-106, 122), routes parkings (l. 138-170) | lignes d'ancrage stables (`createWeatherService`, `ping`) ; le second à fusionner replace 2 lignes |
| `backend/src/parkings.ts` | `ne` et 1 `where` dans `recentLog` | réécrit (US014) | sans objet après US014 |
| `frontend/admin/src/App.tsx`, `Layout.tsx`, `api.ts`, `styles.css` | 1 import, 1 route, 1 onglet, 1 ligne de champs, 8 lignes de CSS en fin de fichier | nouvelles pages, connexion refaite | conflits de listes, triviaux |
| `backend/src/db/schema.ts`, migrations | **rien** | `0002`, `0003`, `0004` | garder `app_meta` (point 1) |
| `contrat/` | **rien** | `contrat/admin.ts`, nouveaux codes d'erreur | aucun |

---

## 4. Conception

### 4.1 Back
**Stockage (D8, R1).**
- Une ligne d'`app_meta` : clé `meteo.forcage`, valeur JSON au format `weatherOverride` : `mode`, `condition`, `intensity`,
  `windKmh`, `windFromDeg`, `note`, `since`, `until`, `by`.
- Elle est vérifiée à l'écriture (contrat, dans la route) et à la lecture (`parseOverride`).
- `parseOverride` refuse aussi une durée nulle ou de plus de 6 h (règle 13) et une météo forcée sans condition. Une valeur
  hors contrat est ignorée (météo réelle) et signalée par `console.warn`.

**Lecture bornée (R2)**, une par instance de fonction :
| Situation | Relecture de la base |
|---|---|
| aucun forçage connu | au plus toutes les 30 min |
| forçage en cours | toutes les 2 min (une fin anticipée se voit vite) |
| base lente (Neon qui se réveille) | la requête attend 1,5 s au plus depuis le début de la lecture, puis répond avec l'état connu ; la lecture continue |
| base injoignable | état connu gardé, nouvel essai 60 s plus tard |
| écriture depuis l'admin | la mémoire de l'instance qui la reçoit est mise à jour tout de suite |
| écran admin | relit toujours la base (il montre l'état écrit) |
| sans base (build, prévisualisation sans base) | jamais de forçage |

**Un forçage échu est oublié à l'heure dite, sans écriture** : chaque instance compare `until` à son horloge. La météo réelle
revient seule (critère « sans action ni écriture »). La ligne échue reste dans `app_meta` jusqu'au prochain `PUT` ou `DELETE`.

**Cache du CDN, calculé par réponse** : `publicCache(cdnS)` partage `cdnS` secondes entre `s-maxage` et
`stale-while-revalidate`.
| Réponse | `cdnS` | En-tête |
|---|---|---|
| météo réelle, forçage connu | 120 | `public, max-age=0, s-maxage=60, stale-while-revalidate=60` (comme aujourd'hui) |
| météo forcée | `min(120, secondes restantes)` | ex. 90 s restantes : `s-maxage=45, stale-while-revalidate=45` ; sous 2 s : `no-store` |
| base pas encore lue (instance qui démarre, Neon en veille) | 0 | `no-store` : la réponse est juste mais pas mise en cache, la suivante saura |
| 503 (`meteo-desactivee`, `meteo-indisponible`) | — | `no-store` (middleware global, et Vercel ne met pas un 503 en cache) |

Ainsi **le CDN ne sert jamais une météo forcée après sa fin** (à l'horloge près entre le CDN et la fonction). La carte peut
donc relire juste après `forcedUntil` (§ 4.3).

**La source est relue même pendant un forçage**, en parallèle de la base. L'écran admin montre donc le relevé réel pendant une
démo (critère d'acceptation). Cela coûte au plus 4 appels par heure, comme d'habitude.

**Routes admin (R3)** : sous le routeur `admin`, donc administration configurée, écritures de la même origine en JSON,
session.
- `PUT /api/admin/weather/override` : 400 `donnees-invalides` (contrat), 503 `base-indisponible` sans base ou base
  injoignable, sinon 200 `weatherOverride`.
- `DELETE /api/admin/weather/override` : 204, ou 404 `introuvable` si aucun forçage n'est en vigueur. Une ligne échue est alors
  retirée sans journal.
- Une table absente (`42P01`) est laissée à `onError`, qui répond 503 `migrations-manquantes`.

**Journal (R5)** : `edit_log`, `target 'meteo'`, actions `meteo-forcee`, `meteo-coupee`, `meteo-reelle`. `data` contient le
forçage, `source` est NULL. Un seul appel (`journal()`) à basculer après EP008 (§ 3.3). `recentLog` exclut `target = 'meteo'`.

**Auteur (R4)** : `by` = `sub` de la session (`admin`). Le motif ne doit pas contenir de donnée personnelle : l'écran le dit.

### 4.2 Écran « Météo » (admin)
- Onglet « Météo », route `#/meteo`. `GET /api/admin/weather` relu toutes les 60 s quand la page est ouverte
  (`refetchInterval`, mis en pause par TanStack Query si l'onglet est caché). Bouton « Actualiser ».
- **Ce que voient les visiteurs** : pastille Direct (vert), Ancien relevé (rouge, `stale` ou plus d'1 h, même seuil que la
  carte), Forcée (gris), Coupée ou Indisponible (rouge) ; libellé français, température, heure de validité du modèle et âge
  (« jamais observé ») ; intensités ; vent.
- **Relevé brut de la source** : point de grille, altitude, heure de lecture ; table des valeurs d'Open-Meteo avec leurs
  unités. Elle est montrée aussi pendant un forçage.
- **Cette instance de l'API** : démarrage, appels à la source, échecs, dernière erreur, réglages, avec la phrase « Compteurs
  depuis le démarrage de cette instance, ce ne sont pas des totaux. »
- **Forcer la météo** :
  - forçage en cours (texte, bouton « Revenir à la météo réelle ») ;
  - choix Forcer ou Couper ; condition (9 libellés) ; intensité, vent et direction facultatifs (masqués quand on coupe) ;
  - durée de 15 min à 6 h (1 h par défaut) ; motif ;
  - avertissement ; bouton « Forcer pour tous » ou « Couper pour tous » ; lien « Aperçu sur la carte ».
- **Le formulaire est validé par `weatherOverrideInput` avant l'envoi**, comme Parkings : un refus s'affiche en français
  (« condition : condition obligatoire pour une météo forcée »).
- **Aperçu sur la carte** : `/?weather=<condition>&intensity=<x>&wind=<km/h>&windfrom=<°>`, dans un nouvel onglet. `?weather=`
  de la carte et `forcedResponse` du back appliquent les mêmes valeurs types (`WEATHER_PRESETS`) et les mêmes règles : même
  rendu, vu seulement par soi.
- Nombres à la française (« 0,9 », « 39 180 m »). Aucun HTML construit à partir des données.

### 4.3 Carte : fin d'un forçage
```
heure du serveur ─────────── until ─────────────────────────────►
CDN (back, C1)    forcée … (plafond : s-maxage + swr ≤ temps restant)│ jamais au-delà
carte (C3)        forcée … ──── minuterie de fin ─► « en attente » (ciel par défaut, puce masquée)
                                     until + 5 s ─► relecture ─► météo réelle (fondu)
```
- `nextRefresh` relit **5 s après `forcedUntil`** (marge pour l'horloge), au plus tard à la relecture ordinaire, **jamais plus
  d'une fois par 30 s**. Avec une horloge du visiteur en avance de plusieurs minutes, cela fait au plus 2 relectures par minute
  d'avance, servies par le CDN.
- `resolveWeather` : forçage fini → `waiting` (ciel par défaut, puce masquée) au lieu de `unavailable` (« Indisponible »).
- `index.ts` : minuterie à `forcedUntil`. La scène quitte le forçage à l'heure dite, même si le visiteur est inactif (aucune
  relecture après 30 min sans interaction).
- Avec le plafond du CDN (§ 4.1), la relecture de `until + 5 s` reçoit la météo réelle.

### 4.4 Ce qui est indispensable, et ce qui peut être retiré (principes « simplicité » et « modifications chirurgicales »)
Les **critères d'US012** imposent :
- `app_meta` et la lecture bornée ;
- les trois routes, l'écran, le journal hors du journal des parkings ;
- le relevé réel pendant un forçage ;
- la fin sans écriture ;
- 503 sans base.

Le reste, avec ce qu'il coûte de le retirer :
| Élément en plus | Taille | Pourquoi | Si on le retire |
|---|---|---|---|
| Plafond du cache pour une météo forcée (`cdnS`, `publicCache`) | ≈ 10 lignes | la carte peut relire 5 s après la fin (demande du coordinateur) | la carte doit relire à la fin + 2 min 5 s (marge du CDN), et reste en ciel par défaut pendant ces 2 min |
| Pas de cache tant que la base n'a pas été lue (`known`) | 3 lignes | une instance qui démarre pendant que Neon se réveille ne fait pas garder au CDN, 2 min, une réponse qui ignore un forçage ou une coupure | jusqu'à 2 min d'état faux après un démarrage à froid |
| L'écran admin relit toujours la base (`force`) | 1 ligne | l'admin voit l'état écrit, même servi par une autre instance | l'écran peut contredire le forçage jusqu'à 30 min |
| Base injoignable → 503 `base-indisponible` (`dbDown`, `missingTable`) | ≈ 12 lignes | message clair dans l'écran au lieu de « Erreur 500 » | 500 `erreur-interne`, comme les écritures des parkings aujourd'hui ; le critère « 503 sans base » reste tenu |
| `parseOverride` refuse plus de 6 h | 2 lignes | règle 13 : une valeur écrite à la main ne force pas la météo pour des jours | une ligne écrite à la main pourrait durer indéfiniment |
| C4 (relecture toutes les 2 min) | 1 constante | Q1 | une carte déjà ouverte voit un forçage en 17 min au plus |

Les trois premiers servent directement la demande (« fin d'un forçage, en tenant compte des 2 min de cache »). Si l'on veut
réduire, le quatrième est le premier candidat.

### 4.5 Carte : début d'un forçage (Q1, C4 facultatif)
Une carte ouverte voit un nouveau forçage, ou un retour au réel anticipé, à sa prochaine relecture : 15 min aujourd'hui,
2 min avec C4, plus 2 min de CDN au plus. C4 met `REFRESH_MS` à 2 min et ajoute `RETRY_MAX_MS = 15 min` pour garder
l'attente qui s'allonge après une panne (un 503 n'est pas mis en cache, chaque essai réveillerait la fonction). L'avertissement
de l'écran admin est réécrit en conséquence.

---

## 5. Les commits

Branche : `feat/EP009-US012-meteo-admin`, partie de `feat/EP009-meteo` (`8384d0b`, US004 comprise). C3 et C4 modifient le
client de la carte, arrivé avec US004 : vérifié, les 4 patchs s'appliquent en série sur `8384d0b`. Avant la fusion d'US004,
C1 et C2 seuls s'appliquaient sur `29cbd0d` (build et 164 tests).

Messages proposés (commits conventionnels, en français, avec la ligne `Co-Authored-By` demandée) :
- C1 `feat(api): forçage de la météo pour les démos, rangé dans app_meta et lu par la route publique (EP009-US012)`
- C2 `feat(admin): écran « Météo » : ce que voient les visiteurs, relevé brut, forcer ou couper (EP009-US012)`
- C3 `feat(meteo): fin d'un forçage : relue 5 s après, sans « Indisponible » entre les deux (EP009-US012)`
- C4 (si Q1 = oui) `feat(meteo): la carte relit la météo toutes les 2 min (EP009-US012)`
- C5 `docs: itération N (EP009-US012, la météo dans l'administration)`

### C1 — back : forçage, lecture bornée, routes admin, journal
Fichiers : `backend/src/meteo/override-store.ts` (nouveau), `service.ts` et `routes.ts` (réécrits), `normalize.ts`,
`app.ts`, `parkings.ts` (diffs), `forcage.test.ts` (nouveau).

**`backend/src/meteo/override-store.ts` (nouveau)**
```ts
import { eq } from 'drizzle-orm';
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
import { weatherOverride, type WeatherOverride } from '../../../contrat/meteo.js';
import * as schema from '../db/schema.js';
import { appMeta, editLog } from '../db/schema.js';
import type { OverrideStore } from './service.js';

/**
 * Forçage de la météo (EP009-US012) rangé dans la table existante `app_meta` (D8) : clé `meteo.forcage`, valeur JSON. Aucune
 * migration, donc aucun conflit avec celles d'EP008. Vérifié par le contrat à l'écriture (route) et à la lecture (ici) : une
 * valeur écrite à la main hors contrat est ignorée (météo réelle) et signalée dans les journaux.
 */
export const OVERRIDE_KEY = 'meteo.forcage';
/** Règle 13 de l'epic : un forçage dure de 5 min à 6 h ; une valeur en base qui dépasse 6 h est hors contrat */
const MAX_OVERRIDE_MS = 360 * 60_000;

/** Même type que `Db` de parkings.ts, sans en dépendre (EP008-US014 réécrit parkings.ts) */
type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

export type WeatherLogAction = 'meteo-forcee' | 'meteo-coupee' | 'meteo-reelle';

/**
 * Journal des forçages. AUJOURD'HUI `edit_log` (cible `meteo`, exclue du journal des parkings) ; après EP008-US013, ce seul
 * appel passe à `audit_log` (`table_name 'app_meta'`, `row_id 'meteo.forcage'`, action `update` ou `delete`, auteur).
 */
export const journal = (db: Db, action: WeatherLogAction, data: unknown) =>
  db.insert(editLog).values({ target: 'meteo', action, data: data as object, source: null });

/** Le forçage d'une ligne d'`app_meta`, s'il respecte le contrat et la durée maximale ; null sinon */
export function parseOverride(value: string | undefined): WeatherOverride | null {
  if (value === undefined) return null;
  let raw: unknown;
  try { raw = JSON.parse(value); } catch { return null; }
  const o = weatherOverride.safeParse(raw);
  if (!o.success) return null;
  const span = Date.parse(o.data.until) - Date.parse(o.data.since);
  if (!(span > 0 && span <= MAX_OVERRIDE_MS)) return null;
  if (o.data.mode === 'forcee' && !o.data.condition) return null;
  return o.data;
}

export function overrideStore(db: Db): OverrideStore {
  return {
    async read() {
      const [row] = await db.select({ value: appMeta.value }).from(appMeta).where(eq(appMeta.key, OVERRIDE_KEY)).limit(1);
      if (!row) return null;
      const o = parseOverride(row.value);
      if (!o) console.warn('[meteo] forçage hors contrat dans app_meta (écrit à la main ?) : ignoré, météo réelle');
      return o;
    },
    async save(o) {
      const value = JSON.stringify(o);
      await db.insert(appMeta).values({ key: OVERRIDE_KEY, value })
        .onConflictDoUpdate({ target: appMeta.key, set: { value, updatedAt: new Date() } });
      await journal(db, o.mode === 'forcee' ? 'meteo-forcee' : 'meteo-coupee', o);
    },
    async clear(by, nowMs) {
      const [row] = await db.delete(appMeta).where(eq(appMeta.key, OVERRIDE_KEY)).returning({ value: appMeta.value });
      const o = parseOverride(row?.value);
      // Une ligne échue (ou illisible) est retirée sans bruit : pour les visiteurs, rien ne change
      if (!o || Date.parse(o.until) <= nowMs) return false;
      await journal(db, 'meteo-reelle', { by, until: o.until });
      return true;
    },
  };
}
```

**`backend/src/meteo/service.ts` (fichier complet après C1)**
```ts
import {
  WEATHER_MAX_AGE_S, type AdminWeatherResponse, type WeatherOverride, type WeatherOverrideInput, type WeatherResponse,
} from '../../../contrat/meteo.js';
import { fetchOpenMeteo, WEATHER_MODEL, WEATHER_POINT, WeatherUpstreamError, type Fetch, type Upstream } from './open-meteo.js';
import { forcedResponse, normalize } from './normalize.js';

/**
 * Service météo (EP009), un par instance de fonction (créé par `createApp`) ; rien n'est appelé au chargement du module.
 * - Relevé gardé en mémoire jusqu'au pas de 15 min suivant de la source, une seule requête à la source en vol : 100 visiteurs
 *   en même temps font 1 appel, aucun visiteur n'en fait aucun (relevé à la demande, D10) ; au plus 4 appels par heure.
 * - Après un échec, pas de nouvel essai avant 60 s (10 min après un refus 429 : la source limite les appels par adresse IP).
 * - Repli : le dernier bon relevé, avec `stale: true`, tant que son pas de 15 min a moins de 3 h ; ensuite indisponible.
 * - Forçage de l'administration (US012, rangé dans `app_meta`) : relu en base au plus toutes les 30 min sans forçage connu,
 *   toutes les 2 min pendant un forçage, jamais plus de 1,5 s d'attente pour une requête ; l'écriture depuis l'administration
 *   met aussi à jour cette instance. Un forçage échu est oublié à l'heure dite, sans écriture : la météo réelle revient seule.
 */
/** La source publie le pas suivant dès son heure de début (constaté le 09/10/2026) : marge avant de la rappeler */
export const STEP_MARGIN_MS = 30_000;
/** Jamais deux appels à la source à moins de 60 s, même si elle tarde à publier le pas suivant */
export const MIN_GAP_MS = 60_000;
/** Un relevé n'est jamais gardé plus de 15 min (pas d'une heure d'un autre modèle) */
export const MAX_FRESH_MS = 15 * 60_000;
export const RETRY_MS = 60_000;
export const RATE_LIMITED_RETRY_MS = 10 * 60_000;
/** Durée de mise en cache par le CDN de Vercel (`s-maxage`), puis autant de `stale-while-revalidate` */
export const CDN_MAX_AGE_S = 60;
/** Forçage relu en base : sans forçage connu, puis pendant un forçage (R2 d'US012 : réveils de Neon bornés) */
export const OVERRIDE_IDLE_MS = 30 * 60_000;
export const OVERRIDE_ACTIVE_MS = 2 * 60_000;
/** Attente maximale de la base pour une requête (Neon en veille) ; au-delà, l'état connu, la lecture continue */
export const OVERRIDE_READ_TIMEOUT_MS = 1500;
/** Base injoignable : nouvel essai de lecture du forçage */
export const OVERRIDE_RETRY_MS = 60_000;

/** Accès au forçage en base (`override-store.ts`) */
export interface OverrideStore {
  read(): Promise<WeatherOverride | null>;
  /** Enregistre (ou remplace) le forçage, avec sa ligne de journal */
  save(o: WeatherOverride): Promise<void>;
  /** Retire le forçage ; vrai s'il était encore en vigueur à `nowMs` (et alors journalisé) */
  clear(by: string, nowMs: number): Promise<boolean>;
}

export interface WeatherDeps {
  /** Accès à la source (tests et contrôle du build : source simulée, sans réseau) */
  fetch?: Fetch;
  /** Horloge en millisecondes ; par défaut l'heure réelle */
  now?: () => number;
  /** Forçage en base ; null ou absent sans base (contrôle du build, prévisualisation sans base) : jamais de forçage */
  overrides?: () => OverrideStore | null;
  /** Tests : attente maximale de la base (par défaut OVERRIDE_READ_TIMEOUT_MS) */
  overrideTimeoutMs?: number;
}

/**
 * `cdnS` : durée de vie de la réponse dans le CDN, en secondes (s-maxage + stale-while-revalidate, `publicCache` de routes.ts) ;
 * 0 : ne pas la mettre en cache.
 */
export type WeatherResult = { ok: true; body: WeatherResponse; cdnS: number } | { ok: false; code: 'meteo-indisponible' | 'meteo-desactivee' };

interface Reading { upstream: Upstream; fetchedAtMs: number }

/** Jusqu'à quand un relevé sert : début du pas suivant de la source (+ marge), au plus 15 min, au moins 60 s */
function freshUntil(r: Reading): number {
  const nextStepMs = (r.upstream.current.time + r.upstream.current.interval) * 1000 + STEP_MARGIN_MS;
  return Math.max(r.fetchedAtMs + MIN_GAP_MS, Math.min(nextStepMs, r.fetchedAtMs + MAX_FRESH_MS));
}

const inForce = (o: WeatherOverride | null, t: number): o is WeatherOverride => !!o && Date.parse(o.until) > t;

/** Attend `p`, au plus `ms` */
function within(p: Promise<void>, ms: number): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    void p.finally(() => { clearTimeout(timer); resolve(); });
  });
}

export function createWeatherService(deps: WeatherDeps = {}) {
  const fetchImpl: Fetch = deps.fetch ?? ((url, init) => fetch(url, init));
  const now = deps.now ?? Date.now;
  const overrideTimeoutMs = deps.overrideTimeoutMs ?? OVERRIDE_READ_TIMEOUT_MS;
  /** Compteurs de cette instance (écran admin) : perdus au redémarrage, ce ne sont pas des totaux */
  const stats = { startedAt: now(), upstreamCalls: 0, upstreamFailures: 0, lastError: null as string | null, lastErrorAt: null as number | null };
  let last: Reading | null = null;
  let retryAt = -Infinity;
  let inflight: Promise<void> | null = null;
  /** Dernier forçage lu ou écrit par cette instance ; `known` : au moins une lecture réussie (sinon l'état est incertain) */
  let override: WeatherOverride | null = null;
  let known = false;
  let checkAt = -Infinity;
  let reading: { promise: Promise<void>; startedAt: number } | null = null;

  async function refresh() {
    stats.upstreamCalls++;
    try {
      last = { upstream: await fetchOpenMeteo(fetchImpl, now()), fetchedAtMs: now() };
    } catch (err) {
      const limited = err instanceof WeatherUpstreamError && err.kind === 'http-429';
      retryAt = now() + (limited ? RATE_LIMITED_RETRY_MS : RETRY_MS);
      stats.upstreamFailures++;
      stats.lastError = err instanceof WeatherUpstreamError ? err.message : String(err);
      stats.lastErrorAt = now();
      // Aucune donnée du visiteur ici : la requête vers la source n'en contient pas
      console.warn('[meteo] source indisponible :', stats.lastError);
    }
  }

  /** Relit la source quand son pas suivant a commencé, sauf échec récent ; requête partagée par les visiteurs */
  async function ensureFresh() {
    const t = now();
    if (last && t < freshUntil(last)) return;
    if (t < retryAt) return;
    inflight ??= refresh().finally(() => { inflight = null; });
    await inflight;
  }

  /**
   * Relit le forçage en base s'il est temps (ou toujours, `force`, pour l'écran admin). Une seule lecture en vol ; la requête
   * l'attend au plus `overrideTimeoutMs` depuis son début (Neon qui se réveille), puis répond avec l'état connu.
   */
  async function readOverride(force: boolean) {
    const store = deps.overrides?.() ?? null;
    if (!store) { override = null; known = true; return; } // sans base, jamais de forçage
    if (!reading && (force || now() >= checkAt)) {
      const startedAt = now();
      const promise = store.read().then(
        (o) => { override = o; known = true; checkAt = now() + (inForce(o, now()) ? OVERRIDE_ACTIVE_MS : OVERRIDE_IDLE_MS); },
        (err) => { checkAt = now() + OVERRIDE_RETRY_MS; console.warn('[meteo] forçage illisible (base injoignable ?) :', String(err)); },
      ).finally(() => { reading = null; });
      reading = { promise, startedAt };
    }
    if (reading) {
      const left = reading.startedAt + overrideTimeoutMs - now();
      if (left > 0) await within(reading.promise, left);
    }
  }

  /** Forçage en vigueur (un forçage échu est oublié à l'heure dite) */
  const active = () => (inForce(override, now()) ? override : null);

  async function current(force = false): Promise<WeatherResult> {
    // En parallèle : la base (forçage) et la source (relevé réel, que l'écran admin montre aussi pendant un forçage)
    await Promise.all([readOverride(force), ensureFresh()]);
    const t = now();
    const o = active();
    if (o?.mode === 'coupee') return { ok: false, code: 'meteo-desactivee' };
    if (o?.mode === 'forcee' && o.condition) {
      // Jamais servie par le CDN après sa fin : s-maxage + stale-while-revalidate tiennent dans le temps restant
      const leftS = Math.floor((Date.parse(o.until) - t) / 1000);
      return { ok: true, body: forcedResponse({ ...o, condition: o.condition }), cdnS: Math.min(2 * CDN_MAX_AGE_S, leftS) };
    }
    if (!last || t / 1000 - last.upstream.current.time > WEATHER_MAX_AGE_S) return { ok: false, code: 'meteo-indisponible' };
    // Encore périmé après `ensureFresh` : la source n'a pas répondu, on sert le dernier bon relevé. Forçage pas encore lu
    // (base qui se réveille) : réponse juste, mais pas mise en cache ; la suivante saura
    return { ok: true, body: { ...normalize(last.upstream, last.fetchedAtMs), stale: t >= freshUntil(last) }, cdnS: known ? 2 * CDN_MAX_AGE_S : 0 };
  }

  const iso = (ms: number) => new Date(ms).toISOString();

  return {
    /** La météo à servir aux visiteurs, ou pourquoi il n'y en a pas */
    current: () => current(),

    /** Forcer ou couper la météo (route admin) : écrit en base, puis cette instance le sait tout de suite */
    async setOverride(input: WeatherOverrideInput, by: string, store: OverrideStore): Promise<WeatherOverride> {
      const t = now();
      const o: WeatherOverride = {
        mode: input.mode,
        ...(input.mode === 'forcee' ? { condition: input.condition } : {}),
        ...(input.mode === 'forcee' && input.intensity !== undefined ? { intensity: input.intensity } : {}),
        ...(input.mode === 'forcee' && input.windKmh !== undefined ? { windKmh: input.windKmh } : {}),
        ...(input.mode === 'forcee' && input.windFromDeg !== undefined ? { windFromDeg: input.windFromDeg } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
        since: iso(t),
        until: iso(t + input.minutes * 60_000),
        by,
      };
      await store.save(o);
      override = o;
      known = true;
      checkAt = now() + OVERRIDE_ACTIVE_MS;
      return o;
    },

    /** Revenir à la météo réelle (route admin) ; faux s'il n'y avait pas de forçage en vigueur */
    async clearOverride(by: string, store: OverrideStore): Promise<boolean> {
      const was = await store.clear(by, now());
      override = null;
      known = true;
      checkAt = now() + OVERRIDE_IDLE_MS;
      return was;
    },

    /** Écran « Météo » : la base est relue à chaque fois (l'admin voit l'état écrit, pas celui de cette instance) */
    async adminView(): Promise<AdminWeatherResponse> {
      const r = await current(true);
      return {
        public: r.ok ? r.body : null,
        publicCode: r.ok ? null : r.code,
        upstream: last && {
          model: WEATHER_MODEL,
          fetchedAt: iso(last.fetchedAtMs),
          observedAt: iso(last.upstream.current.time * 1000),
          grid: { lat: last.upstream.latitude, lon: last.upstream.longitude, elevationM: last.upstream.elevation ?? null },
          raw: Object.fromEntries(Object.entries(last.upstream.current).map(([k, v]) => [k, v ?? null])),
        },
        override: active(),
        instance: {
          startedAt: iso(stats.startedAt), upstreamCalls: stats.upstreamCalls, upstreamFailures: stats.upstreamFailures,
          lastError: stats.lastError, lastErrorAt: stats.lastErrorAt === null ? null : iso(stats.lastErrorAt),
        },
        config: { lat: WEATHER_POINT.lat, lon: WEATHER_POINT.lon, model: WEATHER_MODEL, freshS: MAX_FRESH_MS / 1000, cdnMaxAgeS: CDN_MAX_AGE_S },
      };
    },
  };
}
export type WeatherService = ReturnType<typeof createWeatherService>;
```

**`backend/src/meteo/routes.ts` (fichier complet après C1)**
```ts
import { Hono, type Context } from 'hono';
import { weatherOverrideInput, type AdminWeatherResponse, type WeatherOverride, type WeatherResponse } from '../../../contrat/meteo.js';
import { errorBody } from '../errors.js';
import type { SessionVariables } from '../session.js';
import { CDN_MAX_AGE_S, type OverrideStore, type WeatherService } from './service.js';

/**
 * En-tête de cache d'une réponse 200 : `cdnS` secondes de vie dans le CDN de Vercel, moitié `s-maxage`, moitié
 * `stale-while-revalidate` ; d'ordinaire 120 s (60 + 60 : un changement est vu par tous en 2 min au plus), moins pour une
 * météo forcée qui finit avant (le CDN ne la sert jamais après sa fin), 0 tant que le forçage n'a pas pu être lu. Le
 * navigateur ne reçoit que `public, max-age=0` (Vercel retire les deux autres). Pas de `stale-if-error` : le CDN servirait
 * l'ancienne météo à la place d'un 503 voulu (météo coupée depuis l'administration).
 */
export function publicCache(cdnS: number): string {
  if (cdnS < 2) return 'no-store';
  return `public, max-age=0, s-maxage=${Math.ceil(cdnS / 2)}, stale-while-revalidate=${Math.floor(cdnS / 2)}`;
}
export const PUBLIC_CACHE = publicCache(2 * CDN_MAX_AGE_S);

/** GET /api/weather : publique ; les paramètres de la requête sont ignorés (coordonnées fixes, aucune donnée du visiteur) */
export function weatherRoutes(service: WeatherService) {
  const r = new Hono();
  r.get('/', async (c) => {
    const result = await service.current();
    // Pas d'en-tête de cache sur une erreur : le middleware global pose `no-store`
    if (!result.ok) {
      return c.json(errorBody(result.code === 'meteo-desactivee' ? 'météo coupée par l’administration' : 'météo indisponible', result.code), 503);
    }
    c.header('Cache-Control', publicCache(result.cdnS));
    return c.json(result.body satisfies WeatherResponse);
  });
  return r;
}

/** Table absente (code PostgreSQL 42P01, même s'il est enveloppé par Drizzle) : laissée à `onError` (« migrations-manquantes ») */
function missingTable(err: unknown): boolean {
  for (let e: unknown = err, i = 0; e && i < 4; e = (e as { cause?: unknown }).cause, i++) {
    if ((e as { code?: unknown }).code === '42P01') return true;
  }
  return false;
}

/** Base absente ou injoignable : 503 « base-indisponible », comme les autres écritures de l'administration */
function dbDown(c: Context, err?: unknown) {
  if (err !== undefined) {
    if (missingTable(err)) throw err;
    console.error('[meteo] écriture du forçage impossible :', err);
  }
  return c.json(errorBody('base indisponible', 'base-indisponible'), 503);
}

/**
 * /api/admin/weather (EP009-US012), montées sous le routeur admin : session exigée, écritures de la même origine en JSON.
 * GET : ce que voient les visiteurs, le relevé brut, le forçage, l'état de cette instance ; PUT /override : forcer ou couper
 * la météo pour une durée limitée ; DELETE /override : revenir à la météo réelle.
 */
export function weatherAdminRoutes(service: WeatherService, store: () => OverrideStore | null) {
  const r = new Hono<{ Variables: SessionVariables }>();
  r.get('/', async (c) => c.json((await service.adminView()) satisfies AdminWeatherResponse));
  r.put('/override', async (c) => {
    const body = weatherOverrideInput.safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json(errorBody('données invalides', 'donnees-invalides', body.error.issues), 400);
    const s = store();
    if (!s) return dbDown(c);
    try {
      return c.json((await service.setOverride(body.data, c.get('session').sub, s)) satisfies WeatherOverride);
    } catch (err) {
      return dbDown(c, err);
    }
  });
  r.delete('/override', async (c) => {
    const s = store();
    if (!s) return dbDown(c);
    let removed: boolean;
    try {
      removed = await service.clearOverride(c.get('session').sub, s);
    } catch (err) {
      return dbDown(c, err);
    }
    if (!removed) return c.json(errorBody('aucun forçage en cours', 'introuvable'), 404);
    return c.body(null, 204);
  });
  return r;
}
```

**`backend/src/meteo/normalize.ts`, `backend/src/app.ts`, `backend/src/parkings.ts` (diffs sur le code d'aujourd'hui)**
```diff
diff --git a/backend/src/app.ts b/backend/src/app.ts
index 71db90b..fbd1984 100644
--- a/backend/src/app.ts
+++ b/backend/src/app.ts
@@ -16,7 +16,8 @@ import type { AdminStatusResponse, DbStatus, HealthResponse } from '../../contra
 import { loginRequest, type SessionInfo } from '../../contrat/session.js';
 import { addParking, listEdits, recentLog, removeEdit, saveOverride, type Db } from './parkings.js';
 import { createWeatherService, type WeatherDeps } from './meteo/service.js';
-import { weatherRoutes } from './meteo/routes.js';
+import { weatherAdminRoutes, weatherRoutes } from './meteo/routes.js';
+import { overrideStore } from './meteo/override-store.js';
 
 // Messages de validation en français : ils remontent jusqu'à l'administration (« source : Trop petit : … »)
 z.config(fr());
@@ -65,7 +66,9 @@ export interface AppDeps {
 export function createApp(env: Env = process.env, deps: AppDeps = {}) {
   const app = new Hono().basePath('/api');
   const getDb = deps.db ?? (() => { const c = database(env); return c.ok ? (c.db as unknown as Db) : null; });
-  const weather = createWeatherService({ fetch: deps.weather?.fetch, now: deps.now });
+  /** Forçage de la météo (EP009-US012) : rangé dans la base quand elle existe ; sans base, jamais de forçage */
+  const weatherStore = () => { const db = getDb(); return db ? overrideStore(db) : null; };
+  const weather = createWeatherService({ fetch: deps.weather?.fetch, now: deps.now, overrides: weatherStore });
 
   app.use('*', async (c, next) => {
     await next();
@@ -121,6 +124,7 @@ export function createApp(env: Env = process.env, deps: AppDeps = {}) {
   });
   admin.get('/session', (c) => c.json(c.get('session') satisfies SessionInfo));
   admin.get('/ping', (c) => c.json({ ok: true }));
+  admin.route('/weather', weatherAdminRoutes(weather, weatherStore)); // EP009-US012 : état, forçage pour les démos, coupure
   admin.get('/status', async (c) => {
     const base = { version: appVersion(env), env: appEnv(env), node: process.version, region: env.VERCEL_REGION ?? null };
     const target = resolveDatabase(env);
diff --git a/backend/src/meteo/normalize.ts b/backend/src/meteo/normalize.ts
index 3dd6958..a6575fa 100644
--- a/backend/src/meteo/normalize.ts
+++ b/backend/src/meteo/normalize.ts
@@ -1,4 +1,4 @@
-import type { WeatherAttribution, WeatherCondition, WeatherResponse } from '../../../contrat/meteo.js';
+import { WEATHER_PRESETS, type WeatherAttribution, type WeatherCondition, type WeatherOverride, type WeatherResponse } from '../../../contrat/meteo.js';
 import { WEATHER_MODEL, type Upstream } from './open-meteo.js';
 
 /**
@@ -34,6 +34,9 @@ const round = (x: number, d = 2) => Math.round(x * 10 ** d) / 10 ** d;
 export const intensity = (mmH: number, full: number) => clamp01(Math.log1p(Math.max(0, mmH)) / Math.log1p(full));
 /** 1 à 200 m ou moins, 0,5 à 1 000 m (définition du brouillard), 0 à 5 km ou plus */
 export const fogFromVisibility = (m: number) => clamp01(Math.log(FOG_CLEAR_M / Math.max(1, m)) / Math.log(FOG_CLEAR_M / FOG_FULL_M));
+/** Réciproques (météo forcée : des mm/h et une visibilité cohérents avec les intensités choisies) */
+const mmHForIntensity = (i: number, full: number) => Math.expm1(clamp01(i) * Math.log1p(full));
+const visibilityForFog = (f: number) => Math.round(FOG_CLEAR_M / (FOG_CLEAR_M / FOG_FULL_M) ** clamp01(f));
 
 /** Les 29 codes WMO documentés par Open-Meteo (page lue le 09/10/2026) ; un code absent n'a pas de condition */
 const WMO: Record<number, WeatherCondition> = {
@@ -101,3 +104,39 @@ export function normalize(u: Upstream, fetchedAtMs: number): WeatherResponse {
     attribution: ATTRIBUTION,
   };
 }
+
+/**
+ * Météo forcée depuis l'administration (US012) : les valeurs types du contrat (`WEATHER_PRESETS`) avec les MÊMES règles que
+ * `presetLook` de la carte (`?weather=`), donc le même rendu ; `intensity` remplace l'intensité principale (pluie seule, neige
+ * seule ou brouillard ; ignorée pour « pluie et neige » et le ciel sec) ; vent par défaut 10 km/h d'ouest. Rien d'inventé
+ * (règle 1) : ni température, ni modèle, ni crédit de la source.
+ */
+export function forcedResponse(o: WeatherOverride & { condition: WeatherCondition }): WeatherResponse {
+  const p = WEATHER_PRESETS[o.condition];
+  const rain = p.rainIntensity > 0 && p.snowIntensity === 0 ? (o.intensity ?? p.rainIntensity) : p.rainIntensity;
+  const snow = p.snowIntensity > 0 && p.rainIntensity === 0 ? (o.intensity ?? p.snowIntensity) : p.snowIntensity;
+  const fog = p.fog > 0 ? (o.intensity ?? p.fog) : 0;
+  return {
+    v: 1,
+    source: 'admin',
+    model: null,
+    observedAt: o.since,
+    fetchedAt: o.since,
+    stale: false,
+    forced: true,
+    forcedUntil: o.until,
+    condition: o.condition,
+    temperatureC: null,
+    cloudCover: p.cloudCover,
+    precipMmH: round(mmHForIntensity(rain, RAIN_FULL_MMH) + mmHForIntensity(snow, SNOW_FULL_MMH)),
+    rainIntensity: round(rain),
+    snowIntensity: round(snow),
+    windKmh: o.windKmh ?? 10,
+    windGustKmh: null,
+    windFromDeg: o.windFromDeg ?? 270,
+    visibilityM: fog > 0 ? visibilityForFog(fog) : null,
+    fog: round(fog),
+    thunder: p.thunder,
+    attribution: null,
+  };
+}
diff --git a/backend/src/parkings.ts b/backend/src/parkings.ts
index 686cb59..d5a7b1a 100644
--- a/backend/src/parkings.ts
+++ b/backend/src/parkings.ts
@@ -1,4 +1,4 @@
-import { asc, desc, eq } from 'drizzle-orm';
+import { asc, desc, eq, ne } from 'drizzle-orm';
 import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core';
 import { publishedAdded, publishedOverride, type AddedInput, type OverrideInput, type PublishedEdits } from '../../contrat/parkings.js';
 import * as schema from './db/schema.js';
@@ -60,5 +60,6 @@ export async function removeEdit(db: Db, id: string): Promise<boolean> {
 }
 
 export async function recentLog(db: Db, limit = 30) {
-  return db.select().from(editLog).orderBy(desc(editLog.at), desc(editLog.id)).limit(limit);
+  // Le journal des forçages de la météo (EP009-US012, cible `meteo`) n'est pas une retouche de parking
+  return db.select().from(editLog).where(ne(editLog.target, 'meteo')).orderBy(desc(editLog.at), desc(editLog.id)).limit(limit);
 }
```

**`backend/src/meteo/forcage.test.ts` (nouveau, 20 tests)** : valeurs types, en-tête du CDN, lecture bornée (fausse base :
lente, en panne, absente), routes avec session et base PGlite (401, 400, forçage vu ici et par une autre instance, propagation
en 30 min au plus vers une instance chaude, fin sans écriture, coupure, retour au réel, ligne échue, écran admin, valeur
illisible, sans base, base fermée).
```ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { eq } from 'drizzle-orm';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import * as schema from '../db/schema.js';
import type { Db } from '../parkings.js';
import { apiError } from '../../../contrat/erreurs.js';
import {
  WEATHER_PRESETS, adminWeatherResponse, weatherOverride, weatherResponse, type WeatherCondition, type WeatherOverride,
} from '../../../contrat/meteo.js';
import { forcedResponse } from './normalize.js';
import { OVERRIDE_KEY, parseOverride } from './override-store.js';
import { publicCache } from './routes.js';
import { createWeatherService, type OverrideStore } from './service.js';
import type { Upstream } from './open-meteo.js';

/** Météo forcée depuis l'administration (EP009-US012) : valeurs types, lecture bornée, routes admin, journal */
const json = (res: Response): Promise<any> => res.json();
const T0 = Date.UTC(2026, 9, 9, 10, 5, 0); // 10 h 05 UTC
const MIN = 60_000;
const iso = (ms: number) => new Date(ms).toISOString();

function upstream(step: number): Upstream {
  return {
    latitude: 45.56, longitude: 5.9199996, elevation: 286,
    current: {
      time: step, interval: 900, temperature_2m: 12.8, weather_code: 2, cloud_cover: 71, precipitation: 0, snowfall: 0,
      wind_speed_10m: 14.1, wind_direction_10m: 257, wind_gusts_10m: 29.9, visibility: 33040, lightning_potential: 0,
    },
  };
}
/** Fausse source, avec sa propre horloge (le relevé suit le pas de 15 min en cours) */
function fakeSource() {
  const s = { calls: 0, clock: T0, fetch: async () => { s.calls++; return Response.json(upstream(Math.floor(s.clock / 900_000) * 900)); } };
  return s;
}
const forced = (o: Partial<WeatherOverride> = {}): WeatherOverride =>
  ({ mode: 'forcee', condition: 'snow', since: iso(T0), until: iso(T0 + 30 * MIN), by: 'admin', ...o });

describe('météo forcée : valeurs types, mêmes règles que ?weather= sur la carte', () => {
  it('chaque condition : valeurs du contrat, ni température, ni modèle, ni crédit, fin du forçage', () => {
    for (const c of Object.keys(WEATHER_PRESETS) as WeatherCondition[]) {
      const p = WEATHER_PRESETS[c];
      const r = weatherResponse.parse(forcedResponse({ ...forced(), condition: c }));
      expect(r, c).toMatchObject({
        source: 'admin', model: null, forced: true, forcedUntil: iso(T0 + 30 * MIN), observedAt: iso(T0), stale: false,
        condition: c, temperatureC: null, attribution: null, cloudCover: p.cloudCover, rainIntensity: p.rainIntensity,
        snowIntensity: p.snowIntensity, fog: p.fog, thunder: p.thunder, windKmh: 10, windFromDeg: 270,
      });
    }
  });

  it('l’intensité remplace l’effet principal (pluie, neige, brouillard), pas « pluie et neige » ni le ciel sec ; vent choisi', () => {
    expect(forcedResponse({ ...forced({ condition: 'rain', intensity: 0.9 }), condition: 'rain' }).rainIntensity).toBe(0.9);
    expect(forcedResponse({ ...forced({ intensity: 0.9 }), condition: 'snow' }).snowIntensity).toBe(0.9);
    const fog = forcedResponse({ ...forced({ condition: 'fog', intensity: 1 }), condition: 'fog' });
    expect(fog).toMatchObject({ fog: 1, visibilityM: 200 });
    expect(forcedResponse({ ...forced({ condition: 'sleet', intensity: 0.9 }), condition: 'sleet' })).toMatchObject({ rainIntensity: 0.3, snowIntensity: 0.3 });
    expect(forcedResponse({ ...forced({ condition: 'clear', intensity: 0.9 }), condition: 'clear' })).toMatchObject({ rainIntensity: 0, fog: 0, visibilityM: null });
    expect(forcedResponse({ ...forced({ windKmh: 40, windFromDeg: 180 }), condition: 'snow' })).toMatchObject({ windKmh: 40, windFromDeg: 180 });
  });

  it('une valeur hors contrat en base est ignorée : condition inconnue, sans condition, plus de 6 h, JSON illisible', () => {
    expect(parseOverride(JSON.stringify(forced()))).toMatchObject({ condition: 'snow' });
    expect(parseOverride(JSON.stringify({ ...forced(), condition: 'tornade' }))).toBeNull();
    expect(parseOverride(JSON.stringify({ ...forced(), condition: undefined }))).toBeNull();
    expect(parseOverride(JSON.stringify(forced({ until: iso(T0 + 7 * 60 * MIN) })))).toBeNull();
    expect(parseOverride(JSON.stringify(forced({ until: iso(T0 - MIN) })))).toBeNull();
    expect(parseOverride('{pas du JSON')).toBeNull();
  });

  it('en-tête du CDN : 60 + 60 s d’ordinaire ; moins quand le forçage finit avant ; rien sous 2 s', () => {
    expect(publicCache(120)).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    expect(publicCache(90)).toBe('public, max-age=0, s-maxage=45, stale-while-revalidate=45');
    expect(publicCache(3)).toBe('public, max-age=0, s-maxage=2, stale-while-revalidate=1');
    expect(publicCache(1)).toBe('no-store');
    expect(publicCache(0)).toBe('no-store');
  });
});

describe('lecture du forçage par la route publique : bornée (réveils de Neon)', () => {
  /** Fausse base : compte les lectures, rend ce qu'on lui dit, ou attend, ou échoue */
  function fakeStore(value: () => WeatherOverride | null) {
    const s = {
      reads: 0, mode: 'ok' as 'ok' | 'hang' | 'fail', release: () => {},
      store: {
        read: async () => {
          s.reads++;
          if (s.mode === 'fail') throw new Error('connexion refusée');
          if (s.mode === 'hang') await new Promise<void>((r) => { s.release = r; });
          return value();
        },
        save: async () => {}, clear: async () => false,
      } satisfies OverrideStore,
    };
    return s;
  }

  it('sans forçage : au plus une lecture toutes les 30 min ; pendant un forçage : toutes les 2 min', async () => {
    const src = fakeSource();
    let value: WeatherOverride | null = null;
    const db = fakeStore(() => value);
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    for (let i = 0; i < 100; i++) { src.clock = T0 + i * 17_000; await w.current(); } // 100 visites en 28 min
    expect(db.reads).toBe(1);
    src.clock = T0 + 30 * MIN;
    value = forced({ since: iso(src.clock), until: iso(src.clock + 30 * MIN) });
    expect((await w.current()).ok && db.reads).toBe(2);
    src.clock += 119_000;
    await w.current();
    expect(db.reads).toBe(2);
    src.clock += 1_000;
    await w.current();
    expect(db.reads).toBe(3);
  });

  it('forçage échu : météo réelle à l’heure dite, sans attendre la base ni écrire', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced());
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: true } });
    src.clock = T0 + 30 * MIN;
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: false, source: 'open-meteo' } });
  });

  it('le CDN ne garde jamais une météo forcée après sa fin', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced({ until: iso(T0 + 90_000) }));
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 90 });
    src.clock = T0 + 89_000;
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 1 });
  });

  it('base lente (Neon en veille) : la requête attend au plus le délai, sert la météo réelle sans cache, puis la suivante sait', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced());
    db.mode = 'hang';
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store, overrideTimeoutMs: 50 });
    const t = performance.now();
    const first = await w.current();
    expect(performance.now() - t).toBeLessThan(1000);
    expect(first).toMatchObject({ ok: true, cdnS: 0, body: { forced: false } }); // juste, mais pas mis en cache
    const second = await w.current(); // la lecture est toujours en cours : pas d'attente de plus
    expect(second).toMatchObject({ ok: true, cdnS: 0 });
    expect(db.reads).toBe(1);
    db.release();
    await new Promise((r) => setTimeout(r, 0));
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: true, condition: 'snow' } });
  });

  it('base injoignable : météo réelle sans cache, nouvel essai 60 s plus tard', async () => {
    const src = fakeSource();
    const db = fakeStore(() => forced());
    db.mode = 'fail';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => db.store });
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 0, body: { forced: false } });
    src.clock += 59_000;
    await w.current();
    expect(db.reads).toBe(1);
    db.mode = 'ok';
    src.clock += 1_000;
    expect(await w.current()).toMatchObject({ ok: true, body: { forced: true } });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('sans base (contrôle du build, prévisualisation sans base) : jamais de forçage, réponse mise en cache', async () => {
    const src = fakeSource();
    const w = createWeatherService({ fetch: src.fetch, now: () => src.clock, overrides: () => null });
    expect(await w.current()).toMatchObject({ ok: true, cdnS: 120, body: { forced: false } });
  });
});

describe('forçage depuis l’administration (routes, session, base PGlite)', () => {
  const TOKEN = 'jeton-de-test-meteo-0123456789';
  const ORIGIN = 'http://localhost';
  let client: PGlite;
  let db: Db;
  beforeEach(async () => {
    client = new PGlite();
    const d = drizzle(client, { schema });
    await migrate(d, { migrationsFolder: fileURLToPath(new URL('../db/migrations', import.meta.url)) });
    db = d as unknown as Db;
  });
  afterEach(async () => { if (!client.closed) await client.close(); });

  /** Une instance de l'API (même base) ; `clock` partagée par la fausse source et la session */
  function instance(src = fakeSource(), base: () => Db | null = () => db) {
    const app = createApp({ ADMIN_TOKEN: TOKEN }, { db: base, now: () => src.clock, weather: { fetch: src.fetch } });
    let cookie = '';
    const login = async () => {
      const res = await app.request('/api/admin/login', { method: 'POST', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ token: TOKEN }) });
      cookie = res.headers.getSetCookie().find((c) => c.startsWith('diorama_admin='))!.split(';')[0];
    };
    const send = (method: string, path: string, body?: unknown) =>
      app.request(path, { method, headers: { cookie, origin: ORIGIN, 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { src, app, login, send, pub: () => app.request('/api/weather') };
  }
  const meteoLog = () => db.select().from(schema.editLog).where(eq(schema.editLog.target, 'meteo'));

  it('sans session : 401 sur la lecture, le forçage et le retour au réel', async () => {
    const { app } = instance();
    expect((await app.request('/api/admin/weather')).status).toBe(401);
    const put = await app.request('/api/admin/weather/override', { method: 'PUT', headers: { origin: ORIGIN, 'content-type': 'application/json' }, body: JSON.stringify({ mode: 'coupee', minutes: 60 }) });
    expect(put.status).toBe(401);
    expect((await app.request('/api/admin/weather/override', { method: 'DELETE', headers: { origin: ORIGIN } })).status).toBe(401);
  });

  it('400 : condition absente pour « forcee », durée hors de 5 à 360 min, condition inconnue, champ inconnu', async () => {
    const a = instance();
    await a.login();
    for (const body of [{ mode: 'forcee', minutes: 60 }, { mode: 'forcee', condition: 'snow', minutes: 2 }, { mode: 'forcee', condition: 'snow', minutes: 361 },
      { mode: 'forcee', condition: 'grele', minutes: 60 }, { mode: 'forcee', condition: 'snow', minutes: 60, lat: 48.8 }, null]) {
      const res = await a.send('PUT', '/api/admin/weather/override', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(apiError.parse(await json(res)).code).toBe('donnees-invalides');
    }
  });

  it('forcer la neige : vue tout de suite ici, à froid par une autre instance, journalisée hors du journal des parkings', async () => {
    const a = instance();
    await a.login();
    const put = await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'snow', intensity: 0.9, minutes: 30, note: 'démo avec les amis' });
    expect(put.status).toBe(200);
    expect(weatherOverride.parse(await json(put))).toMatchObject({ mode: 'forcee', condition: 'snow', intensity: 0.9, by: 'admin', since: iso(T0), until: iso(T0 + 30 * MIN), note: 'démo avec les amis' });
    const pub = await a.pub();
    expect(pub.headers.get('cache-control')).toBe('public, max-age=0, s-maxage=60, stale-while-revalidate=60');
    expect(weatherResponse.parse(await json(pub))).toMatchObject({ forced: true, source: 'admin', condition: 'snow', snowIntensity: 0.9, temperatureC: null, attribution: null });
    // Une instance qui démarre lit la base tout de suite
    expect((await json(await instance(a.src).pub())).condition).toBe('snow');
    expect((await meteoLog()).map((l) => l.action)).toEqual(['meteo-forcee']);
    const parkings = await json(await a.send('GET', '/api/admin/parkings/edits'));
    expect(parkings.log).toEqual([]);
  });

  it('une autre instance déjà chaude le voit au plus 30 min après ; la fin revient seule, sans écriture', async () => {
    const a = instance();
    const b = instance(a.src); // même horloge, même base
    expect((await json(await b.pub())).forced).toBe(false); // b a lu la base : pas de forçage
    await a.login();
    await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'fog', minutes: 60 });
    a.src.clock = T0 + 29 * MIN;
    expect((await json(await b.pub())).forced).toBe(false);
    a.src.clock = T0 + 30 * MIN;
    expect((await json(await b.pub())).condition).toBe('fog');
    a.src.clock = T0 + 60 * MIN;
    expect((await json(await a.pub())).forced).toBe(false);
    expect((await json(await b.pub())).forced).toBe(false);
    expect((await meteoLog()).length).toBe(1); // seule l'écriture de l'admin
  });

  it('couper la météo : 503 « meteo-desactivee » sans cache ; revenir au réel : 204, puis 404', async () => {
    const a = instance();
    await a.login();
    expect((await a.send('PUT', '/api/admin/weather/override', { mode: 'coupee', minutes: 60, condition: 'snow' })).status).toBe(200);
    const off = await a.pub();
    expect(off.status).toBe(503);
    expect(off.headers.get('cache-control')).toBe('no-store');
    expect(apiError.parse(await json(off)).code).toBe('meteo-desactivee');
    expect((await a.send('DELETE', '/api/admin/weather/override')).status).toBe(204);
    expect((await a.pub()).status).toBe(200);
    const again = await a.send('DELETE', '/api/admin/weather/override');
    expect(again.status).toBe(404);
    expect(apiError.parse(await json(again)).code).toBe('introuvable');
    expect((await meteoLog()).map((l) => l.action)).toEqual(['meteo-coupee', 'meteo-reelle']);
  });

  it('retour au réel après la fin : 404, la ligne échue est retirée sans journal', async () => {
    const a = instance();
    await a.login();
    await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'rain', minutes: 5 });
    a.src.clock = T0 + 6 * MIN;
    expect((await a.send('DELETE', '/api/admin/weather/override')).status).toBe(404);
    expect(await db.select().from(schema.appMeta).where(eq(schema.appMeta.key, OVERRIDE_KEY))).toEqual([]);
    expect((await meteoLog()).length).toBe(1);
  });

  it('écran admin : conforme au contrat, sans cache ; pendant un forçage, le relevé réel aussi ; autre instance : l’état écrit', async () => {
    const a = instance();
    await a.login();
    await a.send('PUT', '/api/admin/weather/override', { mode: 'forcee', condition: 'thunder', minutes: 60 });
    const res = await a.send('GET', '/api/admin/weather');
    expect(res.headers.get('cache-control')).toBe('no-store');
    const body = adminWeatherResponse.parse(await json(res));
    expect(body).toMatchObject({ public: { forced: true, condition: 'thunder' }, publicCode: null, override: { mode: 'forcee', condition: 'thunder', by: 'admin' } });
    expect(body.upstream).toMatchObject({ model: 'icon_seamless', grid: { lat: 45.56, lon: 5.9199996, elevationM: 286 } });
    expect(body.upstream!.raw.cloud_cover).toBe(71);
    expect(body.instance.upstreamCalls).toBe(1);
    expect(body.config).toMatchObject({ freshS: 900, cdnMaxAgeS: 60 });
    // Une autre instance chaude, qui avait lu « pas de forçage », relit la base pour l'écran admin
    const b = instance(a.src);
    await b.pub();
    await b.login();
    await a.send('DELETE', '/api/admin/weather/override');
    await a.send('PUT', '/api/admin/weather/override', { mode: 'coupee', minutes: 30 });
    const seen = adminWeatherResponse.parse(await json(await b.send('GET', '/api/admin/weather')));
    expect(seen).toMatchObject({ public: null, publicCode: 'meteo-desactivee', override: { mode: 'coupee' } });
  });

  it('valeur illisible dans app_meta (écrite à la main) : ignorée, météo réelle, signalée dans les journaux', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    await db.insert(schema.appMeta).values({ key: OVERRIDE_KEY, value: '{"mode":"forcee","condition":"tornade"}' });
    const res = await instance().pub();
    expect(res.status).toBe(200);
    expect((await json(res)).forced).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('hors contrat'));
    warn.mockRestore();
  });

  it('sans base : forcer et revenir au réel répondent 503 « base-indisponible » ; la route publique continue', async () => {
    const a = instance(fakeSource(), () => null);
    await a.login();
    for (const [m, b] of [['PUT', { mode: 'coupee', minutes: 30 }], ['DELETE', undefined]] as const) {
      const res = await a.send(m, '/api/admin/weather/override', b);
      expect(res.status).toBe(503);
      expect((await json(res)).code).toBe('base-indisponible');
    }
    expect((await a.pub()).status).toBe(200);
  });

  it('base injoignable : 503 « base-indisponible » (pas une erreur interne)', async () => {
    const a = instance();
    await a.login();
    await client.close();
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await a.send('PUT', '/api/admin/weather/override', { mode: 'coupee', minutes: 30 });
    expect(res.status).toBe(503);
    expect((await json(res)).code).toBe('base-indisponible');
    err.mockRestore();
  });
});
```

**Vérifié [copie]** :
- `npx tsc --noEmit -p .` OK ;
- `npm run build` OK ; `npm test` : **177 sur 177** (157 + 20) ;
- `node scripts/check-api-esm.mjs` OK sans variable, et avec `ADMIN_TOKEN=x VERCEL_ENV=preview` plus un `DATABASE_URL`
  injoignable : le bloc météo utilise `createApp({})`, donc ni base ni réseau. **`check-api-esm.mjs` n'a pas besoin d'être
  modifié** (aucun conflit avec EP008).

### C2 — admin : écran « Météo »
Fichiers : `frontend/admin/src/pages/Meteo.tsx` et `Meteo.test.tsx` (nouveaux) ; `App.tsx`, `Layout.tsx`, `api.ts`,
`styles.css` (diffs).

**`frontend/admin/src/pages/Meteo.tsx` (nouveau)**
```tsx
import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, useWatch } from 'react-hook-form';
import {
  WEATHER_CONDITION_FR, adminWeatherResponse, weatherCondition, weatherOverride, weatherOverrideInput,
  type AdminWeatherResponse, type WeatherCondition, type WeatherOverride, type WeatherOverrideInput,
} from '../../../../contrat/meteo.js';
import { api, issuesText } from '../api';

/**
 * Météo (EP009-US012) : ce que reçoivent les visiteurs, le relevé brut de la source, l'état de l'instance de l'API qui répond,
 * et le forçage pour les démos (ou la coupure), vu par tous les visiteurs pendant une durée limitée. Aucun HTML n'est
 * construit à partir de données : React échappe tout ce qu'il affiche.
 */
const METEO_KEY = ['admin', 'meteo'] as const;
/** Au-delà, un relevé est « ancien » : même seuil que la puce de la carte (OLD_AFTER_S, frontend/carte/src/weather/state.ts) */
const OLD_AFTER_MS = 3600_000;
const CONDITIONS = weatherCondition.options;
const DURATIONS: [number, string][] = [[15, '15 min'], [30, '30 min'], [60, '1 h'], [120, '2 h'], [240, '4 h'], [360, '6 h']];
/** Valeurs brutes d'Open-Meteo (`current`, pas de 15 min) : libellé et unité */
const RAW: Record<string, [string, string]> = {
  time: ['Pas du modèle', ''], interval: ['Durée du pas', 's'], temperature_2m: ['Température à 2 m', '°C'], weather_code: ['Code WMO', ''],
  cloud_cover: ['Couverture nuageuse', '%'], precipitation: ['Précipitations sur le pas', 'mm'], snowfall: ['Neige sur le pas', 'cm'],
  wind_speed_10m: ['Vent à 10 m', 'km/h'], wind_direction_10m: ['Vent venant de', '°'], wind_gusts_10m: ['Rafales', 'km/h'],
  visibility: ['Visibilité', 'm'], lightning_potential: ['Potentiel d’éclair', 'J/kg'],
};

/** Heure de Chambéry : « 10:05 » */
const hm = (ms: number) => new Date(ms).toLocaleTimeString('fr-FR', { timeZone: 'Europe/Paris', hour: '2-digit', minute: '2-digit' });
const ago = (ms: number) => {
  const m = Math.round(ms / 60000);
  return m < 1 ? 'à l’instant' : m < 60 ? `il y a ${m} min` : `il y a ${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')}`;
};
const message = (e: unknown) => (e instanceof Error ? e.message : String(e));
/** Nombre à la française : « 0,67 », « 39 180 » ; coordonnées au dix-millième */
const n = (x: number, digits = 2) => x.toLocaleString('fr-FR', { maximumFractionDigits: digits });

type Badge = { text: string; cls: 'ok' | 'warn' | 'info' };
/** Pastille de ce que voient les visiteurs : Direct, Ancien relevé, Forcée, Coupée ou Indisponible */
export function badgeOf(d: AdminWeatherResponse, nowMs: number): Badge {
  if (d.publicCode === 'meteo-desactivee') return { text: 'Coupée', cls: 'warn' };
  const p = d.public;
  if (!p) return { text: 'Indisponible', cls: 'warn' };
  if (p.forced) return { text: 'Forcée', cls: 'info' };
  if (p.stale || nowMs - Date.parse(p.observedAt) > OLD_AFTER_MS) return { text: 'Ancien relevé', cls: 'warn' };
  return { text: 'Direct', cls: 'ok' };
}

interface ForceFields { mode: 'forcee' | 'coupee'; condition: string; intensity: string; windKmh: string; windFromDeg: string; minutes: string; note: string }
const FORCE_DEFAULTS: ForceFields = { mode: 'forcee', condition: '', intensity: '', windKmh: '', windFromDeg: '', minutes: '60', note: '' };
const num = (v: string) => (v.trim() === '' ? undefined : Number(v));

/**
 * Lien « Aperçu sur la carte » : `?weather=` utilise les mêmes valeurs types que le forçage (WEATHER_PRESETS du contrat), donc
 * le même rendu, sans réseau et pour soi seul ; null sans condition
 */
export function previewHref(f: Pick<ForceFields, 'condition' | 'intensity' | 'windKmh' | 'windFromDeg'>): string | null {
  const c = weatherCondition.safeParse(f.condition);
  if (!c.success) return null;
  const q = new URLSearchParams({ weather: c.data });
  for (const [k, v] of [['intensity', f.intensity], ['wind', f.windKmh], ['windfrom', f.windFromDeg]] as const) if (v?.trim()) q.set(k, v.trim());
  return `/?${q}`;
}

/** « Neige (intensité 0,9), jusqu’à 11:30, par admin » */
function overrideText(o: WeatherOverride): string {
  const what = o.mode === 'coupee' ? 'Météo coupée' : `Météo forcée : ${WEATHER_CONDITION_FR[o.condition as WeatherCondition]}${o.intensity !== undefined ? ` (intensité ${n(o.intensity)})` : ''}`;
  return `${what}, jusqu’à ${hm(Date.parse(o.until))}, par ${o.by}${o.note ? `. Motif : ${o.note}` : ''}.`;
}

export function Meteo() {
  // Relue toutes les 60 s tant que la page est ouverte (et seulement si l'onglet est visible)
  const state = useQuery({ queryKey: METEO_KEY, queryFn: () => api('GET', '/api/admin/weather', { schema: adminWeatherResponse }), refetchInterval: 60_000 });
  const d = state.data;
  const nowMs = Date.now();
  return (
    <section>
      <div className="bar">
        <button type="button" onClick={() => void state.refetch()} disabled={state.isFetching}>{state.isFetching ? 'Actualisation…' : 'Actualiser'}</button>
      </div>
      {state.error && <p className="msg" role="alert">{state.error.message}</p>}
      {d && (
        <>
          <Visitors d={d} nowMs={nowMs} />
          <Raw d={d} />
          <Instance d={d} />
        </>
      )}
      <Force override={d?.override ?? null} />
    </section>
  );
}

function Visitors({ d, nowMs }: { d: AdminWeatherResponse; nowMs: number }) {
  const b = badgeOf(d, nowMs);
  const p = d.public;
  return (
    <div className="card">
      <h2>Ce que voient les visiteurs <span className={`badge ${b.cls}`}>{b.text}</span></h2>
      {p ? (
        <dl>
          <dt>Météo</dt><dd>{WEATHER_CONDITION_FR[p.condition]}{p.temperatureC !== null ? `, ${Math.round(p.temperatureC)} °C` : ''}</dd>
          {p.forced
            ? <><dt>Démo</dt><dd>forcée depuis l’administration, jusqu’à {p.forcedUntil ? hm(Date.parse(p.forcedUntil)) : '?'}</dd></>
            : <><dt>Relevé</dt><dd>modèle {p.model ?? '?'}, valable pour {hm(Date.parse(p.observedAt))} ({ago(nowMs - Date.parse(p.observedAt))}){p.stale ? ' : la source ne répond plus, dernier bon relevé' : ''}</dd></>}
          <dt>Intensités</dt><dd>nuages {n(p.cloudCover)}, pluie {n(p.rainIntensity)}, neige {n(p.snowIntensity)}, brouillard {n(p.fog)}{p.thunder ? ', orage' : ''}</dd>
          <dt>Vent</dt><dd>{Math.round(p.windKmh)} km/h, venant de {Math.round(p.windFromDeg)}°</dd>
        </dl>
      ) : (
        <p className="hint">{d.publicCode === 'meteo-desactivee'
          ? 'Météo coupée depuis l’administration : la carte garde son ciel par défaut.'
          : 'Pas de relevé de moins de 3 h : la carte garde son ciel par défaut.'}</p>
      )}
    </div>
  );
}

function Raw({ d }: { d: AdminWeatherResponse }) {
  const u = d.upstream;
  return (
    <div className="card">
      <h2>Relevé brut de la source</h2>
      {u ? (
        <>
          <p className="hint">
            Open-Meteo, modèle {u.model}, point de grille {n(u.grid.lat, 4)} ; {n(u.grid.lon, 4)}{u.grid.elevationM !== null ? ` (altitude ${n(u.grid.elevationM)} m)` : ''},
            lu à {hm(Date.parse(u.fetchedAt))}. Ce relevé est montré même pendant un forçage.
          </p>
          <table>
            <tbody>
              {Object.entries(u.raw).map(([k, v]) => {
                const [label, unit] = RAW[k] ?? [k, ''];
                const value = v === null ? '—' : k === 'time' ? hm(v * 1000) : `${n(v)}${unit ? ` ${unit}` : ''}`;
                return <tr key={k}><td>{label}</td><td className="n">{value}</td></tr>;
              })}
            </tbody>
          </table>
        </>
      ) : <p className="hint">Pas encore de relevé sur cette instance (la source n’a pas répondu).</p>}
    </div>
  );
}

function Instance({ d }: { d: AdminWeatherResponse }) {
  const i = d.instance;
  return (
    <div className="card">
      <h2>Cette instance de l’API</h2>
      <p className="hint">Compteurs depuis le démarrage de cette instance, ce ne sont pas des totaux.</p>
      <dl>
        <dt>Démarrée</dt><dd>{new Date(i.startedAt).toLocaleString('fr-FR')}</dd>
        <dt>Appels à la source</dt><dd>{i.upstreamCalls}</dd>
        <dt>Échecs</dt><dd className={i.upstreamFailures ? 'warn' : undefined}>{i.upstreamFailures}</dd>
        {i.lastError && <><dt>Dernière erreur</dt><dd className="warn">{i.lastError}{i.lastErrorAt ? ` (${new Date(i.lastErrorAt).toLocaleString('fr-FR')})` : ''}</dd></>}
        <dt>Réglages</dt><dd>point {n(d.config.lat, 4)} ; {n(d.config.lon, 4)}, relevé gardé {d.config.freshS / 60} min au plus, cache du CDN {d.config.cdnMaxAgeS} s</dd>
      </dl>
    </div>
  );
}

interface Msg { text: string; ok?: boolean }

function Force({ override }: { override: WeatherOverride | null }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control } = useForm<ForceFields>({ defaultValues: FORCE_DEFAULTS });
  const f = useWatch({ control }) as ForceFields;
  const [msg, setMsg] = useState<Msg>({ text: '' });
  const put = useMutation({ mutationFn: (body: WeatherOverrideInput) => api('PUT', '/api/admin/weather/override', { body, schema: weatherOverride }) });
  const del = useMutation({ mutationFn: () => api('DELETE', '/api/admin/weather/override', { notFound: 'Aucun forçage en cours (déjà terminé ?).' }) });
  /** Le forçage écrit devient tout de suite l'état connu, puis l'écran est relu */
  const publish = async (o: WeatherOverride | null) => {
    queryClient.setQueryData<AdminWeatherResponse>(METEO_KEY, (old) => old && { ...old, override: o });
    await queryClient.invalidateQueries({ queryKey: METEO_KEY });
  };

  const onSubmit = handleSubmit(async (v) => {
    const forcee = v.mode === 'forcee';
    // Mêmes règles que le serveur (contrat), avant l'envoi : un champ refusé est signalé tout de suite, en français
    const checked = weatherOverrideInput.safeParse(Object.fromEntries(Object.entries({
      mode: v.mode, condition: forcee && v.condition ? v.condition : undefined,
      intensity: forcee ? num(v.intensity) : undefined, windKmh: forcee ? num(v.windKmh) : undefined, windFromDeg: forcee ? num(v.windFromDeg) : undefined,
      minutes: Number(v.minutes), note: v.note.trim() || undefined,
    }).filter(([, x]) => x !== undefined)));
    if (!checked.success) return setMsg({ text: issuesText(checked.error.issues) });
    try {
      const o = await put.mutateAsync(checked.data);
      setMsg({ ok: true, text: `${o.mode === 'coupee' ? 'Météo coupée' : `Météo forcée (${WEATHER_CONDITION_FR[o.condition as WeatherCondition]})`} jusqu’à ${hm(Date.parse(o.until))}.` });
      await publish(o);
    } catch (e) {
      setMsg({ text: message(e) });
    }
  });

  async function onBackToReal() {
    try {
      await del.mutateAsync();
      setMsg({ ok: true, text: 'Retour à la météo réelle.' });
    } catch (e) {
      setMsg({ text: message(e) });
    }
    await publish(null);
  }

  const href = f.mode === 'forcee' ? previewHref(f) : null;
  return (
    <div className="card">
      <h2>Forcer la météo</h2>
      {override && (
        <div className="bar current">
          <p>{overrideText(override)}</p>
          <button type="button" className="ghost" onClick={() => void onBackToReal()} disabled={del.isPending}>Revenir à la météo réelle</button>
        </div>
      )}
      <form onSubmit={onSubmit} aria-label="Forçage de la météo">
        <div className="radios">
          <label className="check"><input type="radio" value="forcee" {...register('mode')} /> Forcer une météo</label>
          <label className="check"><input type="radio" value="coupee" {...register('mode')} /> Couper la météo</label>
        </div>
        <div className="grid">
          {/* Champs du forçage masqués quand on coupe (pas `disabled` : React Hook Form les passerait à undefined) */}
          {f.mode === 'forcee' && (
            <>
              <label>Condition<select {...register('condition')}>
                <option value="">choisir…</option>
                {CONDITIONS.map((c) => <option key={c} value={c}>{WEATHER_CONDITION_FR[c]}</option>)}
              </select></label>
              <label>Intensité (0 à 1)<input type="number" min={0} max={1} step={0.05} placeholder="valeur type" {...register('intensity')} /></label>
              <label>Vent (km/h)<input type="number" min={0} max={150} step={1} placeholder="10" {...register('windKmh')} /></label>
              <label>Vent venant de (°)<input type="number" min={0} max={360} step={1} placeholder="270 (ouest)" {...register('windFromDeg')} /></label>
            </>
          )}
          <label>Durée<select {...register('minutes')}>
            {DURATIONS.map(([m, label]) => <option key={m} value={m}>{label}</option>)}
          </select></label>
        </div>
        <label>Motif (facultatif)<input maxLength={200} placeholder="ex. démo avec les amis" {...register('note')} /></label>
        <p className="hint">
          Visible par tous les visiteurs d’ici 1 à 2 minutes (une carte déjà ouverte : à sa prochaine relecture), puis retour
          automatique à la météo réelle à la fin. Le motif est enregistré dans le journal : pas de donnée personnelle.
        </p>
        <div className="bar">
          <button type="submit" disabled={put.isPending}>{f.mode === 'coupee' ? 'Couper pour tous' : 'Forcer pour tous'}</button>
          {href && <a className="preview" href={href} target="_blank" rel="noopener noreferrer">Aperçu sur la carte</a>}
        </div>
        <p className={msg.ok ? 'msg ok' : 'msg'} role="status">{msg.text}</p>
      </form>
    </div>
  );
}
```

**`App.tsx`, `Layout.tsx`, `api.ts`, `styles.css` (diffs)**
```diff
diff --git a/frontend/admin/src/App.tsx b/frontend/admin/src/App.tsx
index 899e81e..33a009e 100644
--- a/frontend/admin/src/App.tsx
+++ b/frontend/admin/src/App.tsx
@@ -8,6 +8,7 @@ import { Layout } from './Layout';
 import { Login } from './pages/Login';
 import { Dashboard } from './pages/Dashboard';
 import { Parkings } from './pages/Parkings';
+import { Meteo } from './pages/Meteo';
 
 /**
  * Administration (EP010). Routage par « # » (`/admin/#/parkings`) : aucune réécriture d'adresse à régler côté serveur
@@ -45,6 +46,7 @@ function Shell() {
         <Switch>
           <Route path="/" component={Dashboard} />
           <Route path="/parkings" component={Parkings} />
+          <Route path="/meteo" component={Meteo} />
           <Route>
             <p className="card">Page introuvable. <Link href="/">Retour au tableau de bord</Link></p>
           </Route>
diff --git a/frontend/admin/src/Layout.tsx b/frontend/admin/src/Layout.tsx
index 6e010e0..3614b88 100644
--- a/frontend/admin/src/Layout.tsx
+++ b/frontend/admin/src/Layout.tsx
@@ -6,6 +6,7 @@ import { useAuth } from './auth';
 const PAGES: { path: string; label: string }[] = [
   { path: '/', label: 'Tableau de bord' },
   { path: '/parkings', label: 'Parkings' },
+  { path: '/meteo', label: 'Météo' },
 ];
 
 export function Layout({ children }: { children: ReactNode }) {
diff --git a/frontend/admin/src/api.ts b/frontend/admin/src/api.ts
index 7d0ef8e..93f1d8f 100644
--- a/frontend/admin/src/api.ts
+++ b/frontend/admin/src/api.ts
@@ -46,6 +46,7 @@ export function errorMessage(status: number, body: ApiErrorBody | null, notFound
 /** Noms français des champs de l'API, pour dire lequel est refusé */
 const FIELD: Record<string, string> = {
   id: 'identifiant', hide: 'masquer', name: 'nom', fee: 'tarif', capacity: 'places', kind: 'type', pos: 'position', note: 'note', source: 'source',
+  mode: 'mode', condition: 'condition', intensity: 'intensité', windKmh: 'vent', windFromDeg: 'direction du vent', minutes: 'durée', // météo (EP009-US012)
 };
 
 /** « places : Trop grand … ; source : Trop petit … » à partir des champs refusés (par le back ou par le contrat ici) */
diff --git a/frontend/admin/src/styles.css b/frontend/admin/src/styles.css
index 55323bf..b8ddcbd 100644
--- a/frontend/admin/src/styles.css
+++ b/frontend/admin/src/styles.css
@@ -46,3 +46,11 @@ button:disabled { opacity: 0.6; cursor: progress; }
 .tab { padding: 7px 14px; border-radius: 99px; border: 1px solid var(--line); color: var(--ink); text-decoration: none; font-weight: 600; }
 .tab.on { background: var(--ink); color: var(--paper); border-color: var(--ink); }
 .tabs button { margin: 0 0 0 auto; }
+/* Météo (EP009-US012) : pastille de ce que voient les visiteurs, choix forcer ou couper, forçage en cours, lien d'aperçu */
+.badge { display: inline-block; margin-left: 8px; padding: 1px 10px; border-radius: 99px; font-size: 12px; font-weight: 700; vertical-align: 1px; color: #fff; background: var(--muted); }
+.badge.ok { background: var(--teal); }
+.badge.warn { background: var(--bad); }
+.radios { display: flex; flex-wrap: wrap; gap: 4px 18px; }
+.bar.current { align-items: center; justify-content: space-between; }
+.bar.current p { margin: 0; }
+.bar .preview { align-self: center; font-weight: 600; }
```

**`frontend/admin/src/pages/Meteo.test.tsx` (nouveau, 6 tests)** : les 4 cartes, la mise en garde sur les compteurs, l'onglet ;
forçage (corps exact, pastille, forçage en cours, lien d'aperçu) puis retour au réel ; refus sans condition ; coupure ; 404 au
retour ; pastilles et lien d'aperçu.
```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { App } from '../App';
import { badgeOf, previewHref } from './Meteo';
import type { AdminWeatherResponse, WeatherOverride, WeatherResponse } from '../../../../contrat/meteo.js';

const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const LIVE: WeatherResponse = {
  v: 1, source: 'open-meteo', model: 'icon_seamless', observedAt: iso(NOW - 6 * 60_000), fetchedAt: iso(NOW - 5 * 60_000),
  stale: false, forced: false, condition: 'partly', temperatureC: 12.8, cloudCover: 0.71, precipMmH: 0, rainIntensity: 0,
  snowIntensity: 0, windKmh: 14.1, windGustKmh: 29.9, windFromDeg: 257, visibilityM: 33040, fog: 0, thunder: false,
  attribution: { text: 'Météo : Open-Meteo.com', url: 'https://open-meteo.com/', licence: 'CC BY 4.0', licenceUrl: 'https://creativecommons.org/licenses/by/4.0/' },
};
const base = (): AdminWeatherResponse => ({
  public: LIVE, publicCode: null,
  upstream: {
    model: 'icon_seamless', fetchedAt: iso(NOW - 5 * 60_000), observedAt: LIVE.observedAt, grid: { lat: 45.56, lon: 5.92, elevationM: 286 },
    raw: { time: Math.floor((NOW - 6 * 60_000) / 1000), interval: 900, temperature_2m: 12.8, cloud_cover: 71, visibility: 33040, lightning_potential: null },
  },
  override: null,
  instance: { startedAt: iso(NOW - 3600_000), upstreamCalls: 3, upstreamFailures: 1, lastError: 'http-429 : Too many requests', lastErrorAt: iso(NOW - 600_000) },
  config: { lat: 45.5658, lon: 5.9205, model: 'icon_seamless', freshS: 900, cdnMaxAgeS: 60 },
});

let state: AdminWeatherResponse;
let calls: { method: string; url: string; body?: unknown }[];

/** Fausse API : la session est ouverte ; le forçage change ce que « voient les visiteurs », comme le vrai serveur */
const fakeServer = vi.fn(async (url: string, init?: RequestInit) => {
  const method = init?.method ?? 'GET';
  const body = init?.body ? JSON.parse(String(init.body)) : undefined;
  calls.push({ method, url, body });
  if (url === '/api/admin/session') return json({ sub: 'admin', method: 'token', expiresAt: iso(NOW + 3600_000), maxExpiresAt: iso(NOW + 8 * 3600_000) });
  if (url === '/api/admin/weather') return json(state);
  if (url === '/api/admin/weather/override' && method === 'PUT') {
    const o: WeatherOverride = { ...body, since: iso(NOW), until: iso(NOW + body.minutes * 60_000), by: 'admin' };
    delete (o as { minutes?: number }).minutes;
    state = o.mode === 'coupee'
      ? { ...state, override: o, public: null, publicCode: 'meteo-desactivee' }
      : { ...state, override: o, public: { ...LIVE, source: 'admin', model: null, forced: true, forcedUntil: o.until, condition: o.condition!, temperatureC: null, attribution: null } };
    return json(o);
  }
  if (url === '/api/admin/weather/override' && method === 'DELETE') {
    if (!state.override) return json({ error: 'aucun forçage en cours', code: 'introuvable' }, 404);
    state = { ...state, override: null, public: LIVE, publicCode: null };
    return new Response(null, { status: 204 });
  }
  return json({ error: 'introuvable', code: 'introuvable' }, 404);
});

beforeEach(() => {
  window.location.hash = '#/meteo';
  state = base();
  calls = [];
  vi.stubGlobal('fetch', fakeServer);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  window.location.hash = '';
});

const form = () => screen.getByRole('form', { name: 'Forçage de la météo' });

describe('administration : écran « Météo »', () => {
  it('montre ce que voient les visiteurs, le relevé brut avec ses unités et l’instance, avec la mise en garde sur les compteurs', async () => {
    render(<App />);
    expect(await screen.findByText('Direct')).toBeTruthy();
    expect(screen.getByText('Éclaircies, 13 °C')).toBeTruthy();
    expect(screen.getByText(/modèle icon_seamless, valable pour .* \(il y a 6 min\)/)).toBeTruthy();
    expect(screen.getByText('71 %')).toBeTruthy();
    expect(screen.getByText('33 040 m')).toBeTruthy(); // nombres à la française (l'espace fine est ramenée à une espace par Testing Library)
    expect(screen.getByText('Compteurs depuis le démarrage de cette instance, ce ne sont pas des totaux.')).toBeTruthy();
    expect(screen.getByText(/http-429 : Too many requests/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Météo' })).toBeTruthy(); // onglet de la navigation
  });

  it('force la neige pour tous : corps validé par le contrat, pastille « Forcée », lien d’aperçu, puis retour au réel', async () => {
    render(<App />);
    await screen.findByText('Direct');
    fireEvent.change(within(form()).getByLabelText('Condition'), { target: { value: 'snow' } });
    fireEvent.change(within(form()).getByLabelText('Intensité (0 à 1)'), { target: { value: '0.9' } });
    fireEvent.change(within(form()).getByLabelText('Durée'), { target: { value: '30' } });
    fireEvent.change(within(form()).getByLabelText('Motif (facultatif)'), { target: { value: ' démo avec les amis ' } });
    expect(within(form()).getByRole('link', { name: 'Aperçu sur la carte' }).getAttribute('href')).toBe('/?weather=snow&intensity=0.9');
    fireEvent.submit(form());
    expect(await within(form()).findByText(/Météo forcée \(Neige\) jusqu’à/)).toBeTruthy();
    expect(calls).toContainEqual({ method: 'PUT', url: '/api/admin/weather/override', body: { mode: 'forcee', condition: 'snow', intensity: 0.9, minutes: 30, note: 'démo avec les amis' } });
    expect(await screen.findByText('Forcée')).toBeTruthy();
    expect(await screen.findByText(/Météo forcée : Neige \(intensité 0,9\), jusqu’à .*, par admin. Motif : démo avec les amis./)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Revenir à la météo réelle' }));
    expect(await screen.findByText('Retour à la météo réelle.')).toBeTruthy();
    expect(calls.some((c) => c.method === 'DELETE' && c.url === '/api/admin/weather/override')).toBe(true);
    expect(await screen.findByText('Direct')).toBeTruthy();
  });

  it('refuse un forçage sans condition (message du contrat, rien n’est envoyé) ; couper la météo pour tous', async () => {
    render(<App />);
    await screen.findByText('Direct');
    fireEvent.submit(form());
    expect(await within(form()).findByText('condition : condition obligatoire pour une météo forcée')).toBeTruthy();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);

    fireEvent.click(within(form()).getByLabelText('Couper la météo'));
    expect(within(form()).queryByLabelText('Condition')).toBeNull();
    expect(within(form()).queryByRole('link', { name: 'Aperçu sur la carte' })).toBeNull();
    fireEvent.submit(form());
    expect(await within(form()).findByText(/Météo coupée jusqu’à/)).toBeTruthy();
    expect(calls).toContainEqual({ method: 'PUT', url: '/api/admin/weather/override', body: { mode: 'coupee', minutes: 60 } });
    expect(await screen.findByText('Coupée')).toBeTruthy();
    expect(screen.getByText('Météo coupée depuis l’administration : la carte garde son ciel par défaut.')).toBeTruthy();
  });

  it('retour au réel alors que le forçage vient de finir : le message du serveur (404)', async () => {
    state = { ...base(), override: { mode: 'forcee', condition: 'rain', since: iso(NOW - 60_000), until: iso(NOW + 60_000), by: 'admin' } };
    render(<App />);
    const back = await screen.findByRole('button', { name: 'Revenir à la météo réelle' });
    state = base(); // fini entre-temps
    fireEvent.click(back);
    expect(await screen.findByText('Aucun forçage en cours (déjà terminé ?).')).toBeTruthy();
  });
});

describe('pastille et lien d’aperçu', () => {
  it('Direct, Ancien relevé (plus d’1 h ou « stale »), Forcée, Coupée, Indisponible', () => {
    const d = base();
    expect(badgeOf(d, NOW).text).toBe('Direct');
    expect(badgeOf({ ...d, public: { ...LIVE, stale: true } }, NOW).text).toBe('Ancien relevé');
    expect(badgeOf(d, Date.parse(LIVE.observedAt) + 61 * 60_000).text).toBe('Ancien relevé');
    expect(badgeOf({ ...d, public: { ...LIVE, forced: true } }, NOW).text).toBe('Forcée');
    expect(badgeOf({ ...d, public: null, publicCode: 'meteo-desactivee' }, NOW).text).toBe('Coupée');
    expect(badgeOf({ ...d, public: null, publicCode: 'meteo-indisponible' }, NOW).text).toBe('Indisponible');
  });

  it('même rendu que le forçage : ?weather=, intensité, vent, direction ; rien sans condition', () => {
    expect(previewHref({ condition: 'fog', intensity: '', windKmh: '', windFromDeg: '' })).toBe('/?weather=fog');
    expect(previewHref({ condition: 'rain', intensity: '0.8', windKmh: '40', windFromDeg: '200' })).toBe('/?weather=rain&intensity=0.8&wind=40&windfrom=200');
    expect(previewHref({ condition: '', intensity: '0.8', windKmh: '', windFromDeg: '' })).toBeNull();
  });
});
```

**Vérifié [copie]** :
- `npm run build` OK ; `npm test` : **183 sur 183** ;
- poids de l'admin : 108,71 → 113,07 Ko gzip (+4,4 Ko, admin seulement, sans effet sur la carte).
- Essai réel dans Chrome sans fenêtre (admin sur 4211, API sur 8817, base PGlite de la copie, vrai appel à Open-Meteo) :
  connexion ; écran en « Direct » ; neige forcée 15 min (message, pastille « Forcée », forçage en cours, relevé réel
  toujours affiché) ; lien d'aperçu `/?weather=snow&intensity=0.9` ; « Revenir à la météo réelle » ; mode « Couper » qui masque
  les champs.
- Seule erreur de console : le 401 attendu de la vérification de session avant la connexion.
- Note : un passage complet sur quatre a vu échouer un test **existant** de Parkings (« garde la valeur enregistrée… revue M1 »,
  25 au lieu de 30), sous une charge machine de 12 à 20. Il est passé dans les 3 autres passages complets, les 6 passages du
  projet admin et les 3 passages du point de départ. `Parkings.tsx` n'est pas modifié : test fragile sous charge, à surveiller.

### C3 — carte : fin d'un forçage
Fichiers : `frontend/carte/src/weather/client.ts`, `state.ts`, `index.ts`, `client.test.ts`, `state.test.ts` (diffs sur US004,
`48ffd36`).
```diff
diff --git a/frontend/carte/src/weather/client.test.ts b/frontend/carte/src/weather/client.test.ts
index 5590f60..c8191b7 100644
--- a/frontend/carte/src/weather/client.test.ts
+++ b/frontend/carte/src/weather/client.test.ts
@@ -62,6 +62,19 @@ describe('quand relire', () => {
   });
 });
 
+const forcedBody = (untilMs: number) => ({ ...body, source: 'admin', model: null, forced: true, forcedUntil: new Date(untilMs).toISOString(), temperatureC: null });
+const forcedOk = (untilMs: number): WeatherFetch => ({ ok: true, body: forcedBody(untilMs) as never, ms: 1 });
+
+describe('fin d’une météo forcée par l’administration (US012)', () => {
+  it('relue 5 s après sa fin, au plus 15 min après la lecture, jamais moins de 30 s après', () => {
+    expect(nextRefresh(forcedOk(NOW + 10 * 60_000), 0, true, 0, NOW)).toBe(10 * 60_000 + 5_000);
+    expect(nextRefresh(forcedOk(NOW + 3600_000), 0, true, 0, NOW)).toBe(15 * 60_000);
+    expect(nextRefresh(forcedOk(NOW - 60_000), 0, true, 0, NOW)).toBe(30_000); // horloge du visiteur en avance : pas d'emballement
+    expect(nextRefresh(forcedOk(NOW + 60_000), 0, false, 0, NOW)).toBeNull(); // onglet caché : rien
+    expect(nextRefresh(forcedOk(NOW + 60_000), 0, true, 31 * 60_000, NOW)).toBeNull(); // visiteur parti : rien
+  });
+});
+
 describe('relectures programmées (minuteries simulées)', () => {
   let visible = true;
   const results: WeatherFetch[] = [];
@@ -127,6 +140,21 @@ describe('relectures programmées (minuteries simulées)', () => {
     expect(f).toHaveBeenCalledTimes(4);
   });
 
+  it('météo forcée qui finit dans 3 min : relue 3 min 5 s après la lecture, la météo réelle revient', async () => {
+    let answer: unknown = forcedBody(NOW + 3 * 60_000);
+    const f = vi.fn(async () => new Response(JSON.stringify(answer), { status: 200 }));
+    const c = client(f as unknown as typeof fetch);
+    c.start();
+    await vi.advanceTimersByTimeAsync(0);
+    expect(results[0]).toMatchObject({ ok: true, body: { forced: true } });
+    answer = body;
+    await vi.advanceTimersByTimeAsync(3 * 60_000 + 4_999);
+    expect(f).toHaveBeenCalledTimes(1);
+    await vi.advanceTimersByTimeAsync(1);
+    expect(f).toHaveBeenCalledTimes(2);
+    expect(results.at(-1)).toMatchObject({ ok: true, body: { forced: false } });
+  });
+
   it('lecture déjà partie pendant le chargement de la ville : réutilisée, pas de seconde requête', async () => {
     const f = reply(200, body);
     const c = client(f);
diff --git a/frontend/carte/src/weather/client.ts b/frontend/carte/src/weather/client.ts
index 9923c1c..72390a0 100644
--- a/frontend/carte/src/weather/client.ts
+++ b/frontend/carte/src/weather/client.ts
@@ -18,6 +18,13 @@ export const REFRESH_MS = 15 * 60_000;
 export const RETRY_MS = 60_000;
 /** Sans interaction depuis ce temps, on ne relit plus (un onglet oublié ne réveille ni la fonction ni la base) */
 export const IDLE_MS = 30 * 60_000;
+/**
+ * Fin d'une météo forcée par l'administration (US012) : relue 5 s après `forcedUntil` (le back ne la sert plus, et le CDN ne la
+ * garde jamais au-delà de sa fin : routes.ts du back), au lieu d'attendre la relecture suivante
+ */
+export const FORCED_END_MARGIN_MS = 5_000;
+/** … mais jamais plus d'une fois toutes les 30 s (horloge du visiteur en avance sur celle du serveur) */
+export const FORCED_MIN_MS = 30_000;
 
 export async function fetchWeather(f: typeof fetch = fetch, timeoutMs = FETCH_TIMEOUT_MS, now: () => number = Date.now): Promise<WeatherFetch> {
   const ctrl = new AbortController();
@@ -42,13 +49,18 @@ export async function fetchWeather(f: typeof fetch = fetch, timeoutMs = FETCH_TI
 }
 
 /**
- * Délai avant la prochaine lecture (ms), ou null pour ne pas relire : jamais sans API (404, carte du Pi) ; onglet caché ou
- * visiteur inactif depuis 30 min : on attend son retour ; 15 min après un succès ou une météo coupée ; après un échec,
- * 60 s puis 2, 4, 8 min, au plus 15 min.
+ * Délai avant la prochaine lecture (ms, compté depuis la dernière lecture `attemptAtMs`), ou null pour ne pas relire : jamais
+ * sans API (404, carte du Pi) ; onglet caché ou visiteur inactif depuis 30 min : on attend son retour ; météo forcée : 5 s
+ * après sa fin (au moins 30 s, au plus 15 min) ; 15 min après un succès ou une météo coupée ; après un échec, 60 s puis 2, 4,
+ * 8 min, au plus 15 min.
  */
-export function nextRefresh(last: WeatherFetch, failures: number, visible: boolean, idleMs: number): number | null {
+export function nextRefresh(last: WeatherFetch, failures: number, visible: boolean, idleMs: number, attemptAtMs = 0): number | null {
   if (!last.ok && last.reason === 'absente') return null;
   if (!visible || idleMs > IDLE_MS) return null;
+  if (last.ok && last.body.forced && last.body.forcedUntil) {
+    const end = Date.parse(last.body.forcedUntil) - attemptAtMs + FORCED_END_MARGIN_MS;
+    return Math.min(REFRESH_MS, Math.max(FORCED_MIN_MS, end));
+  }
   if (last.ok || last.reason === 'desactivee') return REFRESH_MS;
   return Math.min(REFRESH_MS, RETRY_MS * 2 ** Math.max(0, failures - 1));
 }
@@ -85,11 +97,11 @@ export function createWeatherClient(d: {
   const schedule = () => {
     clearTimeout(timer);
     if (!last || stopped || busy) return;
-    const delay = nextRefresh(last, failures, d.visible(), now() - lastInputAt);
+    const delay = nextRefresh(last, failures, d.visible(), now() - lastInputAt, lastAttemptAt);
     if (delay === null) return;
     timer = setTimeout(() => {
       // Revérifié au moment de relire : l'onglet a pu être caché, le visiteur a pu partir
-      if (last && nextRefresh(last, failures, d.visible(), now() - lastInputAt) !== null) void load();
+      if (last && nextRefresh(last, failures, d.visible(), now() - lastInputAt, lastAttemptAt) !== null) void load();
     }, Math.max(0, delay - (now() - lastAttemptAt)));
   };
 
diff --git a/frontend/carte/src/weather/index.ts b/frontend/carte/src/weather/index.ts
index 34f434d..0314282 100644
--- a/frontend/carte/src/weather/index.ts
+++ b/frontend/carte/src/weather/index.ts
@@ -115,6 +115,9 @@ export function startWeather(ctx: WeatherCtx): WeatherModule {
     if (r && !r.forced) {
       const age = now - r.observedAtMs, next = age < OLD_AFTER_S * 1000 ? OLD_AFTER_S * 1000 : WEATHER_MAX_AGE_S * 1000 + 1;
       if (age < next) ageTimer = setTimeout(update, next - age);
+    } else if (r?.forced && r.forcedUntilMs !== null && r.forcedUntilMs >= now) {
+      // Météo forcée (US012) : la scène la quitte à sa fin, même sans relecture (visiteur inactif) ; client.ts relit 5 s après
+      ageTimer = setTimeout(update, r.forcedUntilMs - now + 1);
     }
   };
 
diff --git a/frontend/carte/src/weather/state.test.ts b/frontend/carte/src/weather/state.test.ts
index f2dcdc9..5b226e4 100644
--- a/frontend/carte/src/weather/state.test.ts
+++ b/frontend/carte/src/weather/state.test.ts
@@ -158,7 +158,10 @@ describe('réponse du back (US004) → relevé de la carte', () => {
     const s = resolveWeather(inputs({ reading: forced }), NOW, CLEAR);
     expect(chipOf(s, false)).toMatchObject({ text: 'Démo', label: 'Météo forcée (démo) : Pluie' });
     expect(panelOf(s, NOW)).toMatchObject({ title: 'Pluie', lines: ['Météo forcée (démo) par l’administration, jusqu’à 11 h 00.'] });
-    expect(resolveWeather(inputs({ reading: forced }), Date.parse('2026-10-09T09:00:01Z'), CLEAR).status).toBe('unavailable');
+    // Fini : ciel par défaut et puce masquée en attendant la relecture (5 s après la fin), pas « Indisponible » (US012)
+    const after = resolveWeather(inputs({ reading: forced }), Date.parse('2026-10-09T09:00:01Z'), CLEAR);
+    expect(after).toMatchObject({ status: 'waiting', target: CLEAR });
+    expect(chipOf(after, false)).toBeNull();
   });
   it('panneau en direct : relevé, vent en mots, crédit (texte, lien, licence)', () => {
     const p = panelOf(resolveWeather(inputs({ reading: readingFromResponse(body) }), NOW, CLEAR), NOW);
diff --git a/frontend/carte/src/weather/state.ts b/frontend/carte/src/weather/state.ts
index d67b569..288d5b4 100644
--- a/frontend/carte/src/weather/state.ts
+++ b/frontend/carte/src/weather/state.ts
@@ -147,14 +147,16 @@ export function resolveWeather(i: WeatherInputs, nowMs: number, clear: WeatherLo
   if (i.url) return out('url', i.url.look, i.url.condition);
   if (i.debug) return out('debug', i.debug.look, i.debug.condition);
   if (i.api === 'none') return out('none');
-  // Forçage terminé (le back reprend seul la météo réelle) : on ne le garde pas au-delà de sa fin
-  const r = i.reading?.forced && i.reading.forcedUntilMs !== null && nowMs > i.reading.forcedUntilMs ? null : i.reading;
+  // Forçage terminé (le back reprend seul la météo réelle) : on ne le garde pas au-delà de sa fin ; en attendant la relecture
+  // (5 s après la fin, client.ts), ciel par défaut sans puce, plutôt que « Indisponible »
+  const ended = !!i.reading?.forced && i.reading.forcedUntilMs !== null && nowMs > i.reading.forcedUntilMs;
+  const r = ended ? null : i.reading;
   if (r?.forced) return out('admin', r.look, r.condition, r);
   if (i.api === 'disabled') return out('disabled');
   if (!i.live) return out('simulated', clear, 'clear');
   const age = r ? nowMs - r.observedAtMs : Infinity;
   if (r && age <= WEATHER_MAX_AGE_S * 1000) return out(r.stale || age > OLD_AFTER_S * 1000 ? 'stale' : 'live', r.look, r.condition, r);
-  return out(i.api === 'waiting' ? 'waiting' : 'unavailable');
+  return out(i.api === 'waiting' || ended ? 'waiting' : 'unavailable');
 }
 
 // --- Textes de la puce et du panneau ---------------------------------------------------------------
```

**Vérifié [copie]** :
- `npm run build` OK ; `npm test` : **185 sur 185** ;
- module météo de la carte : 12,78 → 13,04 Ko (5,46 → 5,54 Ko gzip) ; chunk principal inchangé (87,58 → 87,59 Ko gzip).

**Essai réel de la fin d'un forçage [vérifié en local]** :
- montage : carte en développement sur 4212 (C1 à C4), API sur 8817, Chrome sans fenêtre (puce graphique du Mac) ;
- la neige est forcée 5 min, le minimum du contrat, depuis l'API ;
- chronologie relevée, en secondes depuis l'écriture du forçage :

| Moment | Ce qui se passe |
|---|---|
| 2,7 s | lecture de `/api/weather` lancée pendant le chargement de la ville |
| 21,2 s | état `admin`, neige 0,6 (valeur type) |
| 133,0 s puis 253,0 s | relectures toutes les 2 min (C4) |
| 300,8 s (fin + 0,8 s) | état `waiting`, neige 0 : la scène quitte le forçage à l'heure dite (minuterie de C3) |
| 305,0 s (fin + 5,0 s) | relecture de fin (C3) |
| 305,8 s (fin + 5,8 s) | état `live`, éclaircies : la météo réelle revient |

Sans CDN en local : le plafond du cache sur la fin d'un forçage reste à constater sur la prévisualisation (§ 6, point 4).

### C4 — carte : relecture toutes les 2 min (facultatif, Q1)
```diff
diff --git a/frontend/admin/src/pages/Meteo.tsx b/frontend/admin/src/pages/Meteo.tsx
index 5e902d9..6503994 100644
--- a/frontend/admin/src/pages/Meteo.tsx
+++ b/frontend/admin/src/pages/Meteo.tsx
@@ -235,8 +235,8 @@ function Force({ override }: { override: WeatherOverride | null }) {
         </div>
         <label>Motif (facultatif)<input maxLength={200} placeholder="ex. démo avec les amis" {...register('note')} /></label>
         <p className="hint">
-          Visible par tous les visiteurs d’ici 1 à 2 minutes (une carte déjà ouverte : à sa prochaine relecture), puis retour
-          automatique à la météo réelle à la fin. Le motif est enregistré dans le journal : pas de donnée personnelle.
+          Visible par tous les visiteurs en 4 minutes au plus (la carte relit toutes les 2 min, le cache garde 2 min), puis
+          retour automatique à la météo réelle à la fin. Le motif est enregistré dans le journal : pas de donnée personnelle.
         </p>
         <div className="bar">
           <button type="submit" disabled={put.isPending}>{f.mode === 'coupee' ? 'Couper pour tous' : 'Forcer pour tous'}</button>
diff --git a/frontend/carte/src/weather/client.test.ts b/frontend/carte/src/weather/client.test.ts
index c8191b7..bcc98c7 100644
--- a/frontend/carte/src/weather/client.test.ts
+++ b/frontend/carte/src/weather/client.test.ts
@@ -50,9 +50,9 @@ describe('lecture de /api/weather : la carte ne plante jamais', () => {
 });
 
 describe('quand relire', () => {
-  it('15 min après un succès ou une météo coupée, onglet visible et visiteur actif seulement', () => {
-    expect(nextRefresh(ok, 0, true, 0)).toBe(900_000);
-    expect(nextRefresh(ko('desactivee'), 0, true, 0)).toBe(900_000);
+  it('2 min après un succès ou une météo coupée, onglet visible et visiteur actif seulement', () => {
+    expect(nextRefresh(ok, 0, true, 0)).toBe(120_000);
+    expect(nextRefresh(ko('desactivee'), 0, true, 0)).toBe(120_000);
     expect(nextRefresh(ok, 0, false, 0)).toBeNull();
     expect(nextRefresh(ok, 0, true, 31 * 60_000)).toBeNull();
   });
@@ -66,9 +66,9 @@ const forcedBody = (untilMs: number) => ({ ...body, source: 'admin', model: null
 const forcedOk = (untilMs: number): WeatherFetch => ({ ok: true, body: forcedBody(untilMs) as never, ms: 1 });
 
 describe('fin d’une météo forcée par l’administration (US012)', () => {
-  it('relue 5 s après sa fin, au plus 15 min après la lecture, jamais moins de 30 s après', () => {
-    expect(nextRefresh(forcedOk(NOW + 10 * 60_000), 0, true, 0, NOW)).toBe(10 * 60_000 + 5_000);
-    expect(nextRefresh(forcedOk(NOW + 3600_000), 0, true, 0, NOW)).toBe(15 * 60_000);
+  it('relue 5 s après sa fin, au plus 2 min après la lecture (relecture ordinaire), jamais moins de 30 s après', () => {
+    expect(nextRefresh(forcedOk(NOW + 60_000), 0, true, 0, NOW)).toBe(65_000);
+    expect(nextRefresh(forcedOk(NOW + 3600_000), 0, true, 0, NOW)).toBe(120_000);
     expect(nextRefresh(forcedOk(NOW - 60_000), 0, true, 0, NOW)).toBe(30_000); // horloge du visiteur en avance : pas d'emballement
     expect(nextRefresh(forcedOk(NOW + 60_000), 0, false, 0, NOW)).toBeNull(); // onglet caché : rien
     expect(nextRefresh(forcedOk(NOW + 60_000), 0, true, 31 * 60_000, NOW)).toBeNull(); // visiteur parti : rien
@@ -111,11 +111,11 @@ describe('relectures programmées (minuteries simulées)', () => {
     expect(f).toHaveBeenCalledOnce();
   });
 
-  it('succès : relu toutes les 15 min ; onglet caché : rien ; au retour, relu si le relevé a plus de 15 min', async () => {
+  it('succès : relu toutes les 2 min ; onglet caché : rien ; au retour, relu si le relevé a plus de 2 min', async () => {
     const f = reply(200, body);
     const c = client(f);
     c.start();
-    await vi.advanceTimersByTimeAsync(15 * 60_000);
+    await vi.advanceTimersByTimeAsync(2 * 60_000);
     expect(f).toHaveBeenCalledTimes(2);
     visible = false;
     c.wake();
@@ -125,7 +125,7 @@ describe('relectures programmées (minuteries simulées)', () => {
     c.interaction();
     c.wake();
     await vi.advanceTimersByTimeAsync(0);
-    expect(f).toHaveBeenCalledTimes(3); // relevé de plus de 15 min : relu tout de suite
+    expect(f).toHaveBeenCalledTimes(3); // relevé de plus de 2 min : relu tout de suite
   });
 
   it('visiteur inactif depuis 30 min : plus de relecture ; il revient : relu tout de suite', async () => {
@@ -134,21 +134,21 @@ describe('relectures programmées (minuteries simulées)', () => {
     c.start();
     await vi.advanceTimersByTimeAsync(0);
     await vi.advanceTimersByTimeAsync(2 * 3600_000);
-    expect(f).toHaveBeenCalledTimes(3); // à 15 et 30 min ; à 45 min, inactif depuis plus de 30 min : plus rien
+    expect(f).toHaveBeenCalledTimes(16); // toutes les 2 min jusqu'à 30 min ; à 32 min, inactif depuis plus de 30 min : plus rien
     c.interaction();
     await vi.advanceTimersByTimeAsync(0);
-    expect(f).toHaveBeenCalledTimes(4);
+    expect(f).toHaveBeenCalledTimes(17);
   });
 
-  it('météo forcée qui finit dans 3 min : relue 3 min 5 s après la lecture, la météo réelle revient', async () => {
-    let answer: unknown = forcedBody(NOW + 3 * 60_000);
+  it('météo forcée qui finit dans 1 min : relue 1 min 5 s après la lecture, la météo réelle revient', async () => {
+    let answer: unknown = forcedBody(NOW + 60_000);
     const f = vi.fn(async () => new Response(JSON.stringify(answer), { status: 200 }));
     const c = client(f as unknown as typeof fetch);
     c.start();
     await vi.advanceTimersByTimeAsync(0);
     expect(results[0]).toMatchObject({ ok: true, body: { forced: true } });
     answer = body;
-    await vi.advanceTimersByTimeAsync(3 * 60_000 + 4_999);
+    await vi.advanceTimersByTimeAsync(60_000 + 4_999);
     expect(f).toHaveBeenCalledTimes(1);
     await vi.advanceTimersByTimeAsync(1);
     expect(f).toHaveBeenCalledTimes(2);
diff --git a/frontend/carte/src/weather/client.ts b/frontend/carte/src/weather/client.ts
index 72390a0..7e163bc 100644
--- a/frontend/carte/src/weather/client.ts
+++ b/frontend/carte/src/weather/client.ts
@@ -12,10 +12,16 @@ export type WeatherFetch =
 
 /** Délai de la lecture (D10) : un démarrage à froid de la fonction et une source lente peuvent dépasser 3 s ; rien ne l'attend */
 export const FETCH_TIMEOUT_MS = 8000;
-/** Relecture après un succès (le modèle avance par pas de 15 min) ; météo coupée par l'administration : relue au même rythme */
-export const REFRESH_MS = 15 * 60_000;
-/** Premier nouvel essai après un échec, puis 2, 4, 8 min… au plus REFRESH_MS */
+/**
+ * Relecture après un succès ou une météo coupée (US012) : toutes les 2 min, pour qu'une carte déjà ouverte voie un forçage de
+ * l'administration en 4 min au plus (2 min ici + 2 min de CDN) ; presque gratuit : le CDN répond (60 s), le back ne rappelle la
+ * source qu'à chaque pas de 15 min et ne relit la base que toutes les 30 min
+ */
+export const REFRESH_MS = 2 * 60_000;
+/** Premier nouvel essai après un échec, puis 2, 4, 8 min… au plus RETRY_MAX_MS */
 export const RETRY_MS = 60_000;
+/** Plafond des nouveaux essais après un échec (une panne n'est pas mise en cache par le CDN : chaque essai réveille la fonction) */
+export const RETRY_MAX_MS = 15 * 60_000;
 /** Sans interaction depuis ce temps, on ne relit plus (un onglet oublié ne réveille ni la fonction ni la base) */
 export const IDLE_MS = 30 * 60_000;
 /**
@@ -51,8 +57,8 @@ export async function fetchWeather(f: typeof fetch = fetch, timeoutMs = FETCH_TI
 /**
  * Délai avant la prochaine lecture (ms, compté depuis la dernière lecture `attemptAtMs`), ou null pour ne pas relire : jamais
  * sans API (404, carte du Pi) ; onglet caché ou visiteur inactif depuis 30 min : on attend son retour ; météo forcée : 5 s
- * après sa fin (au moins 30 s, au plus 15 min) ; 15 min après un succès ou une météo coupée ; après un échec, 60 s puis 2, 4,
- * 8 min, au plus 15 min.
+ * après sa fin (au moins 30 s, au plus REFRESH_MS) ; REFRESH_MS après un succès ou une météo coupée ; après un échec, 60 s puis
+ * 2, 4, 8 min, au plus 15 min.
  */
 export function nextRefresh(last: WeatherFetch, failures: number, visible: boolean, idleMs: number, attemptAtMs = 0): number | null {
   if (!last.ok && last.reason === 'absente') return null;
@@ -62,7 +68,7 @@ export function nextRefresh(last: WeatherFetch, failures: number, visible: boole
     return Math.min(REFRESH_MS, Math.max(FORCED_MIN_MS, end));
   }
   if (last.ok || last.reason === 'desactivee') return REFRESH_MS;
-  return Math.min(REFRESH_MS, RETRY_MS * 2 ** Math.max(0, failures - 1));
+  return Math.min(RETRY_MAX_MS, RETRY_MS * 2 ** Math.max(0, failures - 1));
 }
 
 /**
```

**Vérifié [copie]** : `npm run build` OK ; `npm test` : **185 sur 185**. Si Q1 = non, ne pas appliquer C4. C3 suffit pour la
fin d'un forçage, et l'avertissement de l'écran reste celui de C2.

### C5 — documents (clôture de l'itération)
- **README** :
  - API (l. 538) : routes `/api/admin/weather`, forçage et coupure (durée de 5 min à 6 h, `app_meta`, lecture bornée,
    `meteo-desactivee`) ;
  - administration (l. 529 et suivantes) : page Météo ;
  - carte (l. 139) : « forcée depuis l'administration (démo) », fin relue 5 s après ;
  - structure (l. 494) : `meteo/override-store.ts`, `pages/Meteo.tsx`.
- **FEATURES, CHANGELOG** (Demande de Dasco, Changements, Vérifié, Non vérifié), **BACKLOG** (cocher US012 ; la ligne EP008 :
  correspondance donnée, § 3.3).
- **DECISIONS**, une ligne chacune :
  - US012 avant EP008-US013, avec `edit_log` (Q2) ;
  - météo forcée jamais servie par le CDN après sa fin ;
  - réponse sans cache tant que le forçage n'a pas été lu ;
  - relecture de la carte à 2 min si Q1 = oui.
- **Spec** :
  - US012 : statut, et le critère « son téléphone la montre en moins de 2 min », vrai pour une carte ouverte après le forçage
    (pour une carte déjà ouverte : 4 min avec C4, 17 min sans) ;
  - US004 : la relecture passe à 2 min si C4 ;
  - epic : statut, « Non vérifié ».
- **Prévenir EP008** : les trois points du § 3.3 (le coordinateur relaie).

---

## 6. Vérifications sur la prévisualisation (à faire par le coordinateur et Dasco)

Prérequis :
- Q3 : base de prévisualisation ;
- `ADMIN_TOKEN` posé pour Preview ;
- pousser `feat/EP009-US012-meteo-admin` vers `preview/EP009-meteo`. Adresse :
  `https://city-chambery-git-preview-ep009-meteo-dasco2.vercel.app` (forme notée en mémoire, à confirmer) ;
- suivre le build par `gh api repos/DascoRM/city-chambery/commits/<sha>/statuses`.

```bash
eval "$(grep -E '^[[:space:]]*export[[:space:]]+VERCEL_AUTOMATION_BYPASS_SECRET=' ~/.zshrc | tail -1)"
H="x-vercel-protection-bypass: $VERCEL_AUTOMATION_BYPASS_SECRET"; P=https://city-chambery-git-preview-ep009-meteo-dasco2.vercel.app
curl -sS -H "$H" $P/api/health                                          # db.status: ok (sinon Q3)
curl -sS -D - -o /dev/null -H "$H" $P/api/weather | grep -iE 'cache-control|x-vercel-cache'   # 2 fois : MISS puis HIT
```
1. **Dasco**, dans `/admin/#/meteo` : l'écran est en « Direct », le relevé brut et l'instance sont remplis.
2. **Dasco** force la neige 15 min avec un motif. **Agent**, toutes les 20 s :
   `curl -sS -H "$H" $P/api/weather | grep -o '"forced":[a-z]*'`. Attendu : `true` en 2 min au plus. L'en-tête de la réponse
   forcée vaut `s-maxage=60, stale-while-revalidate=60`.
3. **Dasco**, téléphone : carte ouverte **après** le forçage, la neige est là en moins de 2 min, puce « Démo ». Carte ouverte
   **avant** : elle arrive à la relecture suivante (2 min avec C4, 15 min sans).
4. **Fin du forçage** : à `until` + 5 s, `forced:false` et `x-vercel-cache` qui n'est pas un `HIT` d'une réponse forcée (plafond
   du CDN, C1). Sur le téléphone, la neige s'efface à l'heure dite, puis la météo réelle revient en quelques secondes, sans
   « Indisponible ».
5. **Dasco** coupe la météo 5 min. **Agent** : `503`, `{"code":"meteo-desactivee"}`, `cache-control: no-store`.
6. **Dasco** clique « Revenir à la météo réelle » : `200` avec `forced:false` en 2 min au plus.
7. **Dasco**, page Parkings : son journal ne montre aucune ligne météo.

| Ce que tu vois | Cause probable |
|---|---|
| PUT : « Base indisponible » | pas de `DATABASE_URL_PREVIEW` (Q3), ou base injoignable |
| « Migrations manquantes » | `0001` (`edit_log`) pas appliquée sur la branche `preview` de Neon |
| forcée sur `/api/weather` mais pas sur la carte ouverte | relecture de la carte (15 min sans C4) : recharger la page |
| encore forcée 2 min après « Revenir à la météo réelle » | autre instance de la fonction (relit la base toutes les 2 min pendant un forçage) + 2 min de CDN : attendre 4 min au plus |
| neige encore là après `until` + 5 s | horloge du téléphone en retard, ou CDN : relever `x-vercel-cache` et l'en-tête |
| « Indisponible » pendant quelques secondes à la fin | C3 absent du déploiement |

---

## 7. Risques
| # | Risque | Parade |
|---|---|---|
| R1 | Réveils de Neon par la lecture du forçage | Bornée (30 min, 2 min pendant un forçage) ; ≈ 0 à 10 CU-h par mois selon l'usage [estimé, plan v2 § 6.3] ; mesure d'une semaine avec R1 d'EP008 |
| R2 | Plusieurs instances : forçage vu en 30 min au plus par une instance chaude qui ne l'a pas écrit | Rare à faible trafic (une seule fonction pour toute l'API, Fluid compute) ; une instance qui démarre lit tout de suite ; l'écran admin relit toujours la base [non vérifié sur Vercel] |
| R3 | Horloges différentes (téléphone, CDN, fonction) | Marge de 5 s, relecture au moins toutes les 30 s, plafond du CDN calculé par la fonction |
| R4 | Migration d'EP008 qui classe les lignes météo en retouches de parkings | Correspondance du § 3.3, à faire porter par EP008 |
| R5 | Conflits de fichiers avec EP008 | § 3.4 : quelques lignes, aux mêmes ancrages |
| R6 | Test Parkings « revue M1 » fragile sous charge | Observé 1 fois sur 4 passages complets à charge 12 à 20 ; à surveiller, sans lien avec US012 |
| R7 | Un forçage écrit à la main en base (plus de 6 h, condition inconnue) | Ignoré par `parseOverride`, signalé dans les journaux |

---

## 8. Vérifié / non vérifié

**Vérifié**
- Branches et commits : `29cbd0d`, `48ffd36`, `dbcc631`, `docs/EP008-v2-admin` (`acde893`).
- Code d'aujourd'hui (back, contrat, admin, carte) et spec d'US012 ; spec et plans d'EP008 (absence d'`app_meta` et de la
  météo, `CHECK` d'`audit_log`, étape 4 de la migration).
- Dans la copie, à chaque commit : `npm run build` et `npm test` (177, 183, 185, 185) ; `check-api-esm` avec les variables de
  Vercel ; C1 et C2 sur `29cbd0d` (build, 164 tests).
- C1 à C4 s'appliquent en série sur `48ffd36` et sur `8384d0b` (tête actuelle de `feat/EP009-meteo`), avec un code
  identique à celui de la copie vérifiée.
- Essai local de bout en bout de l'API (8817), avec la base PGlite de la copie et un vrai appel à Open-Meteo :
  - météo réelle et son en-tête ; forçage vu par la route publique ;
  - écran admin `no-store`, avec le relevé réel pendant le forçage ;
  - retour au réel (204 puis 404) ; coupure (503 `meteo-desactivee`, `no-store`) ;
  - 401 sans session, 403 depuis une autre origine ; journal des parkings sans ligne météo.
- Écran admin dans Chrome sans fenêtre (captures) et fin d'un forçage sur la carte en développement (§ 5, C3).

**Non vérifié**
- Le comportement du CDN de Vercel avec un `s-maxage` variable, la fin réelle d'un forçage derrière le CDN, la propagation
  entre instances sur Vercel (§ 6).
- La base de la prévisualisation (Q3).
- Le rendu de la neige forcée sur un téléphone.
- La consommation réelle de Neon.
- L'intégration par EP008 de la correspondance du § 3.3.
