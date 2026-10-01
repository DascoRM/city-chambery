# EP001 - US010 - Des personnages animés à la place des silhouettes

**Statut : ❌ abandonnée le 01/10/2026 (décision de Dasco : « pas rentable, garde les personnages que tu as modélisés »).** Les passants restent les silhouettes de l'US001. Cette fiche garde ce qui a été essayé et appris, pour ne pas le refaire sans raison.

## L'idée
Remplacer les silhouettes de l'US001 par de vrais petits personnages animés (bras et jambes), pour que la vie de la ville soit plus convaincante de près.

## Ce qui a été essayé

| Essai | Résultat |
|---|---|
| **Pack « Mini Characters » de Kenney** (CC0, 12 personnages, 7 os, 700 à 880 triangles, marche de 0,67 s), un personnage en mode `?debug` (itération 54) | Techniquement bon : marche et attente animées, couleurs du pack, ≈ 250 Ko par personnage. **Écarté sur le style** : figurines « chibi » (grosse tête, aplats), « très cartoon », différentes des silhouettes et des bâtiments du diorama |
| **Personnage Mixamo « Rigged Character »** (FBX de Dasco), un mannequin en mode `?debug` | Proportions réalistes (plus proches des silhouettes), mais : **aucune animation de marche dans le fichier** (seulement la pose en T), **4 864 triangles** et **65 os** (doigts compris) pour un seul maillage, un matériau gris uni sans texture. Il a fallu une marche de remplacement calculée dans le code pour le voir bouger. Abandonné avant d'être jugé |

## Pourquoi « pas rentable »
- **Le style des figurines Kenney ne s'accorde pas avec le diorama**, et un personnage réaliste demande des animations et des textures qu'on n'a pas.
- **Le coût** : 300 personnages de 4 900 triangles et 65 os font 1,5 M de triangles de plus (le diorama en a 1,4 M) et un squelette lourd à instancier ; il faudrait simplifier le maillage (≈ 1 200 triangles), retirer les doigts (65 → ≈ 20 os) et cuire les animations dans une texture, soit plusieurs sessions pour un gain visible seulement au zoom maximal (les silhouettes de 1,7 m sont déjà lisibles à 70 m).
- Les passants de l'US001 sont légers (3 appels de rendu), dans l'esprit maquette, et validés par Dasco.

## Si l'idée revient un jour
- Partir d'un personnage **low-poly à proportions réalistes avec une marche** (ou télécharger « Walking » / « Idle » sur Mixamo « Without Skin ») ;
- viser ≤ 1 200 triangles et ≤ 20 os, instancié avec animation cuite (méthode A de l'ancienne spec : matrices d'os dans une texture) ;
- faire l'essai visuel d'abord, comme pour le pack de bâtiments et celui-ci.

## Bug rencontré, pour mémoire
La première version de l'essai faisait « marcher de côté » le personnage : c'était **une erreur de ma formule d'orientation** (mauvais signe sur l'axe nord-sud), pas le modèle. Corrigée et vérifiée (vu de devant, on voit le visage). Rien à refaire.

**Priorité** : —
**Status** : ❌ Abandonnée (01/10/2026)
