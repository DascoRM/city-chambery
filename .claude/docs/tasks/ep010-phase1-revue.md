# Revue de code : EP010 phase 1 (US002 à US005)

**Date** : 09/10/2026 · **Relecteur** : Claude (sous-agent de relecture, rien implémenté)
**Périmètre** : `git log feat/EP010-front-back..HEAD` sur `feat/EP010-US005-frontieres` (7dbb2e7, 498f3cf, b9fa543, 666f600, a238e6b, 81f8961).
**Méthode** : lecture du diff hors renommages purs, comparaison avec l'ancienne admin (`git show feat/EP010-front-back:public/admin/admin.js` et `…/index.html` ; le chemin `frontend/carte/public/admin/` cité dans la demande n'existe pas sur la branche d'epic), `npm run build`, `npm test`, et des **sondes** : tests Vitest et fixtures lancés sur des copies dans le scratchpad, jamais dans le dépôt.

Gravités : **Moyen** (défaut réel, scénario plausible, à corriger avant la fusion dans `release`/`main`) · **Faible** (défaut réel, impact limité) · **Info** (changement de comportement, risque pré-existant ou amélioration).

---

## Synthèse

| # | Gravité | Où | Défaut | Preuve |
|---|---|---|---|---|
| M1 | Moyen | `frontend/admin/src/pages/Parkings.tsx:119`, `:131`, `:143` | Formulaire de retouche : après un enregistrement ou un retrait réussi, il reprend les **anciennes** valeurs jusqu'à la relecture de la liste ; si elle échoue, il les garde (et le bouton « Retirer la retouche » aussi) | sondes P3, P4, P8 |
| M2 | Moyen | `scripts/check-boundaries.mjs:81`, `:69` | Faux négatifs : import multiligne contenant un commentaire avec `'` ou `;`, `import(/* … */ '…')`, `` import(`…`) ``, fichiers `.jsx/.cjs/.cts` ; faux positifs : import commenté, chaîne | fixtures cb, cb2 |
| F1 | Faible | `frontend/admin/src/api.ts:61-69`, `auth.tsx:34-38` | Une réponse 2xx qui n'est pas du JSON est un succès (`null`) : sur le Pi, **n'importe quel jeton « connecte »**, admin vide, aucun message (l'ancienne admin affichait une erreur) | sonde P2 |
| F2 | Faible | `vercel.json:62-70`, `frontend/admin/index.html`, `Dockerfile:20` | La CSP de l'ancienne admin (balise meta) n'existe plus qu'en en-tête Vercel : l'admin servie par nginx (image Docker, qui la construit encore malgré D4) et par `vite preview` n'a plus de CSP | build + preview |
| F3 | Faible | `auth.tsx:36`, `pages/Dashboard.tsx:17` | 2 `GET /api/admin/status` à chaque connexion (et 1 à chaque retour sur l'onglet) ; chacun lance `dbStats` sur Neon | sonde P1 |
| F4 | Faible | `pages/Parkings.tsx:64` | « Choisir » sur le parking déjà choisi ne fait rien (l'ancienne admin remettait les champs, effaçait le message, faisait défiler) | sonde P5 |
| F5 | Faible | `pages/Parkings.tsx:75`, `:85` | Après un échec de `city.json`, revenir dans le champ de recherche ne relance plus la lecture (l'ancienne admin réessayait à chaque focus) | sonde P6 |
| F6 | Faible (doc) | `README.md:517`, `:482` | Adresse de dev de l'admin fausse (`http://localhost:5173/admin/index.html` n'existe plus) ; « fermée (404) » faux (503 `admin-non-configuree`) | lecture |
| F7 | Faible (doc) | `.claude/docs/context.md:47-48,55`, `onboarding/getting-started.md:10,33,49,51-53` | Anciens chemins (`scripts/`, `public/data/city.json`, `src/content`, `data/raw/`) ; CLAUDE.md fait lire context.md en premier | grep |
| I1 à I8 | Info | voir plus bas | messages, 401 en double, retrait qui vide le formulaire, `noRawHtml` incomplet, `/admin` sans barre en preview, jeton lisible par la carte, `city.json` servi par le SW, commentaire | |

Aucun défaut de gravité élevée. La carte, le service worker et les données sont **identiques** à avant (vérifié octet pour octet).

---

## 1. Parité avec l'ancienne admin

### M1 · Moyen · Valeurs périmées dans le formulaire de retouche
**Où** : `Parkings.tsx:119` (`useEffect(() => { if (!isDirty) reset(overrideFields(current)); }, [current, isDirty, reset])`), `:131` (`reset(f)` puis `await refresh()`), `:143` (`reset(overrideFields(undefined))`).

**Mécanisme** : `reset(f)` fait passer `isDirty` de vrai à faux ; l'effet se relance alors avec `current` **encore périmé** (la liste n'est pas relue) et remet le formulaire à l'ancienne retouche. Il ne se corrige qu'à l'arrivée de la relecture.

**Scénarios constatés (copie de l'admin dans le scratchpad, fausse API)** :
- P3 : `way/2` a 25 places publiées ; on saisit 30 et on enregistre. Serveur : 30 ; champ « Places » pendant la relecture : **25** ; après la relecture : 30.
- P4 : idem, mais la relecture échoue (500, une nouvelle tentative puis échec). Serveur : 30 ; champ : **25** ; message « Retouche enregistrée et publiée. ». Si Dasco ré-enregistre (ou modifie un autre champ pendant la relecture, ce qui bloque la remise à jour puisque le formulaire redevient « modifié »), il **republie silencieusement l'ancienne valeur** par-dessus une retouche sourcée.
- P8 : formulaire modifié, puis « Retirer la retouche » réussi, relecture en échec. Serveur : plus de retouche ; formulaire : **valeurs de la retouche retirée** ; bouton « Retirer la retouche » toujours affiché.

L'ancienne admin ne touchait pas aux champs après l'enregistrement et affichait le bouton tout de suite.

**Correctif** : mettre le cache à jour avant de remettre le formulaire à zéro, la relecture ne servant plus qu'à confirmer. La partie « enregistrement » a été essayée sur la copie : P3 et P4 corrigés, les 8 tests d'origine `App` et `Parkings` restent verts. La partie « retrait » suit le même principe mais n'a pas été exécutée.
```ts
// onSubmit, après await save.mutateAsync(body)
queryClient.setQueryData<AdminParkingEdits>(EDITS_KEY, (old) => old && { ...old, overrides: { ...old.overrides, [parking.id]: body } });
reset(overrideFields(body));
setMsg({ text: 'Retouche enregistrée et publiée.', ok: true });
await refresh();

// onRemove, après await remove.mutateAsync()
queryClient.setQueryData<AdminParkingEdits>(EDITS_KEY, (old) => {
  if (!old) return old;
  const overrides = { ...old.overrides };
  delete overrides[parking.id];
  return { ...old, overrides };
});
reset(overrideFields(undefined));
```
Ajouter un test du type P4 (relecture en échec après un enregistrement) dans `Parkings.test.tsx`.

### F4 · Faible · Re-choisir le même parking ne remet pas le formulaire à zéro
**Où** : `Parkings.tsx:64` (`key={selected.id}`) et `:91` (`onPick(p)` avec le même objet : React ne fait rien). **P5** : on saisit un nom, on clique à nouveau « Choisir » sur le même parking : le nom saisi reste. L'ancienne admin (`select(p)`) remettait les champs à la retouche publiée, effaçait le message et faisait défiler jusqu'au formulaire : c'était la façon d'annuler une saisie.
**Correctif** : un compteur de choix dans la clé : `onPick={(p) => { setSelected(p); setPick((n) => n + 1); }}` et `key={`${selected.id}#${pick}`}`.

### F5 · Faible · Pas de nouvel essai de `city.json` au focus
**Où** : `Parkings.tsx:75` (`enabled: wanted`) et `:85` (`onFocus={() => setWanted(true)}`). **P6** : `city.json` en échec (502) deux fois puis disponible ; après l'erreur, quitter et revenir dans le champ ne relance rien (2 lectures avant, 2 après ; erreur toujours affichée). Il faut changer de page ou recharger. L'ancienne admin relisait à chaque focus tant que la liste était vide.
**Correctif** : `onFocus={() => { setWanted(true); if (city.isError) void city.refetch(); }}`.

### Infos de parité
- **I1** `api.ts:44` : pour une erreur 5xx de `/api/admin/status`, l'ancienne admin disait « Erreur 500 : erreur interne. », la nouvelle « erreur interne » (US004 demande les mêmes messages). Les erreurs réseau restent en anglais (« Failed to fetch », « Load failed » sur Safari), comme avant : un `try/catch` autour de `fetch` dans `api()` les traduirait.
- **I2** `Parkings.tsx:244-246` : un 401 sur « Retirer » de la liste affiche `alert('Jeton refusé.')` puis l'écran de connexion avec « Jeton refusé : reconnecte-toi. » (P7) : double message. Ne pas appeler `alert` si `e instanceof ApiError && e.status === 401`.
- **I3** `Parkings.tsx:143` : après « Retirer la retouche », les champs sont vidés (l'ancienne admin les gardait, ce qui permettait de republier la même retouche). Plus fidèle à l'état publié ; à signaler à Dasco, pas à corriger.
- Conformes (lus et testés) : mêmes appels (`GET /api/admin/status`, `GET /api/admin/parkings/edits`, `PUT …/overrides/:id`, `POST …/added`, `DELETE …/edits/:id`) et mêmes corps (champ vide non envoyé, `hide` seulement coché, x et y ensemble, `custom/` préfixé, source « trimée ») ; source obligatoire (et refus d'une source faite d'espaces, mieux qu'avant) ; confirmations aux mêmes textes ; champ du jeton vidé à chaque essai ; formulaire d'ajout remis à zéro ; liste relue après chaque écriture ; journal ; marque « · retouché » ; recherche (2 caractères, 15 résultats, bouts de rue sans nom écartés) ; messages de succès identiques ; « Impossible de lire la liste des parkings. » enfin visible (avant, il s'écrivait dans le formulaire caché).

---

## 2. Sécurité de l'admin

### F2 · Faible · CSP perdue hors Vercel
**Où** : l'ancienne `public/admin/index.html` portait une CSP en `<meta http-equiv>` (valable partout) ; la nouvelle `frontend/admin/index.html` n'en a plus, la CSP n'est que dans `vercel.json:62-70`. Or l'image Docker construit toujours l'admin (`Dockerfile:20` : `npm run build`, qui enchaîne `build:admin`), contrairement à D4 et à la règle 5 d'ADR-002 ; nginx la sert donc sur le Pi **sans CSP**. Idem pour `npm run preview` (vérifié : `/admin/` répond sans en-tête CSP). Impact limité (pas d'API sur le Pi), mais c'est une régression et elle se combine à F1.
**Correctif** (au choix) : anticiper la partie Docker d'US009 (l'image ne lance que les contrôles et `npm run build:carte`, ce qui supprime aussi F1 sur le Pi) ; ou ajouter dans `frontend/admin/vite.config.ts` un petit plugin `transformIndexHtml` avec `apply: 'build'` qui injecte la balise meta (pas en dev, où Vite injecte des `<style>` que `style-src 'self'` bloquerait ; `frame-ancestors` reste dans l'en-tête Vercel).

### F1 · Faible · Une réponse 2xx non JSON est prise pour un succès
**Où** : `api.ts:62` (`try { data = await res.json() } catch {}`) puis `:69` (`return data as T`, donc `null`), utilisé par `auth.tsx:34-38` (`login`).
**Scénario** : sur le Pi, nginx répond à `/api/admin/status` par `index.html` de la carte, en 200 (`try_files $uri $uri/ /index.html`, `deploy/nginx.conf:57`). **P2** : n'importe quel jeton fait disparaître l'écran de connexion, il est gardé dans `sessionStorage`, aucun message, zéro carte affichée. Même chose pour toute page de repli HTML en 200. L'ancienne admin levait une erreur (`res.json()` non protégé dans `load()`).
**Correctif** : dans `api()`, `if (res.ok && data === null && res.status !== 204) throw new ApiError("L'API ne répond pas à cette adresse (réponse qui n'est pas du JSON).", res.status);` (ou contrôler `content-type`) ; un test avec une réponse `text/html` en 200.

### Infos de sécurité
- **I6** Jeton dans `sessionStorage` : lisible par tout script de l'origine dans le même onglet, donc par la carte (sans CSP, 15 constructions par `innerHTML`/`insertAdjacentHTML`, avec `esc()` aux endroits regardés), et demain par la carte affichée **dans un cadre de l'admin** (EP008-US007, même origine). Pré-existant ; c'est l'objet d'US008 (cookie `HttpOnly`) : à faire avant EP008-US007.
- **I4** `check-boundaries.mjs:106` : la règle « pas de HTML brut » ne voit pas `outerHTML =`, `document.write`, `srcDoc`, `createContextualFragment`, `setHTMLUnsafe` (fixture a8). Ajouter ces motifs.
- `X-Content-Type-Options: nosniff` absent sur `/admin(.*)` : facultatif.

### Vérifié, conforme
- `dist/admin/index.html` construit : un `<script type="module" src="/admin/assets/…">` et un `<link rel="stylesheet">`, **aucun script ni style en ligne** : compatible avec `script-src 'self'; style-src 'self'` ; favicon `data:,` couvert par `img-src 'self' data:` ; bundle sans `eval`, `new Function`, `<style>` créé, ni `jsxDEV` ; 97,5 Ko + 1,1 Ko gzip (< 150 Ko).
- `frame-ancestors 'none'`, `form-action 'none'`, `base-uri 'none'`, `object-src 'none'`, `connect-src 'self'` présents ; les en-têtes `X-Robots-Tag` et `Referrer-Policy` existants couvrent `/admin` ; aucun conflit entre règles d'en-têtes.
- Jeton envoyé seulement en `Authorization: Bearer` vers `/api/…` (même origine), jamais vers `/data/city.json` ; effacé à la déconnexion (avec `queryClient.clear()`) et au premier 401 de session ; un essai de connexion refusé ne déclenche pas l'événement.
- Aucun HTML construit à partir de données (React échappe ; `dangerouslySetInnerHTML`, `.innerHTML`, `insertAdjacentHTML` refusés au build pour l'admin).

---

## 3. Correction React, TanStack Query, React Hook Form

### F3 · Faible · Statut demandé deux fois à la connexion
**Où** : `auth.tsx:36` (`setQueryData(STATUS_KEY, status)`) puis `Dashboard.tsx:17` (`useQuery` sans `staleTime`, défaut 0) : la donnée déposée est déjà périmée au montage, d'où une seconde requête (**P1** : 2 `GET /api/admin/status` pour une connexion ; l'ancienne admin : 1). Même chose à chaque retour sur l'onglet « Tableau de bord ». Chaque appel exécute `dbStats` (taille de la base + `count(*)` par table) sur Neon, ce qui compte pour les garde-fous de coût d'EP008-US008.
**Correctif** : `staleTime: 30_000` sur cette requête (ou dans `defaultOptions`) ; « Actualiser » garde `refetch()`.

### Vérifié, conforme
- Pas de boucle d'effets : l'effet de `Parkings.tsx:119` ne relance pas `reset` tant que `current` et `isDirty` ne changent pas ; `logout` et `login` sont stables (`useCallback`), l'écouteur `admin-unauthorized` est posé une fois (et retiré proprement en StrictMode).
- 401 : seul un 401 obtenu avec le jeton de session émet l'événement ; retour à la connexion vérifié (tests et P7) ; pas de boucle (plus aucune requête une fois déconnecté).
- Nouvelles tentatives : une seule, et seulement pour 5xx et erreurs réseau ; jamais pour 4xx ; les mutations ne sont pas rejouées ; `refetchOnWindowFocus: false`.
- Requêtes de la page Parkings : un `GET` des retouches au montage et un après chaque écriture ; `city.json` lu une fois (`staleTime: Infinity`) au premier focus.
- Le partage structurel de TanStack Query garde la même référence `current` quand la retouche ne change pas : un ajout ou une autre retouche ne réinitialise pas un formulaire ouvert.
- Les états périmés constatés sont ceux de M1 (et F4) ; rien d'autre trouvé.

---

## 4. Build et déploiement

### Vérifié, conforme
- `npm run build` passe (types des 4 configs, frontières : 101 fichiers, chargement ESM de l'API, carte, admin) ; `npm test` : 7 fichiers, 40 tests ; aucun test perdu (la base n'avait que les 4 fichiers de `server/`).
- Ordre et `emptyOutDir` : la carte vide `dist/` puis génère `sw.js` ; l'admin ne vide que `dist/admin/` ensuite.
- **Carte inchangée** : la carte de la branche d'epic, construite à part (`git archive feat/EP010-front-back` dans le scratchpad, sans checkout), donne un `dist/` **identique octet pour octet** à l'actuel hors `admin/` : mêmes fichiers, mêmes empreintes, même `sw.js` (64 entrées), donc même `?v=` (`dataVersion()` hache noms et contenus, et les 52 fichiers de données et modèles sont des renommages à 100 %).
- Service worker : aucune entrée `admin` dans le précache ; `navigateFallbackDenylist: [/^\/api\//, /^\/admin/]` et `globIgnores: ['admin/**']`, déjà présents dans le service worker installé chez les visiteurs depuis d643db3 : `/admin/` va au réseau même avec un ancien service worker (lu dans la config, pas testé dans un navigateur).
- `npm run preview` : `/`, `/admin/`, `/admin/index.html`, `/sw.js` et les fichiers de `/admin/assets/` répondent 200.
- Lock : la racine de `package-lock.json` correspond à `package.json` ; 30 paquets ajoutés, aucun retiré ni changé de version ; liaisons natives `linux-*-musl` de rolldown et lightningcss présentes (image `node:22-alpine`) ; `npm ls` sans erreur.
- Vercel (lu) : `outputDirectory: dist`, `buildCommand: npm run build`, réécriture `/api/:path*` inchangée ; `tsconfig.json` racine aux mêmes options que `frontend/carte/tsconfig.json` (la clé `"//"` est acceptée par `tsc`, vérifié par `tsconfig.vercel-check.json`).
- Pas de `.env` ni de variable `VITE_*` : le changement de `root` (et donc d'`envDir`) n'a pas d'effet.

### Remarques
- Docker : voir F2 (l'image construit et sert l'admin). Le build de l'image doit marcher (mêmes étapes qu'avant plus l'admin, dépendances de dev installées par `npm ci`), mais il n'a pas été lancé.
- **I7** L'admin est contrôlée par le service worker de la carte (portée `/`) : son `fetch('/data/city.json', { cache: 'no-store' })` est servi par le **précache** (`?v` ignoré), donc après une mise à jour des données non encore acceptée (« Mettre à jour »), la recherche lit l'ancienne liste. Pré-existant (même chose avec l'ancienne admin), sans gravité tant que les identifiants OSM sont stables.
- **I5** En `vite preview`, `/admin` (sans barre finale) sert **la carte** (repli SPA), pré-existant ; les liens doivent viser `/admin/`. Non vérifié sur Vercel ni nginx.

---

## 5. `check-boundaries.mjs`

### M2 · Moyen · Faux négatifs de l'expression régulière
**Où** : `scripts/check-boundaries.mjs:81`. `[^'";]*?` ne peut franchir ni apostrophe, ni guillemet, ni point-virgule ; `:69` n'examine que `ts|tsx|mts|mjs|js`.
**Constaté** (copie du script dans le scratchpad, fixtures sous `frontend/admin/src` qui importent `server/` ou `frontend/carte/`) :

| Fixture | Résultat |
|---|---|
| `import {\n  createApp, // l'API\n} from '../../../server/app';` | **non détecté** |
| `import {\n  x, // la carte ; non\n} from '../../carte/src/x';` | **non détecté** |
| `import(/* @vite-ignore */ '../../../server/app')` | **non détecté** |
| `` import(`../../../server/app`) `` | **non détecté** |
| même import dans un fichier `.jsx` | **non détecté** |
| `// import { x } from '../../carte/src/x';` (commentaire) | faux positif |
| `"import { x } from '../../carte/src/x'"` (chaîne) | faux positif |
| `import type`, `import { type … }`, `export * from`, réexport multiligne, import sans nom, React dans la carte | détectés (correct) |

Le premier cas est plausible ici : les commentaires sont en français (« l'API », « d'OSM »). Le contrôle étant la garantie « vérifiée par la machine » d'ADR-002, un contournement involontaire passe le build.

**Correctif (essayé)** : laisser TypeScript, déjà installé, lire les imports : `ts.preProcessFile(source, true, true).importedFiles.map((f) => f.fileName)` trouve les 5 cas manqués (y compris le gabarit sans substitution) et ignore commentaires et chaînes. Étendre `CODE` à `/\.(ts|tsx|mts|cts|js|jsx|mjs|cjs)$/`. Garder ces fixtures comme test du script.

### Parties non examinées (Info)
Les configs (`frontend/*/vite.config.ts`, `vitest.config.ts`, `drizzle.config.ts`), les `index.html` (`<script src>`) et les CSS (`@import`, `url()`) ne sont pas contrôlés. Acceptable pour de l'outillage ; à dire dans l'en-tête du script.

---

## 6. Restes du déplacement US002

- **F6** `README.md:517` : « En développement : `ADMIN_TOKEN=… npm run api:dev` puis http://localhost:5173/admin/index.html » est faux depuis la suppression de `public/admin` (le serveur de dev de la carte répond par la carte) et contredit la ligne 521. Remplacer par `npm run dev:admin` → http://localhost:5174/admin/. Même ligne : « fermée (404) » est faux, l'API répond 503 `admin-non-configuree` (pré-existant, ligne retouchée par cette phase). `README.md:482` : « dist/ Sortie du build (carte) » → carte, et administration dans `dist/admin/`.
- **F7** `.claude/docs/context.md:47-48` (« Backend : Aucun », pipeline `scripts/` → `public/data/city.json`, `src/content/*.json`), `:55` (« Pas de tests automatisés ») ; `.claude/docs/onboarding/getting-started.md:10,33,49,51-53` (`public/data/city.json`, `data/raw/`, `src/content/nature.json`, « pas de tests »). US009 les prévoit, mais CLAUDE.md fait lire context.md en premier : 6 lignes à corriger dès maintenant.
- **I8** `frontend/carte/scripts/convert-nature.mjs:7` : `node scripts/convert-nature.mjs Rock_1 Bush_1` → `npm run nature -- Rock_1 Bush_1`.
- **Code et configs : rien de faux.** Les chemins restants (`public/…`, `content/…`, `data/raw/…`, `assets-src/…`) sont relatifs à `ROOT = frontend/carte` dans les scripts et `vite.config.ts`. Vérifié en exécutant : `npm run data -- --offline` sur une copie donne un `city.json` identique à celui du dépôt hors `generatedAt` ; `npm run check:streets` passe ; `deploy/refresh-data.sh`, `.dockerignore`, `.gitignore`, `Dockerfile`, `package.json` et CLAUDE.md sont à jour.

---

## Non vérifié
- **Vercel** : aucune prévisualisation (`preview/front-back` pas poussée ; MCP Vercel non connecté) : réponse de `/`, `/admin/`, `/admin` et `/api/health`, en-tête CSP réellement servi, compilation d'`api/` avec le tsconfig racine.
- **Docker** : absent de ce Mac : ni l'image, ni un vrai `npm ci` (lock contrôlé seulement par sa structure), ni `REFRESH_DATA=true`.
- **Navigateur réel** : l'admin n'a été exercée que sous happy-dom (tests et sondes) ; `npm run dev:admin` non lancé ; comportement avec un service worker de la carte déjà installé vu seulement dans la config.
- L'arbre de travail contient des modifications de docs non commitées datées de 00:59 (DECISIONS, FEATURES, epic, US003 à US005), avant cette revue : elles ne viennent pas d'elle et n'ont pas été relues.

## Sondes (hors dépôt, réutilisables comme tests)
Scratchpad de la session, dossier `adm/` : `probe/probe.test.tsx` (P1 à P7), `probe/remove.test.tsx` (P8) sur une copie de `frontend/admin/src` (dont `src/pages/Parkings.tsx` porte le correctif M1 pour l'enregistrement) ; dossiers `cb/` et `cb2/` : fixtures de `check-boundaries` ; `base/` : build de la branche d'epic ; `pipe/` : pipeline de données hors ligne.
