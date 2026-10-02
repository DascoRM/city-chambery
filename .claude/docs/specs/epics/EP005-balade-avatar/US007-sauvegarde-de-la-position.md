# EP005 - US007 - Un point de départ, et retrouver son avatar là où on l'a laissé

## User Story

**En tant que** visiteur,
**je veux** partir d'un point de départ défini, et retrouver mon avatar à sa place quand je reviens,
**afin de** reprendre ma balade sans repartir de zéro, ou recommencer proprement.

---

## Critères d'acceptation

- [ ] **Given** le mode balade lancé pour la première fois, **When** j'entre, **Then** l'avatar apparaît au point de départ défini (P3, par défaut la fontaine des Éléphants), réglable dans `avatar.json`
- [ ] **Given** l'avatar à l'arrêt, **When** je recharge la page, **Then** il est au même endroit (clé `chambery-diorama:avatar:v1`)
- [ ] **Given** une position sauvegardée, **When** les données de la ville ont changé (`npm run data`), **Then** le point est contrôlé (sur le réseau, hors bâtiment, hors eau) et, s'il est invalide, l'avatar revient au point de départ
- [ ] **Given** « Recommencer l'exploration », **When** je le choisis, **Then** les lieux sont remis à zéro et l'avatar **retourne à son point de départ** ; les points ne bougent pas
- [ ] **Given** un stockage bloqué (navigation privée), **When** je me promène, **Then** rien ne casse (repli silencieux)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Écriture à l'arrêt de la marche, pas à chaque image ; `{x, y}` en mètres, éventuellement le cap |
| R2 | Même modèle que `src/state/*` (`try/catch`) |
| R3 | Le point de départ est accroché à la grande composante du réseau (US001) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Plusieurs onglets | Dernière écriture gagne |
| Sauvegarde en carte libre | Aucun avatar créé : rien à sauvegarder |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |
| Complexité | Simple |

---

## Checklist dev

- [ ] `src/state/avatar.ts`
- [ ] Point de départ dans `avatar.json`
- [ ] Contrôle de validité au chargement
- [ ] `onReset` mis à jour
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
