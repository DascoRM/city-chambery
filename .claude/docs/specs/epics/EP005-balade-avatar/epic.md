# Epic EP005 - Balade avec un avatar

**Statut : 📝 spec rédigée le 02/10/2026 et complétée par les décisions de Dasco du même jour. À valider, puis prototype. Planifiée, pas commencée.** Plan : [`.claude/docs/tasks/ep005-plan.md`](../../../tasks/ep005-plan.md). Branche d'epic : `feat/EP005-balade-avatar`.

## Résumé
Un **mode balade** : on y entre et on en sort. Dedans, un petit personnage qu'on déplace en touchant ou cliquant dans la ville, **vue 3/4 de dessus façon Diablo / League of Legends**, la caméra le suit, et **les bâtiments qui le masquent disparaissent**. L'interface y est restreinte et on peut y faire des choses qu'on ne fait pas dans la carte libre, sans conflit entre les deux.

---

## Contexte & Problème
Retour d'un utilisateur : se promener dans la ville avec un avatar, en vue à la première personne ou façon Diablo. Aujourd'hui on survole la maquette avec une caméra libre ; on découvre les lieux en cliquant des ✦ à distance. Un avatar donne un but (aller quelque part), une échelle humaine et un jeu de découverte (marcher jusqu'à un lieu pour l'ouvrir), en cohérence avec la piste B du lobby (« ça fait plus jeu »).

---

## Décisions de Dasco

### 02/10/2026, premier échange
| Sujet | Décision |
|---|---|
| Type de vue | **Mode Diablo / LoL** : 3/4 de dessus, clic pour aller, caméra qui suit. **Pas de vue à la première personne** |
| Masquage | Les **bâtiments qui masquent le personnage disparaissent** |
| Process | Analyse par des agents ; spec et plan écrits, **rien de codé** |

### 02/10/2026, réponses aux questions
| Sujet | Décision |
|---|---|
| **Un mode balade explicite et unique** | On entre dans le mode et on en sort. **Les limites de zoom et la caméra de balade n'existent que dans ce mode.** Un mode exclusif permet de faire des choses qu'on n'a pas dans la carte libre, **sans conflit** |
| Interface | **Restreinte en mode balade.** La boussole « n'a pas de réel intérêt pour le moment » : elle est masquée. Quelles autres commandes restent : à voir au prototype |
| Taille et vitesse de l'avatar | **À moi de les fixer** (×2 et ≈ 14 m/s au départ) ; on les réglera aux tests, en réel |
| Effacement | **Au début, les bâtiments entiers** (par identifiant de bâtiment), pas un trou en pointillé. **Ensuite, une itération** pour masquer les bâtiments « en vue » **uniquement dans ce mode** (US013) |
| Arbres | **Pas d'effacement** (« pas pertinent ») |
| Monuments | **Ils s'effacent** (disparaissent comme les bâtiments) ; la transparence façon Diablo reste une alternative à comparer au prototype ; une **liste d'exceptions** est prévue (précisé le 02/10 : « il faut partir sur les bâtiments s'effacent, ça c'est sûr ») |
| Fiches des lieux | **À revoir en mode balade** (surtout sur mobile, où elles perturbent) ; on les garde, la forme est à définir |
| Gestes sur téléphone | **Rester sur ce qui existe sur mobile** (League of Legends mobile et jeux de ce style) : toucher pour aller, ou croix directionnelle ; **à définir à l'usage, pas bloquant** |
| Éléphants | **On garde le clic sur les éléphants** : en croiser un doit rester amusant |
| Relief et escaliers | **Gros point d'attention** (« un des points les plus pénibles ») ; pas bloquant pour la démo |
| « Recommencer l'exploration » | L'avatar **retourne à son point de départ** ; **définir un point de départ** pour l'exploration |
| Clavier | **Non visé : on vise le clic souris** (et le toucher) |
| Accessibilité | **Réduire les animations** et **silhouette contrastée** : oui ; le Journal reste l'équivalent pour le web |
| Téléphone de référence | **iPhone 12 Pro**, en 5G ou Wi-Fi. Retours d'utilisateurs : la carte se charge très bien et reste fluide **même en 4G** |
| **Première mesure sur téléphone** (Dasco, 02/10, iPhone 12 Pro, `?debug`) | **≤ 31 images/s, même en poussant les gestes**, et **750 à 1 000 appels de rendu** au plus ; Dasco n'y voit pas de contrainte. À comprendre : un plafond à ≈ 31 en mouvement n'est pas normal (le code monte à ≈ 60 en mouvement sur Mac) : mode économie d'énergie de l'iPhone, ou téléphone qui n'arrive pas à tenir plus (voir plan) |
| Git | **Une branche d'epic dédiée** (`feat/EP005-balade-avatar`) pour itérer ; on fusionne dans `main` au besoin ; les corrections de `main` se reportent par **rebase** |

**Pourquoi pas la première personne** (analyse du 02/10) : au niveau de l'œil, les 2 067 volumes extrudés sans textures ne tiennent pas ; il faudrait refaire ombres, ciel, effet maquette, collisions, commandes tactiles : 5 à 8 sessions, et le produit changerait de nature. Reprise possible plus tard sous forme d'un bouton « Voir d'ici » (caméra basse, sans marcher).

---

## Objectifs
- Un **mode balade** qu'on entre et qu'on quitte, avec sa caméra, ses limites de zoom et son interface propres
- Un avatar lisible, qu'on dirige par clic ou toucher, qui suit les rues sans traverser un bâtiment ni l'eau
- Un avatar toujours visible : les bâtiments (entiers) et monuments qui le masquent s'effacent
- Marcher jusqu'à un lieu d'histoire pour ouvrir sa fiche, avec des fiches adaptées au mode
- Aucune perte de fluidité (voir le budget, **par vue**), mobile compris
- La carte libre reste inchangée

---

## Hors scope
- Vue à la première personne
- Contrôle au clavier (on vise la souris et le toucher)
- Avatar animé en détail (personnages animés abandonnés : EP001-US010) ; modèle tiers
- Navigation libre sur les places (surfaces) : l'avatar marche sur les rues, avec un « dernier mètre » d'au plus 15 m
- Passages sous porche (aucune donnée aujourd'hui)
- Multijoueur, comptes
- Avatar qui attrape les éléphants (US012, optionnelle, plus tard)

---

## User Stories

| ID | User Story | Priorité | Points | Dépend de | Status |
|----|------------|----------|--------|-----------|--------|
| [US001](US001-reseau-et-chemin.md) | Un réseau de déplacement partagé et un chemin jusqu'au point cliqué | High | 5 | — | 🟡 Fait, à valider |
| [US002](US002-avatar-visible.md) | Un avatar visible, lisible à toutes les distances | High | 5 | US001 | 🟡 Fait, à valider |
| [US003](US003-camera-qui-suit.md) | Un mode balade : caméra qui suit, limites et interface propres | High | 5 | US002 | 🔲 Todo |
| [US004](US004-entrees.md) | Cliquer ou toucher pour aller, sans casser les gestes actuels | High | 5 | US001, US003 | 🔲 Todo |
| [US005](US005-effacement-des-batiments.md) | Les bâtiments entiers et les monuments qui masquent l'avatar s'effacent | High | 13 | US002, US003 | 🔲 Todo |
| [US006](US006-decouverte-des-lieux.md) | Marcher jusqu'à un lieu d'histoire, avec des fiches adaptées au mode | Medium | 5 | US004 | 🔲 Todo |
| [US007](US007-sauvegarde-de-la-position.md) | Un point de départ, et retrouver son avatar là où on l'a laissé | Medium | 2 | US001 | 🔲 Todo |
| [US008](US008-accessibilite.md) | Une balade accessible : animations réduites, silhouette contrastée | Medium | 2 | US002 | 🔲 Todo |
| [US009](US009-mobile-fluidite-et-gestes.md) | Une balade fluide et confortable sur téléphone | High | 3 | US004 | 🔲 Todo |
| [US010](US010-lobby-aide-documentation.md) | Présenter la balade (lobby, aide) et mettre la documentation à jour | Medium | 2 | US003 | 🔲 Todo |
| [US011](US011-cas-de-test.md) | Un scénario de test et un contrôle automatique du déplacement | Medium | 3 | US001 à US007 | 🔲 Todo |
| [US012](US012-avatar-et-elephants.md) | L'avatar et les éléphants (optionnelle, plus tard) | Low | 3 | US004 | ⏳ Plus tard |
| [US013](US013-masquer-les-batiments-en-vue.md) | Masquer les bâtiments « en vue » dans le mode balade (itération suivante) | Low | 5 | US005 | ⏳ Plus tard |

**Total : 50 points hors US012 et US013 (≈ 9 à 13 sessions).** Le **jalon prototype** (US001 à US004 en version minimale, ≈ 1 à 1,5 session) sert à décider avant d'investir dans le reste : voir le plan.

---

## Flux principal
```
Carte libre (comme aujourd'hui) → bouton « Balade » → on entre dans le mode : interface restreinte,
l'avatar apparaît à son point de départ, la caméra descend derrière lui
→ je clique une rue : un anneau marque l'arrivée, l'avatar y va en suivant les rues, la caméra le suit
→ un bâtiment lui masque la vue : il disparaît en entier, l'avatar reste visible
→ je clique une ✦ : il y marche, la fiche s'ouvre à l'arrivée
→ « Vue libre » : je sors du mode, la carte libre reprend (limites et interface d'origine), l'avatar attend
```

---

## Règles métier de l'epic
1. **Un mode explicite et unique** : on entre, on sort. Caméra, limites de zoom, interface et entrées propres au mode ; la carte libre ne change pas
2. **Un seul propriétaire de la caméra à la fois** : suivi, vol (`flyTo`), lobby, journal s'arbitrent par le mode
3. **Priorité d'un clic court** : outil de placement (dev) → éléphant → gemme ou épingle → sol (marcher). Un glisser garde son sens actuel. Un toucher = une seule action
4. **Rien d'inventé** (règle projet 1) : les positions des lieux ne changent pas
5. **Pas d'ombre portée pour l'avatar** (carte d'ombres statique) : ombre en tache, comme les passants et les éléphants
6. **Réglages dans `src/content/avatar.json`** (échelle, vitesse, foulée, couleur, rayon d'accrochage, caméra, effacement, point de départ) : rien en dur dans les shaders (règle BUG-01 : uniformes)
7. **Budget de performance, mesuré par vue** (le compteur varie beaucoup d'une vue à l'autre : 2 406 appels en vue d'ensemble, 630 à 730 près des monuments, 63 dans les rues) : au plus +6 appels de rendu **par rapport à la même vue**, +0,05 M de triangles, ≥ 55 images/s en marche sur Mac, 30 au repos, +0,2 s de chargement
8. **Pas d'asset tiers** : silhouette en formes simples (sinon licence au README, règle projet 5)
9. **Git** : branche d'epic `feat/EP005-balade-avatar` ; une branche par user story `feat/EP005-US00X-<description>` fusionnée dans la branche d'epic ; `main` n'est fusionné qu'au besoin ; les correctifs de `main` se reportent par rebase

---

## Points restant à préciser

| # | Point | Proposition |
|---|-------|-------------|
| P1 | ✅ **Tranché (02/10)** : les bâtiments s'effacent, les monuments aussi (effacés, transparence à comparer), les arbres restent ; liste d'exceptions dans `avatar.json`, vide au départ | — |
| P2 | **Silhouette de l'avatar à travers ce qui reste devant** (comme Diablo) ? | Oui, discrète — **Tranché (Dasco, 03/10) :** pour l'instant une silhouette standard (forme simple) ; un modèle OBJ viendra après |
| P3 | ✅ **Tranché (02/10)** : le point de départ est la **fontaine des Éléphants** | — |
| P4 | **Interface du mode balade** : quelles commandes gardent leur place (Journal, heure, saisons, légende des lieux) ? | Garder le Journal, l'heure et les points ; masquer la boussole et la légende ; à voir au prototype — **Tranché (Dasco, 03/10) :** web = **clic gauche pour déplacer l'avatar, clic droit pour déplacer la carte (caméra)** ; mobile = un doigt pour déplacer l'avatar, deux doigts pour zoomer / déplacer la caméra (validé) |
| P5 | **Fiches des lieux en balade** : quelle forme (surtout sur mobile) ? | Une maquette avant de coder (comme pour le lobby) — **Ouvert (Dasco ne sait pas encore)** : maquette avant de coder |
| P6 | **Geste sur téléphone** : toucher pour aller, ou croix directionnelle ? | Toucher pour aller d'abord ; à tester sur ton iPhone — **Tranché (Dasco, 03/10) :** voir P4 (toucher pour aller, deux doigts pour la caméra) |
| P7 | **Relief et escaliers** : l'avatar monte-t-il les escaliers ? | Oui ; le relief est le gros point d'attention (pente, caméra) — **Tranché (Dasco, 03/10) :** pas pour la démo, à voir au fonctionnement |
| P8 | **Autres téléphones** à tester en plus de l'iPhone 12 Pro ? | Un modèle plus ancien, plus tard — **Ouvert (Dasco ne sait pas)** : un modèle plus ancien, plus tard |

---

## Critères d'acceptation
- [ ] US001 à US011 livrées (US012 et US013 en option, plus tard)
- [ ] `npm run build` passe
- [ ] Scénario de test de l'US011 rejoué, résultats dans le CHANGELOG (réussi, échoué, non vérifié)
- [ ] Mesuré : images/s au repos et en marche, appels de rendu par vue, triangles, chargement, dans le budget ; relevé sur l'iPhone 12 Pro (`?debug`), **après avoir compris le plafond de ≈ 31 images/s en mouvement**
- [ ] Revue PO validée par Dasco, sur le prototype puis sur le rendu final

---

## Estimation globale
- **Complexité** : L
- **Effort estimé** : 9 à 13 sessions (prototype 1 à 1,5). Incertain : le relief et les escaliers, l'effacement par bâtiment (2 à 3 sessions), le réglage de la caméra (plusieurs allers-retours, comme pour les noms de rues), le téléphone (jamais mesuré)

---

## Annexes (analyses des agents, 02/10/2026)
- [Avatar, déplacement et caméra](../../../tasks/ep005-avatar-deplacement-plan.md)
- [Effacement des bâtiments](../../../tasks/ep005-effacement-batiments-plan.md)
- [Intégration, performance, qualité](../../../tasks/ep005-integration-perf-plan.md)

---

**Version** : v1.1 (décisions du 02/10 intégrées)
**Créé le** : 02/10/2026
