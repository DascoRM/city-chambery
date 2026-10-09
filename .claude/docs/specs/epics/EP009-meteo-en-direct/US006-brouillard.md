# EP009 - US006 - Brouillard

## User Story

**En tant que** visiteur,
**je veux** voir le brouillard noyer le bout de la ville,
**afin de** retrouver les matins de brouillard de la cluse.

---

## Critères d'acceptation

- [x] **Given** `?weather=fog`, **Then** le devant de la ville reste lisible *(intensité type ramenée de 0,8 à 0,6 par Dasco le 09/10 : 0,8 noyait la ville de jour)* et le fond se fond dans la couleur du fond de page, de jour comme de nuit, **sans liseré clair** autour du socle
- [x] **Given** la caméra qui s'approche ou s'éloigne, **Then** le brouillard reste proportionné (léger de près)
- [x] **Given** la nuit, **Then** les halos des bars, les gemmes ✦ et les épingles percent le brouillard (D12)
- [x] **Given** les étiquettes et l'interface, **Then** elles restent nettes et lisibles (contraste des boutons vérifié sur fond gris)
- [x] **Given** le brouillard activé puis coupé dix fois, **Then** aucune image de plus de 50 ms et aucun programme nouveau (compteur)

---

## Règles métier
Voir l'[epic](epic.md), règle 9.

| Règle | Description |
|-------|-------------|
| R1 | Brouillard **linéaire** (`THREE.Fog`), créé au démarrage : en vue d'ensemble, tout le socle est entre 2 200 et 3 500 m de la caméra, une densité fixe (`FogExp2`) noierait tout uniformément ; `near` et `far` suivent la distance entre la caméra et le point regardé |
| R2 | Ensuite, seuls `near`, `far` et la couleur changent : 9 à 10 ms, aucune recompilation (mesuré) |
| R3 | Couleur = couleur du bord du fond CSS passée dans l'inverse exact du rendu des tons (ACES) : un fragment noyé s'affiche exactement comme le fond (testé à moins de 1/255) |
| R4 | Voile léger dans la passe finale, en complément (baisse de contraste, couleur du fond) |
| R5 | Brouillard « de vallée » en nappes : écarté (transparence sur une grande surface, coûteuse sur mobile) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 |
| Complexité | Medium |
| Dépend de | US002 (objet brouillard posé au démarrage, correction de la passe finale) |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 4.2 et § 2.3 ; prototype `scene/weather-color.ts` et ses 5 tests (§ 11). Risques : réglage esthétique (densité, voile) ; éléphants dans le brouillard (D12).

---

## Checklist dev
- [x] Branche `feat/EP009-US006-brouillard` depuis `feat/EP009-meteo`
- [x] `npm run build` et `npm test` (`weather/fog.test.ts`) ; vérifié dans le navigateur avec `?weather=fog` et `?debug`, de jour et de nuit (crépuscule : par l'agent)
- [x] Fluidité : compteur `?debug` avant / après, aucun programme nouveau
- [x] Le site marche sans la météo
- [x] FEATURES, CHANGELOG, DECISIONS
- [x] Validé par Dasco (09/10 : « le brouillard fonctionne », 0,6 ; halos des bars et bâtiments la nuit : « c'est ok »)

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026, itération 93) ; épaisseur et halos à juger par Dasco
