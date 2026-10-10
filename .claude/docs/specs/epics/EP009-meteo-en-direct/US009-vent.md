# EP009 - US009 - Vent (fumées, drapeaux, arbres)

## User Story

**En tant que** visiteur,
**je veux** voir la fumée des cheminées, les drapeaux et les arbres suivre le vent réel,
**afin de** sentir le vent sur la maquette.

---

## Critères d'acceptation

- [x] **Given** un vent réel (ou `?weather=rain&wind=60&windfrom=200`), **Then** fumées et drapeaux tournent et se couchent en 6 s environ selon la direction et la force (aujourd'hui figés à la construction) *(fondu τ = 6 s : 63 % en 6 s, 95 % en 18 s ; la météo écrit l'objet `wind` partagé, la fumée le relit toutes les 0,5 s, les drapeaux à chaque image)*
- [x] **Given** un vent de plus de 25 km/h et `qualityLevel` au moins `medium`, **Then** les arbres se balancent ; coût mesuré avant / après (Mac, puis téléphone) et noté ; rien en `low` ni en réduit-mouvement *(progressif de 25 à 60 km/h, 0,6 m au plus en haut d'un arbre de 10 m ; arbres simples et modélisés en `medium` comme en `high` ; coût dans le bruit sur le Mac, téléphone non mesuré)*
- [ ] **Given** l'automne, **Then** quelques feuilles volent (facultatif) *(non fait)*

---

## Règles métier
Voir l'[epic](epic.md), règles 9 et 10.

| Règle | Description |
|-------|-------------|
| R1 | Un objet `wind` partagé, créé dans `main.ts`, passé à la fumée et aux drapeaux, modifié par le module météo (posé dès US002) |
| R2 | Conversion : la météo donne d'où vient le vent (0 = nord), `life.json` attend où il va (0 = est, 90 = nord) : `(−90 − from) mod 360` (testé au prototype) ; vitesse réelle convertie en vitesse « de maquette » (constante à calibrer) |
| R3 | Balancement des arbres par un uniforme `uSway` posé au démarrage ; les arbres font environ 80 % des triangles, d'où la mesure obligatoire |
| R4 | Ombres figées : le balancement ne se voit pas dans l'ombre (accepté) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 2 à 2,5 |
| Complexité | Medium |
| Dépend de | US001, US002 |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 4.6 et § 2.5 (`main.ts` l. 187-197, `chimneys.ts` l. 93-109, `flags.ts` l. 82 et 111).

---

## Checklist dev
- [x] Branche `feat/EP009-US009-vent` depuis `feat/EP009-meteo`
- [x] `npm run build` et `npm test` ; vérifié dans le navigateur avec `?weather=…&wind=…&windfrom=…` et `?debug`
- [x] Fluidité : mesure avant / après le balancement des arbres (Mac avec la puce graphique, puis téléphone) *(Mac fait ; téléphone : Dasco)*
- [x] Le site marche sans la météo
- [x] FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco

---

**Priorité** : Low
**Status** : ✅ Done (10/10/2026, itération 97) ; rendu à juger par Dasco
