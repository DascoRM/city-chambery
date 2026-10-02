# EP005 - US006 - Marcher jusqu'à un lieu d'histoire, avec des fiches adaptées au mode

## User Story

**En tant que** visiteur en mode balade,
**je veux** marcher jusqu'à un lieu ✦ et voir sa fiche à l'arrivée, sous une forme qui ne me gêne pas,
**afin de** découvrir l'histoire en me promenant, y compris sur téléphone.

---

## Critères d'acceptation

- [ ] **Given** le mode balade, **When** je clique une gemme ✦, **Then** l'avatar marche jusqu'au lieu et la fiche s'ouvre à l'arrivée (à ≤ 20 m de la gemme ou au point accroché), sans `flyTo`
- [ ] **Given** un lieu mystère, **When** j'y arrive, **Then** le nom reste caché jusqu'à l'ouverture de la fiche, puis le lieu est enregistré comme découvert
- [ ] **Given** une épingle de bar ou de café, **When** je la clique en balade, **Then** l'avatar va devant l'établissement et la fiche s'épingle à l'arrivée
- [ ] **Given** le Journal, **When** je choisis un lieu en balade, **Then** l'avatar y va (ou est téléporté : à choisir), sans voler la caméra
- [ ] **Given** une fiche de lieu ou d'histoire, **When** elle s'ouvre en mode balade, **Then** elle a la forme décidée sur maquette (P5), qui ne masque pas l'avatar, notamment sur téléphone (le tiroir bas actuel de 62 % de l'écran perturbe)
- [ ] **Given** un lieu proche, **When** l'avatar passe à moins de 25 m sans clic, **Then** un signe discret apparaît (la gemme pulse), sans ouverture automatique de fiche (option)
- [ ] **Given** la carte libre, **When** je clique une gemme, **Then** le comportement actuel est inchangé (fiche immédiate et vol)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Une **maquette des fiches en mode balade** est faite avant le code (comme pour le lobby) : décision de Dasco, « on les garde, il faut voir comment » |
| R2 | Positions des lieux inchangées (règle projet 1) ; `openPoi` n'appelle plus `flyTo` en balade |
| R3 | Les 8 lieux sont à 0 à 17 m du réseau (mesuré) ; rayon de clic actuel 14 m |
| R4 | Progression inchangée (`state/progress`) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Marche interrompue par un autre clic | L'ordre de marche prime, la fiche ne s'ouvre pas |
| Lieu inatteignable | Refus lisible (US001) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 5 |
| Complexité | Medium (le design des fiches s'ajoute) |

---

## Checklist dev

- [ ] Maquette des fiches en balade, choisie par Dasco
- [ ] `main.ts` : `openPoi`, `onSelect`
- [ ] Les 8 lieux, un mystère, une épingle de bar vérifiés, sur écran de téléphone
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
