# Plan : EP010 phase 2 — `backend/`, `contrat/`, session par cookie, Docker et documentation (US006 à US009)

**Date** : 09/10/2026 · **Auteur** : sous-agent chercheur / planificateur back-end · **Statut** : à relire par l'agent principal ; écarts à la spec à valider par Dasco (§ 10)

**Rien n'est implémenté, aucun fichier du dépôt n'a été modifié.** Les essais ont été faits dans un bac à sable hors dépôt (dossier temporaire de la session) : copie de `server/` et `api/` réorganisée comme la cible, `node_modules` du dépôt utilisé en lecture seule.

**Légende** : **[code]** lu dans le dépôt · **[doc]** doc ou code source tiers consulté le 09/10/2026 · **[essayé]** fait tourner dans le bac à sable · **[mesuré]** chiffre obtenu ce jour · **[proposé]** · **[non vérifié]**.

**Lu** : `.claude/CLAUDE.md`, `context.md` ; EP010 (`epic.md`, US002, US005 à US009) ; ADR-001, ADR-002 ; EP008 (`epic.md`, US005) ; `tasks/cloisonnement-depot-plan.md`, `tasks/admin-react-plan.md` (§ 3.3) ; les trois fichiers du stash (`ep008-reponses-dasco-2026-10-09.md`, `ep010-admin-tables-plan.md`, `ep010-progression-plan.md`) ; CHANGELOG 80 à 83 ; DECISIONS ; tout `server/`, `api/index.ts`, les quatre tsconfig, `scripts/check-api-esm.mjs`, `scripts/check-boundaries.mjs`, `drizzle.config.ts`, `vercel.json`, `package.json`, `vitest.config.ts`, `Dockerfile`, `.dockerignore`, `deploy/` ; `frontend/carte/src/scene/parking-edits.ts`, `main.ts`, `vite.config.ts`, `src/types.ts` ; `frontend/admin/` (`vite.config.ts`, `tsconfig.json`, `api.ts`, `auth.tsx`, `types.ts`, `Login.tsx`, `App.tsx`, `Layout.tsx`, tests).

**Point de départ** [code] : branche `feat/EP010-US005-frontieres`, commit `81f8961` ; phase 1 commitée (US003 à US005 : `frontend/admin/`, `vitest.config.ts` racine avec les projets `api` et `admin`, scripts `typecheck`, `build:carte`, `build:admin`, `check:boundaries`). Le back est encore dans `server/`. Vercel le compile avec le `tsconfig.json` racine, qui porte les options de la carte (`lib` DOM, `types: ["vite/client"]`, `include: ["frontend/carte/src"]`) : d'où `tsconfig.vercel-check.json` et le `/// <reference types="node" />` en ligne 1 de cinq fichiers (`app.ts`, `auth.ts`, `dev.ts`, `db/client.ts`, `db/migrate.ts`). Numéros de ligne cités : état au commit `81f8961`.

---

## 0. En bref

1. **Vercel compile `api/index.ts` avec le `tsconfig.json` le plus proche en remontant depuis `api/`** (code de `@vercel/node` : `project: path, // Resolve tsconfig.json from entrypoint dir`) ; la doc dit « à la racine ». Faire du tsconfig racine celui du back marche dans les deux lectures ; **ne jamais créer de tsconfig dans `api/`**. Vercel garde l'`include` du tsconfig (aujourd'hui la fonction est compilée dans un programme qui contient toute la carte) et **une erreur de types n'y fait échouer le build que si `noEmitOnError` est vrai** ; sinon c'est une ligne dans le journal [doc].
2. **US006** : `git mv server backend/src` (renommage pur, `db/` dedans) plutôt que `backend/db` : 0 import interne à réécrire au lieu de 13. Seuls `api/index.ts`, `drizzle.config.ts`, deux scripts npm, `vitest.config.ts`, `check-boundaries.mjs` et l'`include` des tsconfig changent [essayé : `tsc`, chargement ESM comme Vercel, 28 tests verts].
3. **Tsconfig du back = racine** : `module`/`moduleResolution: NodeNext`, `lib: ["ES2022"]` sans DOM, `types: ["node"]` [essayé]. Le code de production compile sans les `/// <reference>`. Un import sans `.js` devient l'erreur `TS2835` : la cause du 500 `FUNCTION_INVOCATION_FAILED` est vue dès `tsc`. **14 lignes de tests** ne compilent plus (sans DOM, `Response.json()` rend `unknown`) : un petit utilitaire suffit.
4. **Ordre sûr en trois commits, trois prévisualisations** : A déplacement (tsconfig inchangé) → B tsconfig racine = back → C suppression de `tsconfig.vercel-check.json` et des cinq `/// <reference types="node" />`. Liste de contrôle de six points pour Dasco (§ 2.5).
5. **US007** : `contrat/` = `erreurs.ts`, `sante.ts`, `parkings.ts` (+ `session.ts` en US008), Zod seulement, sans fichier « index ». `contrat/tsconfig.json` sans DOM ni Node [essayé : `document`, `node:fs` et `process` refusés à la compilation]. **Les réponses réelles de l'API sont conformes aux schémas** [essayé].
6. **La carte importe seulement des types du contrat** (0 octet). Zod classique coûterait **+26 Ko gzip** (+34 % de son `index-*.js`), `zod/mini` **+7 Ko** [mesuré, Rolldown = Vite 8].
7. **US008** : session **sans état**. Un jeton signé HMAC-SHA256 (`hono/jwt`, `exp` = 2 h) est posé dans le cookie `diorama_admin; Max-Age=7200; Path=/api/admin; HttpOnly; Secure; SameSite=Strict`. Clé dérivée d'`ADMIN_TOKEN` : aucune variable à ajouter, et changer le jeton ferme toutes les sessions. Les écritures exigent la même origine (`Origin` = hôte, ou `Sec-Fetch-Site: same-origin`) et du JSON [prototype essayé avec Hono 4.13.13].
8. **Pièges trouvés** : le middleware `csrf()` de Hono ignore les requêtes JSON et lève une `HTTPException`, que notre `onError` transformerait en 500. Avec `Referrer-Policy: no-referrer` (vercel.json), un `fetch` en `mode: 'same-origin'` enverrait `Origin: null`.
9. **US009** : l'image du Pi fait `npm run build:pi` (types et build de la carte seulement). nginx répond 404 sur `/api/` (JSON) et `/admin`. Liste des documents à mettre à jour, avec les phrases périmées relevées.
10. **≈ 15 à 21 h** au total (US006 4–6 h, US007 3,5–5 h, US008 5–6,5 h, US009 2,5–3,5 h). **Aucune migration ni variable Vercel obligatoire.**

---

## 1. Comment Vercel compile `api/` (doc et code source)

| Source | Ce qu'elle dit |
|---|---|
| Doc « Using the Node.js Runtime with Vercel Functions » (mise à jour le 11/08/2026) | « You can use a `tsconfig.json` file at the root of your project to configure the TypeScript compiler. Most options are supported aside from "Path Mappings" and "Project References". » |
| `vercel/vercel`, `packages/node/src/build.ts` (branche `main`) | `tsCompile = register({ basePath: workPath, // The base is the same as root now.json dir` · `project: path, // Resolve tsconfig.json from entrypoint dir` · `rootDir: baseDir, files: true, // Include all files such as global .d.ts` · `nodeVersionMajor })` |
| `vercel/vercel`, `packages/node/src/typescript.ts` | `detectConfig()` → `ts.findConfigFile(normalizeSlashes(options.project), fileExists)` : remonte depuis le point d'entrée jusqu'au premier `tsconfig.json`. `readConfig` : `if (!options.files) { config.files = []; config.include = []; }`, donc avec `files: true` l'`include` du tsconfig est **gardé**. Options imposées : `sourceMap: true, inlineSourceMap: false, inlineSources: true, declaration: false, noEmit: false, outDir: '$$ts-node$$'`. `fixConfig` ne pose `module: 'NodeNext'` (et `strict: false`) que si `module` est absent, et `esModuleInterop: true` s'il est absent. `reportTSError(diagnosticList, config.options.noEmitOnError)` : **le build n'échoue sur une erreur de types que si `noEmitOnError` est vrai** (ou si la variable `EXPERIMENTAL_NODE_TYPESCRIPT_ERRORS` est posée) ; sinon `console.error` |

Conséquences [déduites] :
1. Pour `api/index.ts`, Vercel prend `api/tsconfig.json` s'il existe, sinon le tsconfig racine. Faire de la racine la config du back marche selon la doc comme selon le code. **Un tsconfig ajouté un jour dans `api/` gagnerait sans bruit.**
2. Avec `files: true`, le programme TypeScript de Vercel contient tout l'`include` du tsconfig : **aujourd'hui toute la carte** (DOM, `vite/client`). Après US006 : `api`, `backend/src`, `contrat`, `drizzle.config.ts` seulement.
3. Pas d'alias `paths` côté back ni dans `contrat/` : imports relatifs, comme aujourd'hui.
4. L'erreur `TS2591 process` de l'itération 81 n'a peut-être pas fait échouer le déploiement par elle-même : d'après ce code, elle était seulement écrite dans le journal **[non vérifié** : journal de l'époque non relu**]**. Pour la suite : lire le journal de build à chaque prévisualisation (point 6 du § 2.5). Option `noEmitOnError: true` au commit C.
5. **[non vérifié]** Que les builds de ce projet utilisent la version `main` de `@vercel/node` et le `typescript` du projet (5.9.3). C'est le comportement par défaut d'après le code, pas une observation.

---

## 2. US006 — `backend/` : l'API dans son dossier, sa propre config TypeScript

### 2.1 Arborescence : `backend/src/db/` plutôt que `backend/db/` [proposé, essayé]

```
backend/
├── src/            ex-server/, renommé tel quel (git mv, 18 fichiers, contenu identique)
│   ├── app.ts, auth.ts, env.ts, parkings.ts, dev.ts, *.test.ts      (+ session.ts en US008)
│   └── db/         schema.ts, client.ts, stats.ts, migrate.ts, migrations.test.ts, migrations/ (SQL + meta/)
└── data/dev-db/    base PGlite locale (ex-data/dev-db/, ignorée par Git)
```

Pourquoi pas `backend/db/`, qu'écrivent la spec (critère 1 d'US006) et l'arborescence d'`epic.md` :
- **Renommage pur** : aucun import interne ne bouge (`./db/schema.js`, `../env.js`, `new URL('./migrations', import.meta.url)` restent justes). Sortir `db/` de `src/` oblige à réécrire **13 imports ou chemins**, dans la zone qui a cassé trois fois : `app.ts` ×3, `parkings.ts` ×2, `dev.ts` ×2, `admin.test.ts` ×3, `parkings.test.ts` ×2, `db/client.ts` ×1. Cela crée aussi un aller-retour `src → db → src`, puisque `db/client.ts` lit `src/env.ts`.
- `src/` contient tout le TypeScript du back : une seule règle pour le tsconfig, `check-boundaries` et Vitest. Le schéma et les migrations restent visibles dans `backend/src/db/`.
- **Essayé** : avec cette disposition, `tsc`, le chargement ESM comme Vercel et les 28 tests passent.
- **Déplacer les migrations ne rejoue rien sur Neon.** Le migrateur de Drizzle compare seulement le champ `when` de `meta/_journal.json` au `created_at` de `drizzle.__drizzle_migrations`, jamais le chemin [code : `node_modules/drizzle-orm/migrator.js`, `pg-core/dialect.js` l. 44-72].
- Si Dasco valide, reporter ce choix dans `epic.md` (arborescence), le critère 1 d'US006 et la ligne `backend/` de l'ADR-002.

### 2.2 Le tsconfig du back, qui devient `tsconfig.json` racine [proposé, essayé]

```jsonc
{
  "//": "Config TypeScript du back (EP010-US006) : api/, backend/src/, contrat/. Vercel compile api/index.ts avec le tsconfig.json le plus proche en remontant depuis api/ : celui-ci (n'en créer aucun dans api/). Pas de paths ni de références de projet (non gérés par Vercel). La carte, l'admin et contrat/ ont le leur.",
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true
  },
  "include": ["api", "backend/src", "contrat", "drizzle.config.ts"]
}
```
- **`NodeNext`** : TypeScript exige l'extension `.js` dans les imports relatifs. **Essayé** : `from './env'` donne `TS2835: Relative import paths need explicit file extensions … Did you mean './env.js'?`. L'erreur qui a produit le 500 `FUNCTION_INVOCATION_FAILED` (itération 80) est donc vue par `tsc`. `check-api-esm` reste : il vérifie aussi que la fonction se charge et répond.
- **Sans `DOM`** : `Request`, `Response`, `Headers`, `fetch` et `performance` viennent de `@types/node` 26. **Essayé** : le code de production compile sans DOM et sans les `/// <reference>`.
- **Mais 14 assertions des tests ne compilent plus.** Sans DOM, `Response.json()` rend `Promise<unknown>` (types de Node) au lieu de `Promise<any>` (DOM). Lignes concernées : `admin.test.ts` l. 19-21 et 47, `app.test.ts` l. 40 et 54, `parkings.test.ts` l. 34, 35, 42, 59, 63, 70, 85 et 92. Correction au commit B : `const json = (res: Response) => res.json() as Promise<any>;` dans chaque fichier de test. En US007, la plupart deviennent `healthResponse.parse(await res.json())`, de vrais tests de contrat.
- `esModuleInterop` est implicite avec `NodeNext` : le `fixConfig` de Vercel ne change rien d'utile.
- `include` peut citer `contrat` avant que le dossier existe : un motif qui ne trouve rien n'est pas une erreur tant que d'autres fichiers sont trouvés.
- Éditeur : VS Code prend le tsconfig le plus proche. `contrat/` aura le sien (§ 3.4) ; la carte et l'admin ont déjà le leur.

### 2.3 Ordre sûr : trois commits, trois prévisualisations

Branche `feat/EP010-US006-backend`, partie de `feat/EP010-front-back` **après** fusion de la phase 1 et vérification de `preview/front-back` : on part d'une base saine connue.
Pour chaque commit : `npm run build` et `npm test` verts, puis `git push --force-with-lease origin feat/EP010-US006-backend:preview/front-back`, puis la liste du § 2.5.
Si une prévisualisation échoue : `git revert` du commit et nouvel envoi. La production n'est jamais touchée.

**Commit A — `refactor(api): server/ devient backend/src (EP010-US006)`**. Risque faible : Vercel compile comme avant, seuls les chemins changent.

| Fichier | Changement |
|---|---|
| `server/` → `backend/src/` | `git mv server backend/src` |
| `api/index.ts` | l. 1 : `'../server/app.js'` → `'../backend/src/app.js'` ; commentaire l. 6. Garder les trois lignes de code : format `fetch` éprouvé ; un réexport `export { default } from …` n'a jamais été essayé sur Vercel |
| `drizzle.config.ts` | l. 6-7 → `./backend/src/db/schema.ts`, `./backend/src/db/migrations`. Le fichier reste à la racine : drizzle-kit le cherche dans le dossier courant |
| `package.json` | l. 25 `"api:dev": "tsx backend/src/dev.ts"` ; l. 27 `"db:migrate": "tsx backend/src/db/migrate.ts"` |
| `tsconfig.api.json` | l. 15 `"include": ["api", "backend/src", "drizzle.config.ts"]` |
| `tsconfig.vercel-check.json` | commentaire l. 2 (`server/` → `backend/src/`) |
| `vitest.config.ts` | l. 11 : projet `back` au lieu de `api` (même nom que dans `check-boundaries`), `include: ['backend/src/**/*.test.ts']` |
| `scripts/check-boundaries.mjs` | l. 45 `dirs: ['backend/src', 'api']` ; commentaire l. 6. La règle « le back n'importe pas le front » existe déjà (l. 46, `parts: ['back', 'contrat']`) |
| `backend/src/dev.ts` | l. 20 : dossier par défaut calculé depuis le fichier, `fileURLToPath(new URL('../data/dev-db', import.meta.url))`, soit `backend/data/dev-db` quel que soit le dossier courant ; commentaire l. 8 |
| `.gitignore` l. 10, `.dockerignore` l. 7 | `data/dev-db/` → `backend/data/` |
| `backend/src/db/schema.ts` | commentaire l. 18 (`server/parkings.ts`) |
| `frontend/admin/src/types.ts` | commentaire l. 3 (le fichier se réduit en US007) |
| `README.md` | chemins seulement (l. 89, 476-477, 481, 507, 513, 519-520, 522) ; le reste de la doc en US009 |

Vérifications locales :
- `npm run typecheck`, `npm run build`, `npm test`.
- `git show --stat` doit montrer des renommages à 100 %.
- `npm run db:generate` doit répondre « No schema changes, nothing to migrate » : drizzle-kit lit les nouveaux chemins et les instantanés.
- `npm run api:dev`, puis http://localhost:8787/api/health.
- Critère 5 d'US006 : un import du front ajouté provisoirement dans `backend/src/app.ts` doit faire échouer `npm run check:boundaries`.
- Critère 4 (« les tests ne chargent plus la config de la carte ») : déjà acquis par le `vitest.config.ts` racine de la phase 1 [code].
- Base locale (facultatif, `api:dev` arrêté) : `mkdir -p backend/data && mv data/dev-db backend/data/`.

**Commit B — `build(api): le tsconfig racine devient celui du back (EP010-US006)`**. Risque moyen : c'est ici que Vercel change de config.

| Fichier | Changement |
|---|---|
| `tsconfig.json` | remplacé par la config du § 2.2 (le commentaire « Provisoire » de la l. 2 disparaît) |
| `tsconfig.api.json` | supprimé : fusionné dans la racine |
| `package.json` | l. 12 `typecheck` : `-p tsconfig.api.json` → `-p .` ; garder `-p tsconfig.vercel-check.json` jusqu'au commit C |
| `scripts/check-api-esm.mjs` | l. 16 `-p tsconfig.json` ; commentaire d'en-tête |
| `tsconfig.vercel-check.json` | inchangé. Il hérite maintenant de la config du back : redondant mais inoffensif, et filet si B doit être annulé |
| `backend/src/*.test.ts` | les 14 lectures de `res.json()` passent par `json(res)` |
| `/// <reference types="node" />` | **gardés** |

**Commit C — `chore(api): fin des contournements pour Vercel (EP010-US006)`**. Seulement après une prévisualisation B verte.

| Fichier | Changement |
|---|---|
| `tsconfig.vercel-check.json` | supprimé ; retiré de `typecheck` (l. 12) |
| `backend/src/app.ts`, `auth.ts`, `dev.ts`, `db/client.ts`, `db/migrate.ts` | ligne 1 `/// <reference types="node" />` supprimée |
| `scripts/check-api-esm.mjs` | facultatif (2 lignes) : échouer si `api/tsconfig.json` existe, puisque Vercel le prendrait à la place de la racine (§ 1) |
| `tsconfig.json` | facultatif, recommandé : `"noEmitOnError": true`. Une erreur de types vue par Vercel fait alors échouer le déploiement au lieu d'être une ligne de journal. Sans effet en local (`noEmit`) |

Puis : US006 ✅ dans `epic.md` et clôture d'itération (commit `docs: …`).
Variante plus rapide, déconseillée : A et B dans une seule prévisualisation. Dasco vérifie une fois de moins, mais en cas d'échec on ne sait pas lequel des deux changements est en cause.

### 2.4 Ce que la prévisualisation prouve
- A : le déplacement est suivi par Vercel (le traceur de fichiers part de `api/index.ts`).
- B : la fonction compile et répond avec la config du back.
- C : rien ne dépendait des contournements.

Si B échoue, le journal de build dira pourquoi. On revient à A sans toucher la production.

### 2.5 Liste de contrôle de la prévisualisation (pour Dasco, ≈ 5 min)

Adresse de branche, stable d'un envoi à l'autre : `https://<projet>-git-preview-front-back-<compte>.vercel.app`. Elle est protégée par l'authentification Vercel : ouvrir dans un navigateur connecté à Vercel. Une page de connexion Vercel, c'est la protection, pas une panne. L'agent donne à chaque envoi les 7 caractères du commit attendu.

1. `/api/health` : `"ok":true`, `"version"` = le commit annoncé (sinon l'ancien déploiement est encore servi : attendre et recharger), `"env":"preview"`, `"admin":"configure"`, `"db":{"status":"ok", …}`.
2. `/api/nimporte-quoi` : `{"error":"introuvable"}`, une réponse de l'API et non une page 404 de Vercel.
3. `/admin/` : se connecter. Le tableau de bord montre la même version, la base « Connectée » et « Migrations : à jour ».
4. Admin, onglet Parkings : la liste des retouches et le journal s'affichent.
5. `/?debug` : la carte s'affiche, et la console dit « retouches publiées : … en … ms ».
6. Vercel → Deployments → ce déploiement → Build Logs : rechercher `error TS`, il ne doit y avoir aucune ligne. Facultatif : l'onglet Functions montre une seule fonction, `api/index`.

En cas d'écart : copier la réponse affichée, ou les lignes du journal, dans la conversation. Ajouts pour US008 : § 4.10.

---

## 3. US007 — `contrat/` : schémas partagés

### 3.1 Contenu [proposé ; brouillons essayés]

Conventions :
- Noms de fichiers en français, comme le dossier et les plans du stash.
- Noms dans le code en anglais, comme le code existant.
- Clés JSON en anglais, comme l'API actuelle (`overrides`, `updatedAt`, `sizeBytes`).
- Codes d'erreur et messages en français.
- **Pas de fichier `index.ts`** : un import par fichier (élagage plus sûr, dépendances visibles).

| Fichier | Contenu | Repris de |
|---|---|---|
| `contrat/erreurs.ts` | `errorCode` (`z.enum`). Codes existants : `base-indisponible`, `migrations-manquantes`, `admin-non-configuree`. Nouveaux : `donnees-invalides`, `non-autorise`, `trop-de-tentatives`, `introuvable`, `deja-pris`, `erreur-interne`, plus en US008 `session-expiree`, `origine-refusee`, `type-de-contenu`. `apiError` = `{ error: string, code?: errorCode, issues?: { path, message }[] }` | `app.ts` l. 60, 96, 117, 125, 130-135 ; `auth.ts` l. 49, 51, 56 ; admin `types.ts` (`ApiErrorBody`) |
| `contrat/sante.ts` | `appEnv`, `dbStatus`, `healthResponse` (`/api/health`), `dbStats`, `adminStatusResponse` (`/api/admin/status`, dont `db` = union de « ok, avec taille, tables et migrations manquantes » et « autre état ») | `app.ts` l. 27, 74, 82-92 ; `db/stats.ts` l. 10-15 ; admin `types.ts` (`DbState`, `AdminStatus`) |
| `contrat/parkings.ts` | `osmId`, `customId`, `parkingKind`, `point`, `overrideInput`, `addedInput` (déplacés tels quels) ; `publishedEdits` (`/api/parkings/edits`, lu par la carte) ; `editLogEntry` ; `adminParkingEdits` (`/api/admin/parkings/edits`) ; types `OverrideInput`, `AddedInput`, `PublishedEdits`… | `backend/src/parkings.ts` l. 14-54 ; admin `types.ts` l. 32-84 |
| `contrat/session.ts` (US008) | `loginRequest` = `{ token }` (plus tard `{ username, password }`) ; `sessionInfo` = `{ sub, method, expiresAt }` | § 4 |
| `contrat/tsconfig.json` | § 3.4 | — |
| `contrat/contrat.test.ts` | tests des schémas seuls : source obligatoire, objet strict, bornes, union de `db` | — |

Règles des schémas :
- Requêtes en `z.strictObject` : un champ inconnu est refusé, comme aujourd'hui.
- Réponses en `z.object` : une API plus récente qui ajoute un champ ne casse pas un onglet d'admin resté ouvert.
- Dates en texte ISO, jamais `Date` : c'est ce que reçoit le navigateur (exemple : `editLogEntry.at`).

**Essayé** : brouillons de `erreurs.ts`, `sante.ts` et `parkings.ts` dans le bac à sable, avec `backend/src/parkings.ts` et `app.ts` branchés dessus.
- `tsc` (config du back) est vert.
- Le chargement ESM `api/index.js → backend/src/app.js → ../../contrat/*.js` est vert.
- Les 28 tests sont verts.
- **Les réponses réelles de l'API sont conformes** : `/api/health`, `/api/parkings/edits` et `/api/admin/parkings/edits` (avec une base PGlite), `/api/admin/status` sans base, corps d'erreur 401 et 404.

### 3.2 Qui l'importe

| Partie | Import | Usage |
|---|---|---|
| back | valeurs (`../../contrat/x.js`) | Valide les entrées (`safeParse`). Vérifie ses réponses à la compilation, `c.json({ … } satisfies HealthResponse)` (essayé), et dans les tests, `healthResponse.parse(await res.json())` |
| admin | valeurs | `api(method, path, { schema })` fait `schema.safeParse(data)` : un écart devient « réponse de l'API inattendue » au lieu d'un écran blanc. Formulaires : `overrideInput`, `addedInput` |
| carte | **`import type` seulement** | `fetchPublishedEdits()` rend un `PublishedEdits`. Les garde-fous écrits à la main restent |

**La carte valide-t-elle aujourd'hui ?** [code] À moitié.
- `fetchPublishedEdits` (`parking-edits.ts` l. 47-63) fait `(await res.json()) as ParkingEdits` (l. 55) et vérifie seulement que c'est un objet.
- `applyParkingEdits` (l. 71-101) contrôle chaque champ à la main (`KINDS`, `isPt`, `typeof`, l. 65-66). Il **ignore une retouche invalide sans jeter les autres** (`console.warn`).
- Cette tolérance est voulue : le site ne plante jamais à cause d'une retouche. Un `safeParse` Zod de l'objet entier jetterait tout au premier écart.

**Poids de Zod dans la carte [mesuré]** (zod 4.6.5, schéma `publishedEdits` + `safeParse`, minifié, gzip -9) :

| Choix | Rolldown (= Vite 8) | esbuild |
|---|---|---|
| `import type` seulement | **0** | 0 |
| `zod/mini` | 23,7 Ko → **7,0 Ko gzip** | 22,3 → 7,1 |
| Zod classique | 96,8 Ko → **26,0 Ko gzip** (même chiffre avec `import * as z` et `import { z }` ; confirmé par un vrai `vite build` : 26,2) | `import * as z` : 28,3 ; `import { z } from 'zod'` : **92,4** (esbuild n'élague pas à travers l'objet `z`) |

Repère : dans `dist/` du 09/10, `index-*.js` de la carte pèse 76 Ko gzip et three.js 169 Ko [mesuré]. Zod classique ajouterait **34 %** au code propre de la carte (10 % du JS total) ; `zod/mini`, 9 %.

→ **Type seulement maintenant.** Vérifié : le type `PublishedEdits` du contrat s'affecte au `ParkingEdits` de la carte, et `mergeParkingEdits(file, published)` compile.
- Le jour où la carte devra valider à l'exécution (progression, EP008-US002 ; le plan du stash prévoit `contrat/joueurs.ts`), écrire **ces fichiers-là** du contrat avec `zod/mini`. Le back et l'admin les liront aussi bien.
- L'admin garde Zod classique : environ 96 Ko gzip aujourd'hui [mesuré] + 26, soit ≈ 122 Ko, sous l'objectif de 150 Ko de l'epic.

### 3.3 Règles d'import
- **Back et `contrat/`** : chemins relatifs **avec `.js`** (`../../contrat/parkings.js`), que Node charge tels quels sur Vercel. `NodeNext` le fait respecter à la compilation ; `check-api-esm` le vérifie au chargement, puisque `contrat/` est compilé et chargé dès que `app.ts` l'importe. Pas d'alias : Vercel ne gère pas `paths`.
- **Admin et carte** : le même chemin relatif avec `.js`. **Essayé** : Vite 8 résout `../../contrat/parkings.js` vers le `.ts`, même hors de sa racine ; `moduleResolution: bundler` aussi. Une seule règle partout.
- `contrat/` n'importe que `zod` et lui-même. C'est déjà dans `check-boundaries.mjs` (l. 50-55), qui autorise aussi la carte et l'admin à importer `contrat` (l. 26, 38).
- Pas de `drizzle-zod` dans `contrat/` : il ferait dépendre le contrat du schéma de la base. Dans l'autre sens, le schéma Drizzle peut importer les listes de valeurs du contrat (`parkingKind.options`) pour ses contraintes `CHECK`, ce qui donne une seule source pour les valeurs permises.

### 3.4 `contrat/tsconfig.json` : « pas de DOM, pas de Node », vérifié à la compilation [essayé]

```jsonc
{
  "//": "contrat/ : ni DOM ni Node, seulement Zod (EP010-US007). Un `document` ou un `node:fs` ici est une erreur de compilation.",
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "lib": ["ES2022"], "types": [],
    "strict": true, "noUnusedLocals": true, "noUnusedParameters": true,
    "isolatedModules": true, "skipLibCheck": true, "noEmit": true
  },
  "include": ["."],
  "exclude": ["**/*.test.ts"]
}
```
Essayé :
- Le dossier propre compile.
- Un fichier qui fait `import … from 'node:fs'`, `document.title` et `process.env` est refusé : `TS2307`, `TS2584`, `TS2591`.
- Zod n'amène ni les types de Node ni ceux du DOM (liste des fichiers du programme vérifiée).
- Les tests de `contrat/` sont exclus de ce tsconfig, car Vitest amène les types de Node. Le tsconfig racine les vérifie.

Commande ajoutée au `typecheck` : `tsc --noEmit -p contrat`.

### 3.5 Fichier par fichier (US007)

| Fichier | Changement |
|---|---|
| `contrat/*` | nouveaux fichiers (§ 3.1, § 3.4) |
| `backend/src/parkings.ts` | ne garde que l'accès à la base (`listEdits`, `saveOverride`, `addParking`, `removeEdit`, `recentLog`, type `Db`) ; schémas et types importés de `../../contrat/parkings.js` |
| `backend/src/app.ts` | schémas lus dans `contrat/` (l. 9) ; `DbStatus` (l. 27) vient du contrat ; `satisfies` sur les réponses de `/health`, `/admin/status`, `/parkings/edits` et `/admin/parkings/edits` ; un `code` sur toutes les erreurs (l. 96, 104, 117, 125, 130, 135). Changement additif : l'admin actuelle n'en dépend pas |
| `backend/src/auth.ts` | `code` sur le 429 (l. 51) et le 401 (l. 56) |
| `backend/src/db/stats.ts` | `DbStats` (l. 10-15) devient le type du contrat |
| tests du back | réponses vérifiées par les schémas du contrat ; l'utilitaire `json()` du commit B disparaît là où c'est possible |
| `scripts/check-api-esm.mjs` | facultatif : valider la réponse de `/api/health` avec `healthResponse` (essayé : « conforme ») |
| `package.json` | `typecheck` : `… && tsc --noEmit -p contrat` |
| `vitest.config.ts` | projet `back` : ajouter `contrat/**/*.test.ts` |
| `frontend/admin/src/types.ts` | ne garde que `CityParking` (format de `city.json`, qui n'est pas un format de l'API) ; `ParkingKind` vient du contrat |
| `frontend/admin/src/api.ts` | option `schema` dans `api()` (l. 47-69) ; `ApiErrorBody` devient `ApiError` du contrat ; nouveau message « réponse de l'API inattendue (contrat) » |
| `frontend/admin/src/auth.tsx`, `pages/*.tsx` | passent les schémas ; types tirés du contrat |
| tests de l'admin | données de test typées par le contrat ; un test « réponse hors contrat → message clair » |
| `frontend/carte/src/scene/parking-edits.ts` | `import type { PublishedEdits } from '../../../../contrat/parkings.js'` ; `PublishedResult.edits: PublishedEdits` (l. 40) ; `mergeParkingEdits(file, published: PublishedEdits \| null)` (l. 32). `ParkingEdits` et `ParkingOverride` (l. 9-26) restent, comme format de `content/parkings.json` |

**Contrôle fort pour la carte** : l'import de type est effacé, donc `dist/assets/index-*.js` doit rester **identique** (même empreinte) avant et après. C'est la règle 1 de l'epic.

### 3.6 Anticiper l'admin « par tables »
D'après les réponses de Dasco du 09/10 (« tout est géré depuis les tables ») et les plans du stash :
- **Un fichier par ressource** : `parkings.ts` (puis `parkingOverrideRow`, `customParkingRow`, `parkingAdminRow` pour la vue), `sources.ts`, `pois.ts`, `journal.ts` (`audit_log`), `admin/pagination.ts`, `joueurs.ts`, `regles-du-jeu.ts` (constantes en TypeScript simple : « Zod seulement » veut dire « aucune autre dépendance »).
- **Format d'erreur commun dès maintenant** : `{ error, code, issues? }`, le même dans les deux plans du stash.
- **Pagination : à trancher avant la reprise d'EP008.** Les deux plans du stash divergent : `page, size, sort` → `{ items, page, size, total }` d'un côté, `limite, decalage, tri, ordre` → `{ elements, total, limite, decalage }` de l'autre. Proposition : les noms anglais courts, cohérents avec les champs actuels de l'API. Une ligne dans DECISIONS.
- **Tri et filtres en listes blanches** (`z.enum` par table), dans le contrat. Les identifiants sont des schémas nommés (`osmId`, `customId`, plus tard `sourceId`).
- **Le format publié `publishedEdits` reste celui de la carte** (plan « par tables », US-T2 : « même format ») : l'import de type de la carte reste valable.

---

## 4. US008 — Session d'administration par cookie `HttpOnly`

### 4.1 Jeton signé sans état, plutôt qu'un jeton aléatoire stocké [proposé]

| | Jeton signé (HMAC-SHA256), sans état ← **recommandé** | Jeton aléatoire stocké |
|---|---|---|
| Où vit la session | dans le cookie (signé, avec une date d'expiration) | côté serveur |
| Plusieurs instances de fonction Vercel | marche | la mémoire est propre à chaque instance : il faudrait la base |
| Base endormie ou absente | marche : le tableau de bord qui diagnostique la base reste accessible | admin bloquée quand Neon dort ou tombe ; chaque appel d'admin réveille la base (quota de calcul, plan « par tables » § 7.1) |
| Déconnexion | efface le cookie du navigateur ; un cookie volé reste valable jusqu'à son expiration (2 h au plus) | révocation immédiate |
| Tout fermer d'un coup | changer `ADMIN_TOKEN` (ou `ADMIN_SESSION_SECRET`) puis redéployer | vider la table |
| Migration de base | aucune | une table |

**Bibliothèque : `hono/jwt`** (`sign` et `verify` en HS256, déjà dans Hono 4.13.13 ; `verify` exige l'algorithme, donc pas de confusion d'algorithme). Équivalent possible : `setSignedCookie`/`getSignedCookie` de `hono/cookie`, avec une charge écrite et analysée à la main. Le JWT donne des champs standard (`sub`, `iat`, `exp`) sans code de lecture maison.
WebCrypto global requis : Node ≥ 19. Vite 8 exige déjà Node ≥ 20.19 en local, et l'image Docker utilise `node:22`. La version Node de Vercel s'affiche dans le tableau de bord de l'admin (point 3 du § 2.5).

### 4.2 Cookie et clé
- **Cookie** : `diorama_admin=<jwt>; Max-Age=7200; Path=/api/admin; HttpOnly; Secure; SameSite=Strict` (essayé, § 4.11). Pas de préfixe `__Host-` : il impose `Path=/`. Pas de préfixe `__Secure-` non plus : il interdit de retirer `Secure` en développement.
- **Charge du jeton** : `{ sub: 'admin', method: 'token', iat, exp: iat + 7200 }`. Durée **fixe de 2 h**, comme la décision D5. Une session « glissante » (2 h d'inactivité, 8 h au plus) reste une question pour Dasco (§ 10) ; par défaut, non.
- **Clé** : `ADMIN_SESSION_SECRET` si elle existe, sinon `'diorama-admin-session-v1|' + ADMIN_TOKEN.trim()`. Aucune variable à ajouter ; changer le jeton ferme toutes les sessions.
- **Le jeton ne sert plus qu'à ouvrir la session** (`POST /api/admin/login`). Les autres routes d'admin n'acceptent plus `Authorization: Bearer` (critère : « l'admin ne garde plus le jeton »). Un futur script pourra se connecter puis rejouer le cookie.

### 4.3 Routes et ordre des middlewares (`backend/src/app.ts`, routeur admin des l. 77-128)

```ts
// backend/src/app.ts (esquisse) — AppDeps gagne `now?: () => number` (ms) pour les tests
const admin = new Hono<{ Variables: { session: AdminSession } }>();
admin.use('*', adminConfigured(env));              // 503 admin-non-configuree (logique actuelle d'auth.ts l. 47-49)
admin.use('*', sameOriginWrites());                // écritures : 403 origine-refusee, 415 type-de-contenu
admin.post('/login', login(env, limiter, now));     // { token } → cookie ; 400 / 401 / 429
admin.post('/logout', (c) => { closeSession(c, env); return c.body(null, 204); });
admin.use('*', except((c) => PUBLIC.has(c.req.path), requireSession(env, now)));  // hono/combine
admin.get('/session', (c) => c.json(sessionInfo(c.get('session'))));              // { sub, method, expiresAt }
admin.get('/ping', …); admin.get('/status', …); /* routes des parkings inchangées (l. 97-127) */
```
- `PUBLIC = new Set(['/api/admin/login', '/api/admin/logout'])`. `except` exempte ces chemins explicitement, sans dépendre de l'ordre d'enregistrement (essayé).
- **Login** : limiteur bloqué → 429 `trop-de-tentatives`. Corps refusé par `loginRequest` → 400 sans compter d'échec. Jeton faux (`tokenMatches`, `auth.ts` l. 15-17, après `trim()` comme aujourd'hui l. 53) → `limiter.fail` et 401 `non-autorise`. Sinon `openSession` et 200 `sessionInfo`. **Le corps de la réponse ne contient jamais le jeton.**
- **`requireSession`** : cookie absent ou signature fausse → 401 `non-autorise`. Expiré → 401 `session-expiree`. L'expiration est contrôlée avec l'horloge injectée : `verify(raw, key, { alg: 'HS256', exp: false, iat: false })`, puis `p.exp <= now()`. Les contrôles de date propres à la bibliothèque utilisent l'heure réelle, ce qui empêcherait de tester avec une horloge simulée.
- **`onError`** (l. 131-136) : renvoyer `err.getResponse()` pour une `HTTPException` (import depuis `hono/http-exception`), sinon une telle erreur devient un 500.
- **Nouveau fichier `backend/src/session.ts`** (≈ 80 lignes) : `SESSION_COOKIE`, `SESSION_TTL_S`, `sessionKey(env)`, `openSession(c, env, key, sub, method, nowS)`, `closeSession(c, env)`, `requireSession(env, now)`, `sameOriginWrites()`.
- `auth.ts` : `adminAuth` (l. 44-60) est supprimé ; `tokenMatches`, `createRateLimiter` et `clientKey` (à exporter) restent.

### 4.4 Requêtes intersites
- **`SameSite=Strict`** : le navigateur n'envoie pas le cookie depuis un autre site.
- **Contrôle d'origine sur les écritures** (`POST`, `PUT`, `PATCH`, `DELETE`). La requête est acceptée si l'hôte de l'en-tête `Origin` est égal à l'en-tête `Host` (à défaut, l'hôte de `c.req.url`), **ou** si `Sec-Fetch-Site: same-origin` est présent. Sinon : 403 `origine-refusee`.
  - Sur Vercel, `host` est « the domain name as it was accessed by the client » [doc, request headers].
  - L'origine exacte compte : un sous-domaine du même site (domaine personnalisé plus tard), que `SameSite` laisse passer, est refusé.
- **JSON seulement** : un `Content-Type` présent autre que `application/json` donne 415 `type-de-contenu`. Un formulaire d'un autre site a toujours un type de formulaire.
- **Pas le middleware `csrf()` de Hono.** D'après son code (`node_modules/hono/dist/middleware/csrf/index.js`), il ne contrôle que les types « formulaire » (`application/x-www-form-urlencoded`, `multipart/form-data`, `text/plain`, ou aucun type). Il lève aussi `HTTPException(403)`, que notre `onError` actuel transforme en 500.
- **Piège `Referrer-Policy: no-referrer`** (vercel.json l. 50-58, sur `/admin` et `/api`). Selon la spec Fetch (« append a request `Origin` header »), une requête autre que GET/HEAD dont le mode n'est pas `cors` reçoit `Origin: null` sous cette politique. `fetch('/api/…')` est en mode `cors` par défaut, donc l'`Origin` réel est envoyé. **Ne jamais passer `mode: 'same-origin'` dans `api.ts`.** Le middleware accepte de toute façon `Sec-Fetch-Site: same-origin` (prototype : 200).
- Les GET restent protégés par `SameSite=Strict` ; ils ne modifient rien.

### 4.5 Limite d'essais
- Le limiteur existant (5 échecs par minute et par adresse, en mémoire, donc par instance : `auth.ts` l. 25-40) est **gardé et réservé à `/login`**.
- Un cookie absent ou expiré **ne compte pas** comme un échec. Sinon, six chargements de page après une expiration bloqueraient Dasco.
- Clé du limiteur : `x-forwarded-for` (`auth.ts` l. 42). Vercel « overwrite[s] the `X-Forwarded-For` header and do[es] not forward external IPs […] to prevent IP spoofing » [doc] : cet en-tête n'est pas falsifiable sur Vercel.
- Un limiteur partagé en base relève d'EP008-US008 (table `rate_limits` du plan « progression »).

### 4.6 Développement local (http, proxy de Vite)
- Lancer `ADMIN_TOKEN=… npm run api:dev`, puis `npm run dev:admin` (http://localhost:5174/admin/), et `npm run dev` pour `/data`.
- **`Secure` est retiré seulement en développement sur http** : `secure: appEnv(env) !== 'development' || new URL(c.req.url).protocol === 'https:'`. Chrome accepte `Secure` sur `localhost` ; pour Safari, **[non vérifié]**, d'où cette règle. En prévisualisation et en production, `VERCEL_ENV` est toujours posé (`env.ts` s'en sert déjà pour choisir la base).
- Le proxy de Vite (`frontend/admin/vite.config.ts` l. 23) transmet `Set-Cookie` tel quel. Le cookie n'a pas d'attribut `Domain`, donc il appartient à `localhost`. Les cookies ignorent le port : il part aussi vers 5173, sans effet (`Path=/api/admin`).
- **Contrôle d'origine en dev** : le proxy garde `Host: localhost:5174` (`changeOrigin` vaut `false` par défaut, c'est le cas aujourd'hui), donc `Origin: http://localhost:5174` correspond. **Garder `changeOrigin: false`**, avec un commentaire dans le fichier.
- API seule, avec `curl` : `curl -i -X POST -H 'Origin: http://localhost:8787' -H 'Content-Type: application/json' -d '{"token":"…"}' http://localhost:8787/api/admin/login`, puis `-b 'diorama_admin=…'`.

### 4.7 Comptes d'administration en base, plus tard (D6)
- `POST /api/admin/login` accepte aussi `{ username, password }` (union dans `loginRequest`). Il vérifie un hachage scrypt (`node:crypto`, sans dépendance) dans une table `admin_accounts`, puis appelle **le même** `openSession(c, …, 'compte:<id>', 'password', now)`.
- Le cookie, `requireSession` et l'admin React ne changent pas : c'est le critère « rien à refaire côté session ».
- Pour révoquer une session avant 2 h, ajouter un champ `sid` et une table `admin_sessions` vérifiée par `requireSession` (une requête par appel d'admin). À décider avec les comptes.

### 4.8 Admin React, fichier par fichier (d'après le code de la phase 1)

| Fichier | Changement |
|---|---|
| `frontend/admin/src/api.ts` | `tokenStore` (l. 8-18), l'option `token` et l'en-tête `Authorization` (l. 58) sont supprimés. `fetch(path, { method, cache: 'no-store', credentials: 'same-origin', headers, body })` (l. 60), **sans `mode`**. Un 401 envoie `UNAUTHORIZED_EVENT`, sauf sur `/api/admin/login` (remplace `fromSession`, l. 55 et 66). `errorMessage` (l. 33-45) : `session-expiree` → « Session expirée : reconnecte-toi. », 401 au login → « Jeton refusé. », `origine-refusee` → message explicite |
| `frontend/admin/src/auth.tsx` | État initial lu avec `useQuery(['admin','session'], GET /api/admin/session)` au lieu de `tokenStore` (l. 23) ; pendant le chargement, « Vérification de la session… ». `login(token)` → `POST /api/admin/login { token }`, puis `setQueryData(['admin','session'], info)` (remplace l. 33-39). `logout(why)` → `POST /api/admin/logout` (best effort), puis `queryClient.clear()` (l. 26-31). Au démarrage : `sessionStorage.removeItem('diorama-admin-token')` pour effacer l'ancienne clé |
| `frontend/admin/src/pages/Login.tsx` | inchangé (même champ, vidé et `trim()`) |
| `frontend/admin/src/Layout.tsx` | facultatif : « Session jusqu'à 16 h 42 » d'après `expiresAt` |
| `frontend/admin/src/App.test.tsx` | réécrit (§ 4.9) |
| CSP, dépendances | inchangées (`connect-src 'self'` suffit) |

Un onglet d'admin ouvert pendant le déploiement envoie encore le jeton : 401, puis écran de connexion. C'est normal.

### 4.9 Tests Vitest à écrire

**Back** : nouveau `backend/src/session.test.ts` (≈ 15 tests), plus la réécriture des helpers de `admin.test.ts` (l. 12-13) et `parkings.test.ts` (l. 21-24, 73-78), qui passent à un `login()` → cookie + `Origin`.
1. Bon jeton → 200, corps conforme à `sessionInfo`, sans le jeton. `Set-Cookie` porte `HttpOnly`, `Secure` (env `preview`), `SameSite=Strict`, `Path=/api/admin`, `Max-Age=7200`.
2. Mauvais jeton → 401 `non-autorise`. Après 5 échecs → 429, même avec le bon jeton. Une autre adresse n'est pas touchée.
3. Sans `ADMIN_TOKEN` → 503 `admin-non-configuree`. Corps invalide (jeton absent, champ en trop) → 400.
4. `GET /status` sans cookie → 401 `non-autorise`. Six fois de suite → toujours 401, pas 429.
5. Avec le cookie : `/status` → 200 ; `/session` → `{ sub: 'admin', method: 'token', expiresAt }`.
6. **Expiration** (horloge injectée) : à 2 h − 1 s → 200 ; à 2 h + 1 s → 401 `session-expiree`.
7. Signature falsifiée, clé différente, ou `ADMIN_TOKEN` changé depuis → 401.
8. `Authorization: Bearer <jeton>` seul sur `/status` → 401.
9. Écritures avec cookie : même `Origin` → 200. `Origin` étranger → 403 `origine-refusee`, et rien n'est écrit (la lecture publique ne change pas). Sans `Origin` ni `Sec-Fetch-Site` → 403. `Sec-Fetch-Site: same-origin` avec `Origin: null` → 200. `Content-Type: text/plain` → 415.
10. `POST /login` depuis une origine étrangère → 403, sans compter d'échec.
11. `/logout` → 204 et `Max-Age=0`, avec ou sans session.
12. Développement en http → cookie sans `Secure` ; prévisualisation → avec `Secure`.
13. `/api/health` reste publique (test existant).

**Admin** : `App.test.tsx` réécrit, avec un `fetch` simulé par adresse et par méthode.
1. Au démarrage, `GET /session` → 401 : écran de connexion, rien écrit dans `sessionStorage`.
2. Mauvais jeton → « Jeton refusé. ».
3. Bon jeton (espaces ignorés) : `POST /login` avec `{ token: 'bon' }`, puis tableau de bord. `fetch` n'a jamais d'en-tête `Authorization` et a toujours `credentials: 'same-origin'`.
4. `/status` → 401 `session-expiree` : retour à la connexion avec « Session expirée ».
5. Déconnexion : `POST /logout` appelé et cache vidé.
6. Ancienne clé `diorama-admin-token` présente au démarrage → effacée.

`scripts/check-api-esm.mjs` : appeler aussi `GET /api/admin/session` et attendre 503 `admin-non-configuree` en JSON. Cela prouve que le module de session (WebCrypto, `hono/jwt`) se charge en ESM.

### 4.10 Prévisualisation US008 : à ajouter à la liste du § 2.5
7. Outils de développement → Application → Cookies → `diorama_admin` : HttpOnly ✓, Secure ✓, SameSite Strict, Path `/api/admin`, expiration dans ≈ 2 h. Session Storage : pas de `diorama-admin-token`.
8. Faire puis retirer une retouche de parking d'essai : c'est la première écriture avec session et contrôle d'origine sur Vercel.
9. « Se déconnecter » : le cookie disparaît ; après rechargement, l'écran de connexion s'affiche.

### 4.11 Prototype [essayé, Hono 4.13.13, hors dépôt]
Mêmes middlewares que ci-dessus, horloge injectée, résultats :

| Cas | Résultat |
|---|---|
| Mauvais jeton | 401 |
| Bon jeton | 200, `Set-Cookie: diorama_admin=<jwt>; Max-Age=7200; Path=/api/admin; HttpOnly; Secure; SameSite=Strict` |
| `/session` sans cookie / avec cookie | 401 / 200 |
| Écriture : même origine / `Origin` étranger / sans `Origin` ni `Sec-Fetch-Site` | 200 / 403 / 403 |
| Écriture : `Sec-Fetch-Site: same-origin` avec `Origin: null` | 200 |
| Écriture : `Content-Type: text/plain` | 415 |
| Cookie falsifié | 401 |
| Après 2 h + 1 s | 401, `code: "session-expiree"` |
| Déconnexion | 204, `diorama_admin=; Max-Age=0; Path=/api/admin; HttpOnly; Secure; SameSite=Strict` |

---

## 5. US009 — Docker / Coolify et documentation

### 5.1 L'image du Pi ne construit que la carte (D4)

| Fichier | Changement |
|---|---|
| `package.json` | nouveau script `"build:pi": "tsc --noEmit -p frontend/carte && npm run build:carte"`. `vite build` ne vérifie pas les types, d'où le `tsc` |
| `Dockerfile` | l. 20 → `RUN npm run build:pi` ; en-tête : « image du Pi : la carte seule (EP010, D4 : ni API ni administration sur le Pi) » |
| `.dockerignore` | ajouter `backend`, `api`, `frontend/admin` : contexte plus petit, cache Docker qui n'est plus invalidé par une modification du back ou de l'admin, et preuve que la carte n'en dépend pas (sinon le build échoue). **Garder `contrat/`** : après US007, `tsc -p frontend/carte` lit les types du contrat |
| `deploy/refresh-data.sh`, `docker-compose.yml` | inchangés : les chemins `frontend/carte/…` sont déjà en place depuis US002 [code] |

### 5.2 nginx : 404 sur `/api/` et `/admin` (oui)
Aujourd'hui, `location /` (`deploy/nginx.conf` l. 55-58, `try_files $uri $uri/ /index.html`) répond aux adresses `/admin/…` et `/api/…` avec **l'`index.html` de la carte**, en 200.
- Sur le Pi, `/admin/` lancerait donc la carte 3D.
- `fetchPublishedEdits` reçoit du HTML en 200 et échoue en le lisant. Il se replie bien sur `parkings.json`, mais par accident.

À ajouter avant `location /` :
```nginx
# Pas d'API ni d'administration sur le Pi (EP010, D4) : 404 net plutôt que la page de la carte
location ^~ /api/ {
    default_type application/json;
    add_header Cache-Control "no-store" always;
    return 404 '{"error":"introuvable"}';
}
location = /admin { return 404; }
location ^~ /admin/ { return 404; }
```
Avec un 404 en JSON, la carte voit `!res.ok`, affiche « réponse 404 » en `?debug` et se replie tout de suite. Le service worker exclut déjà `/api/` et `/admin` de son repli (`navigateFallbackDenylist`, `frontend/carte/vite.config.ts` l. 134). **[non vérifié** : pas de Docker sur ce Mac**]**

### 5.3 Documents à mettre à jour, avec les phrases périmées relevées

| Document | À changer |
|---|---|
| `README.md` | **Toutes les commandes** : `build:pi`, `typecheck`, chemins des `db:*`. **Structure du code** : `backend/src/` avec `db/`, `contrat/`, `tsconfig.json` racine = back, `contrat/tsconfig.json`, `backend/data/dev-db/`. **Choix techniques** : « pas de backend » (l. 486-488). **API et base de données** : « Sans `ADMIN_TOKEN` … fermée (404) » → 503 `admin-non-configuree` (depuis l'itération 81) ; « 1,5 s au plus » → 4 s (itération 82) ; jeton en `sessionStorage` / `Authorization` → session par cookie de 2 h (connexion, déconnexion, tout fermer en changeant le jeton) ; `tsconfig.api.json` → `tsconfig.json`. **Déployer** : image du Pi = carte seule ; nginx répond 404 sur `/api` et `/admin` |
| `.claude/CLAUDE.md` | l. 4 « Site 100 % statique, sans back-end ». Règle à ajouter : « le front ne parle au back que par HTTP ; `contrat/` = Zod seulement » (renvoi à l'ADR-002). Checklist : « `npm run build` passe (types de la carte, de l'admin, du back et du contrat, frontières, chargement de l'API comme sur Vercel) » et `npm test` |
| `.claude/docs/context.md` | Hors scope, l. 36 (« Back-end, comptes… »). Stack : ligne Frontend (ajouter l'admin React), Backend l. 47 (« Aucun — site 100 % statique »), Données l. 48 (chemins `frontend/carte/…`), Infrastructure l. 51 (Vercel : carte, admin et API ; Pi : carte seule). Contraintes l. 55 (« Pas de tests automatisés » → Vitest pour le back et l'admin). l. 93. Date de mise à jour (30/09) |
| `.claude/docs/onboarding/getting-started.md` | chemins l. 10 et 51-53 (`public/data`, `src/content`) ; l. 33 et 49 (« pas de tests ni de lint ») ; section « développer avec l'API et l'admin » (trois terminaux, `ADMIN_TOKEN=… npm run api:dev`, http://localhost:5174/admin/) ; `npm test` |
| EP008 `epic.md` | schéma l. 20 : « /admin (page statique) ──► /api/admin/* (jeton secret…) » → admin React, session par cookie |
| EP010 `epic.md`, US006 à US009, ADR-002 | statuts ; `backend/db` → `backend/src/db` si validé ; section « Non vérifié » (la compilation sur Vercel sera vérifiée par la prévisualisation) |
| `DECISIONS.md` | une ligne par décision : tsconfig racine = back (NodeNext, sans DOM) ; `backend/src/db` ; la carte n'importe que des types du contrat ; session sans état (JWT HS256, clé dérivée du jeton, 2 h fixes) ; Pi : 404 sur `/api` et `/admin` |
| CHANGELOG, FEATURES, BACKLOG | clôture de chaque itération |
| facultatif : EP009 `epic.md` l. 61 et 115, US003 l. 34 | `server/app.ts` → `backend/src/app.ts` (epic en pause) |

L'historique (anciennes entrées du CHANGELOG, plans de `tasks/`) reste tel quel.

---

## 6. Ordre des commits

Branche d'epic `feat/EP010-front-back`. Une branche par US, fusionnée après sa prévisualisation. Fusion dans `main` seulement avec l'accord de Dasco : une fusion dans `main` part en production.

| # | US | Commit | Vérification |
|---|---|---|---|
| 1 | US006 | `refactor(api): server/ devient backend/src` | prévisualisation 1 |
| 2 | US006 | `build(api): le tsconfig racine devient celui du back` | prévisualisation 2 + journal de build |
| 3 | US006 | `chore(api): fin des contournements pour Vercel` | prévisualisation 3 |
| 4 | US006 | `docs: itération N (EP010-US006)` | — |
| 5 | US007 | `feat(contrat): schémas partagés entre front et back` (back branché) | `npm run build`, `npm test` |
| 6 | US007 | `refactor(admin): formats de l'API lus dans contrat/` | idem |
| 7 | US007 | `refactor(carte): type des retouches publiées tiré du contrat` | `dist/` de la carte identique ; prévisualisation 4 |
| 8 | US007 | `docs: itération N+1` | — |
| 9 | US008 | `feat(api): session d'administration par cookie HttpOnly de 2 h` | tests |
| 10 | US008 | `feat(admin): connexion par cookie, plus de jeton dans le navigateur` | prévisualisation 5 (points 1 à 9). **Commits 9 et 10 partent ensemble** |
| 11 | US008 | `docs: itération N+2` | — |
| 12 | US009 | `build(docker): l'image du Pi ne construit que la carte ; nginx 404 sur /api et /admin` | `npm run build:pi` ici ; `docker compose build` chez Dasco |
| 13 | US009 | `docs: itération N+3 (README, CLAUDE.md, context.md, getting-started, EP008)` | — |

---

## 7. Estimation (heures de travail de l'agent, hors attente de Dasco, ± 30 %, rien n'est mesuré)

| US | Détail | Heures | Spec |
|---|---|---|---|
| US006 | A 1–1,5 ; B 1–1,5 (dont les tests) ; C 0,5 ; trois prévisualisations 0,75–1 ; clôture 0,5 | **4–6** | 0,5–1 j |
| US007 | contrat, back et tests 1,5–2 ; admin 1–1,5 ; carte 0,5 ; tsconfig, scripts et clôture 0,5–1 | **3,5–5** | 0,5 j |
| US008 | back (`session.ts`, routes, middlewares, ≈ 15 tests, deux fichiers de tests réécrits) 3–3,5 ; admin et tests 1,5–2 ; prévisualisation et clôture 0,5–1 | **5–6,5** | 0,75 j |
| US009 | Docker et nginx 0,5–1 ; documentation 1,5–2 ; clôture 0,5 | **2,5–3,5** | 0,5 j |
| **Total** | | **15–21 h ≈ 2–2,6 j** | 2,25–2,75 j |

---

## 8. Risques

| # | Risque | Effet | Parade |
|---|---|---|---|
| R1 | Vercel compile `api/` autrement que prévu avec le tsconfig racine | 500 ou build en échec sur la prévisualisation | trois commits séparés, une prévisualisation chacun ; `check-api-esm` gardé ; `git revert` simple |
| R2 | Une erreur de types vue seulement par Vercel est écrite dans le journal sans faire échouer le déploiement (§ 1) | déploiement « vert » mais suspect | point 6 de la liste ; `noEmitOnError` (commit C, facultatif) |
| R3 | Un `tsconfig.json` créé un jour dans `api/` | il prendrait le pas sur la racine | commentaire dans le tsconfig racine ; contrôle de 2 lignes dans `check-api-esm` |
| R4 | Tests sans DOM : `res.json()` rend `unknown` | build rouge au commit B si l'on oublie | 14 lignes recensées (§ 2.2), utilitaire `json()`, puis schémas du contrat |
| R5 | Sur Vercel, l'`Origin` ne correspond pas à l'hôte vu par la fonction | écritures d'admin en 403 | `Sec-Fetch-Site` accepté aussi ; message explicite ; point 8 de la prévisualisation US008 |
| R6 | Quelqu'un ajoute `mode: 'same-origin'` dans le `fetch` de l'admin | `Origin: null` (rattrapé par `Sec-Fetch-Site`) | ne pas forcer `mode` ; commentaire dans `api.ts` |
| R7 | Cookie `Secure` refusé sur http://localhost (Safari) | connexion impossible en dev | pas de `Secure` en développement sur http |
| R8 | Proxy Vite de l'admin passé à `changeOrigin: true` | 403 en dev | le laisser par défaut ; commentaire |
| R9 | Session sans état : la déconnexion ne révoque pas un cookie volé | 2 h d'accès au plus | durée courte ; changer `ADMIN_TOKEN` ferme tout ; table de sessions avec les comptes |
| R10 | Limiteur par instance | des essais en rafale répartis sur plusieurs instances | inchangé (limiteur en base : EP008-US008) ; `x-forwarded-for` non falsifiable sur Vercel |
| R11 | Une `HTTPException` devient un 500 dans notre `onError` | 500 au lieu de 403 | pas de `csrf()` ; `onError` rend `err.getResponse()` |
| R12 | Zod ajouté à la carte par mégarde (import de valeur) | +26 Ko gzip | revue ; `dist/` de la carte comparé au commit 7 |
| R13 | Docker non essayé sur ce Mac | image cassée découverte sur le Pi | `npm run build:pi` essayable sans Docker ; Dasco lance `docker compose build` |
| R14 | Travail en parallèle de l'agent principal (la phase 1 vient d'être commitée) | conflits de chemins | US006 ne démarre qu'après fusion de la phase 1 dans la branche d'epic |
| R15 | Base locale `data/dev-db` de Dasco | retouches de test locales perdues | `mv` documenté (§ 2.3, commit A) |

---

## 9. Vérifié / non vérifié

**Vérifié** :
- **Doc et code source de Vercel** (§ 1) : choix du tsconfig, `include` gardé, options imposées, échec du build seulement avec `noEmitOnError`. **Doc des en-têtes** : `host`, `x-forwarded-for` réécrit par Vercel.
- **Bac à sable, avec la disposition cible** (`backend/src`, `contrat/`) :
  - config du back en `NodeNext` sans DOM et sans les `/// <reference>` : le code de production compile ; les tests donnent 14 erreurs, toutes dues à `Response.json()` → `unknown` ; avec DOM, tout compile ; `TS2835` pour un import sans `.js` ;
  - chargement ESM comme Vercel et `/api/health` 200 conforme au contrat ; 28 tests verts ;
  - pureté de `contrat/` (`TS2307`, `TS2584`, `TS2591`) ; réponses réelles de l'API conformes aux schémas ;
  - type `PublishedEdits` compatible avec la carte ; Vite 8 résout `../../contrat/x.js` ;
  - poids de Zod (Rolldown, esbuild, `vite build`) ;
  - prototype de session (§ 4.11).
- **Code des dépendances installées** : migrateur Drizzle (indépendant du chemin) ; Hono 4.13.13 (`hono/cookie`, `hono/jwt` avec algorithme obligatoire, `hono/combine` `except`, limites de `csrf()`) ; versions de Node exigées par Vite 8.
- **Spec Fetch** : `Origin: null` sous `no-referrer` seulement hors mode `cors`.

**Non vérifié** :
- Déploiement réel sur Vercel avec le nouveau tsconfig (c'est l'objet des prévisualisations).
- Que les builds utilisent la version `main` de `@vercel/node` et le TypeScript du projet.
- Que l'erreur `TS2591` de l'itération 81 ait fait échouer le déploiement.
- Que l'hôte de `request.url` sur Vercel soit l'hôte public (le contrôle s'appuie sur l'en-tête `Host`, documenté).
- Cookie `Secure` sur http://localhost avec Safari.
- Image Docker et nginx (pas de Docker sur ce Mac).
- Poids réel de l'admin une fois Zod ajouté (estimé à ≈ 122 Ko gzip).
- Version de Node des fonctions Vercel (affichée par le tableau de bord de l'admin).
- Disponibilité de « Protection Bypass for Automation » sur le plan Hobby (§ 10).

---

## 10. Ce que Dasco devra faire, et les écarts à valider

**Écarts à la spec ou aux plans, à valider** :
1. `backend/src/db/` au lieu de `backend/db/` (§ 2.1).
2. Le jeton ne sert plus qu'à ouvrir la session : `Bearer` est refusé sur les autres routes d'admin (§ 4.2).
3. Session de 2 h fixes, pas glissante. **Question** : la veux-tu glissante (2 h d'inactivité, 8 h au plus) ?
4. Clé de session dérivée d'`ADMIN_TOKEN`, sans nouvelle variable ; `ADMIN_SESSION_SECRET` reste facultative.
5. Pi : 404 sur `/api` et `/admin` ; contexte Docker sans le back ni l'admin (§ 5).
6. La carte n'importe que des types du contrat ; `zod/mini` seulement le jour où elle devra valider (§ 3.2).
7. Pagination de l'admin « par tables » : noms anglais `page, size, sort` (§ 3.6), à trancher avant la reprise d'EP008.

**Actions** :
- **Prévisualisations** : trois passages de la liste du § 2.5 pour US006, un pour US007, un pour US008 (avec les points 7 à 9) ; lire une fois le journal de build (US006, commit B).
- **Variables Vercel** : aucune obligatoire. Facultatif : `ADMIN_SESSION_SECRET` (Production et Preview, `openssl rand -base64 32`). Vérifier qu'`ADMIN_TOKEN` existe bien pour Preview (c'est le cas d'après les itérations 81-82).
- **Migrations** : aucune en phase 2. Le schéma ne change pas, et déplacer le dossier ne rejoue rien (vérifié dans le code de Drizzle). Les migrations `0002`/`0003` viendront avec l'admin « par tables ».
- **Docker** : `docker compose build` (ou un build Coolify), puis trois adresses : `/` (la carte), `/admin/` (404), `/api/health` (404 en JSON).
- **En local** : `mkdir -p backend/data && mv data/dev-db backend/data/` pour garder la base de test ; se reconnecter une fois à l'admin après US008.
- **Facultatif** : activer « Protection Bypass for Automation » (Vercel, Deployment Protection) pour que l'agent vérifie lui-même les prévisualisations avec l'en-tête `x-vercel-protection-bypass`. Disponibilité sur le plan Hobby **non vérifiée**.
- **Fusion dans `main`** : sur accord explicite, comme toujours.

---

## Sources (consultées le 09/10/2026)
- Vercel, *Using the Node.js Runtime with Vercel Functions*, § « Using TypeScript with the Node.js runtime » : https://vercel.com/docs/functions/runtimes/node-js
- Code de `@vercel/node`, appel à `register(...)` dans `compileTypeScript` : https://raw.githubusercontent.com/vercel/vercel/main/packages/node/src/build.ts
- Code de `@vercel/node`, `detectConfig`, `readConfig`, `fixConfig`, `getOutputTypeCheck`, `reportTSError` : https://raw.githubusercontent.com/vercel/vercel/main/packages/node/src/typescript.ts
- Vercel, *Request headers* (`host`, `x-forwarded-host`, `x-forwarded-for`) : https://vercel.com/docs/headers/request-headers
- WHATWG Fetch, « append a request `Origin` header » : https://fetch.spec.whatwg.org/#append-a-request-origin-header ; discussion de l'algorithme : https://lists.w3.org/Archives/Public/public-webapps-github/2019Jun/0543.html
- Code installé dans le dépôt : `node_modules/hono/dist/helper/cookie/index.js`, `utils/cookie.js`, `middleware/csrf/index.js`, `middleware/combine/index.js`, `types/utils/jwt/jwt.d.ts` (Hono 4.13.13) ; `node_modules/drizzle-orm/migrator.js`, `pg-core/dialect.js` (Drizzle 0.45.4) ; `node_modules/vite/package.json` (`engines`).
- Mesures : esbuild 0.28.2, Rolldown 1.2.11, Vite 8.3.1, zod 4.6.5, TypeScript 5.9.3, Node 25 (Homebrew) ; `dist/` du dépôt construit le 09/10 vers 00 h 57.
