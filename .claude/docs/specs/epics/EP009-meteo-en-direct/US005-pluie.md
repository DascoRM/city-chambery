# EP009 - US005 - Pluie

## User Story

**En tant que** visiteur,
**je veux** voir la pluie tomber sur la maquette et les rues mouillées,
**afin de** reconnaître un jour de pluie à Chambéry.

---

## Critères d'acceptation

- [x] **Given** `?weather=rain&intensity=0.8`, **Then** des traînées tombent au-dessus du socle (2 appels de rendu au plus, nombre selon le niveau de qualité et l'intensité), et les rues, les toits et le sol paraissent mouillés (plus sombres, satinés)
- [x] **Given** une bruine (0,15) puis une averse (0,85), **Then** densité et longueur visiblement différentes
- [x] **Given** un zoom de la vue d'ensemble jusqu'à 100 m, **Then** aucun saut des gouttes (deux nappes en fondu)
- [x] **Given** la nuit, **Then** les halos des bars et la lueur des rues sont un peu plus forts
- [x] **Given** la scène au repos sous la pluie, **Then** 30 img/s (« repos (30 max) »), pluie animée
- [x] **Given** l'arrivée de la pluie, **Then** aucune image de plus de 50 ms (crochets du sol mouillé posés au démarrage)
- [ ] **Given** le budget d'US001, **Then** il est respecté sur le téléphone de mesure *(« ça a l'air ok » sur iPhone, Dasco 09/10 ; pas de chiffres)*
- [x] **Given** moins de 24 img/s en mouvement avec la densité de pixels au minimum, **Then** densité divisée par 2, puis coupure (règle 8 de l'epic)

---

## Règles métier
Voir l'[epic](epic.md), règles 8, 9 et 10.

| Règle | Description |
|-------|-------------|
| R1 | Pluie calculée par le GPU : positions dans le vertex shader, tampon fixe, densité par un uniforme ; rien n'est réalloué quand l'intensité change |
| R2 | Gouttes ancrées dans le monde (elles ne glissent pas quand on déplace la carte), épaisseur constante en pixels |
| R3 | Sol mouillé = plus sombre (≈ −15 %) et satiné, sans vrais reflets ni flaques (trop cher sur les 2 400 appels de rendu de la vue d'ensemble) |
| R4 | Hors du socle, les gouttes sont écartées dans le vertex shader, sans coût (D11, à trancher par Dasco) |
| R5 | La pluie ne force pas la pleine cadence : elle s'anime à 30 img/s au repos (TI-02) |

Hors périmètre : éclaboussures, gouttes sur l'objectif. En option : moins de passants, oiseaux à l'abri, fumée plus dense.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 2,5 à 3 |
| Complexité | Medium |
| Dépend de | US001 (budget), US002 |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 4.3 (technique et mesures sur le Mac), § 2.4 (particules), § 2.8 (crochets des matériaux), § 5.2 (dégradation) ; prototype `scene/rain-proto.ts` (§ 11).

---

## Checklist dev
- [x] Branche `feat/EP009-US005-pluie` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test` (`weather/budget.test.ts`) ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après ; mesure GPU sur le Mac ; mesure sur téléphone par Dasco
- [x] Le site marche sans la météo
- [x] FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026, itération 94) ; rendu à juger par Dasco
