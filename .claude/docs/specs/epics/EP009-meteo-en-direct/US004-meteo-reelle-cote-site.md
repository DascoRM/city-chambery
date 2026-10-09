# EP009 - US004 - Météo réelle côté carte : lecture, relances, états, crédits

## User Story

**En tant que** visiteur,
**je veux** que la météo affichée soit celle de Chambéry en ce moment,
**afin que** le diorama reflète la ville réelle.

---

## Critères d'acceptation

- [x] **Given** l'API disponible, **When** le diorama démarre, **Then** la météo arrive après la scène (jamais devant l'écran de chargement) et s'installe en fondu depuis le beau temps ; la puce dit « modèle ICON, 10 h 00 (il y a 6 min) »
- [x] **Given** 503 `meteo-indisponible`, un délai de 8 s dépassé ou hors ligne, **Then** ciel par défaut, « Météo non disponible » (dès que la carte est prête : la lecture part pendant le chargement de la ville), nouvel essai à 60 s, puis 2, 4 et 8 min (au plus 15), et au retour du réseau. *Après un succès, une panne passagère garde le dernier relevé, marqué « Ancien relevé », jusqu'à 3 h (question 2 posée à Dasco)*
- [x] **Given** 404 (carte du Pi, sans API), **Then** ciel par défaut, puce masquée, aucune relance
- [x] **Given** 503 `meteo-desactivee`, **Then** ciel par défaut, « Météo désactivée », relue dans 15 min
- [x] **Given** une réponse hors contrat (`v: 2`, intensité supérieure à 1, condition inconnue, page HTML), **Then** ciel par défaut et relance, sans exception
- [x] **Given** l'onglet caché, ou aucune interaction depuis 30 min, **Then** aucune requête ; au retour, relecture si le relevé a plus de 15 min *(vérifié par les tests, avec de fausses minuteries ; pas dans le navigateur)*
- [x] **Given** une météo forcée par l'admin, **Then** « Météo forcée (démo) », sans température ; **Given** `stale`, ou un relevé de plus d'1 h, **Then** « Ancien relevé (il y a 1 h 10) » ; **Given** un relevé de plus de 3 h (horloge du visiteur, même sans relecture), **Then** ciel par défaut ; une météo forcée, elle, vaut jusqu'à `forcedUntil`
- [x] **Given** de la neige annoncée à plus de 2 °C, **Then** de la pluie
- [x] **Given** les crédits, **Then** « Météo : Open-Meteo.com » avec lien et CC BY 4.0 en bas à droite (visible sur mobile : la barre d'outils monte au-dessus du pied de page) et dans l'écran d'accueil ; le panneau de la puce montre `attribution` (texte, lien, licence) ; rien pour une météo forcée

---

## Règles métier
Voir l'[epic](epic.md), règles 1, 2, 6, 7, 11 et 13.

| Règle | Description |
|-------|-------------|
| R1 | Réponse vérifiée par `weatherResponse.safeParse`, comme les retouches des parkings ; le code ne lève jamais d'exception vers `main()` (tout passe par `{ ok: false, reason }`) |
| R2 | La météo est gardée en mémoire seulement : ni `localStorage`, ni service worker (`/api` n'est pas mis en cache : rien à changer dans `vite.config.ts`) |
| R3 | Priorité : `?weather=`, puis forçage de l'admin, puis direct |

---

## UI

### États de la puce
| État | Description |
|------|-------------|
| Direct | « Pluie, 13 °C · modèle ICON, 10 h 00 (il y a 6 min) » |
| Ancien relevé | `stale` : « Ancien relevé (il y a 1 h 10) » |
| Forcée (démo) | Forçage de l'admin : sans température, sans crédit |
| Non disponible | Ciel par défaut, relances en arrière-plan |
| Désactivée | Coupée depuis l'admin, relue dans 15 min |
| Masquée | Carte du Pi (404) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1 à 1,5 (+ 0,25 pour la mise en page mobile du pied de page) |
| Complexité | Medium |
| Dépend de | US002, US003 (fusionnée, ou `npm run api:dev` en local) |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 3 (client, réponses tolérées, rafraîchissement, fondu, puce) et § 2.6 (crédits) ; [plan back v2](../../../tasks/ep009-back-plan-v2.md) § 5.7 et § 14.7 (délai de 8 s, nouvel essai à 60 s).

---

## Checklist dev
- [x] Branche `feat/EP009-US004-meteo-reelle-carte` depuis `feat/EP009-meteo`
- [x] `npm run build` et `npm test` (`weather/client.test.ts`) ; vérifié dans le navigateur avec l'API locale, sans API, hors ligne et avec le build du Pi
- [ ] Prévisualisation : la carte reçoit la météo réelle
- [x] Le site marche sans la météo
- [x] FEATURES, CHANGELOG, DECISIONS, README (Licences)
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026, itération 91) ; à voir par Dasco sur la prévisualisation
