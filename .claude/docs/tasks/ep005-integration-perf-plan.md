# EP005 « Balade avec un avatar » : intégration, performance, qualité (plan)

Plan de recherche, écrit par un sub-agent chercheur. Rien n'a été implémenté. Lecture du code et des documents seulement : aucune mesure nouvelle n'a été faite. Les études sur l'effacement des bâtiments et sur l'avatar / le chemin / la caméra sont faites ailleurs et ne sont pas refaites ici.

## Résumé

1. Le mode balade tient dans le budget actuel si l'avatar est une silhouette instanciée avec ombre « tache » (comme les passants : +3 appels de rendu, +0,02 M de triangles, 60 images/s mesurées) et si la ville n'est pas redessinée à pleine vitesse quand l'avatar est arrêté.
2. Une caméra qui suit **force la pleine vitesse pendant la marche** (60 images/s, comme glisser la carte : mesuré 59,8 sur Mac M1) et retombe à 30 images/s une demi-seconde après l'arrêt. Aucune mesure sur téléphone n'existe : c'est le risque n° 1.
3. Le point dur n'est pas le rendu mais l'**arbitrage de la caméra** : `flyTo`, `zoomTo`, la boussole, le lobby, `clampTarget` (plancher à 30 m, zoom minimal 70 m) et la résolution adaptative la manipulent déjà. Un « mode suivi » explicite est nécessaire.
4. Sur mobile, « toucher pour aller » entre en conflit avec le double toucher (zoom) et le déplacement à un doigt : la solution proposée est un toucher bref **différé de 320 ms** (ou un mode balade qui remplace le double toucher), à trancher par Dasco.
5. Découpage : un prototype d'1 session (avatar + clic + caméra qui suit, sans effacement), puis ≈ 6 à 9 sessions pour le reste ; 8 à 12 sessions au total avec l'effacement, incertitude forte sur le mobile.

## Faits vérifiés

Références `fichier:ligne` lues dans le dépôt (état de la branche `docs/EP005-balade-avatar-spec`, itération 63).

**Performance**
- Boucle de rendu : `src/main.ts` (`setAnimationLoop`, ≈ lignes 423-449). `busy = still < CAMERA_TAIL || tickers.some(m => m.moving?.())` ; `CAMERA_TAIL = 0,5 s`, `IDLE_FRAME = 1/30 - 0,004` (≈ lignes 393-395). `still` repart à 0 dès que la caméra ou la cible bougent de plus de 1e-3 (≈ lignes 437-443). **Donc une caméra qui suit l'avatar met la boucle en pleine vitesse pendant toute la marche.**
- Derrière le lobby, `still = CAMERA_TAIL` est forcé : la rotation automatique est exclue du « ça bouge » (`main.ts` ≈ ligne 445 ; CHANGELOG itération 63).
- `Ticker.moving?()` : `src/types.ts:10`. Les passants ne définissent pas `moving` (`src/scene/people.ts:29`) : « la marche est lente, elle ne demande pas la pleine vitesse ». Les éléphants, eux, tournent à 30 images/s au repos.
- Mesures de l'itération 42 (CHANGELOG, Chrome for Testing avec GPU M1, 1 200 × 800, densité 2, écran 60 Hz) : repos **30,0 images/s**, glisser la carte **59,8**, souris **55,8**, lecture ▶ **59,0**, clic sur un éléphant **53,4** ; densité restée à 1,5. Dasco : « tout est fluide ». **Non vérifié : mobile, écrans 120 Hz, batterie.**
- Comptes actuels : **63 appels de rendu** (62 → 63 avec les noms de rues, itération 61 et 62), **1,45 à 1,51 M de triangles** (CHANGELOG itérations 61 et 62). Les chiffres « ≈ 2 400 appels » de `PERF-AUDIT.md` et de `FEATURES.md` sont périmés ou concernent un état antérieur aux monuments fusionnés : je retiens le CHANGELOG (63). L'écart n'est pas expliqué dans ce que j'ai lu : non vérifié.
- Chargement ≈ 4,5 s en dev, 4,81 s avec les pauses du lobby (itération 63), 4,75 s après le correctif des rubans (itération 62), mesuré sur Mac M1 ; mobile « ×3 ? » non mesuré.
- Résolution adaptative : `src/scene/quality.ts:16-47` ; plafond 1,5 ; toutes les 2 s, < 40 images/s → −0,25 ; > 56 trois fois de suite → +0,25 ; ne mesure que les images en mouvement.
- Ombres : `renderer.shadowMap.autoUpdate = false` (`src/scene/stage.ts:15-17`), recalculées seulement par `daynight.ts:99`, et `main.ts:270-271, 421`. **Un avatar qui projette une vraie ombre obligerait à les recalculer à chaque image** : à éviter, utiliser une ombre « tache » (précédent : `people.ts`, `blobShadow`).
- Effet maquette : `src/scene/tiltshift.ts:132-142`, cible de rendu à 4 échantillons (2 si densité ≥ 1,5), flou en demi-résolution ; la bande nette suit `controls.target` (donc l'avatar si la cible est l'avatar) ; flou atténué à courte distance (`strength` ≥ 0,25).

**Caméra et gestes**
- `src/scene/stage.ts` : `camera` near = 5 m (ligne 22), FOV 30°, `minDistance = 70` (ligne 31), `minPolarAngle 0,12`, `maxPolarAngle 1,22`, `clampTarget` impose une caméra à **au moins 30 m au-dessus du sol** (lignes 52-63). `flyTo`, `zoomTo`, `resetNorth`, `updateFlight` écrivent directement `camera.position` / `controls.target` (lignes 77-120). `controls.touches = { ONE: PAN, TWO: -1 }` (ligne 41).
- `src/scene/touch.ts` : 2 doigts = zoom, pivot, inclinaison ; écoute `pointerdown` sur le canevas, `pointermove` et `pointerup` sur la fenêtre.
- `src/interaction.ts:68-90` : un `pointerup` à moins de 6 px du `pointerdown` est un « clic » ; sur tactile, deux « clics » à moins de 320 ms et 30 px = double toucher (zoom vers le sol touché). Ordre de priorité : outil de placement (dev) → éléphant (`hunt.click`) → `onSelect(pick(...))` (gemmes ✦ et épingles de lieux). **Un toucher sur le sol ne fait rien aujourd'hui** (hors fermeture de la fiche de lieu : `main.ts` ≈ ligne 354).
- `canvas { touch-action: none }` (`src/style.css:20`).
- Aucun contrôle clavier de la carte : seulement Échap (`src/ui/ui.ts:323`, `src/ui/lobby.ts:113`) et la touche P de l'outil de placement (dev).

**Intégration**
- Beaucoup de modules prennent `controls.target` comme « point regardé » : passants (rayon 250 m), oiseaux, fumée, noms de rues, effet maquette (`main.ts`, lignes 129-175 environ). **Si la cible de la caméra est l'avatar, ils suivent l'avatar sans changement.**
- Noms de rues : opacité = fonction de `camera.position.distanceTo(focus())`, fondu 320 m → 200 m (`street-names.ts` ≈ lignes 255-258, `src/content/streets.json`). Une caméra de balade à 40 à 100 m de l'avatar donnerait **toujours** l'opacité 1 (et construit l'atlas dès le début : ≈ 70 ms, 2 Mo selon CHANGELOG itération 61).
- Lobby : `lobbyView()` place la caméra et active `controls.autoRotate` (`main.ts` ≈ lignes 403-413) ; `lobby.onEnter` l'arrête et affiche l'aide (`main.ts` ≈ 414-418) ; `onLobby: () => lobby.open()` (le « ? ») ne replace pas la caméra ; `.lobby { position:absolute; inset:0; z-index:30 }` couvre le canevas, donc les clics n'atteignent pas la carte ; le lobby a `role="dialog" aria-modal="true"` (`src/ui/lobby.ts:56`).
- Mini-jeu : `hunt.click` passe avant la sélection ; `setupGame` donne `moving` (fumée, bulle, vols) ; `flyTo` du jeu à 160 m (`main.ts` ≈ ligne 296). Les éléphants marchent sur le réseau `mascot.json` (`clearance` 2,2 m, zone interdite de 15 m autour de la fontaine) ; les passants sur un autre réseau (`life.json`, `clearance` 1,0 m, `avoidWater`). `buildWalkways` est appelé deux fois (`people.ts:135`, `mascot.ts:230`) : un troisième réseau pour l'avatar est possible mais coûteux en mémoire et en temps de chargement ; réseau des passants : 5 011 nœuds (CHANGELOG itération 52).
- Progression : `src/state/progress.ts` (clé `chambery-diorama:discovered:v1`) ; points `…:points:v1`, éléphants `…:herd:v1`, lobby `…:lobby:v1`, tous en `try/catch`. **« Recommencer l'exploration » (`main.ts` ≈ lignes 223-229) ne remet à zéro que les lieux découverts**, pas les points (voulu : `points.ts:4`), et d'après ce que j'ai lu pas non plus les éléphants ramenés (non vérifié dans `hunt.ts`).
- Mobile : `matchMedia('(pointer: coarse)')` (`ui.ts:97`, `people.ts:139` avec `innerWidth < 700`) ; passants ×0,5 sur téléphone (`life.json` `mobileFactor`). Boussole à `top: 88px` à droite et bouton « ? » à `bottom: 92px` sur ordinateur ; sur petit écran, la boussole passe en haut (`style.css:187`), la fiche de lieu est au-dessus de l'épingle et le panneau d'histoire est un tiroir bas de `max-height: 62vh` (`style.css:181`).
- Accessibilité existante : zones `aria-live` (progression, points, bulle), boutons avec `aria-label`, lobby modal ; réduction des animations seulement pour le CSS du lobby et la rotation automatique (`main.ts:409`, `style.css:137, 270`). Le canevas WebGL n'a pas de description.

## Analyse par thème

### 1. Budget de performance

**Ce que le mode balade ajoute**
- Un avatar : 1 à 3 maillages (corps, tête, ombre « tache »), ≈ 1 000 triangles (précédent : passants ≈ 1 200 triangles, 3 appels). Négligeable : < 0,1 % des triangles.
- Une silhouette « à travers les murs » (thème 5) : +1 à 2 appels, même ordre de triangles.
- Des effets liés à l'effacement des bâtiments : hors périmètre (étude dédiée), mais c'est probablement **le vrai coût** (matériau modifié ou second rendu) ; à mesurer séparément.
- Une caméra plus basse et plus proche : voit moins de ville à la fois (le tronc de caméra est plus petit) mais **le maillage des bâtiments est un seul objet** (`FEATURES`, « Bâtiments fusionnés ») : l'élimination hors champ ne rend presque rien. Le coût par pixel (effet maquette, ombres, shader de fenêtres) reste le même. Gain nul à attendre d'une caméra proche, sauf sur les arbres s'ils étaient découpés par quartier (non fait : `PERF-AUDIT` constat 3).

**Cadence**
- Marche = caméra qui bouge = `busy` = pleine vitesse (60 images/s), comme glisser la carte. C'est voulu : un suivi à 30 images/s paraîtrait saccadé.
- Avatar arrêté : la caméra converge, `still` dépasse 0,5 s, retour à 30 images/s. **Piège** : un lissage exponentiel de la caméra qui ne s'arrête jamais exactement (`distance < ε` jamais atteint) garderait `busy` vrai. Il faut un seuil d'arrêt franc (comme `flight` : `< 0,5 m`, `stage.ts:119`) ou un `moving()` explicite.
- Animation d'attente (respiration, regard autour) : à 30 images/s sans `moving`. Pas de pleine vitesse pour un décor.
- Proposition : le module avatar définit `moving()` = « en marche ou caméra en rattrapage », rien de plus. La rotation automatique ne doit pas servir au mode balade.

**Budget proposé** (en s'appuyant sur le budget de l'epic EP001 : « au plus +25 appels, +0,5 M de triangles », CHANGELOG itération 53)
- Avatar + silhouette + marqueur de destination : **au plus +6 appels de rendu et +0,05 M de triangles**.
- Images/s en marche sur Mac M1 : **≥ 55** (référence mesurée 59,8) ; au repos : toujours 30 (compteur « repos (30 max) »).
- Temps de chargement : au plus **+0,2 s** (pas de nouveau réseau de voies si on réutilise celui des passants ; sinon à mesurer).
- Mobile : **non mesurable aujourd'hui** (aucun téléphone dans le dispositif de test). Proposition : seuil « ≥ 30 images/s en marche sur le téléphone de Dasco », avec densité qui peut descendre à 1 (déjà géré par `quality.ts`).

**Optimisations à prévoir si le mobile est trop lent**
1. Pendant la marche, baisser temporairement la densité de pixels d'un cran (0,25) et la rétablir à l'arrêt (`quality.ts` ne le fait pas aujourd'hui ; à ajouter avec prudence : changer la densité redimensionne les cibles de rendu).
2. `samples: 2` sur mobile pour l'effet maquette (piste déjà listée au `PERF-AUDIT` constat 5).
3. Réduire passants et groupes (déjà ×0,5 sur téléphone) ou les limiter dans l'écran en mode balade.
4. Découper les arbres par quartier (BACKLOG « Fluidité mobile ») : devient rentable avec une caméra proche.
5. Ne pas mettre à jour la caméra si l'avatar n'a pas bougé (déjà couvert par `still`).

### 2. Mobile

**État** : 1 doigt = déplacer (OrbitControls PAN), 2 doigts = zoom / pivot / inclinaison (`touch.ts`), double toucher = zoom (`interaction.ts:76-82`), toucher une ✦ ou une épingle = fiche.

**Conflits avec « toucher pour aller »**
- Le toucher bref sur le sol est libre aujourd'hui, mais le **premier toucher d'un double toucher** serait aussi interprété comme « aller ici ». Deux options :
  - **A (recommandée pour le prototype)** : en mode balade, le double toucher est désactivé ; un toucher bref = aller. Le zoom reste possible au pincer.
  - **B** : conserver le double toucher et **différer** l'ordre d'aller de 320 ms (latence perceptible, mauvais pour un jeu).
- Un doigt qui glisse : en mode balade, la caméra suit l'avatar ; déplacer la carte avec un doigt (PAN) fait perdre le suivi. Proposition : en mode balade, 1 doigt qui glisse = **pivoter autour de l'avatar** (comme Diablo mobile / jeux de rôle) ou ne rien faire ; 2 doigts gardent zoom / pivot / inclinaison. Une action explicite (bouton « Recentrer » ou « Vue d'ensemble ») rend la main à la carte libre. **Décision de produit** (question 2).
- Seuil de 6 px entre `pointerdown` et `pointerup` : sur téléphone, un doigt bouge de 6 à 10 px sans le vouloir ; vérifier que « toucher pour aller » n'est pas pris pour un glissement (non vérifié sur appareil).
- Le tiroir bas (`max-height: 62vh`) cache le bas de l'écran : si l'avatar y est, il est invisible. Proposition : à l'ouverture d'une fiche, le suivi **décale le point regardé vers le haut** de l'écran (comme `followPlace` le fait pour la fiche de lieu, `main.ts` ≈ lignes 363-370) ; non vérifié visuellement.
- La zone de l'effet maquette (`focusY` borné à 0,2-0,8) : la bande nette doit rester sur l'avatar même décalé.

**Interface**
- **Boussole** : garder. Son action (`resetNorth`) tourne autour de la cible, donc autour de l'avatar : cohérent, à condition que le suivi n'écrase pas `camera.position` pendant l'animation de 0,6 s.
- **« ? »** : garder, position inchangée. Il ouvre le lobby par-dessus la carte (la caméra ne se déplace pas, `main.ts` : `onLobby`). L'avatar doit être **en pause** et ignorer les clics et touches pendant le lobby (`lobby.isOpen()`).
- **Fiche en tiroir bas / fiche de lieu** : ne pas fermer ni bloquer la balade pendant qu'une fiche est ouverte ; un toucher dans le vide ferme la fiche (comportement actuel `onSelect`), et **ne doit pas en plus donner un ordre d'aller** : un toucher = une seule action (fermer **ou** aller).
- Aide `hint` : texte tactile à adapter (« Touche pour marcher ») ; `ui.ts:97-100`.
- Commandes en bas : l'heure (`.tools`, `bottom: 28px`) occupe la zone du pouce ; éviter d'y mettre un joystick virtuel (non retenu : le « toucher pour aller » suffit).

### 3. Intégration avec l'existant

| Élément | Adaptation | Risque de casse |
|---|---|---|
| **Lobby EP004** (`lobby.ts`, `main.ts` ≈ 403-418) | Avatar invisible ou en attente derrière le lobby ; `autoRotate` reste réservé au lobby ; à « Explorer la carte », la caméra peut rejoindre l'avatar (vol) ; texte du lobby à compléter (une carte « Balade ») | Moyen : deux modes qui écrivent la caméra ; `lobbyView()` doit rester cohérent avec la position sauvegardée de l'avatar |
| **Éléphants / `hunt.click`** | L'éléphant garde la priorité du clic ; l'avatar ne se déplace pas quand on clique un éléphant (déjà garanti par l'ordre dans `interaction.ts:84-86`) ; éléphants de 4,5 m : l'avatar peut passer « dans » un éléphant (marche sur des réseaux voisins) → décider : ignorer, ou éviter | Faible pour le clic, moyen pour le chevauchement visuel |
| **Gemmes ✦ et fiches** (`openPoi`, `main.ts` ≈ 308-320) | `openPoi` appelle `stage.flyTo` : en mode balade, ce vol **volerait la caméra** à l'avatar. Proposition : « marcher jusqu'au lieu puis ouvrir la fiche » (le prototype peut garder l'ouverture immédiate sans vol) | **Élevé** si non traité : caméra et avatar désynchronisés |
| **Journal** (`onJournalPick`) | Même `flyTo` : choisir entre téléporter l'avatar ou le laisser et voler | Moyen |
| **Noms de rues** | Seuil de distance caméra → centre de vue (320 → 200 m) : caméra de balade toujours dans le « plein » ; les noms seraient tous visibles dans le rayon (182 noms, un seul appel). Bénéfice pour s'orienter, mais **possible encombrement** vu de près ; ajouter un rayon autour de l'avatar ou réduire l'opacité sous ≈ 100 m (à regarder, non vérifié). Autre point : le plancher de caméra à 30 m (`stage.ts:60`) et la visée plus rasante cachent les noms dans les rues étroites (limite déjà connue, CHANGELOG itération 60) | Faible à moyen, surtout visuel |
| **Passants / oiseaux / fumée** | Suivent `controls.target` : si la cible est l'avatar, ils se regroupent autour de lui sans changement. Passants de 1,7 m : l'avatar doit avoir une taille/une couleur qui le distingue (légèrement plus grand, couleur franche, anneau au sol) | Faible ; confusion visuelle avec les passants à régler |
| **Heure / saison / horloge** | La nuit : avatar éclairé (le matériau doit réagir à `night.uNight` comme les passants, sinon il brille dans le noir) ; lecture ▶ de la journée : `moving` déjà géré | Faible |
| **Ombres** | Pas de nouvelle ombre portée : ombre « tache » | Évité si la règle est suivie |
| **Effet maquette** | Bande nette sur l'avatar ; flou minimal à courte distance : cohérent | Faible |
| **Plancher caméra et zoom minimal** | `minDistance = 70` et plancher 30 m interdisent une vue « Diablo » proche. Il faut des limites propres au mode balade (par exemple 25-60 m) **sans** les changer pour la carte libre ; near = 5 m à vérifier contre les façades | **Élevé** : réglage global actuel, utilisé par tout |
| **Outil de placement (dev)** | Passe avant tout ; ne pas lui prendre ses clics | Faible |
| **PWA / hors ligne** | Aucun asset nouveau si l'avatar est en formes simples ; un modèle glTF demande la licence au README et un crédit (règle projet n° 5) | Faible |

### 4. Sauvegarde

- Proposition : clé `chambery-diorama:avatar:v1` dans `src/state/avatar.ts`, même modèle que `state/*` (JSON, `try/catch`, repli silencieux). Contenu minimal : `{ x, y }` en mètres (système de `data.bounds`), éventuellement le cap. Écrite à l'arrêt de la marche (pas à chaque image).
- **Relecture** : au chargement, vérifier que le point est **encore valide** (sur un nœud ou une arête du réseau, hors bâtiment, hors eau) car `city.json` peut changer entre deux déploiements (`npm run data`) ; sinon, repli sur le point de départ. À écrire dans le prototype dès la première version : c'est la protection contre un avatar enterré.
- Hors ligne et navigation privée : le stockage peut être bloqué (cas déjà géré ailleurs).
- **« Recommencer l'exploration »** : `onReset` remet à zéro les lieux découverts seulement. Proposition par défaut : **ramener l'avatar au point de départ** (c'est « recommencer ») et ne pas toucher aux points (cohérent avec `points.ts:4`). Décision de produit (question 5). Le message `ui.flash('Exploration remise à zéro')` resterait.
- Plusieurs onglets : dernière écriture gagne (même comportement que les autres états).

### 5. Accessibilité et confort

- **Clavier** : aujourd'hui aucune navigation clavier de la carte. Proposition : **flèches et ZQSD / WASD** (`KeyboardEvent.code` : `KeyW/KeyA/KeyS/KeyD` couvre ZQSD sur un clavier AZERTY, à vérifier sur le clavier de Dasco), Échap pour annuler, Entrée ou Espace pour « agir ici » (ouvrir la ✦ proche). Éviter la touche **P** (outil de placement en dev) et ne rien capter quand le lobby est ouvert, quand un champ (curseur d'heure, cases de légende) a le focus, ou avec Ctrl / Cmd. Déplacement clavier = avancer le long du réseau (choisir l'arête la plus alignée avec la direction à l'écran) : voir l'étude du chemin.
- **Lecteurs d'écran** : un canevas WebGL est opaque. Minimum raisonnable : un `aria-label` sur le canevas (« Carte 3D du centre de Chambéry, navigable au clavier ») et une zone `aria-live="polite"` qui annonce « Vous êtes près de : … » (lieu d'histoire, nom de rue lu dans `streetLabels`) et « Nouveau lieu découvert » (la fiche le fait déjà via `flash`, à vérifier). Une vraie équivalence (liste de lieux navigable) existe déjà avec le **Journal**. Rendu complet pour lecteur d'écran : non visé, à dire à Dasco.
- **`prefers-reduced-motion`** : aujourd'hui seulement le CSS du lobby et la rotation automatique. En mode balade : suivi de caméra **sans lissage long** (ou plus court), pas d'animation d'oscillation de l'avatar, pas de rebond du marqueur de destination, vols (`flyTo`) raccourcis. Non essayé jusqu'ici même pour le lobby (BACKLOG EP004).
- **Daltonisme** : l'avatar ne doit pas se distinguer **seulement par la couleur** ; silhouette contrastée (clair sur sombre et sombre sur clair), anneau ou ombre portée nette, silhouette visible à travers les murs : second passage de l'avatar avec test de profondeur inversé (`depthFunc: GreaterDepth`, `depthWrite: false`, couleur plate, quelques % d'opacité) dans la scène du rendu principal, **avant** l'effet maquette (le canevas des étiquettes `overlayScene` est dessiné après et n'a pas la profondeur de la scène : non adapté). Coût : +1 appel. La silhouette doit aussi se distinguer des passants (forme ou taille).
- **Langue** : tout en français, tutoiement comme le reste de l'interface (« Touche pour marcher ») ; noms de rues avec leur article (`withArticle` existe dans `hunt.ts`).
- **Confort** : vitesse de marche modérée (valeur à régler à l'usage : non vérifié), pas de secousse de caméra, un arrêt net, pas de mal de mer (caméra à hauteur et angle quasi constants, rotation seulement à la demande).

### 6. Tests et vérification

Le projet n'a pas de test automatisé (règle de `context.md` : `npm run build` + navigateur). Méthode reprise : Chrome for Testing + GPU (Metal) via Playwright (mémoire de projet, itération 42) ; le navigateur de test fait un rendu logiciel dont les temps ne sont pas représentatifs (règle projet n° 6).

**Contrôlable par script** (navigateur, via `window.diorama`, disponible en dev et avec `?debug`, `main.ts` dernière ligne ; l'avatar devra y être exposé) :
- **Parcours de chemin** : ordonner « aller en (x, y) » depuis une liste de destinations (✦, fontaine, gare, hôtel de ville, extrémités du réseau), attendre l'arrivée, vérifier la distance finale à la destination.
- **Jamais dans un bâtiment** : à chaque pas, test point-dans-polygone sur `data.buildings` (fonctions de `src/scene/geo.ts`), avec trous (cours) et exceptions voulues (passages sous bâtiment exclus du réseau).
- **Jamais dans l'eau** : même test sur `data.water`, hors ponts (`bridge`).
- **Jamais hors réseau** : distance de l'avatar à la polyligne la plus proche < tolérance (≈ 0,5 m).
- **Jamais sous le sol, ni en l'air** : `|y − heightAt| < tolérance`.
- **Cadence** : relever les images dessinées par seconde au repos et en marche (compteur `?debug` ; méthode de l'itération 42), appels de rendu et triangles avant / après.
- **Aucune erreur console** pendant le parcours.
- **Données** : un contrôle comme `npm run check:streets` (`scripts/check-street-labels.mjs`) : tous les lieux ✦ et la position de départ sont **atteignables** (dans la composante principale du réseau). Comment partager `walkways.ts` (TypeScript) avec un script Node (`scripts/*.mjs`) : non vérifié ; pistes : exécuter le contrôle dans le navigateur de test, ou un petit module commun (voir EN-01 dans le BACKLOG).

**Non automatisable** : sensation de fluidité, lisibilité de l'avatar et de la silhouette, confort de la caméra, gestes sur téléphone, lecteur d'écran. Ils sont dits « non vérifiés » dans le CHANGELOG tant que non joués (règle projet n° 6).

Le scénario écrit est en fin de document.

### 7. Découpage et planning

Voir la section suivante.

## Découpage en user stories et planning

Points sur l'échelle du projet (1 = très petit, 8 = grosse journée). 1 session ≈ une demi-journée de l'agent principal. Les US d'effacement des bâtiments et celles de l'avatar/chemin/caméra viennent des autres études : je ne fais que les placer dans l'ordre.

| Ordre | US (titre provisoire) | Points | Dépend de | Décisions de produit avant de commencer |
|---|---|---|---|---|
| 1 | **US001 Prototype : avatar, clic pour aller, caméra qui suit** (sans effacement) | 5 | rien (réseau des passants réutilisé) | Q1 (modes de caméra), position de départ, apparence provisoire (forme simple), vitesse |
| 2 | **US002 Mode caméra « balade » et arbitrage** (`flyTo`, journal, boussole, lobby, limites 25-60 m, near, plancher) | 3 | US001 | Q2 (gestes mobiles en balade), comportement des ✦ (Q3) |
| 3 | **US003 Effacement des bâtiments qui masquent l'avatar** (étude dédiée) | 8 (à confirmer) | US001, US002 | choix visuel de l'effacement (autre étude) |
| 4 | **US004 Silhouette à travers les murs** et lisibilité (daltonisme) | 2 | US001 (et US003 si l'effacement suffit, la silhouette peut devenir inutile) | faut-il les deux ? |
| 5 | **US005 Clavier et accessibilité** (flèches / ZQSD, `aria-label`, annonces, réduction des animations) | 3 | US001 | périmètre lecteur d'écran (Q6) |
| 6 | **US006 Lieux et jeu** : marcher jusqu'à un ✦ puis ouvrir la fiche ; éléphants (proximité ?) ; journal | 5 | US002 | Q3, Q4 (l'avatar joue-t-il aux éléphants ?) |
| 7 | **US007 Sauvegarde de la position** et « Recommencer » | 2 | US001 | Q5 |
| 8 | **US008 Mobile : fluidité et gestes** (mesure sur téléphone, densité pendant la marche, double toucher) | 3 | US002 | téléphone de référence de Dasco |
| 9 | **US009 Lobby, aide, README, FEATURES** (carte « Balade », texte tactile, licences) | 2 | US001 | texte du lobby |
| 10 | **US010 Cas de test et contrôle de données** (scénario écrit, parcours automatisé) | 3 | US001 à US007 | aucune |

Total hors effacement : **28 points** (US001, 002, 004 à 010) ; US003 à part.

**Prototype (≈ 1 session, 0,75 à 1,5)** = US001 seule : avatar en formes simples, instancié, ombre « tache », silhouette provisoire ; toucher ou clic sur le sol → point le plus proche du réseau → marche à vitesse constante ; caméra qui suit à 3/4 de dessus avec des limites provisoires ; **sans** effacement, **sans** clavier, **sans** sauvegarde (position de départ fixe), **sans** gestion des fiches (l'ordre de marche est ignoré quand on clique une ✦, un éléphant ou l'interface). Critères de sortie : build vert, aucun avatar dans un bâtiment ou dans l'eau sur 50 destinations aléatoires, 60 images/s en marche sur le Mac, 30 au repos, aucune erreur console. Sert à **décider** (sensation, taille de l'avatar, angle, faisabilité de l'effacement) avant d'investir dans le reste.

**Estimation** : prototype 1 session ; US002 + US005 + US007 + US009 : 2 à 3 sessions ; US006 + US008 + US010 : 2 à 3 sessions ; US004 : 0,5 session ; effacement : 2 à 4 sessions (autre étude) ; revue et retours de Dasco (une à deux itérations de retouche) : 1 à 2 sessions. **Total 8 à 12 sessions, 1 à 1,5 session pour le prototype.** Incertitudes : le comportement sur téléphone (jamais mesuré), le coût de l'effacement, le réglage de la caméra (beaucoup d'allers-retours avec Dasco, comme pour les noms de rues : 3 itérations), le partage du réseau de voies entre modules.

Contrainte de workflow (`CLAUDE.md` du projet) : spec validée par Dasco avant de coder ; une branche par user story (`feat/EP005-US001-…`) ; clôture d'itération (FEATURES, BACKLOG, CHANGELOG, DECISIONS).

## Scénario de test proposé

À jouer sur `npm run dev` puis sur le build (`npm run build && npm run preview`), avec `?debug` pour le compteur. Format de l'epic EP002 (US004). Résultat consigné dans le CHANGELOG avec « réussi / échoué / non vérifié ».

| # | Étape | Résultat attendu |
|---|-------|------------------|
| 1 | Ouvrir la carte avec le lobby (`?lobby=1`), ne pas toucher | Avatar invisible ou immobile derrière le voile ; la caméra tourne ; compteur « repos (30 max) » |
| 2 | « Explorer la carte » | Lobby fermé ; l'avatar est à sa position de départ ; l'aide s'affiche |
| 3 | Cliquer (ou toucher) une rue à 100 m | Un marqueur apparaît ; l'avatar marche en suivant les rues, sans traverser de bâtiment ; la caméra le suit ; compteur en pleine vitesse (≥ 55 images/s sur GPU) |
| 4 | Cliquer sur un bâtiment ou dans le vide | Pas de déplacement dans le bâtiment ; l'avatar va au point accessible le plus proche, ou ne bouge pas (selon la règle retenue), sans erreur |
| 5 | Cliquer sur l'eau (la Leysse) | L'avatar n'entre pas dans l'eau ; il traverse par un pont si le chemin existe |
| 6 | Arrêter l'avatar | Au bout d'environ 1 s, compteur « repos (30 max) » ; la caméra est stable (pas de dérive) |
| 7 | Changer la destination pendant la marche | L'avatar repart sans téléportation ni demi-tour impossible |
| 8 | Cliquer une ✦, puis fermer la fiche | Comportement retenu (ouverture immédiate ou marche puis ouverture) ; la caméra et l'avatar restent synchronisés ; point découvert enregistré |
| 9 | Cliquer un éléphant | Le jeu réagit comme avant ; l'avatar ne bouge pas |
| 10 | Boussole, puis pivoter la vue | Nord en haut, l'avatar reste centré, pas de saut de caméra |
| 11 | Mettre 23 h, puis la lecture ▶ | L'avatar reste lisible (silhouette), les noms de rues sont lisibles, pas d'erreur |
| 12 | Se placer derrière un grand bâtiment (rue de Boigne) | L'avatar reste visible (effacement ou silhouette) |
| 13 | Recharger la page | L'avatar est à la même place (sauvegarde) |
| 14 | « Recommencer l'exploration » (Journal) | Lieux remis à zéro ; avatar au départ (si retenu) ; points inchangés |
| 15 | Clavier : flèches, ZQSD, Échap ; avec le lobby ouvert | L'avatar avance au clavier ; ignoré pendant le lobby et dans les champs ; Échap annule la marche |
| 16 | `prefers-reduced-motion: reduce` | Suivi de caméra sans lissage long, aucun rebond ; lobby sans rotation |
| 17 | `?debug` : relever images/s, appels de rendu, triangles | Marche ≥ 55 (Mac GPU) ; repos 30 ; au plus +6 appels et +0,05 M de triangles par rapport aux 63 appels et 1,5 M de départ |
| 18 | Téléphone ou fenêtre 320 px : toucher pour aller, pincer, tourner, double toucher, ouvrir un tiroir | Pas de conflit de gestes ; avatar visible hors du tiroir bas ; images/s relevées (≥ 30) |
| 19 | Parcours automatisé (script) : 50 destinations aléatoires et toutes les ✦ | 0 pas dans un bâtiment, 0 dans l'eau hors pont, 0 hors réseau, toutes les ✦ atteintes, 0 erreur console |

## Risques

| Risque | Gravité | Réponse proposée |
|---|---|---|
| Fluidité sur téléphone : pleine vitesse en marche, jamais mesuré | Élevée | Prototype mesuré sur le téléphone de Dasco ; densité adaptative ; seuil de décision de Dasco |
| Conflits de caméra (`flyTo`, journal, boussole, lobby, `clampTarget`) | Élevée | US002 : un seul propriétaire de la caméra à la fois (mode explicite) |
| Limites de zoom (70 m) et plancher (30 m) incompatibles avec la vue de balade | Élevée | Limites propres au mode balade, la carte libre ne change pas |
| Avatar enterré après un changement de données (`npm run data`) | Moyenne | Validation de la position sauvegardée au chargement, repli sur le départ |
| Coût de l'effacement des bâtiments (autre étude) | Élevée | À mesurer au prototype de l'effacement avant de s'engager |
| Gestes tactiles : double toucher, glisser à un doigt, seuil de 6 px | Moyenne | Option A (pas de double toucher en balade) ; test sur appareil |
| Deux ou trois réseaux de voies en mémoire (éléphants, passants, avatar) | Moyenne | Réutiliser celui des passants ; mesurer le chargement |
| Confusion visuelle avec les passants (1,7 m) | Faible | Avatar distinct (taille, couleur, anneau) |
| Pas de test automatisé : régressions sur les autres fonctionnalités | Moyenne | Scénario écrit rejoué à chaque US ; script de parcours |
| Réduction des animations et lecteurs d'écran non essayés ailleurs non plus | Faible | Dit explicitement « non vérifié » |

## Questions ouvertes pour Dasco

1. **La balade remplace-t-elle la carte libre, ou est-ce un mode en plus ?** Proposition : un **mode à part**, avec un bouton « Balade » / « Vue d'ensemble » ; la carte libre actuelle (tourner, pincer, double toucher) reste le défaut, pour ne pas casser ce qui est validé.
2. **Sur téléphone, que fait un doigt qui glisse en mode balade ?** Proposition : **pivoter autour de l'avatar** ; un toucher bref = aller ; 2 doigts = zoom / pivot / inclinaison comme aujourd'hui ; le double toucher est désactivé en balade.
3. **Quand on touche une ✦ ou une épingle en mode balade, l'avatar marche-t-il d'abord ?** Proposition : l'avatar **marche jusqu'au lieu puis la fiche s'ouvre** (plus immersif), avec un raccourci « ouvrir tout de suite » via le Journal ; au prototype : ouverture immédiate, sans vol de caméra.
4. **L'avatar a-t-il un rôle dans le jeu des éléphants ?** (les attraper en s'approchant ?) Proposition : **non pour l'instant** ; le clic sur l'éléphant garde la priorité ; à reprendre dans une US dédiée après le prototype.
5. **Que devient la position de l'avatar à « Recommencer l'exploration » ?** Proposition : **retour au point de départ** ; les points ne sont pas touchés (comme aujourd'hui).
6. **Quel niveau d'accessibilité pour la balade ?** Proposition : clavier (flèches / ZQSD), `aria-label` et annonces des lieux proches, réduction des animations, silhouette contrastée ; **pas** de promesse de parcours complet au lecteur d'écran (le Journal reste l'équivalent).

Complément pour la décision du prototype : **le téléphone de référence** pour mesurer les images/s (aucune mesure mobile n'existe).
