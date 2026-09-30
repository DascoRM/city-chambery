# EP001 - US003 - Des fenêtres qui s'allument et s'éteignent au fil de la soirée

## User Story

**En tant que** visiteur qui regarde la ville la nuit,
**je veux** voir les fenêtres s'allumer à la tombée du jour puis s'éteindre peu à peu dans la nuit,
**afin que** la ville semble habitée par des gens qui rentrent, veillent et dorment.

---

## Critères d'acceptation

- [ ] **Given** la carte à 18 h 30 un soir d'hiver (nuit tombée), **When** je regarde les façades, **Then** une partie des fenêtres est allumée (environ un tiers, selon la courbe)
- [ ] **Given** la lecture ▶ d'une nuit, **When** l'heure passe de 22 h à 4 h, **Then** les fenêtres s'éteignent une à une, sans clignoter : une fenêtre éteinte ne se rallume pas avant le matin
- [ ] **Given** la carte à 4 h, **When** je compare à 21 h, **Then** il y a nettement moins de fenêtres allumées
- [ ] **Given** la carte à 7 h un matin d'hiver (encore sombre), **When** je regarde les façades, **Then** quelques fenêtres se rallument
- [ ] **Given** la carte en plein jour, **When** je regarde les façades, **Then** aucune fenêtre n'est lumineuse (comme aujourd'hui)
- [ ] **Given** l'heure réelle (mode Direct), **When** une minute passe, **Then** les changements restent très discrets, quelques fenêtres à la fois
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** le nombre d'appels de rendu et de triangles est identique

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Aujourd'hui la part de fenêtres allumées est `uLit = 0,15 + 0,2 × nuit` (`src/scene/daynight.ts`) : elle ne dépend que du soleil, donc constante une fois la nuit installée. Le shader des fenêtres (`windowsMaterial`, `src/scene/city.ts`) allume une fenêtre quand son hachage est sous `uLit` : **faire varier `uLit` suivant l'heure suffit pour que les fenêtres changent d'état une à une**, sans nouvelle donnée |
| R2 | La part allumée suit une **courbe horaire** de `life.json` (`windows.litCurve`, interpolée). Proposition de départ : 0 h 20 % · 2 h 10 % · 4 h 5 % · 6 h 12 % · 7 h 20 % · 9 h 10 % · 16 h 15 % · 18 h 35 % · 22 h 40 % · 24 h 25 % (à régler à l'œil) |
| R3 | La luminosité reste multipliée par `uNight` : la courbe décide *combien* de fenêtres sont allumées, le soleil décide si on les voit (en hiver, 17 h est déjà sombre ; en été 19 h ne l'est pas) |
| R4 | Un même hachage par fenêtre : l'ordre d'extinction est stable d'un jour à l'autre (pas de tirage au hasard à chaque image) |
| R5 | Aucun nouveau maillage, aucun nouvel appel de rendu : seule la valeur d'un uniforme change |
| R6 | Les monuments éclairés (château, cathédrale, Carré Curial, fontaine) et les halos des lieux ouverts ne changent pas |

---

## Rendu

**Écran** : la carte, de nuit.

| État | Description |
|------|-------------|
| Crépuscule | Les premières fenêtres s'allument avec la baisse du soleil (`uNight`) |
| Soirée | Environ 35 à 40 % de fenêtres allumées |
| Nuit profonde | Quelques fenêtres isolées (5 à 10 %) |
| Aube | Un léger regain avant le jour, puis extinction |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Curseur d'heure tiré vite | Les fenêtres changent en même temps que le curseur, sans retard ni saut |
| Été | Nuit courte : la courbe s'applique, on ne voit que les heures sombres |
| Changement de saison forcé | Même courbe ; seule l'heure du coucher change ce qu'on voit |
| Valeur de la courbe hors de 0 à 1 | Ramenée dans l'intervalle au chargement |

---

## Dépendances et existant réutilisé
`daynight.ts` (`uLit`, `uNight`), `windowsMaterial` dans `city.ts`, `clock`.

## Vérification
Captures à 18 h 30, 22 h, 4 h, 7 h en décembre, et 22 h en juillet ; lecture ▶ d'une nuit complète ; `?debug` avant / après. Les captures en rendu logiciel sont trop lentes : utiliser Chrome avec la carte graphique.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |
| Complexité | Simple |

---

## Checklist dev

- [ ] Code implémenté (`daynight.ts`, `life.json`)
- [ ] `npm run build` passe
- [ ] Vérifié à 4 heures différentes et en lecture ▶
- [ ] README (courbe) et clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
