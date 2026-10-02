# EP005 - US011 - Un scénario de test et un contrôle automatique du déplacement

## User Story

**En tant que** développeur du diorama,
**je veux** un scénario écrit et un parcours automatique qui vérifient la balade,
**afin de** rejouer la vérification après chaque modification.

---

## Critères d'acceptation

- [ ] **Given** l'epic terminée, **When** je cherche le scénario, **Then** il est dans ce fichier : 19 étapes numérotées, chacune avec son résultat attendu (proposition de l'analyse : `docs/tasks/ep005-integration-perf-plan.md`, section « Scénario de test proposé »)
- [ ] **Given** le scénario, **When** Claude le joue (Chrome avec carte graphique), **Then** chaque étape est consignée réussie, échouée ou non vérifiée dans le CHANGELOG
- [ ] **Given** un parcours automatique via `window.diorama`, **When** je lance 50 destinations aléatoires et toutes les ✦, **Then** l'avatar n'est jamais dans un bâtiment (avec cours), jamais dans l'eau hors pont, jamais hors réseau (< 0,5 m), jamais sous le sol ou en l'air (`|y − heightAt|` < tolérance), arrive à chaque destination, et il n'y a aucune erreur console
- [ ] **Given** un contrôle de données comme `npm run check:streets`, **When** je le lance, **Then** les 8 ✦ et la position de départ sont atteignables (dans la grande composante)
- [ ] **Given** la cadence, **When** je relève `?debug`, **Then** marche ≥ 55 images/s (Mac GPU), repos 30, au plus +6 appels et +0,05 M de triangles

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Le projet n'a pas de test automatisé : la vérification passe par `npm run build` et le navigateur |
| R2 | Comment partager `walkways.ts` (TypeScript) avec un script Node : **non vérifié** ; pistes : exécuter le contrôle dans le navigateur de test, ou un petit module commun |
| R3 | Ce qui n'est pas automatisable est dit « non vérifié » : fluidité ressentie, lisibilité, confort de la caméra, gestes sur téléphone, lecteur d'écran |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Étape échouée | Anomalie au BACKLOG, la US concernée repasse en cours |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Scénario recopié ici
- [ ] Script de parcours
- [ ] Contrôle de données
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
