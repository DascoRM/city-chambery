# EP005 - US002 - Un avatar visible, lisible à toutes les distances

## User Story

**En tant que** visiteur en mode balade,
**je veux** voir mon petit personnage marcher, bien distinct des passants,
**afin de** le retrouver du premier coup d'œil, de près comme de loin.

---

## Critères d'acceptation

- [ ] **Given** le mode balade, **When** l'avatar est créé, **Then** il apparaît sur le point regardé (accroché à la grande composante), avec une silhouette dans le style des passants, agrandie ×2 (3,4 m)
- [ ] **Given** une caméra à 30, 70 et 150 m, **When** je regarde l'avatar, **Then** il reste repérable (≈ 38 px de haut à 150 m sur un écran de 900 px) grâce à sa couleur franche et à l'anneau au sol
- [ ] **Given** l'avatar en marche, **When** il avance, **Then** son cap est lissé, ses jambes bougent (foulée adaptée à sa vitesse) et il a un léger rebond ; à l'arrêt il reste debout, jambes immobiles
- [ ] **Given** une destination, **When** l'ordre est donné, **Then** un anneau pulse sur le point d'arrivée et disparaît à l'arrivée
- [ ] **Given** la nuit, **When** je regarde l'avatar, **Then** il est éclairé comme les passants (réagit à `uNight`), sans briller dans le noir
- [ ] **Given** `?debug`, **When** je compare avec avant, **Then** l'avatar ajoute au plus 3 appels de rendu et 0,02 M de triangles ; aucune ombre portée (ombre en tache)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Silhouette : `bodyGeometry` et `headGeometry` de `people.ts` (à exporter), fusionnées en un `Mesh`, shader de jambes partagé avec les passants |
| R2 | Couleur absente des vêtements des passants ; pas l'éléphant ; aucun modèle tiers (règle projet 5) |
| R3 | Réglages dans `src/content/avatar.json` : échelle, vitesse (≈ 14 m/s : Q2), foulée, couleur, anneau |
| R4 | Ombre : `blobShadow()` de `mascot.ts` ; jamais d'ombre portée (cartes d'ombres statiques) |
| R5 | `moving()` vrai pendant la marche, pour la cadence |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Avatar ×2 plus grand que les passants | Voulu (licence de maquettiste) : anneau et couleur le distinguent ; réglable |
| Lobby ouvert | Avatar en pause, invisible ou immobile derrière le voile |
| Hiver, nuit | Silhouette lisible (clair sur sombre) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Medium |

---

## Checklist dev

- [ ] `avatar.ts`, `avatar.json`
- [ ] Exports de `people.ts`
- [ ] Captures à 30, 70, 150 m, de jour et de nuit
- [ ] Appels de rendu comparés avec `?debug`
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
