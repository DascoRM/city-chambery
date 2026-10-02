# Plan EP005 « Balade avec un avatar » (planifié, pas commencé)

Rédigé le 02/10/2026 par l'agent principal, à partir de trois analyses d'agents chercheurs (annexes ci-dessous), puis mis à jour avec les décisions de Dasco du même jour. **Aucune ligne de code n'est écrite** : la spec doit d'abord être validée par Dasco (règle du projet). Spec : [`specs/epics/EP005-balade-avatar/epic.md`](../specs/epics/EP005-balade-avatar/epic.md).

## En une page

- **Quoi** : un **mode balade** (on y entre, on en sort) : un avatar qu'on dirige au clic ou au toucher, vue 3/4 façon Diablo, caméra qui suit, bâtiments qui s'effacent devant lui, interface restreinte.
- **Combien** : 50 points, **9 à 13 sessions** (1 session ≈ une demi-journée de travail), incertain sur le relief, l'effacement et le téléphone.
- **Comment on avance sans se tromper** : un **prototype d'abord** (US001 à US004 en version minimale, 1 à 1,5 session), puis on **décide** avant d'investir dans le reste.
- **Pas commencé.** Branche d'epic : `feat/EP005-balade-avatar` (documents seulement pour l'instant).

## Flux Git (décision de Dasco)

```
main ───────────────────────────────────────────────────────►  (production Vercel)
  \                                                      /
   feat/EP005-balade-avatar  ── merge au besoin ────────┘   ← branche d'epic, on y itère
        \        \        \
         US001   US002   US003 …   feat/EP005-US00X-<description>, fusionnées dans la branche d'epic
```

- **Une branche d'epic** `feat/EP005-balade-avatar` pour itérer ; **une branche par user story** `feat/EP005-US00X-<description>` qui se fusionne dans la branche d'epic (pas dans `main`).
- **`main` n'est fusionné qu'au besoin** : tant que l'epic n'est pas prête, la production ne change pas.
- **Correctifs sur `main`** (un bug trouvé ailleurs) : on les **reporte sur la branche d'epic par rebase** (`git rebase main`). Le rebase réécrit l'historique de la branche d'epic : acceptable parce que Dasco est seul dessus ; si la branche est poussée, on pousse avec `--force-with-lease`.
- Chaque US se clôt comme une itération (FEATURES, BACKLOG, CHANGELOG avec « Vérifié » et « Non vérifié », DECISIONS).

## Jalons et ordre

| Jalon | Contenu | Sessions | Sortie |
|---|---|---|---|
| **J0 · Décisions** | Dasco valide la spec ; points restants de l'epic (P4 l'interface, P5 les fiches, P6 le geste mobile, P7 les escaliers, P8 autres téléphones) ; **comprendre le plafond de ≈ 31 images/s sur l'iPhone** (mode économie d'énergie ? téléphone au maximum ?) | — | Spec validée, cause du plafond connue |
| **J1 · Prototype** | US001 (réseau, chemin) + US002 (avatar) + US003 (mode balade, caméra) + US004 (entrées), version minimale : formes simples, vitesse fixe, point de départ fixe, **sans** effacement ni sauvegarde ni fiches | 1 à 1,5 | **Go / no-go de Dasco** sur la sensation (taille de l'avatar, angle, vitesse) |
| **J2 · Jouable** | US005 (effacement des bâtiments entiers : la plus incertaine, à mesurer d'abord) + US006 (marcher jusqu'à un lieu, avec une **maquette des fiches** avant le code) | 3 à 5 | Une vraie balade, lieux compris |
| **J3 · Finition** | US007 (point de départ, sauvegarde), US008 (accessibilité), US009 (iPhone), US010 (lobby, aide, docs), US011 (scénario, contrôle automatique) | 3 à 4 | Epic livrable ; revue de Dasco |
| **Plus tard** | US012 (éléphants), US013 (masquer les bâtiments « en vue »), « Voir d'ici » | — | À ouvrir par Dasco |

## Prototype (J1) : critères de sortie

- `npm run build` passe ; aucune erreur console
- 50 destinations aléatoires : l'avatar n'est jamais dans un bâtiment ni dans l'eau, jamais hors réseau
- Marche : ≥ 55 images/s sur le Mac (référence 59,8) ; repos : « repos (30 max) » ; au plus +6 appels de rendu **par rapport à la même vue**, +0,05 M de triangles
- Dasco joue 5 minutes et dit : on continue, on change l'angle ou la vitesse, ou on arrête

## Ordre des tâches techniques

1. **Diagnostic du réseau** (script jetable) : pourquoi la rive nord-est (982 nœuds) est coupée ; où se rattachent les 8 lieux ; décision sur `avoidWater` / lignes d'eau `covered`. Si les données doivent changer : `scripts/` puis `npm run data -- --offline`.
2. **Réseau partagé** : un seul graphe pour passants et avatar (pas de 3e construction ≈ 0,5 s) ; index d'accrochage ; `pointInBuilding` pour le dernier mètre.
3. **Chemin** : accrochage (refus à plus de 40 m), A* avec nœuds virtuels, arrondi des angles, replanification.
4. **Avatar** : silhouette des passants ×2, ombre en tache, anneau d'arrivée, `moving()`, réglages `avatar.json`.
5. **Mode balade** : suivi par translation du rig, suivi suspendu pendant un vol, dénivelé, limites de zoom et interface propres au mode, boutons Balade / Vue libre / Retrouver, boussole masquée.
6. **Entrées** : priorité éléphant > gemme > sol ; double toucher désactivé en balade ; un toucher = une action ; geste mobile à décider à l'usage.
7. **Effacement** : identifiant de bâtiment (`aId`), texture de facteurs, test caméra → avatar contre les emprises ; monuments en transparence ; arbres exclus ; liste d'exceptions ; silhouette.
8. **Lieux et fiches** : marcher puis ouvrir ; maquette des fiches en balade ; plus de `flyTo` en balade.
9. **Point de départ et sauvegarde, accessibilité, iPhone, lobby, tests**, dans cet ordre.

## Budget de performance (à tenir à chaque US, **mesuré par vue**)

Le compteur d'appels de rendu dépend de la vue (mesuré le 02/10/2026, voir `PERF-AUDIT.md`) :

| Vue | Appels de rendu | Triangles |
|---|---|---|
| Vue d'ensemble (ouverture) | **2 406** | 1,58 M |
| Près du Carré Curial (300 m) | 732 | 1,54 M |
| Près du château (300 m) | 630 | 1,55 M |
| Dans les rues (rue de Boigne, 130 m) | **63** | 1,53 M |

| Mesure | Limite |
|---|---|
| Appels de rendu | **+6 au plus par rapport à la même vue** |
| Triangles | +0,05 M au plus |
| Images/s en marche (Mac GPU) | ≥ 55 (59,8 mesurés en glissant la carte) |
| Images/s au repos | 30 |
| Chargement (Mac, dev) | +0,2 s au plus (≈ 4,8 s aujourd'hui) |
| iPhone 12 Pro | **Mesuré par Dasco le 02/10 : ≤ 31 images/s même en poussant les gestes, 750 à 1 000 appels de rendu.** Aucune marge au-dessus de 30 : la balade ne doit pas faire baisser ce niveau ; cause du plafond à comprendre avant le prototype |

**Pourquoi 55 et pas 30 ?** Les 30 images/s sont la cadence **au repos** (quand rien ne bouge, on économise). Dès que quelque chose bouge, la boucle passe à la pleine vitesse, ≈ 60 sur un écran de 60 Hz : or une caméra qui suit un avatar bouge en permanence, et à 30 images/s ce suivi paraîtrait saccadé. 55 n'est pas un objectif de beauté : c'est le **seuil de non-régression** (59,8 mesurés ; en dessous de 55, on a dégradé quelque chose). Au repos, 30 suffit parfaitement.

**Monuments non fusionnés** : près d'un monument, 630 à 732 appels contre 63 dans les rues. Une balade qui passe devant le château ou le Carré Curial entre dans cette zone. Si la mesure sur l'iPhone est mauvaise, le ticket du backlog « Monuments : fusionner la géométrie par matériau » (aujourd'hui en attente) devient prioritaire.

## Décisions de Dasco reprises dans la spec (02/10/2026)

Mode explicite et unique (entrer, sortir) ; zoom et interface propres au mode ; boussole masquée ; effacement des **bâtiments entiers** d'abord puis, plus tard, masquer les bâtiments « en vue » (US013) ; arbres non, monuments oui avec liste d'exceptions ; fiches à revoir en balade ; geste mobile à définir à l'usage ; éléphants cliquables ; relief et escaliers = point d'attention ; « Recommencer » ramène au point de départ à définir ; pas de clavier ; animations réduites et silhouette contrastée ; iPhone 12 Pro comme référence (5G, Wi-Fi ; 4G fluide d'après les utilisateurs).

## Arbitrages entre les trois analyses (avant les décisions de Dasco)

| Sujet | Les analyses disaient | Retenu |
|---|---|---|
| Découpage | 7 US (avatar), 10 US (intégration) | **13 US** : fusion, effacement et accessibilité séparés ; US013 plus tard |
| Limites de la caméra | « ne pas toucher 70 m / 30 m » / « limites propres 25-60 m » | **Limites propres au mode balade** (décision de Dasco) |
| Doigt qui glisse sur téléphone | « déplacer la carte » / « pivoter autour de l'avatar » | **À définir à l'usage**, façon League of Legends mobile |
| Effacement | 5 techniques comparées ; cutaway d'abord | **Bâtiments entiers d'abord** (décision de Dasco) ; le cône de vue reste le repli si le mobile est trop lent |
| Double toucher mobile | désactiver / différer 320 ms | **Désactiver en balade** |
| « Appels de rendu périmés » (les agents) | « 2 400 est périmé, mesuré 63 » | **Faux** : 63 est la mesure d'une vue dans les rues ; 2 406 en vue d'ensemble. Documents précisés par vue |

## Risques principaux

| Risque | Gravité | Parade |
|---|---|---|
| Relief et escaliers (pentes, caméra) | Élevée | Point d'attention dès US001 et US003 ; pas bloquant pour la démo |
| Coût de l'effacement par bâtiment (GPU mobile non mesuré) | Élevée | Mesurer avant de s'engager ; repli : cône de vue en shader |
| Fluidité sur téléphone : ≤ 31 images/s en mouvement mesurées (02/10), donc **aucune marge** | **Élevée** | Comprendre la cause (mode économie d'énergie ? GPU ?) avant le prototype ; mesurer chaque ajout ; pistes : monuments fusionnés (750 à 1 000 appels vus sur l'iPhone), `samples: 2` de l'effet maquette, densité |
| Conflits de caméra (`flyTo`, journal, lobby, plancher) | Élevée | Mode explicite et exclusif (US003) |
| Une partie de la carte inaccessible | Haute | Diagnostic en tête (US001) |
| Fiches de lieux encombrantes sur mobile | Moyenne | Maquette avant de coder (US006) |
| Avatar enterré après un changement de données | Moyenne | Validation de la position sauvegardée |

## Ce qui n'est PAS décidé

Les points restants de l'epic : silhouette (P2), commandes gardées dans l'interface de balade (P4), forme des fiches (P5), geste mobile (P6), escaliers (P7), autres téléphones (P8). Tranchés le 02/10 : bâtiments et monuments s'effacent (arbres non), exceptions en liste vide au départ, point de départ = fontaine des Éléphants.

## Annexes (analyses des agents chercheurs)

- [Avatar, déplacement et caméra](ep005-avatar-deplacement-plan.md)
- [Effacement des bâtiments](ep005-effacement-batiments-plan.md)
- [Intégration, performance, qualité (scénario de test de 19 étapes)](ep005-integration-perf-plan.md)

*Note : les annexes ont été écrites avant les décisions de Dasco. Là où elles divergent (zoom, effacement, clavier, boussole, geste mobile, appels de rendu), l'epic et ce plan font foi.*
