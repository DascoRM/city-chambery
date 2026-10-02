# EP005 - US010 - Présenter la balade (lobby, aide) et mettre la documentation à jour

## User Story

**En tant que** visiteur et développeur,
**je veux** que la balade soit annoncée et expliquée, et la documentation à jour,
**afin de** trouver la balade et savoir s'en servir.

---

## Critères d'acceptation

- [ ] **Given** le lobby, **When** je le lis, **Then** une carte « Balade » présente le mode, qui s'ouvre depuis la carte (texte de `lobby.json`, à compléter par toi)
- [ ] **Given** l'aide à l'écran, **When** je suis en balade, **Then** elle dit « Touche pour marcher » (tactile) ou « Clique pour marcher » (souris)
- [ ] **Given** la documentation, **When** la balade est livrée, **Then** FEATURES, BACKLOG, CHANGELOG, DECISIONS (réseau partagé, caméra par translation du rig, technique d'effacement) et README sont à jour
- [ ] **Given** PERF-AUDIT, **When** je le relis, **Then** il donne les appels de rendu **par vue** (mesurés le 02/10/2026 : 2 406 en vue d'ensemble, 630 à 732 près des monuments, 63 dans les rues) et le budget de la balade s'y réfère

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Aucun asset tiers : pas de licence à ajouter (règle projet 5) |
| R2 | Textes en tutoiement, sans fait inventé |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Balade absente (désactivée) | Le lobby ne la mentionne pas |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |
| Complexité | Simple |

---

## Checklist dev

- [ ] `lobby.json`, `ui.ts`
- [ ] Documents de suivi
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
