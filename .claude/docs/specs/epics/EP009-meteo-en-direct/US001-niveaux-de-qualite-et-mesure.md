# EP009 - US001 - Niveaux de qualité, temps GPU et mesure de la pluie sur téléphone

## User Story

**En tant que** Dasco,
**je veux** que le diorama connaisse la puissance de l'appareil (qualité basse, moyenne, haute) et qu'on mesure une pluie prototype sur mon téléphone,
**afin de** n'engager les effets météo qu'en sachant ce qu'ils coûtent.

---

## Critères d'acceptation

- [ ] **Given** un téléphone, **When** le diorama démarre, **Then** `qualityLevel` vaut `medium` (`low` si `deviceMemory` vaut 3 Go ou moins), `?quality=low|medium|high` le force, et le compteur `?debug` l'affiche *(règle testée, `?quality=` vérifié dans Chrome ; à constater sur l'iPhone)*
- [x] **Given** un ordinateur, **Then** `qualityLevel` vaut `high`
- [ ] **Given** `?debug` dans Chrome (Mac, Android), **Then** le compteur affiche « GPU x.x ms » si le navigateur propose l'extension de mesure, sinon « GPU n/d » (Safari) *(Chrome du Mac vérifié ; Android et Safari non)*
- [x] **Given** `?debug&rain=2500`, **Then** la pluie prototype est dessinée en 1 appel de rendu (+1 au compteur), sans à-coup à son apparition
- [ ] **Given** la mesure de Dasco sur son iPhone (protocole ci-dessous), **Then** une ligne dans DECISIONS : budget retenu (ex. « pluie : palier de cadence inchangé, pire image + 5 ms au plus, 2 appels au plus ») et nombre de gouttes par niveau

---

## Règles métier
Voir l'[epic](epic.md), règles 8 et 9.

| Règle | Description |
|-------|-------------|
| R1 | Une seule détection de l'appareil : `scene/quality.ts` remplace la règle recopiée dans `people.ts` (l. 140) et `birds.ts` (l. 80) : pointeur tactile **ou** fenêtre de moins de 700 px (une tablette est `medium`, une fenêtre étroite d'ordinateur aussi) ; `?quality=` change aussi le nombre de passants et d'oiseaux (voulu : c'est ce qu'on veut simuler) |
| R3 | Le compteur `?debug` est chargé à la demande, comme la pluie de mesure : il sort du chunk principal |
| R2 | Le prototype de pluie n'existe que derrière `?debug&rain=N`, chargé à la demande |

### Niveaux proposés (à confirmer par la mesure)
| Effet | low | medium | high |
|-------|-----|--------|------|
| Traînées de pluie (× intensité) | 1 200 | 2 500 | 5 000 |
| Flocons | 800 | 1 500 | 3 000 |
| Sol mouillé ou enneigé, couvert, brouillard | oui | oui | oui |
| Balancement des arbres | non | arbres simples | tous |
| Nuages de maquette | non | 6 | 12 |
| Trait d'éclair | non | oui | oui |

Pour mémoire, mesuré sur le Mac (puce M1) : 3 000 traînées = +0,1 à +0,45 ms de GPU par image, cadence inchangée ; 20 000 traînées larges = −3 % d'img/s.

### Protocole de mesure (Dasco)
Mode économie d'énergie coupé ; même vue (vue d'ensemble, puis une rue) ; 10 s au repos, puis 10 s en tournant à deux doigts ; noter img/s et « pire » avec `?debug`, puis avec `?debug&rain=2500`, puis `&rain=5000` ; noter le modèle et la version d'iOS. La mesure dira aussi d'où vient le plafond de 30-31 img/s de l'iPhone : synchro à 60 Hz (le cran suivant serait 20 img/s) ou économie d'énergie.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,75 à 1 (mesure sur téléphone non comptée) |
| Complexité | Simple |
| Dépend de | — |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 5.1 (niveaux), § 4.3 (pluie prototype et mesures), § 7 ; prototype `scene/rain-proto.ts` (§ 11).

---

## Checklist dev
- [x] Branche `feat/EP009-US001-qualite-et-mesure` depuis `feat/EP009-meteo`
- [x] `npm run build` et `npm test` (`scene/quality.test.ts`) ; vérifié dans le navigateur avec `?debug` et `?quality=`
- [x] Mesure sur le Mac avec la puce graphique (le navigateur de test fait un rendu logiciel : non représentatif)
- [ ] Mesure sur téléphone par Dasco, budget noté dans DECISIONS
- [x] FEATURES, CHANGELOG, DECISIONS
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔄 Code livré le 09/10/2026 (itération 89) ; reste la mesure sur iPhone par Dasco et la ligne du budget dans DECISIONS
