# EP005 - US003 - Un mode balade : caméra qui suit, limites et interface propres

## User Story

**En tant que** visiteur,
**je veux** entrer dans un mode balade où la caméra suit mon avatar, puis en sortir quand je veux,
**afin de** me promener comme dans un jeu sans rien changer à la carte libre.

---

## Critères d'acceptation

- [ ] **Given** la carte libre, **When** je touche « Balade », **Then** j'entre dans le mode : l'avatar apparaît à son point de départ et la caméra vole vers ≈ 85 m de distance et ≈ 57° d'inclinaison (valeurs de départ à régler à l'œil)
- [ ] **Given** le mode balade, **When** je regarde l'écran, **Then** l'interface est restreinte : la boussole est masquée ; les autres commandes gardées sont celles décidées (P4)
- [ ] **Given** le mode balade, **When** je zoome, **Then** les limites de zoom sont celles du mode (essai : ≈ 45 m au plus près, plancher de 30 m conservé) ; **Given** la carte libre, **Then** ses limites (70 m, plancher 30 m) sont inchangées
- [ ] **Given** l'avatar en marche, **When** il avance, **Then** la cible et la caméra se translatent du même vecteur à chaque image (lissage), sans saccade, à pleine vitesse ; rotation et zoom restent possibles pendant la marche
- [ ] **Given** un relief (92 m de dénivelé), **When** l'avatar monte ou descend, **Then** la caméra suit le dénivelé : l'angle ne dérive pas
- [ ] **Given** un vol (`flyTo`, `zoomTo`, journal), **When** il est en cours, **Then** le suivi est suspendu et reprend à la fin ; en balade, `openPoi` ne vole plus la caméra
- [ ] **Given** un glissement de la carte, **When** je le fais (geste décidé en P6), **Then** le suivi s'arrête sans quitter le mode et un bouton « Retrouver mon avatar » le recentre par un vol
- [ ] **Given** « Vue libre », **When** je le touche, **Then** je sors du mode : caméra, limites et interface de la carte libre reviennent ; l'avatar reste où il est
- [ ] **Given** l'avatar arrêté, **When** la caméra le rattrape, **Then** elle s'arrête franchement (seuil d'arrêt) et le compteur `?debug` revient à « repos (30 max) » au bout de ≈ 0,5 s
- [ ] **Given** l'effet maquette, **When** la caméra suit, **Then** la bande nette reste sur l'avatar sans changement de code (elle vise `controls.target`)
- [ ] **Given** la caméra de balade près d'un grand bâtiment (cathédrale ≈ 25 m), **When** je regarde, **Then** on a vérifié ce que voit la caméra (près plan 5 m) et noté la limite

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Mode unique et exclusif** : un seul mode actif à la fois ; on peut s'y permettre des choses qu'on n'a pas dans la carte libre sans conflit (décision de Dasco) |
| R2 | Un seul propriétaire de la caméra : `stage.setFollow`, `stage.follow(point, dt)`, `stage.isFlying()` |
| R3 | Les passants, oiseaux, fumée et noms de rues lisent `controls.target` : ils suivent l'avatar sans changement |
| R4 | Noms de rues : une caméra proche les met tous à pleine opacité ; à regarder (encombrement), éventuellement un rayon autour de l'avatar |
| R5 | Pas de rotation automatique (réservée au lobby) ; lissage plus court si `prefers-reduced-motion` |
| R6 | Le relief est un gros point d'attention (décision de Dasco) : pente, caméra, escaliers |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Lobby rouvert par « ? » | L'avatar est en pause ; la caméra ne bouge pas |
| Fiche en tiroir bas (mobile) | Le point regardé se décale vers le haut pour que l'avatar reste visible |
| Sortie du mode pendant une marche | L'avatar s'arrête sur place |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Complexe (la caméra a déjà quatre propriétaires) |

---

## Checklist dev

- [ ] `stage.ts` : suivi, vols, dénivelé, limites par mode
- [ ] Bouton Balade / Vue libre / Retrouver, interface restreinte (`ui.ts`)
- [ ] Vérifié : vitesse maximale, rotation et zoom en marche, vols, plancher, entrée et sortie du mode
- [ ] Cadence mesurée
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🟡 Fait (itération 68), à valider par Dasco
