# Revue EP009 — code de la carte (US001, US002, US004)

Relecture indépendante du 09/10/2026, branche `feat/EP009-US004-meteo-reelle-carte`, tête `48ffd36`.
- **Périmètre** : `git diff 65df83e 48ffd36 -- frontend/carte contrat`, avec le plan `ep009-us001-us002-us004-plan.md` et la spec (epic, US001, US002, US004).
- **Méthode** : aucun fichier du dépôt modifié en dehors de ce rapport. Essais dans une copie (`git archive 48ffd36`) servie sur mes ports : carte sur 4191, API de dev sur 8797 (vraie route `/api/weather`), build d'avant EP009 sur 4192. Sondes Vitest jetables. Mesures dans Chrome for Testing avec Metal (la vraie puce graphique du Mac), à partir de `mesures/lib.mjs`.
- **Hors périmètre** (point connu, non compté) : la fin d'une météo forcée n'est relue qu'à la relecture de 15 min.

## En bref
- **Aucun défaut bloquant.** Aucun changement de météo ne compile de programme (règle 9 tenue, vérifié sur 7 conditions). Par temps stable, rien ne tourne à chaque image. Le DOM n'est jamais construit en HTML à partir de données. `localStorage` est sûr. La mise en page mobile est correcte sans `?debug`.
- **2 défauts importants** :
  - le client relit hors des règles d'US004 (retour du réseau onglet caché ou visiteur inactif) et ne relit pas au retour sur un onglet caché plus de 30 min ;
  - l'option `manualPureFunctions: ['z']` de Vite supprime en silence, dans le build de production, tout appel de méthode sur une variable nommée `z` dont le résultat n'est pas utilisé (prouvé).
- **10 mineurs** : fondu prolongé de 22 s par le vent sans effet visible ; puce sans « modèle ICON » ; crédits ; accessibilité du panneau ; textes ; tests ; README à mettre à jour à la clôture.
- **Les deux longues images signalées ne sont pas des défauts de la météo** :
  - pendant le fondu, la pire image est la même avec ou sans module météo, et avec ou sans réécriture du fond CSS : c'est la charge de la machine ;
  - à l'ouverture du panneau, c'est le **premier** panneau ouvert qui paie 60 à 110 ms, que ce soit le journal ou la météo : coût commun aux panneaux, déjà présent avant EP009.

---

## Défauts

### Bloquant
Aucun.

### Important

#### I1. Relectures hors des règles d'US004
Critère d'US004 : « Given l'onglet caché, ou aucune interaction depuis 30 min, Then aucune requête ; au retour, relecture si le relevé a plus de 15 min ».

**(a) Le retour du réseau ignore l'onglet caché et l'inactivité.**
- **Où** : `frontend/carte/src/weather/client.ts:105`. `online()` appelle `load()` sans vérifier `visible()` ni l'inactivité.
- **Scénario** : la lecture échoue (Wi-Fi coupé), le visiteur passe sur un autre onglet ou s'en va, puis le réseau revient.
- **Preuve** (sondes Vitest, fausses minuteries) :
  - onglet caché, puis `online()` : une requête part ;
  - visiteur inactif depuis 40 min, puis `online()` : une requête part aussi.

**(b) Le retour sur l'onglet ne relit pas si l'absence a duré plus de 30 min.**
- **Où** : `client.ts:49-51` et `:99`. `wake` appelle `schedule`, qui calcule l'inactivité depuis le dernier geste ; or le temps passé onglet caché compte comme de l'inactivité.
- **Scénario** : onglet caché 45 min, puis le visiteur revient et regarde sans toucher. `visibilitychange` ne déclenche aucune relecture, et le relevé, vieux de 45 min, reste affiché jusqu'au premier geste.
- **Preuve** (sondes) :
  - caché 20 min puis revenu : relu tout de suite ;
  - caché 45 min puis revenu : aucune relecture ;
  - au premier geste ensuite : relu.
- **Pourquoi le test ne le voit pas** : `client.test.ts:112-113` appelle `c.interaction()` **avant** `c.wake()`, ce qui simule un geste.

**Correction proposée.**
- Dans `online()`, ne relire que si `d.visible()` et si le visiteur est actif depuis moins de 30 min. Sinon, laisser `wake()` ou `interaction()` relire plus tard.
- Au passage de l'onglet à « visible », compter le retour comme une présence (`lastInputAt = now()`), puis appeler `schedule()`.
- Ajouter les deux tests ci-dessus, sans `interaction()` avant `wake()`.

#### I2. `treeshake.manualPureFunctions: ['z']` : piège silencieux pour tout le bundle de la carte
- **Où** : `frontend/carte/vite.config.ts:92`.
- **Ce que fait l'option** : elle déclare « pur » tout appel à un identifiant nommé `z`, y compris `z.methode()`, dans **tout** le code de la carte. Si le résultat n'est pas utilisé, l'appel est supprimé, et seulement au build de production (le serveur de dev ne fait pas d'élagage).
- **Preuve** (build Vite et rolldown jetable, même version) :
  - code : `const z = { n: 0, inc() { this.n++; return this; } }; z.inc();` ;
  - avec l'option, `z.inc();` disparaît du fichier construit et `z.n` vaut **0** ;
  - sans l'option, l'appel est gardé et `z.n` vaut 1.
- **Aujourd'hui** : aucun cas. Ni la carte, ni le contrat, ni le cœur de three.js, ni les quatre addons importés ne contiennent d'appel `z.xxx()` à effet de bord. `terrain.ts:35` appelle une fonction locale `z(i, j)` dont les résultats servent. Avec et sans l'option, le chunk three.js a la même empreinte : l'option ne retire que des schémas (−0,67 Ko gzip sur le chunk principal, 87,58 contre 88,25 Ko).
- **Pourquoi c'est important** : dans du code 3D, une variable `z` (axe, vecteur) sur laquelle on appelle `z.normalize();` ou `z.set(…);` est naturelle. Ce bug n'apparaîtrait qu'en production.
- **Correction proposée** (deux voies, la seconde à mesurer) :
  1. Garde-fou peu coûteux : interdire tout identifiant `z` dans `frontend/carte/src` (règle de `check-boundaries.mjs`), avec un commentaire sur l'option dans `vite.config.ts`.
  2. Retirer l'option et annoter les schémas du contrat (`/* @__PURE__ */ z.object(…)`), en vérifiant le poids : une annotation ne couvre pas les appels passés en arguments.

### Mineur

#### M1. Le vent prolonge le fondu de 22 s sans rien changer à l'image
- **Où** : `weather/index.ts:161-165` (`ctx.sky(skyModifier)` à chaque image tant que `blendLook` bouge) et `state.ts:242-253` (le vent a une constante de temps de 6 s).
- **Mesuré** (3 pages, vraie route) : le ciel converge en **19 s**, le fondu complet en **41 s**. Pendant 22 s, `dayNight.apply()` complet tourne à chaque image (position du soleil, lumières, chaîne CSS du fond) alors que le vent ne sert à rien avant US009.
- **Autre conséquence** : `?weather=clear` lance environ 38 s de fondu invisible. Le vent par défaut (10 km/h d'ouest) diffère de celui de `life.json` (vers 30°, 0,7 m/s), et la couverture de 5 % est sous la zone morte.
- **Correction** : n'appeler `ctx.sky` que si une clé du ciel (`cloud`, `rain`, `snow`, `fog`, `storm`) a bougé, ou ne pas fondre le vent tant qu'aucun effet ne le lit.

#### M2. La puce ne dit pas « modèle ICON, 10 h 00 » et ne distingue pas un ancien relevé
- **Où** : `state.ts:197-200`.
- **Constat** :
  - en direct, la puce affiche « 13 °C », avec le libellé et l'info-bulle « Météo : Pluie, 13 °C, direct ». Or la règle 1 et US004 demandent que la puce dise « modèle ICON, 10 h 00 (il y a 6 min) » ; le mot « direct » seul peut se lire comme une observation ;
  - l'icône et le texte sont **identiques** en direct et pour un ancien relevé : seule l'info-bulle change (sonde).
- **Correction** : libellé « Météo : Pluie, 13 °C · modèle ICON, 10 h 00 (il y a 6 min) » ; pour un ancien relevé, la classe `off` (icône grisée) ou une marque.

#### M3. Crédits : pas de lien sur l'écran d'accueil, texte écrit en dur
- **Où** : `main.ts:605` et `ui.ts:131`.
- **Constat** :
  - l'accueil reçoit « Météo : Open-Meteo.com, modèle ICON du DWD (CC BY 4.0) » en `textContent` (sûr), mais sans lien, alors qu'US004 demande le crédit « avec lien et CC BY 4.0 en bas à droite… et dans l'écran d'accueil » ;
  - le pied de page et l'accueil écrivent la source en dur, au lieu de reprendre `attribution` de la réponse (seul le panneau l'utilise). Un changement de source ou de modèle côté back laisserait un crédit faux.
- **Correction** : reprendre `attribution` (texte, `url`, `licenceUrl`) dans le pied de page et dans l'accueil, avec des liens.

#### M4. Accessibilité du panneau
- **Preuve** (Chrome, clavier) :
  - Entrée sur la puce ouvre le panneau, mais le focus **reste sur la puce** ;
  - il faut **5 appuis** sur Tab pour atteindre le panneau, ajouté à la fin de `#app` (`panel.ts:50`) ;
  - après Échap depuis le panneau, le focus tombe sur `body` (`panel.ts:60-67`) ;
  - pas d'`aria-controls` sur la puce.
- **Ce qui est bien** : `aria-expanded`, `aria-label` complet, ✕ « Fermer », Échap, interrupteurs natifs, « Effets réduits » cochée et grisée quand le système demande moins d'animations.
- **Correction** : `aria-controls` sur la puce ; à l'ouverture, focus sur le titre (`tabindex="-1"`) ou sur ✕ ; à la fermeture, focus rendu à la puce ; ou bien insérer le panneau juste après la barre d'heure.

#### M5. Panneau : contenu figé, et panneau ouvert sous une puce masquée
- **Où** : `index.ts:102-119` et `:133-139`.
- **Contenu figé** : le panneau n'est réécrit qu'au prochain `update()` (relecture de 15 min, minuteur d'âge à 1 h et 3 h). « il y a 6 min » peut donc rester affiché plus de 10 min.
- **Puce masquée** : réactiver la météo depuis le panneau (ou toucher la puce « Sans météo » avec le module déjà chargé) passe l'état à `waiting`. La puce disparaît jusqu'à 8 s, et le panneau reste ouvert sur « Météo non disponible ».
- **Correction** : rafraîchir le texte d'âge à la minute quand le panneau est ouvert ; pendant `waiting` après une réactivation, garder la puce (« … ») plutôt que `null`.

#### M6. « Coupée » contre « Météo désactivée »
- **Où** : `state.ts:202` et `:226`.
- **Constat** : US004 écrit « Given 503 `meteo-desactivee`, Then … « Météo désactivée » ». Le code dit « Coupée » et « Météo coupée », et réserve « Météo désactivée » à la préférence du visiteur.
- **À trancher** : le choix du code évite la confusion entre la coupure par l'admin et le choix du visiteur. Il faut alors corriger la spec.

#### M7. Délai écoulé pendant la lecture du corps : classé « hors-contrat »
- **Où** : `client.ts:35`.
- **Constat** : `res.json().catch(() => null)` avale l'`AbortError`.
- **Preuve** : serveur local qui envoie les en-têtes puis s'arrête → `{ ok: false, reason: 'hors-contrat', ms: 405 }`, avec un délai de 400 ms.
- **Effet** : aucun sur les relances (même rythme), mais la raison est fausse pour le compteur et pour plus tard.

#### M8. Horloge du visiteur
- **Où** : `state.ts:85`.
- **Constat** :
  - une horloge en avance de plus de 3 h fait refuser **tous** les relevés : `hors-contrat`, relances jusqu'à 15 min, « Indisponible » en permanence pour ce visiteur (sonde) ;
  - une horloge en retard est bien gérée (« à l'instant »).
- **Piste** : calculer l'âge avec l'heure du serveur (`fetchedAt` et le temps écoulé depuis la réception, ou l'en-tête `Date`). Risque R10 accepté par le plan ; à décider.

#### M9. Tests
- `weather/index.ts` (câblage) n'est pas testé :
  - minuteur qui vieillit le relevé (1 h, 3 h) ;
  - relevé gardé et marqué ancien après un échec (`index.ts:129`) ;
  - crédit montré seulement avec les données de la source ;
  - `setEnabled` qui arrête ou relance le client ;
  - réaction à `prefers-reduced-motion`.

  Le projet `admin` utilise déjà `happy-dom` : un test de ce module avec un faux `ctx` est possible.
- `client.test.ts:112-113` masque I1 (b), et rien ne teste `online()` onglet caché.
- `client.test.ts:41-48` : `vi.useRealTimers()` n'est rappelé qu'en fin de test ; si une assertion échoue avant, les tests suivants gardent les fausses minuteries. Mettre un `afterEach`.
- Pas de fragilité trouvée par ailleurs : horloges fixées, minuteries simulées. Les 61 tests des projets `carte` et `contrat` passent.

#### M10. README à `48ffd36` : phrases périmées après US004
Attendu, puisque le commit de clôture d'US004 est à venir, mais à ne pas oublier :
- ligne 139 : « la pluie, le brouillard et la météo réelle arrivent avec les US suivantes » ;
- ligne 538 : « La carte ne l'affiche pas encore (EP009-US004) » ;
- ligne 635 : « Le crédit sera affiché dans la carte… (EP009-US004) ».

---

## Les deux observations du coordinateur

### Pire image pendant le fondu vers la vraie météo (23 à 81 ms) : bruit de la machine, pas le fondu

**Conditions de mesure** : build de `48ffd36`, vraie route, 1280×800, densité 1. Fenêtres de 12 s, au repos (cadence limitée à 30 img/s, soit 33 ms par image normale). Charge de la machine entre 5 et 22 sur 8 cœurs pendant les mesures.

| Condition (au repos) | Pire image par passage |
|---|---|
| Démarrage **avec** météo (fondu en cours) | 34, 34, 35, 42 ms |
| Démarrage **sans** météo (module ni chargé ni exécuté) | 34, 35, 36, 43 ms |
| Scène posée, puis `weather.set({ condition: 'rain' })` | 36, 45, 46, **350** ms |
| Scène posée, rien ne change (témoin) | 34, 35, 36, 36 ms |
| 3 pages × 6 changements (pluie, beau temps, couvert, relâché), dont la moitié **sans réécriture du fond CSS** (accesseur masqué) | 34 à 45 ms, avec ou sans fond CSS ; une seule longue image de 50 ms (voir plus bas) |
| Caméra en mouvement (60 img/s), 2 pages × 4 changements | 19 à 44 ms ; une fois 102 ms, à une charge de 22,5, dans une fenêtre **sans** fond CSS |

- **Le fondu n'ajoute rien de mesurable** au démarrage (même pire image avec et sans module). Réécrire le fond CSS à chaque image ne change rien sur le Mac.
- **Les grandes valeurs (350 ms, 102 ms) tombent sur des pics de charge** de la machine. Elles ne se reproduisent pas, apparaissent aussi sans fond CSS, et aucun programme n'est compilé au changement de météo (`renderer.info.programs` avant et après chaque changement).
- **Image de 30 à 50 ms d'origine connue** : environ 1 min après le démarrage, la première mise à jour des ombres compile **4 programmes de profondeur** (`depth…`). Ils apparaissent aussi dans une fenêtre témoin de 40 s sans aucun changement de météo (sonde `programmes.mjs`, 2 pages). C'est antérieur à EP009 et sans lien avec la météo ; les compiler au démarrage (`renderer.compile`, ou un rendu des ombres une fois tout posé) l'effacerait.
- **La fenêtre de `fondu-reel.mjs` est piégée** : elle mesure de 1,5 à 13,5 s après le démarrage, donc pendant les chargements tardifs. Pour juger la règle « aucune image de plus de 50 ms quand la météo change », mieux vaut un changement sur une scène posée, comparé à un témoin.
- **Conclusion** : pas de défaut. Les 23 à 81 ms viennent de la charge de la machine et du démarrage. Le coût du repeint du fond CSS sur un téléphone reste **non mesuré** : si US001 montre des à-coups sur l'iPhone, limiter la réécriture du fond à 4 fois par seconde pendant un fondu.

### Image de 69 à 112 ms à l'ouverture du panneau : le premier panneau ouvert, quel qu'il soit

**Mesures** (Event Timing et `long-animation-frame`, 3 pages par ordre) :

| Ordre | Première ouverture | Ouvertures suivantes |
|---|---|---|
| Météo d'abord | météo : longue image de 80 à 110 ms (dont 65 à 77 ms de rendu ; gestionnaire de 4 à 20 ms, dont 12 ms de mise en page forcée par `place()`), pire image de 85 à 107 ms (charge 8 à 16) | météo : 34 ms, aucune longue image ; journal ensuite : aucune |
| Journal d'abord | journal : longue image de 60 à 66 ms (44 à 49 ms de rendu), pire image de 71 à 75 ms (charge 3 à 5) | météo ensuite : 34 ms, **aucune** longue image |

- **Le coût est payé une fois, par le premier panneau ouvert** : le journal le paie aussi. Il se passe dans la phase de rendu du navigateur (style, mise en page, peinture), pas dans notre code (polices déjà chargées : `document.fonts.status = loaded`). La cause exacte n'est pas isolée ; c'est commun aux panneaux et antérieur à EP009.
- **Ne mérite pas de correction dans US004** : environ 140 à 170 ms entre le clic et l'affichage une seule fois, sous le seuil « bon » de l'INP (200 ms).
- Si on veut l'effacer : rendre une fois, hors écran, un panneau de ce type au démarrage, après la scène.

## Mise en page mobile (`--foot`, `--lift`) : correcte
- **Sans `?debug`, de 320 à 720 px** : la puce est touchable partout (l'élément sous son centre et ses bords est bien la puce), au-dessus de « ? ».
- **À 375 px** : `--foot` 42 px, barre d'outils remontée de 24 px, aucun chevauchement avec le pied de page, crédit météo visible.
- **US004 corrige un défaut antérieur** : avant EP009, le pied de page recouvrait la barre d'heure à 320 px (capture du build `65df83e`).
- **Avec `?debug` à 375 px**, la ligne « 📍 Position » remonte la barre d'heure sous le bouton « ? », qui couvre la puce. Ça gêne seulement les scripts de mesure : cliquer par `dispatchEvent`, ou avec `?debug&lobby=0` en 390 px et plus.
- **Défaut antérieur, non lié à la météo** : à 320 px, « ? » recouvre la fin de la légende (« Restaurants »), déjà le cas avant EP009.

---

## Ce qui est bon
Le code est clair et bien découpé. Logique pure testée (`resolveWeather`, `chipOf`, `panelOf`, fondu sans dépassement, relances) ; module chargé à la demande et jamais attendu ; aucune exception vers `main()` ; DOM construit avec `textContent` ; liens du crédit en `https://` seulement ; préférences dans un `try` avec des valeurs contrôlées ; `?weather=` sans réseau ; Pi (404) sans relance.

Règle 9 tenue : brouillard et `fog: false` posés au démarrage, aucune compilation au changement de météo, aucun travail par image une fois la météo stable. Le chunk principal prend +2,12 Ko gzip depuis le début d'EP009 (85,46 → 87,58 Ko), dans le budget de 2,5 Ko.

## Vérifié / non vérifié

**Vérifié** (copie de `48ffd36`, Node 25.2.1, Chrome for Testing avec Metal)
- Lecture du diff complet de la carte, du plan (§ 0, 1, 3.1-3.2, 4.1-4.2) et de la spec (epic, US001, US002, US004) ; points vérifiés : priorités, fondu, minuteries, onglet caché, inactivité, fin d'un forçage, âge des relevés, état après une coupure.
- `tsc` de la carte, `check-boundaries`, Vitest `carte` et `contrat` : 61 tests sur 61. Build de la carte, et build sans `manualPureFunctions` pour comparaison.
- Sondes Vitest (8) : `online()` onglet caché ou visiteur inactif ; retour après 20 et 45 min ; délai réel avec un serveur local ; horloge du visiteur décalée ; puce en direct ou ancien relevé.
- Preuve rolldown de l'élagage d'un appel `z.inc()`.
- Mesures A/B du fondu (au repos et en mouvement, avec ou sans module, avec ou sans fond CSS), programmes compilés avec leur fenêtre témoin, ouverture des panneaux dans les deux ordres, mise en page de 320 à 1280 px avec et sans `?debug`, comparaison avec le build `65df83e`, parcours au clavier du panneau.
- Taille des chunks : principal 87,58 Ko gzip, contre 85,46 avant EP009.

**Non vérifié**
- Tout téléphone réel : coût du repeint du fond pendant le fondu, ouverture du premier panneau, puce sur iPhone.
- Safari et Firefox, dont `:has()` et le rendu des emoji de la puce.
- La prévisualisation (`preview/EP009-meteo`, `c6524c5`) : je ne m'en suis pas servi. Le secret n'a été ni chargé ni utilisé.
- Le service worker (bloqué pendant les essais) et le build du Pi : le cas 404 est vérifié seulement par les tests.
- Toutes les mesures ont été faites alors que la machine était chargée (charge de 3 à 26 sur 8 cœurs, travail parallèle du coordinateur), chaque fois comparées à un témoin.
- La cause exacte du coût de la première ouverture d'un panneau (dans le rendu du navigateur, commune au journal).
