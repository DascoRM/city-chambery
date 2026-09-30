# EP001 - US007 - Préparer le pack de bâtiments Kenney (nom, licence, conversion)

## User Story

**En tant que** développeur du diorama (Dasco, et Claude pour le code),
**je veux** que le pack de bâtiments soit rangé, sous licence vérifiée, et converti dans le format et les couleurs du projet,
**afin de** pouvoir l'utiliser pour les détails de façade sans rien casser.

---

## Critères d'acceptation

- [ ] **Given** le dossier `assets-src/buiding`, **When** l'US est terminée, **Then** il s'appelle `assets-src/kenney-buildings` et contient toujours ses `.obj`, `.mtl` et `Textures/colormap.png` d'origine
- [ ] **Given** le pack, **When** je cherche sa licence, **Then** elle est vérifiée à la source (site de l'auteur) et notée dans le README (section Licences), avec son nom, son auteur et son lien ; si elle exige un crédit, il est affiché dans l'application
- [ ] **Given** `npm run buildings`, **When** je le lance, **Then** les pièces retenues sont écrites dans `public/models/buildings/` avec les couleurs de la palette du projet, sans texture, à l'échelle en mètres, avec une origine utile (centre du bas, face vers +Z)
- [ ] **Given** la liste des pièces retenues, **When** je regarde le poids total, **Then** il est d'au plus 60 Ko (compressé) ; le nombre de triangles par pièce est indiqué dans le journal du script
- [ ] **Given** `npm run build`, **When** il s'exécute, **Then** il passe et le diorama est strictement identique à avant (cette US n'affiche rien)
- [ ] **Given** la commande `npm run buildings`, **When** je la relance, **Then** les fichiers produits sont identiques (conversion déterministe)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | **Licence d'abord** : le dossier ne contient pas de fichier de licence ; les `.obj` indiquent « Created by Kenney (www.kenney.nl) ». Kenney publie habituellement ses packs en CC0 ; **à confirmer sur la page du pack avant de convertir quoi que ce soit** (règle 5 du projet). Si la licence n'est pas libre, l'epic perd US008 et US009 |
| R2 | **Renommer** `buiding` → `kenney-buildings` (Q6 de l'epic) ; le dossier n'est pas encore suivi par git (1,1 Mo) : à commiter sous son nouveau nom, avec ses `.obj`, `.mtl` et sa texture d'origine, comme le pack Quaternius |
| R3 | **Pièces retenues** (à valider avec Dasco, sur les 217 du pack) : auvents (`building-window-awnings`, `roof-flat-awning-a` à `c`), portes (`door-brown*`, `door-white*`, `building-door*`), balcons (`building-window-balcony`), climatiseurs (`detail-ac-a`, `detail-ac-b`), lucarnes (`roof-slanted-window`), détails de toit plat (`roof-flat-detail-a` à `d`). Les murs, toits et maisons complètes ne sont pas retenus (hors scope de l'epic) |
| R4 | **Couleurs** : les pièces sont colorées par **une texture de palette** (`colormap.png`, 512 × 512) lue par les coordonnées UV, pas par des couleurs de matériau : `convert-nature.mjs` ne suffit donc pas. Le script lit la palette, en tire une **couleur par sommet** (puis `flatShading` dans l'appli, comme les arbres), et peut la remplacer par la palette du diorama (`RECOLOR`) ; les auvents reçoivent ensuite la couleur de leur catégorie (US008) |
| R5 | **Échelle** : une unité du pack vaut à peu près un étage (le bloc fait 1 × 1, un climatiseur 0,24) ; mesurer et fixer l'échelle en mètres (un étage ≈ 3 m) dans le script, une fois, plutôt que dans l'appli |
| R6 | **Un seul fichier glTF** `details.glb` avec une pièce par nœud nommé (moins de requêtes, même chargeur que les autres modèles) ; si TI-04 (compression meshopt) est faite avant, il est compressé de la même façon |
| R7 | Dépendances : lecture de la texture PNG par un module minimal de `node:zlib` ou une dépendance de développement (alors `package-lock.json` est commité, règle 4) |
| R8 | README : commande, structure du dossier, licence, limites (les pièces sont du décor, pas un relevé des façades) |

---

## Rendu
Aucun : pas de changement visible.

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Licence non libre ou non confirmée | Arrêt de l'US et décision de Dasco ; le pack reste hors du dépôt |
| Pièce sans UV ou avec plusieurs matériaux | Avertissement dans le journal du script, pièce écartée |
| Palette lue en sRGB | Convertie en linéaire avant d'être écrite (comme `hexToLinear` dans `convert-nature.mjs`) |
| Dossier `Textures` absent | Erreur claire du script |

---

## Dépendances et existant réutilisé
`scripts/convert-nature.mjs` (lecture des `.obj`, `RECOLOR`, conversion en linéaire, simplification) ; README (Licences).

## Vérification
`npm run buildings` deux fois (identique) ; `npm run build` ; poids des fichiers ; ouverture d'une pièce dans un visionneur glTF pour l'échelle et les couleurs.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Licence vérifiée et notée
- [ ] Dossier renommé ; `scripts/convert-buildings.mjs` ; `npm run buildings`
- [ ] `npm run build` passe ; diorama inchangé
- [ ] README (Licences, commandes, structure) et clôture d'itération
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
