# EP005 - US004 - Cliquer ou toucher pour aller, sans casser les gestes actuels

## User Story

**En tant que** visiteur en mode balade,
**je veux** diriger mon avatar d'un clic ou d'un toucher, comme dans un jeu,
**afin de** jouer naturellement à la souris comme au doigt.

---

## Critères d'acceptation

- [ ] **Given** un clic ou un toucher court (≤ 6 px), **When** il vise l'outil de placement (dev), puis un éléphant, puis une gemme ou une épingle, **Then** la priorité actuelle est respectée ; **sinon** le sol : l'avatar marche
- [ ] **Given** un éléphant croisé en balade, **When** je le clique, **Then** le jeu réagit comme avant (le clic sur les éléphants est conservé) et l'avatar ne bouge pas
- [ ] **Given** un glisser à la souris, **When** je tourne ou déplace la vue, **Then** son sens actuel est conservé (souris : tourner ; clic droit : déplacer)
- [ ] **Given** la souris au-dessus du sol, **When** je survole, **Then** le curseur indique « marcher » et un anneau de prévisualisation suit, sans lancer un rayon sur les bâtiments à chaque mouvement
- [ ] **Given** un téléphone, **When** je dirige l'avatar, **Then** le geste suit ce qui existe sur mobile (à la League of Legends mobile : toucher pour aller, éventuellement une croix directionnelle) ; le choix se fait à l'usage sur l'iPhone (P6)
- [ ] **Given** le mode balade sur téléphone, **When** je pince ou tourne à deux doigts, **Then** zoom, pivot et inclinaison restent comme aujourd'hui ; le double toucher de zoom est désactivé (le 1er toucher a déjà lancé la marche)
- [ ] **Given** un geste à deux doigts, **When** je lève les doigts, **Then** aucun ordre d'aller n'est donné (le `pointerup` est ignoré)
- [ ] **Given** une fiche ouverte, **When** je touche dans le vide, **Then** la fiche se ferme **et** l'avatar ne reçoit pas d'ordre : un toucher = une seule action
- [ ] **Given** le lobby ouvert, **When** je clique, **Then** l'avatar ne reçoit aucun ordre
- [ ] **Given** la carte libre (hors du mode balade), **When** je clique le sol, **Then** il ne se passe rien, comme aujourd'hui

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Règle de priorité : outil de placement → éléphant (`hunt.click`) → gemme / épingle → sol |
| R2 | Pas de clavier (décision de Dasco : on vise le clic et le toucher) |
| R3 | Geste mobile : **non bloquant, à définir à l'usage** ; l'état des doigts de `touch.ts` est exposé à `interaction.ts` |
| R4 | Clic sur gemme ou épingle en balade : l'avatar y va ; la fiche s'ouvre à l'arrivée (US006) |
| R5 | Seuil de 6 px à vérifier sur tactile (un doigt bouge de 6 à 10 px sans le vouloir) |
| R6 | L'aide de `ui.ts` change en balade |

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
- [ ] Vérifié souris et émulation tactile, puis iPhone (US009)
- [ ] Mini-jeu des éléphants rejoué (aucune régression)
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
