# Epic EP005 - Balade avec un avatar

**Statut : 📝 spec rédigée le 02/10/2026 (analyse par trois agents), à valider par Dasco avant de coder. Planifiée, pas commencée.** Plan : [`.claude/docs/tasks/ep005-plan.md`](../../../tasks/ep005-plan.md).

## Résumé
Un petit personnage qu'on déplace en touchant ou cliquant dans la ville, **vue 3/4 de dessus façon Diablo / League of Legends**, la caméra le suit, et **les bâtiments et toits qui le masquent s'effacent** pour qu'on le voie toujours. Un mode en plus de la carte libre actuelle.

---

## Contexte & Problème
Retour d'un utilisateur : se promener dans la ville avec un avatar, en vue à la première personne ou façon Diablo. Aujourd'hui on survole la maquette avec une caméra libre ; on découvre les lieux en cliquant des ✦ à distance. Un avatar donne un but (aller quelque part), une échelle humaine et un jeu de découverte (marcher jusqu'à un lieu pour l'ouvrir), en cohérence avec la piste B du lobby (« ça fait plus jeu »).

---

## Décisions de Dasco (02/10/2026)

| Sujet | Décision |
|---|---|
| Type de vue | **Mode Diablo / LoL** : 3/4 de dessus, clic pour aller, caméra qui suit. **Pas de vue à la première personne** |
| Masquage | Les **bâtiments ou toits qui masquent le personnage disparaissent** |
| Process | Analyse par des agents, **spec et plan écrits, rien de codé** |

**Pourquoi pas la première personne** (analyse du 02/10) : au niveau de l'œil, les 2 067 volumes extrudés sans textures ne tiennent pas ; il faudrait refaire ombres (une carte de 2048 pour 1,3 km), ciel, effet maquette, collisions, commandes tactiles : 5 à 8 sessions, et le produit changerait de nature. Reprise possible plus tard sous forme d'un bouton « Voir d'ici » (caméra basse, sans marcher).

---

## Objectifs
- Un avatar lisible, qu'on dirige par clic ou toucher, qui suit les rues sans traverser un bâtiment ni l'eau
- Une caméra qui le suit, sans casser la carte libre actuelle
- Un avatar toujours visible : bâtiments, toits et arbres qui le masquent s'effacent
- Marcher jusqu'à un lieu d'histoire pour ouvrir sa fiche
- Aucune perte de fluidité (30 images/s au repos, ≥ 55 en marche sur Mac), mobile compris
- Un mode **facultatif** : la carte libre reste le mode par défaut

---

## Hors scope
- Vue à la première personne
- Avatar animé en détail (personnages animés abandonnés : EP001-US010) ; modèle tiers
- Navigation libre sur les places (surfaces) : l'avatar marche sur les rues, avec un « dernier mètre » d'au plus 15 m
- Passages sous porche (aucune donnée aujourd'hui)
- Multijoueur, comptes
- Avatar qui attrape les éléphants (US012, optionnelle, plus tard)

---

## User Stories

| ID | User Story | Priorité | Points | Dépend de | Status |
|----|------------|----------|--------|-----------|--------|
| [US001](US001-reseau-et-chemin.md) | Un réseau de déplacement partagé et un chemin jusqu'au point cliqué | High | 5 | — | 🔲 Todo |
| [US002](US002-avatar-visible.md) | Un avatar visible, lisible à toutes les distances | High | 5 | US001 | 🔲 Todo |
| [US003](US003-camera-qui-suit.md) | Une caméra de balade qui suit l'avatar | High | 5 | US002 | 🔲 Todo |
| [US004](US004-entrees.md) | Cliquer ou toucher pour aller, sans casser les gestes actuels | High | 5 | US001, US003 | 🔲 Todo |
| [US005](US005-effacement-des-batiments.md) | Les bâtiments, toits et arbres qui masquent l'avatar s'effacent | High | 8 | US002, US003 | 🔲 Todo |
| [US006](US006-decouverte-des-lieux.md) | Marcher jusqu'à un lieu d'histoire pour ouvrir sa fiche | Medium | 3 | US004 | 🔲 Todo |
| [US007](US007-sauvegarde-de-la-position.md) | Retrouver son avatar là où on l'a laissé | Medium | 2 | US001 | 🔲 Todo |
| [US008](US008-clavier-et-accessibilite.md) | Se déplacer au clavier et rester accessible | Medium | 3 | US002 | 🔲 Todo |
| [US009](US009-mobile-fluidite-et-gestes.md) | Une balade fluide et confortable sur téléphone | High | 3 | US004 | 🔲 Todo |
| [US010](US010-lobby-aide-documentation.md) | Présenter la balade (lobby, aide) et mettre la documentation à jour | Medium | 2 | US003 | 🔲 Todo |
| [US011](US011-cas-de-test.md) | Un scénario de test et un contrôle automatique du déplacement | Medium | 3 | US001 à US007 | 🔲 Todo |
| [US012](US012-avatar-et-elephants.md) | L'avatar et les éléphants (optionnelle, plus tard) | Low | 3 | US004 | ⏳ Plus tard |

**Total : 44 points hors US012 (≈ 8 à 12 sessions).** Le **jalon prototype** (US001 à US004 en version minimale, ≈ 1 à 1,5 session) sert à décider avant d'investir dans le reste : voir le plan.

---

## Flux principal
```
Carte libre (comme aujourd'hui) → bouton « Balade » → l'avatar apparaît sur le point regardé, la caméra descend derrière lui
→ je clique une rue : un anneau marque l'arrivée, l'avatar y va en suivant les rues, la caméra le suit
→ un bâtiment lui masque la vue : il s'efface en pointillé autour de lui, l'avatar reste visible
→ je clique une ✦ : il y marche, la fiche s'ouvre à l'arrivée
→ « Vue libre » : je reprends la caméra, l'avatar attend ; « Retrouver mon avatar » le recentre
```

---

## Règles métier de l'epic
1. **Mode facultatif** : la carte libre actuelle (tourner, pincer, double toucher) reste le défaut ; rien ne change pour qui ne choisit pas la balade
2. **Un seul propriétaire de la caméra à la fois** : suivi, vol (`flyTo`), boussole, lobby, journal s'arbitrent par un mode explicite
3. **Priorité d'un clic court** : outil de placement (dev) → éléphant → gemme ou épingle → sol (marcher). Un glisser garde son sens actuel. Un toucher = une seule action
4. **Rien d'inventé** (règle projet 1) : les positions des lieux ne changent pas ; l'avatar ne reçoit pas de fait historique
5. **Pas d'ombre portée pour l'avatar** (carte d'ombres statique) : ombre en tache, comme les passants et les éléphants
6. **Réglages dans `src/content/avatar.json`** (échelle, vitesse, foulée, couleur, rayon d'accrochage, caméra, effacement) : rien en dur dans les shaders (règle BUG-01 : uniformes)
7. **Budget** : au plus +6 appels de rendu (63 aujourd'hui), +0,05 M de triangles, ≥ 55 images/s en marche sur Mac (59,8 mesurés en glissant la carte), 30 au repos, +0,2 s de chargement
8. **Pas d'asset tiers** : silhouette en formes simples (sinon licence au README, règle projet 5)

---

## Questions ouvertes pour Dasco

| # | Question | Proposition par défaut |
|---|----------|------------------------|
| Q1 | **Balade facultative ou par défaut ?** | Facultative : bouton « Balade » à côté de la boussole ; la carte libre reste le défaut (session de test avec les amis) |
| Q2 | **Vitesse et taille de l'avatar.** À l'échelle réelle (1,4 m/s) il faudrait 6 minutes pour 500 m | Avatar ×2 (3,4 m, lisible à 150 m), ≈ 14 m/s (500 m en ≈ 35 s), réglables |
| Q3 | **Effacement : trou pointillé ou bâtiment entier ?** | Trou pointillé (cône de vue) d'abord ; bâtiment entier en phase 2 seulement si le rendu déplaît (+1 session) |
| Q4 | **L'effacement touche-t-il aussi arbres et monuments ?** Et une silhouette de l'avatar à travers les murs ? | Oui pour les arbres et les monuments (liste d'exceptions possible) ; oui pour une silhouette discrète |
| Q5 | **Fiche des lieux** : à l'arrivée seulement ? | Oui : on clique la ✦, l'avatar y marche, la fiche s'ouvre à l'arrivée (au prototype : ouverture immédiate) ; signe discret « lieu mystère tout proche » à ≤ 25 m, sans ouverture automatique |
| Q6 | **Sur téléphone, un doigt qui glisse en balade** : déplacer la carte (et quitter le suivi) ou pivoter autour de l'avatar ? | Les deux agents ne sont pas d'accord. Je propose **pivoter autour de l'avatar** (comme les jeux), un toucher bref = aller, deux doigts inchangés, double toucher désactivé en balade ; à tester sur ton téléphone |
| Q7 | **Éléphants** : le clic sur un éléphant garde son effet immédiat ? | Oui ; « s'approcher pour l'attraper » en US012 après la v1 |
| Q8 | **Escaliers** : l'avatar peut-il les emprunter (les passants non) ? | Oui (111 voies) ; pas les passages sous bâtiment |
| Q9 | **« Recommencer l'exploration »** : que devient l'avatar ? | Retour au point de départ ; les points ne bougent pas |
| Q10 | **Niveau d'accessibilité** | Clavier (flèches, ZQSD), `aria-label` et annonces des lieux proches, réduction des animations, silhouette contrastée ; pas de promesse de parcours complet au lecteur d'écran (le Journal reste l'équivalent) |
| Q11 | **Quel téléphone** pour mesurer les images/s ? Aucune mesure mobile n'existe | Le tien (modèle à noter) |

---

## Critères d'acceptation
- [ ] US001 à US011 livrées (US012 en option)
- [ ] `npm run build` passe
- [ ] Scénario de test de l'US011 rejoué, résultats dans le CHANGELOG (réussi, échoué, non vérifié)
- [ ] Mesuré : images/s au repos et en marche, appels de rendu, triangles, chargement, dans le budget ; téléphone relevé
- [ ] Revue PO validée par Dasco, sur le prototype puis sur le rendu final

---

## Estimation globale
- **Complexité** : L
- **Effort estimé** : 8 à 12 sessions (prototype 1 à 1,5). Incertain : le mobile (jamais mesuré), l'effacement (2 à 4 sessions), le réglage de la caméra (plusieurs allers-retours, comme pour les noms de rues)

---

## Annexes (analyses des agents, 02/10/2026)
- [Avatar, déplacement et caméra](../../../tasks/ep005-avatar-deplacement-plan.md)
- [Effacement des bâtiments](../../../tasks/ep005-effacement-batiments-plan.md)
- [Intégration, performance, qualité](../../../tasks/ep005-integration-perf-plan.md)

---

**Version** : v1.0 (brouillon)
**Créé le** : 02/10/2026
