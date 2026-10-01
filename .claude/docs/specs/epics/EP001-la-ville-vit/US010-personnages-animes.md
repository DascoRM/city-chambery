# EP001 - US010 - Des personnages animés à la place des silhouettes (pack Kenney « Mini Characters »)

**Statut : 📝 planifiée le 01/10/2026, à lancer sur décision de Dasco.** Demande de Dasco : ajouter une tâche pour intégrer les modèles de `assets-src/characters` aux passants. Avant l'intégration complète : **un essai visuel avec go de Dasco**, comme pour le pack de bâtiments (écarté le 30/09 : le style d'un pack ne se juge qu'à l'écran).

## User Story

**En tant que** visiteur qui zoome sur une rue ou une place,
**je veux** voir de vrais petits personnages qui marchent (bras et jambes animés) et s'arrêtent,
**afin que** la vie de la ville soit plus convaincante de près que les silhouettes de l'US001.

---

## Ce que contient le pack (mesuré le 01/10/2026)

| Élément | Valeur |
|---|---|
| Pack | **Mini Characters 1.0** de Kenney, `assets-src/characters` (dossier déposé par Dasco, non encore commité) |
| Licence | **CC0 1.0** (lue dans `License.txt` du pack : usage commercial permis, crédit « Kenney » apprécié mais non obligatoire) |
| Personnages | **12** : `character-female-a` à `-f`, `character-male-a` à `-f` |
| Poids de chaque personnage | ≈ 700 à 880 triangles, ≈ 250 Ko en GLB (animations comprises) |
| Squelette | **7 os seulement** : racine, 2 jambes, torse, 2 bras, tête ; 2 maillages par personnage (corps, tête) |
| Animations | 32 par personnage, dont **`walk` (0,67 s)**, `idle` (1,33 s), `sprint` (0,5 s), `sit` (0,17 s), `emote-yes` / `emote-no`, `holding-*`, `wheelchair-*` |
| Taille | 0,67 unité de haut : **× 2,54** pour 1,7 m |
| Couleurs | une seule texture de palette partagée (`Textures/colormap.png`), lue par les UV |
| Accessoires | 10 pièces `aid-*` (cannes, béquille, lunettes, masque, appareil auditif…) et 4 fauteuils roulants : pas retenus ici |
| Poids du dossier | 14 Mo (FBX 8,8 Mo, GLB 3,3 Mo, OBJ 1,2 Mo) : voir « Fichiers à garder » |

---

## Critères d'acceptation (à affiner après l'essai)

- [ ] **Given** la carte à midi, **When** je zoome à 70 m sur une place, **Then** je vois des personnages aux têtes, bras et jambes qui bougent, de plusieurs modèles différents (hommes et femmes)
- [ ] **Given** un personnage qui arrive à une pause (US001 : pause à un carrefour), **When** il s'arrête, **Then** il passe à l'animation `idle` et reprend la marche à la fin de la pause, sans à-coup
- [ ] **Given** la carte au repos, **When** les personnages marchent, **Then** la carte reste à 30 images/s (mode « repos » de `?debug`) et la fluidité mesurée ne baisse pas de plus de 10 % par rapport aux silhouettes
- [ ] **Given** `?debug`, **When** je compare avant et après, **Then** les appels de rendu augmentent d'au plus 15 et les triangles d'au plus 0,3 M à la densité maximale
- [ ] **Given** un téléphone, **When** je regarde la carte, **Then** le nombre de personnages est réduit comme pour les silhouettes (`mobileFactor`)
- [ ] **Given** un personnage, **When** je clique dessus, **Then** rien ne se passe (décor, règle de l'epic)
- [ ] **Given** la nuit, **When** je regarde un personnage, **Then** il est éclairé comme le reste de la scène (pas noir, pas lumineux)

---

## Deux méthodes possibles (à trancher par l'essai)

| | **A. Animation par instances (recommandée)** | **B. Personnages classiques près de la caméra** |
|---|---|---|
| Principe | Le cycle de marche (0,67 s) et la pause sont « cuits » dans une petite texture de matrices d'os ; le shader déforme chaque instance selon sa phase. Un maillage instancié par modèle de personnage (12 appels de rendu au plus), **tous les passants sont animés** | `SkinnedMesh` et `AnimationMixer` de three.js pour une vingtaine de personnages dans un rayon d'environ 60 m ; au-delà, les silhouettes de l'US001 |
| Pour | Même coût partout, aucune bascule visible, adapté aux 7 os (matrices minuscules) ; même méthode que la marche de l'éléphant (déformation dans le shader) | Simple à écrire, animations directes du pack |
| Contre | Un script de « cuisson » à écrire, un shader de déformation à écrire et à vérifier | Un appel de rendu et un mélangeur par personnage ; **bascule visible** silhouette ↔ personnage ; limite basse de personnages |
| Estimation | 8 points | 5 points |

L'essai (étape 1) construit la méthode A sur un seul modèle ; si elle s'avère trop longue ou trop coûteuse, on retombe sur B.

---

## Plan

1. **Essai visuel (go de Dasco)** : un personnage (`character-male-a`) qui marche dans une rue, à l'échelle 1,7 m, couleurs du pack ; captures de jour et de nuit, avant / après ; Dasco dit si le style lui plaît. S'il ne lui plaît pas : retrait des sources (comme pour le pack de bâtiments), les silhouettes restent
2. **Conversion** (`npm run characters`, script dans le style de `convert-nature.mjs` et `convert-buildings.mjs`) : GLB gardés, mise à l'échelle, couleur de palette lue ou texture réduite, animations `walk` et `idle` extraites ; sortie `public/models/characters/`
3. **Animation** : méthode A ou B
4. **Intégration à `people.ts`** : mêmes déplacements (réseau, pauses, rayon autour du point regardé) ; le modèle est tiré au hasard à la création ; la silhouette de l'US001 est conservée comme repli si un chargement échoue
5. **Mesure** : `?debug`, Chrome avec carte graphique, puis un vrai téléphone ; README et clôture d'itération

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Décor sans interaction** (règle de l'epic) : ni cliquables, ni liés au jeu ; les clics passent au travers |
| R2 | **Cadence** : la marche de ces personnages ne force pas la pleine vitesse (`moving()` faux) ; la carte reste à 30 images/s au repos |
| R3 | **Ombres** : pas d'ombre projetée (ce qui bouge n'en projette pas) ; la pastille d'ombre de l'US001 est conservée |
| R4 | **Licence** : CC0, mention dans le README (section Licences) ; le crédit « Kenney » n'est pas obligatoire, il peut être ajouté volontairement |
| R5 | **Couleurs** : celles du pack à l'essai ; si elles jurent avec le diorama, recolorer avec la palette du projet (comme les arbres) |
| R6 | **Poids** : au plus 400 Ko de modèles servis (12 personnages réduits à la marche et à l'arrêt) ; le fichier de l'appli ne grossit que du code d'animation |
| R7 | **Nombre de modèles** : les 12 personnages, tirés au hasard ; les accessoires (cannes, lunettes, fauteuils) hors de cette US |

## Fichiers à garder dans `assets-src/characters` (à faire au moment de commiter)

Comme pour le pack de bâtiments (sources réduites au strict nécessaire), je propose de ne commiter que `Models/GLB format/character-*.glb` (12 fichiers, ≈ 3 Mo), `Models/GLB format/Textures/colormap.png`, `License.txt` et `Preview.png` ; les FBX (8,8 Mo), les OBJ, les accessoires, les fauteuils et les liens `.url` ne sont pas commités. Aucun fichier du dossier n'est commité à ce jour.

## Questions pour Dasco
- Est-ce que l'on commence par l'essai d'un seul personnage (recommandé), avant toute conversion des 12 ?
- Les 12 personnages, ou seulement quelques-uns (par exemple 4 hommes et 4 femmes) pour garder le poids bas ?
- Faut-il garder les silhouettes de l'US001 comme repli de chargement, ou les retirer une fois les personnages validés ?

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 (essai) + 8 (méthode A) ou 5 (méthode B) ; **provisoire, à confirmer après l'essai** |
| Complexité | Medium à Complexe |

---

**Priorité** : Low à Medium (après US001, US002 validées)
**Status** : 📝 Planifiée, en attente du go de Dasco
