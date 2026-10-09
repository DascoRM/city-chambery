# Revue de code : EP010 phase 2 (US006 à US008)

**Date** : 09/10/2026 · **Relecteur** : Claude (sous-agent de relecture, rien implémenté dans le dépôt)
**Périmètre** : `ea2e3a5..f21e898` (12 commits : US006 fusionnée, US007 fusionnée, US008 sur `feat/EP010-US008-session`). Les commits arrivés pendant la relecture (`c07edba`, `d7e9b67`, `f863eab`) ne sont pas relus ; seuls `c07edba` (8 lignes) et la documentation de `f863eab` ont été regardés pour dire ce qui reste à corriger.
**Méthode** : lecture du diff (hors `package-lock.json`, inchangé) ; copie `git archive f21e898` dans le scratchpad, `npm run build` et `npm test` dessus ; **sondes** Vitest (back, admin) ; **parcours réels dans Chrome for Testing** (headless) contre l'admin construite et l'API servies sur une même origine (`Referrer-Policy: no-referrer` comme `vercel.json`), puis à travers le proxy de Vite ; tailles mesurées en construisant `e00ba67` (juste avant US007) et `f21e898`.

Gravités : **Moyen** (défaut réel, scénario plausible, à corriger avant la fusion dans `main`) · **Faible** (défaut réel, impact limité) · **Info** (risque connu, pré-existant, ou amélioration).

---

## Synthèse

| # | Gravité | Où | Défaut | Preuve |
|---|---|---|---|---|
| M1 | Moyen | `frontend/admin/src/auth.tsx:48-51`, `api.ts:86`, `backend/src/session.ts:83` | **« Se déconnecter » est annulé par une lecture en cours** : sa réponse arrive après la déconnexion avec un cookie renouvelé (2 h) ; au rechargement, connecté sans jeton | Chrome (journal ci-dessous) ; correctif essayé |
| M2 | Moyen, **déjà corrigé par `c07edba`** | `scripts/check-api-esm.mjs:36` | Le contrôle exigeait 503 sur `/api/admin/session` : dès qu'`ADMIN_TOKEN` est posé au build (Vercel l'injecte), 401 → build en échec | reproduit sur `f21e898` |
| F1 | Faible (dev) | `frontend/admin/vite.config.ts:39-40` | Commentaire faux : la forme courte du proxy de Vite pose `changeOrigin: true`, l'API reçoit `Host: localhost:8787` ; les écritures ne passent que grâce à `Sec-Fetch-Site` ; ouverte par une autre adresse que `localhost` (téléphone sur le réseau local), **la connexion est refusée (403)** | Chrome + code de Vite ; correctif essayé |
| F2 | Faible | `backend/src/session.ts:29-33`, `:44`, `:60` | Clé passée en texte à `hono/jwt`, qui la lit comme une clé PEM si elle contient « PUBLIC » (connexion 200 puis 401 partout) ou « PRIVATE » (connexion 500) | sonde S2 ; correctif essayé |
| F3 | Faible | `backend/src/session.ts:12`, `:32` | `ADMIN_SESSION_SECRET` lue sans être documentée, contre D10 : posée, changer `ADMIN_TOKEN` ne ferme plus les sessions ; aucune longueur minimale (« s » accepté) | sonde S5 |
| F4 | Faible | `backend/src/session.ts:45`, `auth.tsx:61`, `App.test.tsx:90-96` | Le code `session-expiree` n'est presque jamais renvoyé : le navigateur jette le cookie à l'instant où le JWT expire ; Dasco lit « Session terminée » et non « Session expirée (2 h…) » ; le test simule un cas que Chrome ne produit pas | Chrome (session de 5 s) |
| F5 | Faible | `scripts/check-api-esm.mjs:33-36` | Ne signe ni ne vérifie aucun JWT (sans cookie, `verify` n'est jamais appelé) : WebCrypto et `hono/jwt` ne sont pas exercés, même après `c07edba` | lecture |
| F6 | Faible (doc) | `README.md:471-474`, `:477-482`, `:486` ; `.claude/CLAUDE.md:106` ; `backend/src/db/schema.ts:18` | Restes d'US006/US007/US008 encore présents à `f863eab` | grep |
| F7 | Faible (doc) | `epic.md:122` (D12), `DECISIONS.md:99`, `CHANGELOG.md:14` | « administration +24 Ko », base « 83,0 Ko » : mesuré 97,8 → 108,7 Ko gzip, soit **+10,9 Ko** | builds |
| I1 à I11 | Info | voir plus bas | schéma de l'`Origin` non comparé, JWT comme oracle hors ligne du jeton, limiteur, session utilisable par la carte (même origine), admin « tout ou rien » sur une ligne hors contrat… | |

Aucun défaut grave : algorithme imposé, plafond de 8 h non contournable, attributs du cookie, refus du `Bearer`, contrôle d'origine et type de contenu sont conformes (détail au § 1).

**Build et tests (copie de `f21e898`)** : `npm run build` passe (types des 4 configs, frontières : 109 fichiers, `check-api-esm`, carte, admin) ; `npm test` : **11 fichiers, 84 tests verts** (back 36, admin 23, contrat 6, carte 4, outillage 15).

---

## 1. Sécurité de la session

### M1 · Moyen · Une lecture en cours ressuscite la session après « Se déconnecter »
**Où** : `requireSession` renouvelle le cookie à **chaque** requête, avant le traitement (`session.ts:83`). Après la déconnexion, une réponse partie avant elle revient donc avec `Set-Cookie: diorama_admin=<jwt valable 2 h>`, et le navigateur l'enregistre. Côté admin, rien n'empêche cette réponse d'arriver : `logout` (`auth.tsx:48-51`) n'annule pas les requêtes en cours, et `api()` ne passe aucun `signal` à `fetch` (`api.ts:86`, `Dashboard.tsx:19`, `Parkings.tsx:59`).

**Scénario** : Dasco ouvre l'administration, le tableau de bord demande `/api/admin/status`, que la base Neon endormie ou un démarrage à froid rendent lent (plusieurs secondes). Il clique aussitôt sur « Se déconnecter » : l'écran de connexion s'affiche, mais le navigateur garde une session valable 2 h (prolongeable jusqu'à 8 h). Sur un poste partagé, la personne suivante qui ouvre `/admin/` est connectée sans jeton.

**Constaté dans Chrome** (`zz-e2e/server.ts` : `/api/admin/status` retardé de 3 s ; `zz-e2e/browser.mjs`) :
```
05:27:42.513 LECTURE /api/admin/status | cookie                      ← tableau de bord rechargé
05:27:42.589 ÉCRITURE POST /api/admin/logout | … | cookie
05:27:42.589    → 204 /api/admin/logout Set-Cookie: diorama_admin=… Max-Age=0
05:27:45.514    → 200 /api/admin/status Set-Cookie: diorama_admin=eyJ… Max-Age=7200   ← après la déconnexion
05:27:47.193 LECTURE /api/admin/session | cookie                     ← rechargement de la page
05:27:47.194    → 200 /api/admin/session …                           ← connecté sans jeton
```
État du navigateur : « cookie effacé » juste après la déconnexion, puis « cookie présent (ressuscité) », puis « CONNECTÉ sans jeton » après rechargement. La sonde S1 montre la même chose côté serveur, y compris quand la réponse tardive est une erreur 500 : le renouvellement est posé avant le traitement.

**Correctif (a), côté admin, essayé** : annuler les lectures avant la déconnexion, et transmettre le `signal` à `fetch`. Une requête annulée n'a plus d'effet, pas même son `Set-Cookie`.
```ts
// api.ts : ApiOptions gagne `signal?: AbortSignal` ; fetch(path, { …, signal: opts.signal, … })
// Dashboard.tsx / Parkings.tsx : queryFn: ({ signal }) => api('GET', '/api/admin/status', { schema: adminStatusResponse, signal })
// auth.tsx, logout : await queryClient.cancelQueries(); avant le POST /api/admin/logout (et queryClient dans les dépendances)
```
Résultat dans Chrome : le serveur envoie toujours le cookie renouvelé, mais le navigateur l'ignore (« cookie effacé ») et le rechargement affiche l'écran de connexion (`/api/admin/session | sans cookie → 401`). Les 23 tests de l'admin restent verts. Copie modifiée : `scratchpad/revue-admin-src-fix/`.
Ce correctif ne couvre ni une **écriture** en cours (les mutations ne sont pas annulées par `cancelQueries`), ni un **autre onglet** d'administration.

**Correctif (b), côté serveur, plus robuste** (non essayé) : à la déconnexion, poser un second cookie `diorama_admin_sortie=<heure>` (HttpOnly, `Path=/api/admin`, 8 h). `requireSession` refuse alors toute session dont `auth` ≤ cette heure, et efface le cookie de session. La connexion efface ce second cookie. Une réponse tardive peut réécrire `diorama_admin`, pas ce second cookie : cela couvre les écritures et les autres onglets.
Plus faible : ne renouveler que s'il reste moins de 1 h 50, ce qui réduit la fenêtre sans la fermer.
**Test à ajouter** : admin, « la déconnexion annule les lectures en cours » (le `signal` du `fetch` en cours est `aborted`) ; avec (b), un test back « réponse tardive après la déconnexion → 401 ».

### F1 · Faible (dev) · Le proxy de Vite réécrit `Host` ; connexion refusée hors `localhost`
**Où** : `frontend/admin/vite.config.ts:39-40`. Le commentaire « changeOrigin reste à false (par défaut) » est faux pour la forme courte : Vite fait `if (typeof opts === "string") opts = { target: opts, changeOrigin: true }` (`node_modules/vite/dist/node/chunks/node.js`, vers la ligne 19741). Le plan (§ 4.6) supposait le comportement de `http-proxy`.
**Constaté** (même config sur d'autres ports, `zz-e2e/vite.admin.dev.config.ts`, plus `allowedHosts` pour le nom d'essai ; Vite accepte déjà une adresse IP) :
- depuis `http://localhost:5274`, l'API reçoit `host= localhost:8887 | origin= http://localhost:5274 | sec-fetch-site= same-origin` : acceptée seulement grâce à `Sec-Fetch-Site` ;
- depuis `http://admin.test:5274` (un nom qui n'est pas `localhost`, comme une adresse du réseau local ouverte depuis un téléphone avec `--host`), Chrome n'envoie pas `Sec-Fetch-Site` à une origine non sécurisée : `sec-fetch-site= null`, réponse 403, message « Requête refusée : elle ne vient pas de l'administration (origine). », **connexion impossible**.

**Correctif (essayé)** : `proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: false }, '/data': 'http://localhost:5173' }`. `Host` est alors gardé (`localhost:5274`, `admin.test:5274`) et la connexion passe dans les deux cas. Corriger le commentaire.

### F2 · Faible · Jeton contenant « PUBLIC » ou « PRIVATE »
**Où** : `sessionKey` (`session.ts:29-33`) rend un texte, passé tel quel à `sign` (`:44`) et à `verify` (`:60`). `hono/jwt` (`dist/utils/jwt/jws.js`, `importPrivateKey` / `importPublicKey`) importe une clé texte comme `pkcs8` si elle contient « PRIVATE », comme `spki` si elle contient « PUBLIC ».
**Constaté (S2)** : `ADMIN_TOKEN=MON-JETON-PUBLIC-…` : connexion 200, puis **401 sur toute requête** (l'admin revient sans cesse à la connexion). `…PRIVATE…` : **connexion 500** (`atob` : caractère invalide). L'administration reste fermée, ce n'est pas une faille. Mais la panne est incompréhensible, et elle toucherait aussi une future `ADMIN_SESSION_SECRET`. Improbable avec `openssl rand -base64 32` ; possible avec une phrase choisie à la main.
**Correctif (essayé)** : clé = empreinte hexadécimale, par exemple `createHash('sha256').update(env.ADMIN_SESSION_SECRET?.trim() || \`diorama-admin-session-v1|${token}\`).digest('hex')`. S2 ne reproduit plus le défaut ; les 26 tests de session, d'administration et de parkings, et les autres sondes, restent verts. Autre option : importer une seule fois une `CryptoKey` HMAC (`sign` / `verify` l'acceptent).

### F3 · Faible · `ADMIN_SESSION_SECRET`, variable cachée
**Où** : `session.ts:32` (et le commentaire `:12`). D10 dit « pas de nouvelle variable ». Posée sur Vercel, elle découple les sessions du jeton : changer `ADMIN_TOKEN` ne ferme plus rien (S5), contrairement à ce qu'affirment le README et le commentaire `:11`. Sa longueur n'est pas contrôlée (une clé « s » est acceptée, et les sessions deviennent forgeables).
**Correctif** : la retirer jusqu'aux comptes en base (D6). Ou la documenter (README, variables) en refusant moins de 32 caractères, et dire qu'elle remplace la fermeture par changement de jeton.

### Infos de sécurité
- **I1** `session.ts:98-102` : seul l'hôte de l'`Origin` est comparé, pas son schéma. `Origin: https://localhost` est accepté pour un hôte servi en http, et inversement (S3). C'est couvert par `Secure`, `SameSite=Strict` (le « same-site » tient compte du schéma) et le HSTS de `.vercel.app`. Pour comparer l'origine entière, utiliser `x-forwarded-proto` sur Vercel.
- **I2** Clé = préfixe connu + `ADMIN_TOKEN` : un cookie (JWT) intercepté permet d'essayer des jetons **hors ligne**, sans limiteur. Sans risque avec le jeton aléatoire que conseille le README (256 bits) ; écrire « jeton aléatoire obligatoire ». De plus, ni l'environnement ni `aud` n'entrent dans la signature : si Preview et Production ont le même `ADMIN_TOKEN`, un JWT de prévisualisation est valable en production (il faudrait le copier à la main). Ajouter `appEnv` au préfixe de la clé, ou un `aud`.
- **I3** Limiteur (`auth.ts:22-40`, pré-existant, réduit par US008 à `/login`) :
  - il est par instance ;
  - en IPv6, un attaquant change d'adresse dans son /64 ;
  - `recent()` enregistre une liste vide pour chaque nouvelle adresse dès `blocked()` (l. 24-27) : la `Map` grossit sans fin ;
  - hors Vercel, `x-forwarded-for` est libre (S6), et `npm run api:dev` écoute sur toutes les interfaces (`serve({ fetch, port })`, vu `*:4390` avec lsof).
  Acceptable sur Vercel avec un jeton fort. Correctifs simples : supprimer les listes vides ; clé IPv6 par /64.
- **I4** Toute page de la même origine peut se servir de la session tant qu'elle est ouverte, écritures comprises (`Origin` et `Sec-Fetch-Site` disent « même origine »). C'est le cas de **la carte**, sans CSP et dans n'importe quel onglet. Ce n'est pas une régression par rapport au vol du jeton, mais il faut le savoir avant EP008-US007 (la carte dans un cadre de l'admin) : CSP de la carte.
- **I11** `Secure` dépend de `VERCEL_ENV` (`session.ts:36`) : une API servie un jour hors de Vercel derrière un proxy TLS (`c.req.url` en http) poserait un cookie sans `Secure`.

### Vérifié, conforme
- **JWT** : HS256 imposé (`verify` compare `alg` de l'en-tête : `none`, HS512 avec la vraie clé, HS256 avec une autre clé → 401, S4). Les champs sont contrôlés (`sub`, `method`, `auth`, `exp`). Les dates de la bibliothèque sont désactivées et contrôlées avec l'horloge injectée. Le JWT ne contient aucun secret.
- **Plafond de 8 h** : il part d'`auth` (signé), qui est recopié à chaque renouvellement, et `exp = min(now + 2 h, auth + 8 h)`. Testé à 8 h − 60 s (`Max-Age=60`) puis à 8 h (401). On ne peut pas le dépasser sans la clé.
- **Cookie, constaté dans Chrome** : `HttpOnly`, `SameSite=Strict`, `Path=/api/admin`, `Max-Age` 7200, invisible pour `document.cookie`, `sessionStorage` vide. `Secure` est posé en prévisualisation (test) et en production (code).
- **Déconnexion** : 204 et `Max-Age=0`, avec ou sans session ; une déconnexion depuis un autre site est refusée (403, S3). Seule la course de M1 la met en défaut.
- **Jeton** : `Bearer` refusé (401). Aucune réponse ne contient le jeton, même les 400 de la connexion (S6). Comparaison en temps constant (SHA-256 puis `timingSafeEqual`). Un cookie mal formé (encodage cassé, guillemets, 8 Ko, JWT vide) donne 401, jamais 500.
- **Contrôle d'origine** : Chrome envoie la vraie `Origin` et `Sec-Fetch-Site: same-origin` sur POST, PUT et DELETE, **malgré `Referrer-Policy: no-referrer`** (constaté). Une origine étrangère, un sous-domaine ou un autre port sont refusés. Une connexion lancée depuis un autre site est refusée sans compter d'échec. Un corps de formulaire donne 415. Les types voisins de JSON (`application/json-patch+json`) passent, sans effet.
- **Limiteur** : il ne compte que les mauvais jetons, et seulement sur `/login` ; les 401 de session ne mènent jamais à 429 (test).

---

## 2. Correction du back et de l'admin

### F4 · Faible · « Session expirée » presque jamais affiché
**Où** : `maxAge: exp - nowS` (`session.ts:45`). Le cookie disparaît du navigateur au moment même où le JWT expire, donc après 2 h sans activité (ou à 8 h) la requête suivante part **sans cookie**. L'API répond 401 `non-autorise`, et l'admin affiche « Session terminée : reconnecte-toi. » (`auth.tsx:61`). Le code `session-expiree` n'arrive qu'avec une horloge client en retard sur le serveur.
**Constaté dans Chrome** : copie avec une session de 5 s, attente de 6,5 s, clic sur « Actualiser ». La requête part `| sans cookie → 401`, message « Session terminée : reconnecte-toi. ». Le test `App.test.tsx:90-96` (`/status` qui répond `session-expiree`) passe, mais il ne reflète pas ce que fait un navigateur.
**Correctif** : garder le cookie jusqu'au plafond (`maxAge: max - nowS`), le JWT gardant `exp` = 2 h d'inactivité. L'API reçoit alors le JWT expiré et répond `session-expiree`, ce qui donne le bon message. Le JWT expiré qui reste dans le navigateur est sans risque : l'API le refuse. Ou plus simple : un seul message, « Session expirée ou fermée : reconnecte-toi. ». Ajouter un test admin du cas réel : 401 `non-autorise` en cours d'utilisation → retour à la connexion avec le message.

### Infos
- **I5** `Parkings.tsx:59` : l'admin vérifie toute la réponse `adminParkingEdits`. Une seule ligne hors contrat (SQL écrit à la main, migration future) fait afficher « Réponse inattendue » à toute la page, et l'outil qui servirait à corriger la ligne devient inutilisable. La carte, elle, trie une par une. Option : valider les lignes dans `listEdits` (back) et écarter ou signaler les mauvaises.
- **I7** `session.ts:75`, `:80`, `:82`, `:104`, `:106` : ces corps d'erreur ne passent pas par `errorBody` (typé par `ErrorCode`) comme ceux d'`app.ts`. Une faute de frappe dans un code ne serait pas vue à la compilation (les tests couvrent quatre de ces codes). La ligne 75 n'est jamais atteinte : le middleware 503 passe avant.
- **I8** Un onglet de l'ancienne admin resté ouvert envoie `Bearer` et affiche « Jeton refusé. » alors que le jeton est bon (prévu par le plan, § 4.8) : il suffit de recharger.
- **I9** À chaque chargement sans session, la console affiche « Failed to load resource: 401 » (`GET /session`). Purement cosmétique.
- **I10** `backend/src/db/schema.ts:18` : le commentaire place la validation dans `backend/src/parkings.ts` ; elle est maintenant dans `contrat/parkings.ts`.

### Vérifié, conforme
- **Middlewares** : dans l'ordre 503 (non configurée), origine des écritures, session (sauf `PUBLIC`). `except()` exempte exactement `/api/admin/login` et `/logout` ; les variantes `/login/`, `/LOGIN`, `//session` et `/session/` donnent 401. Une `HTTPException` rend sa propre réponse au lieu d'un 500.
- **Cookie présent, `ADMIN_TOKEN` retiré** : 503 partout. Au démarrage, l'admin réessaie une fois puis affiche le message sur `ADMIN_TOKEN` (sonde A2). Avec un autre jeton, la signature est refusée et l'écran de connexion s'affiche.
- **Admin au démarrage** : une seule vérification de session, StrictMode compris (A4). « Vérification de la session… » s'affiche pendant l'attente.
- **Admin en cours d'utilisation** : une écriture refusée pour session expirée ramène à la connexion avec le message (A3). La déconnexion vide le cache sans aucune requête après le `POST /logout` (A1). Aucune requête n'a d'en-tête `Authorization` ; `credentials: 'same-origin'` est passé, sans `mode`.
- **Nouvelles tentatives** : une seule, sur 5xx et erreurs réseau.

---

## 3. Contrat

- **Conformité** : les schémas correspondent aux réponses réelles (tests du back sur PGlite pour `/health`, `/admin/status` sans base, `/parkings/edits` et `/admin/parkings/edits` ; `check-api-esm` pour `/health` ; `satisfies` partout dans `app.ts`). `sessionInfo` correspond à `writeSession`.
- **Usage de `zod/mini`** : correct (`.check(z.trim(), z.minLength…)` transforme bien la valeur, `z.extend`, `z.strictObject`, `z.config(fr())` dans le back et dans l'admin).
- **Champs en plus ou en moins** : les requêtes refusent un champ inconnu ; les réponses retirent les champs en plus sans refuser. Un champ manquant, ou une **valeur d'énumération nouvelle** (un nouvel état de base, un nouvel environnement), fait afficher « Réponse inattendue » dans l'admin : c'est voulu.
- **I6** Tolérance de la carte : elle trie **retouche par retouche**, plus champ par champ (`parking-edits.ts:54-56`). Un `kind` inconnu (API plus récente) fait maintenant jeter toute la retouche, y compris `hide` et la source, alors qu'`applyParkingEdits` (l. 110-111) n'ignorait que ce champ. Acceptable (contrat commun, même déploiement), à savoir.
- **Poids, F7** (vite build, gzip) :
  - carte : 77,20 → 85,46 Ko (**+8,3**, conforme à D12) ;
  - administration : **97,81 → 108,71 Ko (+10,9)** entre `e00ba67` et `f21e898`. La base « 83,0 Ko » du CHANGELOG 86, d'où vient « +24 Ko » (D12, DECISIONS), n'est pas la taille gzip de l'admin avant US007 (97,8 Ko d'après Vite ; 97,5 Ko mesurés à la relecture de la phase 1) : la mesure de départ n'est pas faite comme celle d'arrivée.
  - **Aucun import qui gonfle inutilement** : seule la locale `fr` est dans les bundles (chaînes allemandes, espagnoles, polonaises et japonaises cherchées sans résultat ; deux « Invalid input » qui viennent du cœur de Zod), et dans le back `zod/locales` coûte ≈ 1 ms au chargement.
- La carte en dev sert bien `contrat/parkings.ts` hors de sa racine (`/@fs/…`, 200).

---

## 4. US006 et Vercel

### M2 · Moyen · Déjà corrigé par `c07edba`
`check-api-esm.mjs:36` (à `f21e898`) exigeait `503 admin-non-configuree`. Vercel injecte les variables pendant le build : avec `ADMIN_TOKEN` posé, la réponse est 401, le contrôle échoue et le déploiement aussi. Reproduit : `ADMIN_TOKEN=… node scripts/check-api-esm.mjs` sort avec le code 1, message « /api/admin/session : 401 … ». (Repéré grâce au message de `c07edba`, puis reproduit sur `f21e898`.) Le correctif de `c07edba` accepte 503 `admin-non-configuree` ou 401 `non-autorise` : correct.

### F5 · Faible · `check-api-esm` n'exerce pas la session
Même après `c07edba`, le contrôle n'envoie aucun cookie : `readSession` répond « absente » avant `verify`, donc ni `sign` ni `verify` (WebCrypto) ne tournent. **Proposition** : si `ADMIN_TOKEN` n'est pas posé, en poser un provisoire avant l'`import`. Puis faire `POST /api/admin/login` (avec `Origin: http://localhost`, en JSON) → 200 et `Set-Cookie`, et `GET /api/admin/session` avec ce cookie → 200. Sur Vercel, le build tourne avec la version de Node du projet [non vérifié] : cela prouverait que la session y fonctionne.

### Vérifié, conforme
- **`tsconfig.json` racine** (NodeNext, sans DOM, `types: ["node"]`) :
  - un import sans `.js` est refusé ;
  - `noEmitOnError` empêche `check-api-esm` d'émettre en cas d'erreur de types ;
  - un `api/tsconfig.json` fait échouer le build.
- **Ce que couvre `check-api-esm`** : la résolution ESM (la cause historique du 500), le chargement du module, et `/health` conforme au contrat. **Ce qu'il ne couvre pas** : le traçage des fichiers par Vercel (nft), la version de Node des fonctions, la session (F5).
- **Restes du déplacement** : aucun `server/`, `tsconfig.api.json`, `tsconfig.vercel-check.json`, `data/dev-db` ni `/// <reference types="node" />` dans le code et les configs (`.gitignore`, `.dockerignore`, `drizzle.config.ts`, scripts npm, Vitest, `check-boundaries`).

### F6 · Faible (doc) · Restes encore présents à `f863eab`
- `README.md:471-472` : `api.ts` « jeton de session », `auth.tsx` « si le jeton est refusé » ;
- `README.md:474` : `types.ts` « provisoire : passeront dans contrat/, EP010-US007 » (fait en US007) ;
- `README.md:477-482` : la liste de `contrat/` n'a pas `session.ts` ;
- `README.md:486` : « deviendra backend/ (EP010 phase 2) » (fait en US006) ;
- `.claude/CLAUDE.md:106` (l. 111 à `f863eab`) : « api/ Inutilisé (pas de back-end) » ;
- `schema.ts:18` (I10) et le commentaire de F1.

Corrigés entre-temps dans `f863eab` (vu par grep, non relu) : le paragraphe « Administration » du README (Bearer, `sessionStorage`), « pas de backend », « 1,5 s », `CLAUDE.md:4`, `context.md:93`.

---

## 5. Tests

**Trous importants** :
1. La course de M1 : aucun test.
2. Le contrôle d'origine n'est testé que sur PUT et sur la connexion : rien pour DELETE ou POST depuis un autre site, la déconnexion depuis un autre site, un sous-domaine, un autre port ou un autre schéma (sondes S3 : tous conformes, sauf I1).
3. Rien sur F2, F3, ni sur le cas réel de F4 (401 `non-autorise` après une expiration).
4. `check-api-esm` ne se connecte pas (F5).
5. Admin : rien sur un 503 au démarrage (A2), un 401 sur une écriture (A3), ni sur le fait que la déconnexion annule les lectures (M1).
6. Les schémas de session ne sont testés qu'à travers l'API, pas dans `contrat.test.ts` (acceptable).

**Tests qui passent à tort** : `App.test.tsx:90-96` simule une réponse `session-expiree` que Chrome ne déclenche pas (F4). Les autres tests regardés (`session.test.ts`, `admin.test.ts`, `parkings.test.ts`, `Parkings.test.tsx`, `parking-edits.test.ts`, `contrat.test.ts`) vérifient bien ce qu'ils annoncent ; leurs assertions ne passeraient pas avec un cookie vide ou un en-tête absent.

---

## Non vérifié
- **Vercel réel** : pas d'accès (MCP Vercel non connecté, pas de secret de contournement). Restent à constater sur la prévisualisation : la connexion avec le vrai jeton, le cookie `Secure` servi, une écriture avec contrôle d'origine, et l'en-tête `Host` tel que la fonction le reçoit (le contrôle tient de toute façon grâce à `Sec-Fetch-Site` sur https).
- **Safari / WebKit et Firefox** : leurs versions installées ne correspondent pas au Playwright disponible ; seul Chrome a été essayé. Un Safari antérieur à 16.4 n'envoie pas `Sec-Fetch-Site` et dépend donc de `Host`.
- **Docker** et les commits `d7e9b67` / `f863eab` (US009) : non relus.
- **Correctif (b) de M1** : non essayé.

## Sondes (hors dépôt, scratchpad de la session)
- `revue/` : copie de `f21e898`.
- `revue/zz-sondes/` :
  - `back-probe.test.ts.txt` (S1 à S6) ;
  - `admin-probe.test.tsx.txt` (A1 à A5) ;
  - `cookie-malforme.test.ts`.
  Les deux premiers se renomment en `.test.ts(x)` et se placent dans `backend/src/` ou `frontend/admin/src/`.
- `revue/zz-e2e/` :
  - `server.ts` (admin construite et API sur la même origine, `/status` retardé, journal des en-têtes) ;
  - `browser.mjs` (M1) ;
  - `dev-proxy.mjs`, `dev-proxy-host.mjs` et `vite.admin.dev.config.ts` (F1) ;
  - `idle.mjs` (F4, avec une session de 5 s dans une copie).
- `revue-admin-src-fix/` : admin avec le correctif (a) de M1.
- `revue2-base-ea2e3a5/`, `revue2-e00ba67/` : builds de comparaison des tailles.
- Remarque : une première extraction de `ea2e3a5` a écrasé une partie du dossier `scratchpad/base/` de la relecture de la phase 1 (`api/`, `frontend/`, `scripts/`, `server/`, `.claude/`, fichiers de la racine). C'est sans effet sur le dépôt.
