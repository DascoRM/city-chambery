# EP005 - US003 - Une caméra de balade qui suit l'avatar

## User Story

**En tant que** visiteur en mode balade,
**je veux** que la caméra reste derrière mon avatar en vue 3/4, tout en gardant la rotation et le zoom libres,
**afin de** me promener comme dans un jeu, puis reprendre la carte libre quand je veux.

---

## Critères d'acceptation

- [ ] **Given** la carte libre, **When** je touche « Balade », **Then** l'avatar apparaît et la caméra vole vers ≈ 85 m de distance et ≈ 57° d'inclinaison (valeurs de départ à régler à l'œil)
- [ ] **Given** l'avatar en marche, **When** il avance, **Then** la cible et la caméra se translatent du même vecteur à chaque image (lissage), sans saccade, à pleine vitesse ; rotation et zoom restent possibles pendant la marche
- [ ] **Given** un relief (92 m de dénivelé), **When** l'avatar monte ou descend, **Then** la caméra suit le dénivelé : l'angle ne dérive pas
- [ ] **Given** un vol (`flyTo`, `zoomTo`, boussole, journal), **When** il est en cours, **Then** le suivi est suspendu et reprend à la fin ; en balade, `openPoi` ne vole plus la caméra
- [ ] **Given** un glissement de la carte (clic droit, ou le geste décidé en Q6), **When** je le fais, **Then** le suivi s'arrête sans quitter la balade et un bouton « Retrouver mon avatar » le recentre par un vol
- [ ] **Given** « Vue libre », **When** je le touche, **Then** la caméra redevient entièrement libre, l'avatar attend sur place
- [ ] **Given** l'avatar arrêté, **When** la caméra le rattrape, **Then** elle s'arrête franchement (seuil d'arrêt) et le compteur `?debug` revient à « repos (30 max) » au bout de ≈ 0,5 s
- [ ] **Given** l'effet maquette, **When** la caméra suit, **Then** la bande nette reste sur l'avatar sans changement de code (elle vise `controls.target`)
- [ ] **Given** la caméra de balade, **When** elle est près d'un grand bâtiment (cathédrale ≈ 25 m), **Then** on a vérifié ce que voit la caméra (près plan 5 m) et noté la limite

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Un seul propriétaire de la caméra : `stage.setFollow`, `stage.follow(point, dt)`, `stage.isFlying()` |
| R2 | Limites propres au mode balade ; la carte libre ne change pas. Départ : distance minimale 70 m et plancher 30 m inchangés ; essai à ≈ 45 m en balade seulement (le plancher de 30 m est gardé) |
| R3 | Les passants, oiseaux, fumée et noms de rues lisent `controls.target` : ils suivent l'avatar sans changement |
| R4 | Noms de rues : une caméra proche les met tous à pleine opacité ; à regarder (encombrement), éventuellement un rayon autour de l'avatar |
| R5 | Pas de rotation automatique (réservée au lobby) ; lissage plus court si `prefers-reduced-motion` |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Lobby rouvert par « ? » | L'avatar est en pause ; la caméra ne bouge pas |
| Fiche en tiroir bas (mobile) | Le point regardé se décale vers le haut pour que l'avatar reste visible |
| Boussole | Tourne autour de l'avatar ; le suivi n'écrase pas l'animation de 0,6 s |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Complexe (la caméra a déjà quatre propriétaires) |

---

## Checklist dev

- [ ] `stage.ts` : suivi, vols, dénivelé
- [ ] Bouton Balade / Vue libre / Retrouver (`ui.ts`)
- [ ] Vérifié : vitesse maximale, rotation et zoom en marche, boussole, vols, plancher
- [ ] Cadence mesurée
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
