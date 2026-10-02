# EP005 - US007 - Retrouver son avatar là où on l'a laissé

## User Story

**En tant que** visiteur de retour,
**je veux** retrouver mon avatar à sa place quand je reviens,
**afin de** reprendre ma balade sans repartir de zéro.

---

## Critères d'acceptation

- [ ] **Given** l'avatar à l'arrêt, **When** je recharge la page, **Then** il est au même endroit (clé `chambery-diorama:avatar:v1`)
- [ ] **Given** une position sauvegardée, **When** les données de la ville ont changé (`npm run data`), **Then** le point est contrôlé (sur le réseau, hors bâtiment, hors eau) et, s'il est invalide, l'avatar revient au départ
- [ ] **Given** « Recommencer l'exploration », **When** je le choisis, **Then** les lieux sont remis à zéro et l'avatar retourne au départ ; les points ne bougent pas (Q9)
- [ ] **Given** un stockage bloqué (navigation privée), **When** je me promène, **Then** rien ne casse (repli silencieux)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Écriture à l'arrêt de la marche, pas à chaque image ; `{x, y}` en mètres, éventuellement le cap |
| R2 | Même modèle que `src/state/*` (`try/catch`) |
| R3 | Position de départ fixe : le point regardé à l'entrée en balade (ou un point choisi) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Plusieurs onglets | Dernière écriture gagne |
| Sauvegarde en mode carte libre | Aucun avatar créé : rien à sauvegarder |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |
| Complexité | Simple |

---

## Checklist dev

- [ ] `src/state/avatar.ts`
- [ ] Contrôle de validité au chargement
- [ ] `onReset` mis à jour
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
