# EP005 - US001 - Un réseau de déplacement partagé et un chemin jusqu'au point cliqué

## User Story

**En tant que** visiteur en mode balade,
**je veux** que mon avatar suive les rues jusqu'à l'endroit que je désigne, sans traverser un bâtiment ni l'eau,
**afin de** me promener dans toute la ville sans jamais le voir marcher dans un mur.

---

## Critères d'acceptation

- [ ] **Given** le réseau des passants (5 751 nœuds, 92 composantes), **When** je lance le diagnostic, **Then** je sais pourquoi la rive nord-est (982 nœuds) est coupée de la grande composante (4 008 nœuds) quand `avoidWater` est actif, et la correction retenue la relie (ou la limite est documentée)
- [ ] **Given** les 8 lieux d'histoire et les 169 bars, cafés et restaurants, **When** j'ordonne d'y aller, **Then** chacun est atteignable (rattaché à la grande composante) ; la cathédrale ne se rattache plus à un îlot de 3 nœuds
- [ ] **Given** un clic sur le sol, **When** il est à plus de 40 m de toute voie, **Then** l'ordre est refusé (message « Pas par là », anneau rouge) ; en deçà, l'avatar va au point le plus proche du réseau
- [ ] **Given** un clic à 15 m ou moins du réseau, **When** le segment direct ne coupe aucun bâtiment, **Then** l'avatar quitte la voie en ligne droite pour le « dernier mètre »
- [ ] **Given** une destination, **When** le chemin est calculé, **Then** il prend moins de 2 ms (A* mesuré : 0,15 ms en moyenne, 0,93 ms au pire sous Node) et il n'y a pas de demi-tour sec
- [ ] **Given** l'avatar en marche, **When** je désigne un autre point, **Then** il replanifie depuis sa position courante (arête et abscisse) sans téléportation
- [ ] **Given** le chargement, **When** l'avatar est créé, **Then** le graphe des passants est réutilisé (pas de 3e construction) et le chargement augmente d'au plus 0,2 s
- [ ] **Given** la fontaine, **When** l'avatar s'en approche, **Then** la zone interdite est réduite à ≈ 9 m (15 m aujourd'hui, pensés pour un éléphant)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Le graphe de `walkways.ts` est partagé par passants et avatar ; options de l'avatar ≈ celles des passants avec escaliers autorisés (Q8) |
| R2 | Départ et arrivée sont des points sur une arête (nœuds virtuels), pas seulement des nœuds |
| R3 | Accrochage toujours dans la **grande composante**, jamais « au plus proche tout court » |
| R4 | Chemin : A* à heuristique euclidienne, coût divisé par `Edge.w` (préférence des rues piétonnes) ; angles arrondis (≈ 1,5 m), pas de string-pulling en v1 |
| R5 | Si une correction de données est nécessaire : `scripts/` puis `npm run data -- --offline` (règle projet 2), jamais `city.json` à la main |
| R6 | Aucun passage sous bâtiment (aucune donnée : `Road` n'a ni `tunnel` ni `covered`) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Destination dans une autre composante | Refusée à l'accrochage, jamais à A* |
| Impasse (18 % des nœuds) | L'avatar s'arrête au bout |
| Pont | Arêtes `bridge` (lift 0,9) : rien à faire |
| Clic sous un toit | Le point xz du rayon sert à l'accrochage |
| Même arête que le départ | Cas traité à part (pas de A*) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Complexe (le réseau coupé peut coûter une session de plus si `scripts/` doit changer) |

---

## Checklist dev

- [x] Diagnostic du réseau (script jetable) et décision
- [x] Réseau partagé exporté, index d'accrochage en grille de 25 m, `pointInBuilding`
- [x] `src/scene/avatar-path.ts` : accrochage, A*, polyligne, replanification
- [x] Vérifié en console sur 20 destinations dont les 8 ✦
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🟡 Fait (itération 66), à valider par Dasco
