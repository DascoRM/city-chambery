# EP009 - US007 - Neige (flocons, sol, toits, arbres)

## User Story

**En tant que** visiteur,
**je veux** voir la neige tomber et blanchir les toits, les rues et les arbres,
**afin de** voir Chambéry sous la neige.

---

## Critères d'acceptation

- [x] **Given** `?weather=snow`, **Then** des flocons tombent lentement, avec une légère dérive (2 appels de rendu au plus) *(1 en vue d'ensemble et en rue, 2 entre 400 et 700 m, où les deux nappes se relaient ; « pluie et neige » : 2 à 4)*
- [x] **Given** de la neige, **Then** toits, sol, parcs et canopées blanchissent selon la pente (les façades non), en gardant la palette pastel ; vérifié dans chaque vue (ensemble, Carré Curial, château, rue) *(pleinement sous 45°, rien au-delà de 73° : les toits très pentus, clochers, restent sombres ; captures de l'agent regardées, rendu à juger par Dasco)*
- [x] **Given** les matériaux concernés (12), **Then** un seul morceau de GLSL commun, posé au démarrage : aucun à-coup à l'arrivée de la neige *(arrivée : +1 programme, celui des flocons, aucun si la pluie est déjà venue ; aucun pendant l'accumulation ; pire image 18 à 46 ms ; au démarrage, +1 programme (45 → 46) : les têtes des passants partageaient celui des houppiers)*
- [x] **Given** `?weather=sleet` (pluie et neige), **Then** gouttes et flocons mêlés *(sol en partie blanc et mouillé)*
- [x] **Given** la neige d'hiver demandée au BACKLOG (« Hiver : reprendre les arbres », arbres enneigés plutôt que nus), **Then** traitée ici ou reportée explicitement *(quand il neige, tous les arbres se coiffent de blanc ; des arbres enneigés sans neige qui tombe : reporté, question posée à Dasco)*

---

## Règles métier
Voir l'[epic](epic.md), règles 6, 8 et 9.

| Règle | Description |
|-------|-------------|
| R1 | Flocons : même système GPU et même programme que la pluie (sprites ronds, chute ≈ 6 fois plus lente, balancement propre à chaque flocon, dérive au vent) ; 800 / 1 500 / 3 000 **par nappe** selon le niveau de qualité (`?debug&snowmax=N`) ; même règle de dégradation que la pluie |
| R2 | Neige au sol : uniforme `uSnow` × orientation vers le haut × plaques (bruit à deux échelles, 7 m et 1,7 m) qui s'étendent avec l'accumulation, vers un blanc bleuté légèrement cassé ; une petite neige (0,2) ne couvre qu'en partie |
| R3 | 12 matériaux crochetés au démarrage (chaque matériau modifié plus tard figerait l'image) : les 4 d'US005 (rues, bâtiments et toits, sol et parcs ; chaussées à 55 %, voies piétonnes à 80 %) et 8 qui ne se mouillent pas (houppiers des arbres simples, arbres modélisés, cheminées, auvents, toits de la cathédrale, du Carré Curial et du château). Sans neige : tirets, berges, ponts, eau, troncs, fontaine des Éléphants, passants, oiseaux, repères |
| R4 | Dans le temps : la neige au sol s'accumule (τ = 30 s, tout blanc en ≈ 1 min 10) et fond (τ = 5 min) ; la carte ne connaît que la neige qui tombe (une neige tombée avant l'ouverture de la page n'apparaît pas) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 3 à 4 (≈ 2 réalisés, réglage à l'œil avec Dasco compris) |
| Complexité | Complexe |
| Dépend de | US002, US005 (système de précipitations, crochets des matériaux) |

Détail technique : [plan US007](../../../tasks/ep009-us007-plan.md) (code, mesures, captures, points à régler à l'œil), [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 4.4 et § 2.8.

---

## Checklist dev
- [x] Branche `feat/EP009-US007-neige` depuis `feat/EP009-meteo`
- [x] `npm run build` et `npm test` ; vérifié dans le navigateur avec `?weather=snow` et `?debug`, dans chaque vue (par l'agent, captures de jour et de nuit)
- [x] Fluidité : compteur `?debug` avant / après, aucune image de plus de 50 ms à l'arrivée de la neige (Mac ; aucun téléphone)
- [x] Le site marche sans la météo (lumières, fond et appels identiques)
- [x] FEATURES, CHANGELOG, DECISIONS, BACKLOG (arbres d'hiver)
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : ✅ Done (10/10/2026, itération 95) ; rendu à juger par Dasco
