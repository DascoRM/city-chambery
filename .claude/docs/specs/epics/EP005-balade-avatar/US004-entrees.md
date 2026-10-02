# EP005 - US004 - Cliquer ou toucher pour aller, sans casser les gestes actuels

## User Story

**En tant que** visiteur en mode balade,
**je veux** diriger mon avatar d'un clic ou d'un toucher, sans perdre les gestes de la carte,
**afin de** jouer naturellement à la souris comme au doigt.

---

## Critères d'acceptation

- [ ] **Given** un clic ou un toucher court (≤ 6 px), **When** il vise l'outil de placement (dev), puis un éléphant, puis une gemme ou une épingle, **Then** la priorité actuelle est respectée ; **sinon** le sol : l'avatar marche
- [ ] **Given** un glisser, **When** je tourne ou déplace la vue, **Then** son sens actuel est conservé (souris : tourner ; clic droit : déplacer)
- [ ] **Given** la souris au-dessus du sol, **When** je survole, **Then** le curseur indique « marcher » et un anneau de prévisualisation suit, sans lancer un rayon sur les bâtiments à chaque mouvement
- [ ] **Given** un téléphone, **When** je touche le sol, **Then** l'avatar marche ; **When** je pince ou tourne à deux doigts, **Then** zoom, pivot et inclinaison restent comme aujourd'hui
- [ ] **Given** le mode balade, **When** je touche deux fois vite, **Then** le double toucher de zoom est désactivé (le 1er toucher a déjà lancé la marche)
- [ ] **Given** un geste à deux doigts, **When** je lève les doigts, **Then** aucun ordre d'aller n'est donné (le `pointerup` est ignoré)
- [ ] **Given** une fiche ouverte, **When** je touche dans le vide, **Then** la fiche se ferme **et** l'avatar ne reçoit pas d'ordre : un toucher = une seule action
- [ ] **Given** le lobby ouvert, **When** je clique, **Then** l'avatar ne reçoit aucun ordre
- [ ] **Given** la carte libre (hors balade), **When** je clique le sol, **Then** il ne se passe rien, comme aujourd'hui

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Règle de priorité : outil de placement → éléphant (`hunt.click`) → gemme / épingle → sol |
| R2 | Un doigt qui glisse en balade : **à décider (Q6)**. Les deux analyses divergent : déplacer la carte et quitter le suivi, ou pivoter autour de l'avatar. À tester sur ton téléphone |
| R3 | Clic sur gemme ou épingle en balade : l'avatar y va ; la fiche s'ouvre à l'arrivée (US006) ; hors balade, comportement actuel inchangé |
| R4 | Seuil de 6 px à vérifier sur tactile (un doigt bouge de 6 à 10 px sans le vouloir) |
| R5 | L'état des doigts de `touch.ts` est exposé à `interaction.ts` |
| R6 | L'aide de `ui.ts` change en balade (« Touche pour marcher ») |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Clic sur l'eau ou un bâtiment | L'avatar va au point accessible le plus proche, ou refus (US001) |
| Clic sur l'interface | Ignoré |
| Clic à moins de 2 m de la destination actuelle | Ignoré |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Complexe (entrées déjà arbitrées à plusieurs endroits) |

---

## Checklist dev

- [ ] `interaction.ts`, `touch.ts`, `ui.ts`
- [ ] Vérifié souris et émulation tactile (téléphone réel : à faire en US009)
- [ ] Mini-jeu des éléphants rejoué (aucune régression)
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
