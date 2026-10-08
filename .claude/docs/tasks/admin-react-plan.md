# Plan : administration en React (EP008, US005 à US010)

Auteur : Claude, sub-agent chercheur / planificateur front admin. Date : 08/10/2026. **Aucun code écrit ni modifié.**
« Mesuré » = vérifié dans le dépôt ou sur le registre npm ce jour ; « estimé » = jugement, à confirmer.

Lu : `context.md`, EP008 (`epic.md`, US005 à US010), `DECISIONS.md`, ADR-001, `tasks/analyse-back-end-admin.md`,
`public/admin/*` (admin livrée par US005 : 45 + 60 + 25 lignes), `server/app.ts`, `server/auth.ts`, `server/env.ts`,
`server/db/schema.ts`, `api/index.ts`, `vite.config.ts`, `vercel.json`, `deploy/nginx.conf`, `Dockerfile`,
`src/content/parkings.json`, `src/content/pois.json`, `src/dev/placement.ts`, `src/dev/position-picker.ts`,
`src/scene/parking-edits.ts`, `src/ui/parking-card.ts`.

Hypothèse de travail : un autre agent planifie le cloisonnement (`apps/site`, `apps/admin`, `apps/api` ou équivalent,
et un paquet `shared/` avec les schémas Zod du contrat API). Ce plan dit ce que l'admin **attend** de ce cloisonnement
(§ 3.1) et comment avancer s'il n'est pas prêt.

---

## 0. En bref

- **Pile proposée** : React 19.3 + Vite 8 (`@vitejs/plugin-react` 6) · routage **wouter** 3 · données **TanStack Query** 5 ·
  formulaires **React Hook Form** 7 + `@hookform/resolvers` 5 + **schémas Zod 4 partagés** · **CSS simple** (reprise des
  jetons de `admin.css`), `<dialog>` natif, pas de bibliothèque d'UI · carte : **à trancher** (§ 2.6), par défaut
  **plan 2D Leaflet sans fond de carte, dessiné depuis `city.json`**, la vue 3D du diorama en seconde étape.
- **Intégration** : application Vite séparée, `base: '/admin/'`, sortie dans `dist/admin/` ; même domaine que le site et
  l'API (pas de CORS) ; exclue du service worker (déjà le cas : `globIgnores: ['admin/**']`, `navigateFallbackDenylist`).
- **Coût** : ≈ **11 à 14 jours** de front pour tout l'écran d'administration d'EP008 (dont ≈ 2 jours de surcoût
  « React » : socle + migration de la page actuelle) ; le back-end correspondant est à planifier à part.
- **Poids** : ≈ 110 à 130 Ko gzip pour l'admin hors carte (estimé), carte chargée à la demande (+42 Ko Leaflet, ou
  ≈ +170 Ko si l'on réutilise three.js). Sans effet sur le site public.

---

## 1. Écrans nécessaires

Toutes les routes sont sous `/admin/`. Toutes les requêtes passent par un seul client `api()` qui ajoute le jeton,
valide la réponse avec le schéma Zod partagé et traduit les erreurs (codes de l'admin actuelle : 401, 429, 503
`admin-non-configuree`, 404 « plateforme » vs 404 « API »).

Légende API : **existe** = déjà dans `server/app.ts` ; **à créer** = endpoint proposé, à valider avec le plan back-end.

| # | Écran (route) | US | Contenu | Actions | Appels API |
|---|---|---|---|---|---|
| E1 | Connexion (`/admin/login`) | US005 | champ jeton (type password), message d'erreur, plus tard bouton « Se connecter avec GitHub » | se connecter | `GET /api/admin/status` (existe, sert de test du jeton) ; plus tard `GET /api/admin/auth/github` |
| E2 | Tableau de bord (`/admin/`) | US005, US008, US010 | **existant** : version, environnement, Node, région, état de la base, taille, lignes par table. **À ajouter** : joueurs actifs (7 j / 30 j), appels par jour (graphique simple en barres CSS, pas de bibliothèque), part des quotas Vercel et Neon, **bandeau d'alerte à 70 %** (US008), date de la dernière sauvegarde (US010), retouches en attente de publication | actualiser, se déconnecter, aller aux retouches en attente | `GET /api/admin/status` (existe) ; `GET /api/admin/usage` (à créer : compteurs en base, voir risque R4) |
| E3 | Parkings, liste (`/admin/parkings`) | US006 | les 152 parkings de `city.json` (mesuré) + les `added` ; colonnes : nom, id OSM, type, tarif (payant / gratuit / inconnu), capacité (connue / ≈ estimée / inconnue), état (retouché, masqué, ajouté, brouillon) ; recherche par nom / id ; filtres « inconnus », « retouchés », « masqués » | ouvrir, « Ajouter un parking absent d'OSM » | `GET /data/city.json?v=…` (fichier statique, **pas d'appel de fonction**) + `GET /api/admin/edits?kind=parking` (à créer) |
| E4 | Parking, fiche (`/admin/parkings/:id`, `/admin/parkings/new`) | US006, US007 | formulaire = modèle `ParkingOverride` de `src/scene/parking-edits.ts` : masquer, nom, tarif (oui / non / inconnu), capacité, type, position `[x, y]`, note, **source obligatoire** (libellé + URL ou « relevé sur place, date ») ; **aperçu** de la fiche telle que le joueur la verra (même fonction que le site) ; mini-carte centrée sur le parking | enregistrer en brouillon, publier, annuler une retouche, « choisir sur la carte » (→ E6 puis retour avec la position) | `POST /api/admin/edits` (à créer), `PATCH /api/admin/edits/:id`, `POST /api/admin/edits/:id/publish`, `DELETE /api/admin/edits/:id` |
| E5 | Lieux d'histoire (`/admin/lieux`, `/admin/lieux/:id`) | US006, US007 | les 8 fiches de `pois.json` (lecture : le fichier est dans le bundle du site, l'admin l'importe depuis `shared/` ou le lit via l'API) ; **périmètre v1 = position seulement** (`pos`, remplace `osm.match` à l'affichage), + source de la position ; textes en lecture seule (voir décision D6) | placer / déplacer, brouillon, publier | mêmes endpoints que E4 avec `kind=poi` |
| E6 | Carte de position (`/admin/carte?pour=parking:way/123`) | US007 | carte plein écran ; clic → position `[x, y]` (mètres du diorama, arrondie au décimètre comme `position-picker.ts`), bâtiment, parking, rue les plus proches (même logique `describe()` / `nearestStreet()` que `position-picker.ts`, à déplacer dans `shared/`) ; repère du point cliqué ; repères des retouches existantes | « Utiliser cette position » (retour au formulaire d'origine), copier la position (comme l'outil `?debug`) | `GET /data/city.json?v=…` seulement |
| E7 | Journal (`/admin/journal`) | US006 | retouches datées et attribuées (jeton = « admin », puis login GitHub) : date, cible, champs changés (avant → après), source, état (brouillon / publiée / annulée / exportée) | filtrer par cible, annuler une retouche publiée (crée une retouche inverse) | `GET /api/admin/journal?cursor=` (à créer) |
| E8 | Sauvegarde (`/admin/sauvegarde`) | US006, US010 | date du dernier export JSON dans le dépôt et de la dernière sauvegarde de la base, lien vers le commit, procédure de restauration (lien README) | « Exporter maintenant » (déclenche l'action GitHub), télécharger l'export JSON courant | `GET /api/admin/backups`, `POST /api/admin/export` (à créer), `GET /api/admin/export.json` |

Non retenu dans l'admin (hors EP008 ou trop tôt) : gestion des joueurs et modération des pseudos (US004 / US009 :
un écran « Joueurs » viendra avec elles, 1 jour estimé), régénération de la ville (`npm run data`, analyse du 06/10, S2).

### Règles transverses à l'écran
- **Jamais de HTML construit à partir de données** : React échappe par défaut ; interdire `dangerouslySetInnerHTML`
  (vérification `grep` dans `npm run build` ou une règle de test, le projet n'a pas d'ESLint).
- Source obligatoire vérifiée **deux fois** : même schéma Zod côté formulaire (retour immédiat) et côté serveur (règle 3
  de l'epic : aucune confiance dans le navigateur).
- Brouillon / publié : l'aperçu montre l'état « après publication » ; la publication demande une confirmation (`<dialog>`).
- Interface en français, tutoiement comme l'admin actuelle ; ordinateur d'abord, mais utilisable sur téléphone (16 px de marge).

---

## 2. Pile proposée et comparée

Versions et licences **mesurées sur le registre npm le 08/10/2026** (`https://registry.npmjs.org/<paquet>/latest`) ;
poids gzip de bundlephobia (`https://bundlephobia.com/api/size?package=…`) quand il est fiable, sinon « estimé ».

### 2.1 React 19 ou Preact

| | React 19.3.0 + react-dom 19.3.0 | Preact 11.0.1 (+ `preact/compat`) |
|---|---|---|
| Licence | MIT | MIT |
| Poids | ≈ 60 Ko gzip pour `react` + `react-dom/client` (**estimé** : bundlephobia ne mesure que l'entrée de `react-dom`, 1,4 Ko, chiffre trompeur) | ≈ 5 Ko gzip (mesuré, 4,9 Ko) |
| Écosystème (RHF, TanStack Query, Testing Library) | natif | par `preact/compat` ; marche en général, cas limites possibles |
| Maturité | 19.x stable | **11.0.1 publiée le 08/10/2026** (aujourd'hui) : majeure toute neuve |
| Plugin Vite 8 | `@vitejs/plugin-react` 6.1.2 (peer `vite ^8`) | `@preact/preset-vite` 2.10.6 (peer jusqu'à `8.x`, exige `@babel/core`) |

**Recommandation : React 19.** L'admin sert une personne, sur ordinateur, chargée une fois : 55 Ko de plus n'ont aucun
effet sur les joueurs. React évite les surprises de compatibilité, c'est ce que Dasco a demandé, et la doc ou l'aide de
l'assistant sont plus fiables. Preact n'a d'intérêt que pour un site public sensible au poids, ce que l'admin n'est pas.
Le React Compiler (`babel-plugin-react-compiler`) n'est pas utile ici : on s'en passe.

### 2.2 Routage

| | wouter 3.13.0 | React Router 8.4.0 | TanStack Router 1.170.41 |
|---|---|---|---|
| Licence | **Unlicense** (domaine public) | MIT | MIT |
| Poids gzip | 2,7 Ko (mesuré) | jusqu'à 59 Ko (mesuré pour tout le paquet ; moins en mode déclaratif après élagage, non mesuré) | 30 Ko (mesuré) |
| Points forts | 8 routes, `base="/admin"`, API minimale | standard, très documenté | routes et paramètres typés |
| Points faibles | pas de chargement de données intégré (TanStack Query le fait) | la v8 pousse le « mode framework » (serveur, chargeurs) : inutile ici ; majeures fréquentes (v7 → v8 en un an) | génération de code par plugin, courbe d'apprentissage |

**Recommandation : wouter.** Huit routes, aucune donnée chargée par le routeur, `base` géré. Si Dasco veut le standard
le plus répandu, React Router en mode déclaratif est l'alternative ; TanStack Router est surdimensionné.

### 2.3 Données

| | TanStack Query 5.104.1 (MIT, 13,4 Ko gzip mesuré) | `fetch` + `useEffect` maison |
|---|---|---|
| Cache, rechargement après une écriture, états chargement / erreur, nouvelle tentative | fournis (`invalidateQueries` après publication) | à écrire et tester à la main |
| Base qui se réveille (Neon, veille après 5 min) | `retry` réglable : 1 nouvelle tentative après 1,5 s couvre le réveil | à écrire |
| Coût | une dépendance de plus | 0 Ko, mais ≈ 150 lignes à maintenir |

**Recommandation : TanStack Query** dès qu'il y a plus de deux écrans avec écritures (E3 à E8). Réglages : `staleTime`
30 s, `retry: 1`, `refetchOnWindowFocus: false` (chaque appel est une invocation Vercel ; rester sobre, US008).

### 2.4 Formulaires et validation

- **React Hook Form 7.89.0** (MIT, 14,4 Ko gzip mesuré) + **`@hookform/resolvers` 5.9.1** (MIT ; peer `zod ^3.25 || ^4`,
  compatible avec le `zod ^4.6.5` du dépôt).
- **Les schémas viennent de `shared/`** : `ParkingOverrideSchema`, `AddedParkingSchema`, `PoiPositionSchema`,
  `SourceSchema` (libellé non vide + URL https ou mention « relevé sur place, AAAA-MM-JJ »), `AdminStatusSchema`,
  `UsageSchema`, `EditSchema`, `JournalPageSchema`. Le serveur Hono les utilise pour valider (`zValidator` ou
  `schema.parse`), l'admin pour le formulaire **et** pour vérifier les réponses (`safeParse` dans `api()` : un écart de
  contrat devient un message clair au lieu d'un écran blanc).
- Les mêmes schémas devraient remplacer, côté site, les contrôles écrits à la main de `parking-edits.ts` (`isPt`, `KINDS`) :
  à proposer au plan de cloisonnement, pas obligatoire pour l'admin.
- Alternative écartée : formulaires contrôlés sans bibliothèque (faisable pour 5 champs, mais E4 en a 9 avec des champs
  conditionnels et des erreurs par champ ; RHF le fait sans re-rendus).

### 2.5 Interface

| Option | Licence | Pour | Contre |
|---|---|---|---|
| **CSS simple** (jetons de `admin.css` : `--ink`, `--paper`, `--line`, `--teal`, `--bad`, sombre auto) + CSS Modules (fournis par Vite) | — | déjà écrit (25 lignes), cohérent avec le site, aucun outil de plus, CSP `style-src 'self'` facile | composants (tableau triable, onglets) à écrire, ≈ 0,5 j |
| Pico CSS 2.1.1 | MIT | joli sans classes, 1 fichier | look générique, on se bat contre ses styles pour coller au site ; dernière version stable 2.1.1 (mesuré) |
| shadcn/ui + Radix (`radix-ui` 1.7.0) + Tailwind 4.3.3 | MIT | composants accessibles, rapides à assembler | chaîne Tailwind en plus, composants copiés dans le dépôt à maintenir, beaucoup pour 8 écrans ; Tailwind ne sert nulle part ailleurs dans le projet |

**Recommandation : CSS simple**, `<dialog>` natif pour les confirmations, `<details>` pour les sections repliables.
Si un composant accessible manque (menu déroulant complexe, infobulle), ajouter **un seul primitif Radix** à la demande.

### 2.6 Carte de position (US007) : la vraie question

Fait mesuré qui change tout : les positions du projet sont en **mètres locaux** (`pos: [x, y]`, origine
lat 45.56575, lon 5.9205, projection équirectangulaire `111 320 × cos(lat)` dans `scripts/fetch-osm.mjs`, emprise
± 662 × ± 583 m). Et **US007 demande « même rendu que l'application (même moteur) »**.

| Option | Licence / coût | Effort (estimé) | Pour | Contre |
|---|---|---|---|---|
| **A. Vue 3D du diorama (three.js)**, chargée à la demande dans l'admin | three MIT ; ≈ 170 Ko gzip (≈ 79 % des 216 Ko du site, DECISIONS 30/09) + `city.json` 1,4 Mo | **3 à 4 j** dont 2 de refactorisation : extraire de `src/main.ts` (559 lignes) une fonction `createDioramaView(container, data, { lite: true })` (scène, relief, bâtiments, rues, parkings, repères ; sans jeu, passants, oiseaux, lobby) | **remplit la spec à la lettre** ; mêmes coordonnées, même `screenRay` / `pickTargets` que `position-picker.ts` ; Dasco voit exactement ce que voient les joueurs | dépend du cloisonnement (le moteur doit devenir importable par l'admin) ; risque de régression sur le site pendant la refactorisation ; lourd sur un vieux portable |
| **B. Plan 2D Leaflet sans fond de carte** (`L.CRS.Simple`, coordonnées = mètres du diorama), polygones dessinés depuis `city.json` : bâtiments, rues, parkings, eau | Leaflet 1.9.4 **BSD-2-Clause**, 41,7 Ko gzip (mesuré) ; **pas de tuiles**, donc ni politique d'usage OSM ni CSP externe | **1,5 à 2 j** | aucune conversion de coordonnées ; aucune dépendance au moteur 3D ; vue de dessus précise pour cliquer ; marche dès le socle | ne respecte pas « même moteur » ; pas de relief ni de hauteurs ; Leaflet 1.9.4 date de mai 2023 (2.0 en alpha) : stable mais peu actif |
| C. Leaflet + tuiles OSM raster | Leaflet BSD-2 ; tuiles : [politique d'usage OSMF](https://operations.osmfoundation.org/policies/tiles/) (attribution visible, Referer valide, pas de préchargement ni hors-ligne ; usage interactif faible accepté) | 2 j | fond familier (noms de rues, commerces) | conversion mètres ↔ lat/lon à écrire et tester ; CSP `img-src https://tile.openstreetmap.org` ; `Referrer-Policy: no-referrer` actuel sur `/admin` **contredit** la politique OSM (Referer exigé) : à assouplir |
| D. MapLibre GL 6.13.0 + tuiles vectorielles | BSD-3-Clause ; **280 Ko gzip** (mesuré) ; tuiles vectorielles gratuites à trouver (OpenFreeMap ou autre, non vérifié) | 2,5 j | rendu vectoriel net, rotation | le plus lourd ; WebGL + worker (`worker-src blob:` dans la CSP) ; conversion de coordonnées ; un deuxième moteur WebGL à côté de three.js |

- **react-leaflet 5.0.0 est sous licence Hippocratic 2.1** (mesuré), qui n'est pas une licence open source au sens de
  l'OSI (clauses « droits humains ») : à éviter ; Leaflet s'utilise très bien directement dans un `useEffect`
  (≈ 60 lignes de composant).
- **Recommandation par défaut : B maintenant, A ensuite si Dasco le veut.** B débloque US006 (choisir une position dans
  le formulaire) sans attendre le cloisonnement ni toucher au site ; A reste la cible de la spec et peut remplacer la
  carte derrière la même interface `<PositionPicker onPick={(pos, where) => …} />`. Si Dasco tient au « même moteur »
  dès le départ : A directement (+1,5 à 2 j, et dépendance forte au cloisonnement). C et D écartés : un fond OSM
  n'apporte que les noms de commerces, au prix de la conversion, de la CSP et du Referer.
- Dans tous les cas, la logique « quoi est sous le clic » (`describe`, `nearestStreet`, `pointInPoly`) passe dans
  `shared/` (fonctions pures, testables), utilisée par l'outil `?debug` du site et par l'admin.

### 2.7 Tests

- **Vitest 4** (déjà dans le dépôt) + **@testing-library/react 16.3.3** (MIT, peer React 18/19) +
  `@testing-library/user-event` + environnement **happy-dom 20.14.5** (MIT, plus léger) ou jsdom 30.1.2 (MIT, plus
  complet) ; happy-dom suffit pour des formulaires. Pas de MSW : un `fetch` simulé par test suffit pour huit endpoints.
- À tester (≈ 25 à 35 tests, estimé) : schémas partagés (source obligatoire, position dans l'emprise, capacité > 0) ;
  client `api()` (traduction de 401 / 429 / 503 / 404 plateforme, réponse hors contrat) ; garde de route (sans jeton →
  login ; jeton refusé → effacé) ; formulaire parking (erreur si source vide, aperçu mis à jour, brouillon puis
  publication) ; `describe()` de la carte (fonction pure, sans WebGL) ; absence de `dangerouslySetInnerHTML`.
- La carte elle-même (Leaflet ou three.js) se vérifie dans le navigateur, pas en test unitaire (rendu WebGL logiciel non
  représentatif, règle 6 du projet).

---

## 3. Intégration

### 3.1 Ce que l'admin attend du cloisonnement
```
apps/site/      (ou src/ actuel)  TS vanilla + three.js, inchangé
apps/admin/     React ; vite.config.ts propre ; base '/admin/' ; build → dist/admin/
api/ + server/  Hono (inchangé)
shared/         schémas Zod du contrat API + fonctions pures réutilisées :
                applyParkingEdits, données de la fiche parking (parking-card.ts sans DOM), describe()/nearestStreet(),
                types CityData / Parking / Pt, conversion mètres ↔ lat/lon
```
- Importé par alias TypeScript (`paths`) ou espace de travail npm (`workspaces`) : au choix de l'autre plan ; l'admin
  n'a besoin que d'`import { ParkingOverrideSchema } from '@diorama/shared'`.
- **Si le cloisonnement n'est pas prêt** : démarrer l'admin dans `admin/` à la racine avec un alias vers `server/` et
  `src/scene/parking-edits.ts` ; le déplacement ensuite est mécanique (≈ 0,5 j). Ne pas bloquer ADM-01 dessus.

### 3.2 Build et service
- **Application Vite séparée** plutôt que multi-page dans `vite.config.ts` du site : le plugin React, la CSP et les
  dépendances de l'admin ne touchent pas le site ; le site garde son découpage three.js et son PWA.
- `npm run build` : vérification des types du site, de l'API, **de l'admin**, puis `vite build` du site (vide `dist/`),
  puis `vite build -c apps/admin/vite.config.ts` avec `outDir: dist/admin`, `emptyOutDir: false` pour l'admin seulement
  sur son dossier (ou ordre inverse avec vidage maîtrisé). Un seul `dist/`, donc **rien à changer à Vercel** (`outputDirectory: dist`)
  **ni au Dockerfile** (`COPY --from=build /app/dist`).
- **Supprimer `public/admin/`** au moment de la bascule : Vite copie `public/` dans `dist/` et écraserait / mélangerait
  les fichiers.
- **Routes profondes** (`/admin/parkings/way/123` rechargé) :
  - Vercel : ajouter dans `rewrites` `{ "source": "/admin/:path*", "destination": "/admin/index.html" }` (après les
    fichiers réels : Vercel sert d'abord le fichier statique existant) et garder la règle `/api/:path*`.
  - nginx (Pi) : `location /admin/ { add_header Cache-Control "no-cache"; try_files $uri /admin/index.html; }` et
    `location /admin/assets/ { … immutable … }` ; sans ça, `location /` renverrait l'`index.html` **du site**.
  - Identifiants OSM avec `/` (`way/123`) : encoder (`way%2F123`) ou utiliser `?id=` ; à fixer dans ADM-01.
- **Cache** : `/admin/assets/*` à empreinte → 1 an immuable (la règle Vercel actuelle ne vise que `/assets/`, à étendre) ;
  `/admin/index.html` → `no-cache`.
- **Service worker du site** : déjà exclu (`globIgnores: ['admin/**']`, `navigateFallbackDenylist: [/^\/admin/]`,
  `vite.config.ts`). À **vérifier après bascule** : un visiteur qui a le SW installé et ouvre `/admin/` ne doit pas recevoir
  l'`index.html` du jeu (test manuel dans le navigateur, SW actif). L'admin, elle, n'a **pas** de service worker.
- **Le Pi** : l'image Docker est nginx seul, **sans API**. L'admin y sera servie mais ne marchera que si `/api/` y existe :
  soit nginx fait proxy de `/api/` vers Vercel (cookies / jeton : même origine apparente, simple), soit le Pi fait tourner
  `server/dev.ts` (Node + `@hono/node-server`) dans un second conteneur. Décision D5, hors admin.

### 3.3 Authentification
**Étape 1 (reprise de l'existant, US005)** : jeton saisi, gardé en `sessionStorage` (`diorama-admin-token`), envoyé en
`Authorization: Bearer`. Disparaît à la fermeture de l'onglet. Problèmes connus :
- **Pas d'expiration** : le jeton est le secret maître lui-même ; volé une fois (XSS, poste partagé), il vaut jusqu'à
  sa rotation à la main dans Vercel.
- Lisible par tout script de la page : la CSP stricte est la vraie protection.

**Étape 1 bis, recommandée avec US006 (premières écritures)** : `POST /api/admin/session` échange le jeton contre un
**cookie de session `HttpOnly; Secure; SameSite=Strict; Path=/api/admin`**, signé (HMAC, secret Vercel), **2 h glissantes,
8 h maximum** (estimé, à choisir par Dasco). Le jeton maître ne reste plus dans le navigateur ; `SameSite=Strict` + même
origine suffisent contre la falsification de requêtes (pas de jeton CSRF à gérer tant que l'API n'accepte pas les
formulaires d'autres sites ; garder `form-action 'none'` et exiger `Content-Type: application/json` sur les écritures).
Coût : ≈ 0,5 j back + 0,25 j front. Côté React, rien ne change sinon `credentials: 'same-origin'` et la disparition du
stockage.
- Attention : `Path=/api/admin` et les prévisualisations Vercel (domaine différent) : chaque domaine a sa session, normal.

**Étape 2 : GitHub** (OAuth App ou GitHub App, gratuit) : bouton → `/api/admin/auth/github` → retour
`/api/admin/auth/callback` → vérification du login dans une liste blanche (`ADMIN_GITHUB_LOGINS=dascoRM`) → même cookie
de session. Le journal (E7) gagne l'auteur réel. Points durs : **URL de rappel par domaine** (production, `release`,
`preview/**` ont des domaines différents : une app OAuth par environnement, ou rappel unique en production et sessions
seulement en production), état `state` anti-rejeu. ≈ 1,5 j back + 0,5 j front (estimé). Le jeton reste en secours.

### 3.4 CSP et sécurité
- Aujourd'hui : CSP en `<meta>` dans `public/admin/index.html` (`default-src 'self'; style-src 'self'; script-src 'self';
  connect-src 'self'; base-uri 'none'; form-action 'none'`) et en-têtes `X-Robots-Tag: noindex, nofollow` +
  `Referrer-Policy: no-referrer` sur `/(admin|api)(.*)` dans `vercel.json`.
- **Passer la CSP en en-tête HTTP** (Vercel `headers` pour `/admin/(.*)`, et `add_header` nginx) pour pouvoir ajouter
  `frame-ancestors 'none'` (sans effet en `<meta>`) ; garder la `<meta>` en double sécurité.
- Compatibilité React / Vite avec cette CSP : le build Vite ne produit pas de script en ligne pour une app sans
  `modulepreload` en ligne (à vérifier sur le premier build, `build.modulePreload.polyfill: false` au besoin) ; React
  applique les `style={…}` par le CSSOM, **autorisé** par `style-src 'self'` (seuls les attributs `style=""` du HTML et
  les `<style>` sont bloqués). Leaflet : idem, plus son fichier CSS importé ; images de marqueurs par défaut à remplacer
  par des `divIcon` (pas de `data:`). Option A (three.js) : `blob:` peut être nécessaire pour certains chargeurs (meshopt
  décodeur en worker ? non vérifié) → `worker-src 'self' blob:` si besoin.
- Ajouter `img-src 'self' data:` seulement si nécessaire ; `connect-src 'self'` suffit (même domaine pour API et
  `city.json`).
- Garder `noindex` (meta + en-tête), `Cache-Control: no-store` des réponses API (déjà fait dans `app.ts`).
- Déconnexion : vider le cache TanStack Query (`queryClient.clear()`) en plus du jeton / cookie.

---

## 4. Migration et découpage

### 4.1 Ordre
1. **ADM-01 Socle** : `apps/admin` (ou `admin/`), Vite + React + wouter + TanStack Query, `api()` validé par Zod, garde
   d'authentification, mise en page (en-tête, navigation, jetons CSS repris), tests en place, build intégré, règles Vercel
   et nginx, CSP en en-tête.
2. **ADM-02 Parité** : connexion + tableau de bord existant **à l'identique** (mêmes messages d'erreur, mêmes libellés
   `DB_LABEL`), puis suppression de `public/admin/`. Vérification sur une prévisualisation `preview/**`.
3. Puis les nouvelles fonctions, dans l'ordre conseillé par l'epic (US006 et US007 d'abord).

### 4.2 Découpage (jours de front ; back-end non compté sauf mention)

| ID | Contenu | US EP008 | Jours | Dépend de |
|---|---|---|---|---|
| ADM-01 | Socle React, build, routes Vercel / nginx, CSP en en-tête, client API + schémas partagés, tests | US005 | 1,5 | décision D1 ; cloisonnement **souhaité** (sinon dossier `admin/` provisoire, +0,5 j plus tard) |
| ADM-02 | Migration de la page actuelle (connexion, état), suppression de `public/admin/`, vérif. SW | US005 | 0,5 à 1 | ADM-01 |
| ADM-03 | Session par cookie `HttpOnly` (front) | US005 | 0,25 (+0,5 back) | ADM-02 ; avant ADM-05 |
| ADM-04 | Carte de position, option B (Leaflet 2D, `describe()` partagé) | US007 | 1,5 à 2 | ADM-01, `shared/` (fonctions pures) |
| ADM-05 | Parkings : liste, fiche, aperçu, brouillon / publication, ajout | US006 | 2,5 à 3 | ADM-01, ADM-04 ; back : table `edits`, endpoints E3/E4, lecture publique des retouches par le site |
| ADM-06 | Lieux : position + source | US006 | 1 | ADM-05 (même formulaire générique) |
| ADM-07 | Journal + annulation | US006 | 1 | ADM-05 ; back : journal |
| ADM-08 | Tableau de bord : usage, quotas, alerte 70 % | US005, US008 | 1 | ADM-02 ; back : compteurs `GET /api/admin/usage` (US008) |
| ADM-09 | Sauvegarde / export | US006, US010 | 0,5 | ADM-07 ; back : action GitHub d'export |
| ADM-10 | Connexion GitHub (front) | US005 | 0,5 (+1,5 back) | ADM-03 |
| ADM-11 *(option)* | Carte 3D « même moteur » (option A) | US007 | 3 à 4 | cloisonnement **obligatoire** (moteur importable) ; ADM-04 (même interface) |
| | **Total sans ADM-11** | | **≈ 10,5 à 12** | |
| | **Total avec ADM-11** | | **≈ 13,5 à 16** | |

Comparaison honnête : l'epic compte 3 + 5 + 3 + 2 + 2 = 15 points pour US005 à US010 côté admin **et** back-end, et
« 6 à 8 sessions » pour toute l'epic. Ce plan, front seul, est plus large que l'estimation de l'epic ; l'écart vient du
socle React (≈ 2 j, qu'une page vanilla n'aurait pas eu), de la carte et du brouillon / publication. Les chiffres sont
des estimations sans mesure : marge d'erreur ± 30 %.

### 4.3 Dépendances avec les US d'EP008
- **US006 (back)** doit définir où vivent les retouches : table `edits` (cible, champs, source, auteur, état, dates) et
  **comment le site les lit** (« effet immédiat sans redéploiement ») : `GET /api/edits` public, mis en cache
  (`s-maxage` CDN court, US008), fusionné par `applyParkingEdits` au chargement, avec repli sur `parkings.json` si l'API
  ne répond pas (règle 2 de l'epic). L'admin n'en dépend que par le contrat Zod.
- **US008** fournit les compteurs et seuils ; l'admin ne fait qu'afficher.
- **US010** fournit l'export (action GitHub planifiée, qui écrit un JSON dans le dépôt) ; l'admin affiche l'état et
  déclenche.
- **US002 à US004, US009** : rien dans l'admin avant elles ; un écran « Joueurs » plus tard.

### 4.4 Taille du bundle (estimé, gzip)
| Morceau | Ko |
|---|---|
| React + react-dom/client | ≈ 60 (estimé) |
| wouter | 2,7 (mesuré) |
| TanStack Query | 13,4 (mesuré) |
| React Hook Form + resolvers | ≈ 15 (14,4 mesuré + ≈ 1) |
| Zod 4 (schémas partagés) | ≈ 15 à 20 (estimé ; `zod/mini` plus léger si besoin) |
| Code de l'admin | ≈ 15 à 25 (estimé) |
| **Total au chargement** | **≈ 120 à 135** |
| Carte B, à la demande | +41,7 (Leaflet, mesuré) + `city.json` 1,4 Mo (≈ 400 Ko gzip ; souvent déjà dans le cache HTTP du navigateur si l'admin demande la même adresse `?v=` que le site, non vérifié) |
| Carte A, à la demande | ≈ +170 (three.js) + `city.json` |

Objectif à inscrire dans ADM-01 : **< 150 Ko gzip au chargement**, carte en `import()` séparé. Aucun effet sur le site.

---

## 5. Risques et décisions

### 5.1 Risques
| # | Risque | Effet | Parade |
|---|---|---|---|
| R1 | Refactorisation de `main.ts` pour la carte 3D (option A) | régression du site (jeu, balade, perf iPhone ≤ 31 img/s) | option B d'abord ; A seulement après cloisonnement, mesures `?debug` avant / après |
| R2 | Routes `/admin/*` mal réécrites (Vercel ou nginx) | 404 ou `index.html` du jeu servi à l'admin ; déjà vécu (commits `39d9277`, `07309ef`) | tests manuels sur `preview/**` et dans Docker local avant fusion ; liste de contrôle des URL |
| R3 | Service worker du site déjà installé qui intercepte `/admin/` | admin introuvable pour Dasco sur son propre navigateur | déjà exclu dans la config ; tester avec un SW actif |
| R4 | « Joueurs actifs, appels par jour, part du quota Vercel » : Vercel Hobby n'expose pas facilement l'usage par API (**non vérifié**) | tableau de bord incomplet | compter nous-mêmes en base (une ligne par jour et par route, ≈ 1 écriture par appel : coût à mesurer, US008) ; quota Vercel affiché « estimé d'après nos compteurs » |
| R5 | Jeton sans expiration en `sessionStorage` | vol = accès durable | cookie `HttpOnly` dès les premières écritures (ADM-03), CSP stricte, rotation documentée |
| R6 | Réveil de Neon (veille après 5 min) | premier appel lent ou en échec | `retry: 1` de TanStack Query, message « la base se réveille » |
| R7 | Admin sur le Pi sans API | admin inutilisable sur le Pi | décision D5 |
| R8 | Licences : react-leaflet (Hippocratic 2.1) | dépendance non OSI | ne pas l'utiliser (Leaflet direct) |
| R9 | Leaflet 1.9.4 peu actif (mai 2023 ; 2.0 en alpha) | maintenance | usage minimal derrière une interface `<PositionPicker>` remplaçable (par l'option A) |
| R10 | Deux sources de vérité pour les retouches (base + `parkings.json`) | conflits, retouche perdue | règle à fixer par US006 : la base fait foi, l'export JSON est la sauvegarde ; `parkings.json` = valeurs de repli |
| R11 | Écart d'estimation (React, carte, publication) | epic plus longue que 6 à 8 sessions | découpage ADM livrable par morceaux ; ADM-11 optionnelle |

### 5.2 Décisions à trancher par Dasco
| # | Question | Proposition par défaut |
|---|---|---|
| D1 | React 19 ou Preact ? | **React 19** (admin pour une personne, compatibilité, Preact 11 sortie aujourd'hui) |
| D2 | Routeur : wouter ou React Router ? | **wouter** (8 routes, 2,7 Ko) |
| D3 | Interface : CSS simple, Pico ou shadcn/Tailwind ? | **CSS simple** repris de l'admin actuelle |
| D4 | Carte : plan 2D Leaflet d'abord (B) ou vue 3D « même moteur » tout de suite (A) ? Fond OSM voulu ? | **B puis A** ; pas de fond OSM |
| D5 | L'admin doit-elle marcher sur le Pi (proxy `/api/` vers Vercel, ou API Node sur le Pi) ? | **Vercel seulement** pour EP008 ; Pi plus tard |
| D6 | Lieux : position seulement, ou aussi les textes des fiches (titre, histoire, anecdote, sources) ? | **Position + source seulement** en v1 ; textes plus tard (relecture, assainissement, plus de risque) |
| D7 | Publication : directe, ou brouillon puis « publier » ? | **Brouillon puis publier** avec aperçu (critère US006) |
| D8 | Session : garder le jeton en `sessionStorage`, ou cookie `HttpOnly` 2 h dès US006 ? | **Cookie dès US006** |
| D9 | Connexion GitHub : en EP008 ou plus tard ? Une app OAuth par environnement ? | **Après US006 / US007** ; production seulement, jeton de secours ailleurs |
| D10 | Emplacement si le cloisonnement tarde : `admin/` provisoire ou attendre ? | **`admin/` provisoire**, déplacé ensuite |

---

## Sources
- Registre npm, versions et licences (08/10/2026) : [react](https://registry.npmjs.org/react/latest),
  [react-dom](https://registry.npmjs.org/react-dom/latest), [preact](https://registry.npmjs.org/preact) (11.0.1 publiée le 08/10/2026),
  [@vitejs/plugin-react](https://registry.npmjs.org/@vitejs/plugin-react/latest), [@preact/preset-vite](https://registry.npmjs.org/@preact/preset-vite/latest),
  [wouter](https://registry.npmjs.org/wouter/latest), [react-router](https://registry.npmjs.org/react-router),
  [@tanstack/react-router](https://registry.npmjs.org/@tanstack/react-router/latest), [@tanstack/react-query](https://registry.npmjs.org/@tanstack/react-query/latest),
  [react-hook-form](https://registry.npmjs.org/react-hook-form/latest), [@hookform/resolvers](https://registry.npmjs.org/@hookform/resolvers/latest),
  [leaflet](https://registry.npmjs.org/leaflet) (1.9.4 du 18/05/2023, 2.0.0-alpha.1), [react-leaflet](https://registry.npmjs.org/react-leaflet/latest) (Hippocratic-2.1),
  [maplibre-gl](https://registry.npmjs.org/maplibre-gl/latest), [@picocss/pico](https://registry.npmjs.org/@picocss/pico/latest),
  [tailwindcss](https://registry.npmjs.org/tailwindcss/latest), [radix-ui](https://registry.npmjs.org/radix-ui/latest),
  [@testing-library/react](https://registry.npmjs.org/@testing-library/react/latest), [happy-dom](https://registry.npmjs.org/happy-dom/latest), [jsdom](https://registry.npmjs.org/jsdom/latest).
- Poids gzip : [bundlephobia](https://bundlephobia.com/) (API `/api/size`, 08/10/2026).
- Tuiles OSM : [Tile Usage Policy, OSMF](https://operations.osmfoundation.org/policies/tiles/).
- Licence react-leaflet : [LICENSE (unpkg)](https://unpkg.com/react-leaflet@3.2.0/LICENSE.md), [licenses.dev](https://licenses.dev/npm/react-leaflet/4.2.1).
