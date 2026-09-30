# EP001 - US010 - *(Option)* Des personnages animés près de la caméra

**Statut : ⏸ non planifiée.** Décision de Dasco (30/09/2026) : silhouettes simples d'abord ; les personnages animés
restent une option pour plus tard. Cette fiche garde l'idée et ses conditions ; elle n'a ni estimation ni critères
détaillés avant que Dasco la déclenche.

## User Story

**En tant que** visiteur qui zoome tout près d'une rue,
**je veux** voir quelques vrais personnages qui marchent (bras et jambes animés),
**afin que** la vie de la ville soit convaincante de près, pas seulement de loin.

---

## Conditions pour la lancer
- US001 et US002 livrées et jugées par Dasco : les silhouettes ne suffisent pas de près
- Un pack de personnages low-poly sous licence libre, choisi avec Dasco (l'ancien backlog citait un pack Quaternius en CC0, à convertir de FBX en glb ; **à vérifier** : la licence et le format exact)
- Une mesure des silhouettes (images/s, appels de rendu) qui montre la marge disponible

## Piste technique (à affiner avant d'estimer)
- Personnages animés (squelette) **seulement près de la caméra** : une vingtaine au plus, dans un rayon d'environ 60 m autour du point visé, remplaçant les silhouettes à cet endroit ; au-delà, les silhouettes de l'US001 restent
- Conversion du pack en `.glb` par un script (comme `npm run mascot`), licence dans le README, crédit dans l'application si la licence l'exige
- Mélangeur d'animations de three.js (clips de marche et d'arrêt), un seul modèle cloné (`SkeletonUtils`) ; coût des squelettes à mesurer sur mobile
- Raccord visuel entre silhouette et personnage (taille, couleurs, démarche), pour que le remplacement ne se voie pas
- La règle 5 de l'epic s'applique : pas de pleine vitesse forcée

## Points à trancher le moment venu
- Style des personnages par rapport au reste de la maquette (low-poly pastel ?)
- Nombre maximal et rayon de remplacement
- Faut-il désactiver sur mobile ?

---

**Priorité** : Low
**Status** : ⏸ Non planifiée
