# EP005 - US005 - Les bâtiments, toits et arbres qui masquent l'avatar s'effacent

## User Story

**En tant que** visiteur en mode balade,
**je veux** voir mon avatar même quand un bâtiment, un toit ou un arbre est entre lui et la caméra,
**afin de** ne jamais le perdre dans une rue étroite.

---

## Critères d'acceptation

- [ ] **Given** un bâtiment entre la caméra et l'avatar, **When** je regarde, **Then** un trou en pointillé (dither) s'ouvre autour de la ligne de vue et l'avatar reste visible, sans passe transparente ni maillage séparé
- [ ] **Given** l'avatar contre un mur ou dans une cour, **When** je regarde, **Then** le trou ne mange pas le mur contre lequel il passe (fondu près de l'avatar) et ne coupe que ce qui est au-dessus de lui (sol et bas des murs gardés)
- [ ] **Given** des arbres et les monuments (château, cathédrale, Carré Curial), **When** ils masquent l'avatar, **Then** ils s'effacent aussi (liste d'exceptions possible dans `models.json`)
- [ ] **Given** un bâtiment qui reste devant, **When** il masque quand même l'avatar, **Then** une silhouette discrète de l'avatar, de couleur unie, reste visible à travers (+1 à 3 appels de rendu)
- [ ] **Given** la nuit, **When** une zone s'efface, **Then** les fenêtres allumées autour du trou restent correctes (calculées au fragment) et l'avatar reste lisible
- [ ] **Given** les ombres, **When** une partie s'efface, **Then** la carte d'ombres statique est inchangée et n'est pas recalculée (coût nul)
- [ ] **Given** la carte libre, **When** je n'ai pas lancé la balade, **Then** aucun coût : la variante du shader n'est compilée ou activée qu'en balade (ou le coût mesuré est négligeable)
- [ ] **Given** `?debug`, **When** j'ai l'avatar dans une rue dense, **Then** +0 appel de rendu pour l'effacement, images/s et chargement dans le budget de l'epic

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Technique : « cutaway » cylindrique / conique en shader (dither + `discard`), piloté par uniformes seulement (`uAvatar`, `uCam`, `uCutR`) : règle BUG-01 |
| R2 | Module `src/scene/cutaway.ts` ; `applyCutaway(material, { instanced })` ; **instances** : la position monde doit passer par `instanceMatrix` (arbres, auvents) |
| R3 | Les bâtiments sont **un seul maillage fusionné, un seul matériau** (`city.ts:311-315`), sans identifiant de bâtiment : le trou agit sur une zone, pas sur un bâtiment entier (phase 2 optionnelle : identifiant par bâtiment, +1 session) |
| R4 | Réglages (rayon, pente du cône, fondu) dans `avatar.json` |
| R5 | Épingles, cheminées, auvents, drapeaux au-dessus d'un toit effacé : les cacher dans le cylindre, cas par cas |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Grain de dither visible quand la densité de pixels baisse | Bruit intercalé, flou de l'effet maquette ; `alphaToCoverage` à tester |
| Intérieur « creux » derrière le trou | À regarder ; intérieur sombre éventuel (sans doubler le coût) |
| Bâtiments bas devant la caméra | Non effacés si l'avatar est visible (limite par distance et hauteur) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 8 |
| Complexité | Complexe (coût du `discard` sur GPU mobile à tuiles non mesuré) |

---

## Checklist dev

- [ ] `cutaway.ts`
- [ ] Bâtiments (`city.ts`), arbres, monuments
- [ ] Silhouette (matériau, ordre de rendu)
- [ ] Cas : rue de Boigne, place Saint-Léger, château, nuit, hiver
- [ ] Images/s, appels, triangles mesurés ; essai téléphone
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
