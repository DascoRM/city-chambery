# EP002 - US002 - Dessiner les noms à plat sur le sol

## User Story

**En tant que** visiteur qui regarde une rue de près,
**je veux** lire son nom écrit à plat sur le sol, dans le sens de la rue,
**afin de** savoir où je suis comme sur un plan de ville.

---

## Critères d'acceptation

- [x] **Given** la caméra près d'une rue, **When** je regarde le sol, **Then** le nom est posé à plat sur la chaussée, orienté selon l'axe de la rue
- [x] **Given** une rue orientée de gauche à droite ou de droite à gauche, **When** je la regarde depuis le sud, **Then** le texte n'est jamais à l'envers (il se lit de gauche à droite à l'écran, quel que soit le sens du tracé)
- [x] **Given** un nom au sol, **When** le soleil ou la nuit change, **Then** il reste lisible (contraste suffisant de jour comme de nuit, comme les rues elles-mêmes)
- [x] **Given** un nom au sol, **When** un bâtiment ou un arbre est devant, **Then** le nom est caché par lui comme un objet du sol (il ne flotte pas par-dessus)
- [ ] **Given** une rue en pente ou un pont, **When** je regarde le nom, **Then** il est à la hauteur de la chaussée (pas dans le sol, pas au-dessus)
- [ ] **Given** le texte, **When** il dépasse la largeur de la rue, **Then** il ne déborde pas sur les bâtiments voisins (taille adaptée à la rue ou à la longueur)
- [x] **Given** les mêmes noms dessinés partout, **When** je regarde `?debug`, **Then** les appels de rendu augmentent d'au plus quelques unités (noms regroupés, pas un objet par nom)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Le nom est un **texte peint** posé juste au-dessus du ruban de la rue (hauteur : `roadLift()` de `src/scene/roads.ts`, au plus haut des sommets voisins du ruban), pas un sprite tourné vers la caméra comme les parcs |
| R2 | Un seul matériau et une seule géométrie fusionnée (règle de performance de l'epic : pas d'objet par nom) ; **lettres en champ de distance** (un atlas d'une case par lettre, ≈ 2 Mo) : nettes à tous les zooms, pas de coupure aux extrémités (correctif du 01/10 après retour de Dasco) |
| R2 bis | **Jamais à l'envers** : le nom se retourne de 180° quand la caméra tourne, pour se lire de gauche à droite à l'écran (correctif du 01/10) |
| R3 | Style du texte : voir Q3 de l'epic (par défaut majuscules, sans empattement, gris foncé, halo clair) ; police déjà chargée dans l'app, pas de nouvelle ressource tierce |
| R4 | Les noms ne projettent pas d'ombre et n'en reçoivent pas |
| R5 | Position et angle viennent de l'US001 ; le rendu ne recalcule pas le choix |
| R6 | Si une nouvelle police ou image est ajoutée : licence au README (règle projet) |

---

## Rendu

**Écran** : la carte, zoomée sur le centre ancien.

| État | Description |
|------|-------------|
| Au sol, de jour | Gris foncé sur la chaussée, halo clair |
| Au sol, de nuit | Moins lumineux que les lieux ouverts, mais lisible |
| Hiver / neige | À vérifier : pas de neige peinte sur le sol aujourd'hui |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Nom très long (« Quai Sénateur Antoine Borrel ») | Taille réduite ou nom coupé sur deux lignes, jamais plus large que la rue plus de quelques mètres |
| Rue très étroite (escalier, passage) | Texte plus petit, ou absent si illisible |
| Texte à l'envers | Retourné de 180° pour rester lisible, y compris quand on tourne la vue |
| Police pas encore chargée | Attente, ou police de secours (Georgia / sans-serif) sans bloquer le démarrage |
| Écran haute densité | Texte net (résolution de texture suffisante) sans exploser la mémoire |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Complexe |

---

## Checklist dev

- [x] Code implémenté (nouveau module sous `src/scene/`, câblé dans `main.ts`)
- [x] `npm run build` passe
- [ ] Vérifié rue de Boigne, quai de la Leysse (courbe), un pont, de jour et à 23 h
- [ ] Vérifié sur petit écran (320 px) et mobile si possible
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🟡 Livrée (itération 60), à valider par Dasco
