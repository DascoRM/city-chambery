# Plan EP005 « Balade avec un avatar » (planifié, pas commencé)

Rédigé le 02/10/2026 par l'agent principal, à partir de trois analyses d'agents chercheurs (annexes ci-dessous). **Aucune ligne de code n'est écrite** : la spec doit d'abord être validée par Dasco (règle du projet). Spec : [`specs/epics/EP005-balade-avatar/epic.md`](../specs/epics/EP005-balade-avatar/epic.md).

## En une page

- **Quoi** : un avatar qu'on dirige au clic ou au toucher, vue 3/4 façon Diablo, caméra qui suit, bâtiments qui s'effacent devant lui.
- **Combien** : 44 points, **8 à 12 sessions** (1 session ≈ une demi-journée de travail), très incertain sur le mobile et sur l'effacement.
- **Comment on avance sans se tromper** : un **prototype d'abord** (US001 à US004 en version minimale, 1 à 1,5 session), puis on **décide** avant d'investir dans le reste.
- **Pas commencé** : branche `docs/EP005-balade-avatar-spec` (documents seulement).

## Jalons et ordre

| Jalon | Contenu | Sessions | Sortie |
|---|---|---|---|
| **J0 · Décisions** | Dasco répond aux questions Q1 à Q11 de l'epic (au moins Q1, Q2, Q3, Q6, Q11 avant le prototype) | — | Spec validée, réponses notées dans l'epic |
| **J1 · Prototype** | US001 (réseau, chemin) + US002 (avatar) + US003 (caméra) + US004 (entrées), version minimale : formes simples, vitesse fixe, point de départ fixe, **sans** effacement, clavier, sauvegarde ni fiches | 1 à 1,5 | **Go / no-go de Dasco** sur la sensation (taille de l'avatar, angle, vitesse) |
| **J2 · Jouable** | US005 (effacement des bâtiments, le plus incertain : le mesurer d'abord) + US006 (marcher jusqu'à un lieu) | 2 à 4 | Une vraie balade, lieux compris |
| **J3 · Finition** | US007 (sauvegarde), US008 (clavier, accessibilité), US009 (téléphone), US010 (lobby, aide, docs), US011 (scénario et contrôle automatique) | 3 à 4 | Epic livrable ; revue de Dasco |
| **Plus tard** | US012 (éléphants), effacement « bâtiment entier » (phase 2, +1 session), « Voir d'ici » | — | À ouvrir par Dasco |

Une branche par user story : `feat/EP005-US00X-<description>`. Chaque US se clôt comme une itération (FEATURES, BACKLOG, CHANGELOG avec « Vérifié » et « Non vérifié », DECISIONS).

## Prototype (J1) : critères de sortie

- `npm run build` passe ; aucune erreur console
- 50 destinations aléatoires : l'avatar n'est jamais dans un bâtiment ni dans l'eau, jamais hors réseau
- Marche : ≥ 55 images/s sur le Mac (référence 59,8) ; repos : « repos (30 max) » ; au plus +6 appels de rendu et +0,05 M de triangles
- Dasco joue 5 minutes et dit : on continue, on change l'angle ou la vitesse, ou on arrête

## Ordre des tâches techniques (fusion des trois analyses)

1. **Diagnostic du réseau** (script jetable) : pourquoi la rive nord-est (982 nœuds) est coupée ; où se rattachent les 8 lieux ; décision sur `avoidWater` / lignes d'eau `covered`. Si les données doivent changer : `scripts/` puis `npm run data -- --offline`.
2. **Réseau partagé** : un seul graphe pour passants et avatar (pas de 3e construction ≈ 0,5 s) ; index d'accrochage ; `pointInBuilding` pour le dernier mètre.
3. **Chemin** : accrochage (refus à plus de 40 m), A* avec nœuds virtuels, arrondi des angles, replanification.
4. **Avatar** : silhouette des passants ×2, ombre en tache, anneau d'arrivée, `moving()`, réglages `avatar.json`.
5. **Caméra** : suivi par translation du rig, suivi suspendu pendant un vol, dénivelé, limites propres au mode balade, boutons Balade / Vue libre / Retrouver.
6. **Entrées** : priorité éléphant > gemme > sol ; double toucher désactivé en balade ; un toucher = une action.
7. **Effacement** : `cutaway.ts` (uniformes, instances) ; bâtiments, arbres, monuments ; silhouette.
8. **Lieux** : marcher puis ouvrir ; plus de `flyTo` en balade.
9. **Sauvegarde, clavier, mobile, lobby, tests**, dans cet ordre.

## Budget de performance (à tenir à chaque US)

| Mesure | Départ (mesuré) | Limite |
|---|---|---|
| Appels de rendu | 63 | +6 au plus |
| Triangles | 1,45 à 1,51 M | +0,05 M au plus |
| Images/s en marche (Mac GPU) | 59,8 en glissant la carte | ≥ 55 |
| Images/s au repos | 30 | 30 |
| Chargement (Mac, dev) | ≈ 4,8 s | +0,2 s au plus |
| Téléphone | **aucune mesure** | ≥ 30 images/s à confirmer sur le téléphone de Dasco |

La caméra qui suit force la pleine vitesse pendant la marche (comme glisser la carte) : voulu. Piège : un lissage qui ne s'arrête jamais garderait la pleine vitesse au repos : seuil d'arrêt franc.

## Arbitrages entre les trois analyses

| Sujet | Les analyses disaient | Retenu dans la spec |
|---|---|---|
| Découpage | 7 US (avatar), 10 US (intégration) | **12 US** : fusion, effacement et accessibilité séparés |
| Limites de la caméra | « ne pas toucher 70 m / 30 m en v1, essai à 45 m » / « limites propres 25-60 m » | **Limites propres au mode balade** ; départ 70 m / plancher 30 m, essai à ≈ 45 m ; carte libre inchangée |
| Doigt qui glisse sur téléphone | « déplacer la carte et quitter le suivi » / « pivoter autour de l'avatar » | **Question Q6 pour Dasco**, à tester sur son téléphone |
| Effacement | 5 techniques comparées | **Cutaway en shader + silhouette** ; bâtiment entier seulement en phase 2 |
| Double toucher mobile | désactiver en balade / différer 320 ms | **Désactiver en balade** (latence mauvaise pour un jeu) |
| Documents périmés | PERF-AUDIT et FEATURES disent « ≈ 2 400 appels » | Mesuré : 63. À corriger en US010 |

## Risques principaux

| Risque | Gravité | Parade |
|---|---|---|
| Fluidité sur téléphone, jamais mesurée | Élevée | Prototype mesuré sur le téléphone de Dasco (Q11) |
| Coût de l'effacement (`discard` sur GPU mobile à tuiles) | Élevée | Mesurer avant de s'engager ; repli : coupure d'altitude simple |
| Conflits de caméra (`flyTo`, journal, boussole, lobby, plancher) | Élevée | Un seul propriétaire à la fois (US003) |
| Une partie de la carte inaccessible | Haute | Diagnostic en tête (US001) |
| Gestes tactiles | Moyenne | Double toucher désactivé, test sur appareil |
| Avatar enterré après un changement de données | Moyenne | Validation de la position sauvegardée |

## Ce qui n'est PAS décidé

Les réponses de Dasco aux questions de l'epic, le téléphone de référence, le texte du lobby, et si la balade devient un jour le mode par défaut.

## Annexes (analyses des agents chercheurs)

- [Avatar, déplacement et caméra](ep005-avatar-deplacement-plan.md)
- [Effacement des bâtiments](ep005-effacement-batiments-plan.md)
- [Intégration, performance, qualité (scénario de test de 19 étapes)](ep005-integration-perf-plan.md)
