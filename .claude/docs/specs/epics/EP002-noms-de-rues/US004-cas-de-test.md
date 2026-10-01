# EP002 - US004 - Un cas de test pour vérifier l'affichage des noms

## User Story

**En tant que** développeur du diorama (Dasco, et Claude pour le code),
**je veux** un scénario de vérification écrit et rejouable pour les noms de rues,
**afin de** savoir en quelques minutes si les noms s'affichent bien, et de le revérifier après une autre modification.

---

## Contexte
Le projet n'a pas de tests automatisés : la vérification passe par `npm run build` (types) et le navigateur (`?debug`). Le navigateur de test fait un rendu logiciel : les temps ne sont pas représentatifs (règle projet) ; pour les images/s, utiliser Chrome for Testing avec GPU.

---

## Critères d'acceptation

- [x] **Given** l'epic terminée, **When** je cherche le scénario, **Then** il est dans ce fichier (section « Scénario »), avec des étapes numérotées et un résultat attendu pour chacune
- [x] **Given** le scénario, **When** Claude le joue dans le navigateur, **Then** le résultat de chaque étape (réussi / échoué / non vérifié) est consigné dans le CHANGELOG
- [x] **Given** les données, **When** le contrôle de données est lancé (Q5), **Then** il échoue si un nom de la liste n'est pas dans `city.json`, si deux emplacements du même nom sont à moins de 60 m, ou si une liste est vide
- [ ] **Given** une modification ultérieure du rendu (EP003 ou autre), **When** je rejoue le scénario, **Then** je sais si les noms sont toujours corrects

---

## Scénario (à jouer sur `npm run dev`)

| # | Étape | Résultat attendu |
|---|-------|------------------|
| 1 | Ouvrir la carte, ne pas toucher | Aucun nom de rue visible |
| 2 | Zoomer à la molette (ou pincer) jusqu'à la rue de Boigne | Les noms apparaissent en fondu, à plat, dans le sens de la rue |
| 3 | Continuer à zoomer jusqu'au zoom maximum | Les noms restent lisibles, jamais à l'envers |
| 4 | Dézoomer jusqu'à la vue d'ensemble | Les noms s'effacent en fondu et disparaissent complètement |
| 5 | S'arrêter exactement à la distance où ils apparaissent | État stable : pas de clignotement |
| 6 | Aller à la Leysse (rue courbe) puis à un pont | Le nom suit le tracé sur la partie droite ; sur un pont, il est à la hauteur du pont |
| 7 | Mettre 23 h avec le curseur d'heure | Les noms restent lisibles |
| 8 | Cliquer sur un nom de rue | Rien ne se passe (les clics passent au travers) |
| 9 | Ouvrir une fiche de lieu puis la fermer, lancer le mini-jeu | Aucun nom ne gêne, aucune erreur dans la console |
| 10 | Avec `?debug`, zoomer rue de Boigne sans bouger | Compteur « repos (30 max) » ; appels de rendu augmentés d'au plus quelques unités |
| 11 | Téléphone ou fenêtre à 320 px | Noms lisibles, pas de dépassement |

### Résultat du 01/10/2026 (Chrome avec carte graphique, `npm run dev`)

| # | Résultat | Détail |
|---|----------|--------|
| 1 | ✅ | Vue d'ensemble (2 844 m) : groupe invisible, texture non construite |
| 2 | ✅ | Opacité 0,11 à 295 m, 0,56 à 255 m, 1 à 195 m ; noms à plat dans le sens de la rue (rue de Boigne) — caméra placée par script, pas à la molette |
| 3 | 🟡 | Lisibles à 90 m, jamais à l'envers ; le zoom maximum (70 m) n'a été relevé que par l'opacité (1) |
| 4 | ✅ | 0 dès 345 m ; groupe masqué |
| 5 | 🟡 | Stable par construction (fonction continue de la distance) ; non observé à l'écran |
| 6 | 🟡 | Quai Sénateur Antoine Borrel (long, vue du dessus) et rue Saint-Réal lisibles ; **la Leysse et un pont n'ont pas été regardés** |
| 7 | ✅ | 23 h : lisibles (clair sur fond sombre), en vue oblique et vue du dessus |
| 8 | 🟡 | Non cliqué : lu dans le code (les raycasts ne visent que des listes explicites) |
| 9 | ❌ | Non joué (fiche de lieu, mini-jeu) ; aucune erreur ni avertissement console pendant les essais |
| 10 | ✅ | « repos (30 max) » ; 62 → 63 appels de rendu avec les noms, triangles inchangés |
| 11 | ❌ | Non joué (téléphone, 320 px) |

**Rejoué le 01/10/2026 après le correctif du rendu** (étapes 2 et 3) : noms entiers (début et fin visibles), nets au zoom, toujours de gauche à droite en tournant la vue de 180° ; étape 7 (nuit, 23 h) rejouée : lisibles.

Contrôle des données : `npm run check:streets` passe (182 noms) et échoue sur une copie cassée (7 erreurs, sortie 1).

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Le scénario est un fichier de ce dossier, pas un script ; il est joué à la clôture de chaque user story et de l'epic |
| R2 | Ce qui n'est pas vérifié est dit explicitement dans le CHANGELOG (règle projet n° 6) : ex. téléphone réel, GPU |
| R3 | Le contrôle de données (Q5) est un petit script Node (`scripts/`), lancé avec `npm run data` ou à part ; il ne modifie jamais `city.json` |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Étape échouée | Une anomalie est notée dans le BACKLOG, la US concernée repasse en cours |
| Rendu logiciel lent | Les étapes d'affichage sont jugées, pas les temps |
| Police absente | Étape 3 : police de secours lisible |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |
| Complexité | Simple |

---

## Checklist dev

- [ ] Scénario relu par Dasco
- [ ] Scénario joué, résultats dans le CHANGELOG
- [x] Contrôle de données ajouté (si Q5 retenue)
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🟡 Livrée (itération 60), à valider par Dasco
