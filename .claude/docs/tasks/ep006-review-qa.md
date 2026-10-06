# EP006 parkings : revue QA avant fusion dans `main`

Date : 06/10/2026. Branche testée : `feat/EP006-parkings` (HEAD 0f023f8), aucun fichier du dépôt modifié.
Méthode : Chrome for Testing avec GPU (Metal, rendu réel), serveur Vite port 5211, scripts Playwright dans le scratchpad. Pour comparer, une copie de `main` (git archive, hors dépôt) a tourné sur le port 5212. `npx tsc --noEmit` : 0 erreur.

Légende : **[R]** reproduit dans le navigateur · **[C]** vu dans le code seulement · **[NT]** non testé.

---

## 1. Plan de test (matrice priorisée)

Priorité 1 = bloquant de fusion, 2 = important, 3 = confort.

| Fonction | Desktop jour | Desktop nuit 23 h | Hiver | Mobile 390 tactile | Couche éteinte | Couche allumée | Balade | Fiche ouverte / Échap |
|---|---|---|---|---|---|---|---|---|
| Survol et clic bars, cafés, restaurants (P1) | R | NT | NT | NT | R (régression, bug 74 corrigé) | R | NT | R |
| Gemmes ✦ (P1) | R | NT | NT | NT | R | R (vol de clic, voir A6) | NT | R |
| Clic dans le vide ferme la fiche (P1) | R | NT | NT | NT | R | R | NT | R |
| Échap ferme la fiche parking (P1) | R | NT | NT | NT | n/a | R | NT | R |
| Couche éteinte avec fiche parking ouverte (P1) | R | NT | NT | NT | R (fiche fermée) | R | NT | R |
| Couche éteinte avec fiche bar ouverte | R (la fiche reste, voulu) | NT | NT | NT | R | R | NT | R |
| Fiche parking puis clic bar / gemme (superposition) (P1) | R (une seule fiche à la fois) | NT | NT | NT | n/a | R | NT | R |
| Clic sol en balade, couche allumée (P1) | n/a | n/a | n/a | NT | n/a | R | R | n/a |
| Clic panneau en balade (P2) | n/a | n/a | n/a | NT | n/a | R (ouvre la fiche, pas de marche) | R | R |
| Effacement des bâtiments en balade et panneaux sur toit (P2) | NT | NT | NT | NT | n/a | NT | C | n/a |
| Zones de clic des panneaux vs gemmes / épingles (P1) | R | NT | NT | NT | n/a | R | NT | n/a |
| Rendu des aplats et légende (P1) | R | R | R | R | n/a | R | R | n/a |
| Panneaux : position, visibilité (P1) | R | R | NT | NT | n/a | R | NT | n/a |
| Performance (appels, img/s, mémoire) (P1) | R | NT | NT | R (1 passe) | R | R | NT | n/a |
| Robustesse `parkings.json` et `city.json` (P2) | R | n/a | n/a | n/a | n/a | R | n/a | n/a |
| Accessibilité clavier, `aria-pressed`, contraste (P2) | R | n/a | n/a | NT | n/a | R | n/a | n/a |
| Textes et exactitude des chiffres (P2) | R | n/a | n/a | R | n/a | R | n/a | R |
| Mini-jeu éléphants avec la couche allumée (P2) | NT | NT | NT | NT | NT | NT | NT | NT |
| Lobby, chargement, noms de rues, journal (P3) | R (chargement sans erreur) | NT | NT | R (chargement) | R | NT | NT | NT |

Cas limites métier : parking à capacité inconnue [R], capacité estimée [R], tarif inconnu [R], parking de nuit (aucun horaire dans les données et aucune fiche n'en parle) [C].

---

## 2. Résultats mesurés

### 2.1 Performance (Mac, GPU réel, 1280×800 ; appels de rendu du compteur `?debug`)

Mesure fiable : basculer la couche 4 fois de suite sur la même vue immobile et lire le compteur.

| Vue | Couche éteinte | Couche allumée | Écart | Budget epic |
|---|---|---|---|---|
| Vue d'ensemble | 2406 | 2407 | +1 | +1 |
| Carré Curial | 60 | 61 | +1 | +3 à +4 |
| Château | 615 | 616 | +1 | +3 à +4 |
| Rue de Boigne | 66-67 | 67-68 | +0 à +2 | +3 à +4 |

- Couche éteinte : identique à `main` sur la vue d'ensemble (2406 appels, 1,58 M triangles, 60 img/s en mouvement, 30 au repos). **[R] +0 appel tenu.** Triangles : +0,01 à +0,02 M allumée (budget 0,05 M).
- Images/s en mouvement : 60 partout, couche éteinte comme allumée. Ce n'est pas représentatif d'un iPhone 12 Pro (budget : au plus −3 img/s) : **[NT]**.
- Premier allumage : un à-coup de **94 ms** sur Mac (autres images 25 ms) : c'est la peinture de la texture du sol (annoncée dans le CHANGELOG). Sur iPhone il faut s'attendre à ×3 à ×5 : **[NT]**. Deuxième allumage : aucun à-coup (écart max 27 ms).
- Mémoire : tas JS 36,6 → 38,4 Mo allumé, 38,7 Mo après 11 bascules : pas de fuite visible ; 1 texture de plus ; nombre de géométries et de matériaux inchangé.
- Piège de lecture : les appels varient beaucoup selon la vue sans rapport avec la couche (2406 en vue d'ensemble, 60 au Carré Curial) : c'est déjà le cas sur `main`. Une première mesure mal stabilisée m'a donné +18 au Curial (bruit de tuiles et d'étiquettes pendant l'orbite) : ne pas comparer deux vues prises à des moments différents.
- Mobile 390 (densité 1,5) : 61 appels, 58 img/s en mouvement sur vue rapprochée (émulation Chrome, pas un iPhone).

### 2.2 Console
Aucune erreur ni avertissement dans toutes les sessions normales (bureau, mobile, nuit, hiver, balade). Seules les entrées volontairement invalides en provoquent (voir R1, R2).

---

## 3. Anomalies

Résumé : 0 bloquant, 5 importants, 9 mineurs.

### Importants

**A1. Panneau invisible mais cliquable : Parking Ravet (400 places, documenté) et au moins deux autres silos [R]**
- Reproduction : `?debug&lobby=0`, bouton « 🅿️ Parkings », caméra sur (355,238) à 260 m, aucun panneau visible sur le silo. Cliquer au centre du bâtiment (écran 640×344 dans ma vue) : la fiche « Parking Ravet · Parking en silo · 400 places » s'ouvre.
- Cause : pour les silos (`multi-storey`), le panneau est posé au sol à l'intérieur du contour, donc dans le bâtiment OSM du silo (25,6 m pour Ravet). Le cube (sommet à environ 14 m) est enterré dans la façade. La zone de clic (cylindre) reste active et traverse les bâtiments (le tirage de rayon ne tient pas compte des occlusions).
- Mesure d'occlusion (8 azimuts à 150 m, 2 points par panneau) : Ravet 0 % visible, `way/943464704` (silo sans nom, 440 places) 0 %, `way/965969150` (coin sud-ouest, bâtiment de 26,6 m) 0 %, `way/1419987130` 13 %, `way/1490571672` 25 %, La Falaise 50 % (cube qui sort à demi du toit, visible sur capture), Cassine Gare 63 %.
- Attendu : un panneau visible pour chaque parking documenté (silo : sur le toit, comme pour les souterrains).
- Gravité : important (le parking le plus renseigné de la ville n'a pas de panneau visible et sa fiche n'est atteignable qu'en cliquant dans le vide d'une façade).
- Capture : `scratchpad/ravet3.png`, `scratchpad/b-falaise.png`.

**A2. `parkings.json` : un `added` sans `pos` fait planter tout le site [R]**
- Reproduction : intercepter `src/content/parkings.json` avec `"added":[{"id":"added/1","kind":"surface","name":"Sans pos"}]` (c'est ce que produirait une faute de frappe de Dasco). Charger la page.
- Obtenu : `PAGEERROR: Cannot read properties of undefined (reading '0')` pendant la construction de la scène ; `window.diorama` n'existe jamais, la page reste sur le chargement. Sur Vercel, ce serait tout le site hors service après un déploiement.
- Attendu : ignorer l'entrée invalide (et un `console.warn`), le reste doit s'afficher.
- Gravité : important (fichier édité à la main, aucun garde-fou, impact total).
- Les autres retouches invalides sont tolérées : `overrides` sur un identifiant inconnu (sans effet, ok) ; `overrides` / `added` à `null` (ok) ; `pos: "abc"` (ok).

**A3. La ligne de source de la fiche dit toujours « OpenStreetMap » même pour une valeur retouchée ou ajoutée [R]**
- Reproduction : `overrides` `{"way/37376434":{"fee":false,"capacity":999}}` puis clic sur le Parking de l'Europe. Fiche : « Gratuit · 999 places · Source : OpenStreetMap, relevé du 28 septembre 2026. À vérifier sur place. ». Idem pour un `added` (fiche « Source : OpenStreetMap » sur un parking absent d'OSM).
- Attendu : règle 1 de l'epic (chaque chiffre porte sa vraie source). La mention doit dire « retouché » ou ne citer que la `note`. Aujourd'hui `sourceNote` est un texte fixe ([C] `src/ui/parking-card.ts`).
- Gravité : important dès qu'une première retouche est utilisée (aujourd'hui `overrides` et `added` sont vides : le défaut est latent).

**A4. `note` d'une retouche injectée en HTML brut dans la fiche [R]**
- Reproduction : `overrides` `{"way/37376434":{"note":"<img src=x onerror=window.__xss=1> <b>gras</b> & co"}}`, clic sur le panneau : `window.__xss === 1` (le script s'est exécuté) ; le `<b>` s'affiche en gras. `name` est correctement échappé (`&lt;i&gt;Nom&lt;/i&gt;`).
- Cause [C] : `ui.ts` insère `c.lines` sans `esc()` ; la ligne `📝 ${p.note}` n'est pas échappée (les autres lignes contiennent du HTML volontaire : `<small>`).
- Impact réel : limité (le fichier est édité par Dasco), mais un `&` ou un `<` dans une source citée casse l'affichage, et c'est un trou si le fichier est un jour alimenté autrement.
- Gravité : important (sécurité faible, robustesse réelle). Correction attendue : échapper `note`.

**A5. Contraste insuffisant (accessibilité) [R, calculé]**
- Pastille de tarif de la fiche : texte blanc sur orange `#ff8a3d` = **2,35:1** ; sur menthe `#3ec9a7` = **2,08:1** (WCAG AA texte : 4,5:1). L'ombre de texte aide un peu. Étiquette de catégorie (`.pc-cat`, 11 px, couleur du tarif sur crème) : même problème.
- Distinction des aplats : `Tarif inconnu` `#b9aed6` et `Le long de la rue` `#cdc2e8` : contraste 1,24:1 entre eux, quasi indiscernables (la plainte de Dasco à l'itération 73 portait déjà sur « on ne voit pas la différence »). Orange et menthe ne se distinguent que par la teinte (daltonisme rouge-vert).
- Gravité : important pour l'accessibilité, mineur pour la fusion.

### Mineurs

**A6. Zones de clic des gemmes qui volent les clics des panneaux, et panneaux qui se volent entre eux [R]**
- Les gemmes ✦ (cylindre de 14 m de rayon, 56 m de haut) l'emportent sur les panneaux proches. Exemple : panneau du parking à côté du Château (`way/1489707148`) : sur 4 vues de test sur 8, le centre du panneau ouvre la fiche d'histoire du Château. Autre cas : un parking ajouté à (100,100), sous la gemme de la rue de Boigne : le clic ouvre « Rue de Boigne et ses portiques » (capture `rb-added_valide.png`).
- Côté épingles de bars : sur 627 centres d'épingles et de gemmes échantillonnés, seuls 2 sont volés par un panneau (tous deux par « Q-Park Les Halles », zone dense). **Pas de régression sur les bars, cafés et lieux d'histoire dans l'ensemble.**
- Panneaux voisins qui se masquent mutuellement : `way/943464704` / `way/944405106` (Cassine Gare), `way/1489706446` / `way/1489706447`. Environ 3 % des essais (16 sur 464).
- Gravité : mineur.

**A7. En balade, le sol sous et autour d'un panneau ne fait pas marcher [R]**
- Reproduction : balade, couche allumée, avatar à 18 m du panneau du Parking de l'Europe, cliquer le sol à 4 m du pied du panneau (écran 1120,658 puis 961,604) : la fiche s'ouvre, pas de marche. À 8 m : tantôt fiche, tantôt marche ; à 12 m et plus : marche.
- Cause : cylindre de clic de 8 m de rayon × 22 m de haut (échelle 1,6), dont la projection écran couvre plus que le pied. Cohérent avec la priorité voulue (panneau avant sol), mais gênant sous un panneau dans un grand parking.
- Gravité : mineur. Cliquer un panneau en balade ouvre la fiche sans faire marcher l'avatar (différent des ✦ où l'avatar marche puis ouvre) : à décider.

**A8. Capture de clic derrière les bâtiments (déjà vrai pour pins et gemmes, aggravé par les panneaux) [R]**
- Tooltip « 🅿️ … » et clic fonctionnent sur un panneau caché derrière un immeuble (voir A1). Même mécanisme que les épingles.

**A9. Orange « payant » proche de l'orange des épingles « Restaurants » [R, visuel]**
- Même teinte orangée pour les pastilles restaurants (`#e8591a` environ) et l'aplat/panneau « Payant » (`#ff8a3d`) : de nuit, les lueurs orange des deux se confondent (`winter-night-mid.png`, `night-mid.png`). Mineur.

**A10. Mobile 390 : la légende des parkings chevauche le haut du bouton « Journal » [R]**
- Reproduction : viewport 390×780 tactile, toucher « 🅿️ Parkings ». Légende en [16,535,166,630], rangée de boutons du haut en y 616-659 : chevauchement de 14 px sur « Journal » (visible sur `m-on-toast.png` et `m-card-way_21911243.png`). Le bouton reste cliquable à la majorité de sa surface.
- Même viewport : le message de 2 lignes « 58 parkings repérés, dont 13 qui avouent leur nombre de places » recouvre la rangée Bars / Cafés / Restaurants et la barre d'heure pendant quelques secondes (toast qui s'affiche à y 663 à 740 ; il reste cohérent avec l'ancien comportement mais couvre plus). Il ne déborde pas horizontalement (16 à 374 px). Pas de défilement horizontal de la page (largeur document 390).
- La fiche reste dans l'écran (x 59 à 330, y 52 à 250) pour 4 parkings testés. Le titre le plus long (« Espace Amélie Zenzen - Parking du Laurier ») passe sur deux lignes sans déborder.
- Gravité : mineur.

**A11. Parkings de souterrain sans bâtiment au-dessus : panneau posé au sol sur une entrée [R/C]**
- Parking du Château (`way/1489707144`, 604 places, le plus grand) : aucune entrée ni le centre ne tombent dans un bâtiment OSM ; le panneau est donc au sol à l'entrée (-388,-109,5), pas sur un toit (le CHANGELOG 74 indique n'avoir vérifié que l'Hôtel de ville). Rien de faux (position vient d'OSM) mais comportement différent de la règle « panneau sur le toit ».
- Autre : `way/1273312256` (souterrain sans nom) à 10 m du bord de la maquette (x = -651,7 pour une borne à -662,4) ; 8 autres panneaux de surface à moins de 12 m du bord (voir coordonnées dans le script) : le cube de 6 m peut déborder du socle. Non vérifié visuellement.
- Gravité : mineur.

**A12. Retouche `pos` mal comprise [R]**
- `overrides.pos` ([0,0]) déplace seulement un peu le panneau (y de 9,3 à 8,9) : `insidePoint()` le ramène au point intérieur le plus proche du contour. Pour un souterrain, `pos` est ignoré s'il y a des entrées. La doc de `parkings.json` dit « Nouvelle position (m) du panneau ». Attendu : respecter la valeur ou documenter la contrainte. Mineur.
- `capacity: 0` est traité comme « inconnu » et l'estimation `est` n'est pas retirée : cohérent, mais non documenté.
- JSON vide `{}` (sans `kinds`, `capacity`…) : la page se charge, la couche s'allume, mais le clic sur un panneau lève `Cannot read properties of undefined (reading 'estimated')` et aucune fiche ne s'ouvre [R]. Mineur.

**A13. Textes et exactitude [R]**
- Les chiffres de la fiche n'ont pas d'étiquette individuelle : « 🚗 154 places » sans « OSM » ; seule la ligne finale « Source : OpenStreetMap, relevé du 28 septembre 2026 » les couvre. La règle de l'epic (« chaque chiffre porte son étiquette ») est tenue au niveau de la fiche, pas du chiffre. Seule l'estimation porte « (estimé d'après la surface) ». Tarif « Payant » : aucune date ni source propre.
- Le champ `access` n'est jamais affiché alors que 2 panneaux concernent des parkings « clients » et « abonnés » (sans nom) et 1 un parking d'accès inconnu nommé « Courte durée » (titre ambigu hors contexte, ressemble à un nom de zone de gare). Une fiche « Parking sans nom · Payant » pour un parking réservé aux abonnés peut induire en erreur.
- 40 panneaux sur 58 sont « Parking sans nom » (30 avec « tarif inconnu », 40 sans nom). Le ton « celui-là garde son secret » est répété sur la majorité des fiches.
- Parking des Ducs (112 places abonnés selon la BNLS) n'est plus affiché (déjà noté au CHANGELOG 73). Données OSM Ravet 400 contre 474 officielles : non signalé dans la fiche (attendu pour la prochaine US, fiches officielles).
- Message du bouton : « repérés, dont 13 qui avouent » : le « 58 » compte aussi 40 parkings sans nom, ce qui est exact.
- Accessibilité : `<div class="parking-legend" aria-label=…>` sans `role` : l'étiquette est ignorée par les lecteurs d'écran ; le bouton a `title` mais pas d'`aria-label` (son texte suffit, `aria-pressed` correct). Focus clavier : Tab atteint le bouton, anneau par défaut du navigateur (outline auto 1 px), Entrée allume la couche, `aria-pressed="true"`, légende affichée, focus conservé [R].

### Vérifié sans anomalie
- Survol d'un bar (« La Taverne De Midgard »), clic bar avec couche allumée, fiche qui reste épinglée ; clic gemme avec fiche parking ouverte : la fiche parking se ferme et la fiche d'histoire s'ouvre (jamais deux fiches) ; Échap ferme la fiche parking (et les autres) ; clic dans le vide ferme ; couche éteinte avec fiche parking ouverte : la fiche se ferme ; avec fiche bar ouverte : elle reste ; rallumer ne rouvre rien.
- Couche éteinte : un clic à l'emplacement d'un panneau n'ouvre rien (les zones de clic sont bien retirées).
- Balade : entrée, clic sol (avatar marche), légende des parkings visible et sans chevauchement sur desktop, boutons ok.
- Données absentes ou vides : `city.json` sans clé `parkings` ou avec `parkings: []` : bouton masqué, aucune erreur. `overrides` sur identifiant inconnu : sans effet. `hide` : panneau et fiche retirés. `kind: street` : panneau retiré.
- Données : 151 parkings (48 surface, 93 voirie, 5 silos, 5 souterrains), 58 avec panneau, aucun doublon de centre dans un autre polygone hors voirie, un seul parking sans contour (Q-Park Les Halles, nœud, souterrain) géré. Pas d'estimation sur un souterrain. Aucun parking avec à la fois capacité et estimation. `tsc --noEmit` passe.

---

## 4. Non testé (ou limité)
- iPhone réel : gestes, fluidité, coût du premier allumage et du `discard`, budget −3 img/s.
- Balade sur mobile tactile ; double toucher près d'un panneau ; deux doigts.
- Effacement des bâtiments en balade : le panneau posé sur le toit d'un souterrain (Hôtel de ville, Palais de Justice) ou d'un silo flotterait si le bâtiment s'efface [C] (le CHANGELOG 73 l'annonce). Ma tentative de reproduction (caméra forcée) n'était pas concluante : **[NT]**.
- Mini-jeu des éléphants avec la couche allumée (clic sur un éléphant à travers un panneau), noms de rues, journal : non rejoués.
- Nuit en balade ; nuit en gros plan sur les panneaux (la lueur est visible en vue moyenne, jugée lisible ; orange confondu avec les restaurants, voir A9) ; hiver en gros plan.
- Lueur de nuit : intensité exacte non mesurée ; panneau « P » de nuit vu à un seul endroit (Château).
- Parkings « de nuit » (horaires) : les données n'en contiennent aucun.
- Pas de `npm run build` (il écrirait `dist/` dans le dépôt) ; typage vérifié par `tsc --noEmit` uniquement.

## 5. Notes de méthode
- La copie de `main` a utilisé un lien symbolique vers `node_modules` du dépôt : Vite peut avoir écrit dans `node_modules/.vite` (ignoré par git, `git status` ne montre que le rapport de code `ep006-review-code.md` d'un autre agent).
- Scripts et captures : `/private/tmp/claude-501/-Users-claudepetit-Documents-development-carte-chamb-ry/8781d90c-a23d-484e-bb05-175402382769/scratchpad/`.
- Serveurs arrêtés à la fin (`pkill`).

## 6. Recommandation
**GO conditionnel** : aucun défaut bloquant, la couche éteinte n'a aucun coût mesuré, et le budget de rendu est tenu. Avant fusion dans `main` (= production), corriger au minimum A2 (garde-fou sur `added`) et A1 (panneaux de silos visibles, au moins Ravet) ; A3, A4 et A5 peuvent suivre dans la foulée. Faire le relevé iPhone via Vercel (premier allumage) comme prévu par l'epic.
