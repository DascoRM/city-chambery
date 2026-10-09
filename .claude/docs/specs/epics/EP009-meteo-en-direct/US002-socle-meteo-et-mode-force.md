# EP009 - US002 - Socle météo : état, fondu, couvert, `?weather=`, puce, réglages posés au démarrage

## User Story

**En tant que** visiteur,
**je veux** que la lumière du diorama change quand le ciel est couvert, et voir la météo dans une petite puce,
**afin de** sentir le temps qu'il fait sans quitter la maquette.

---

## Critères d'acceptation

- [x] **Given** aucune météo (ni `?weather=`, ni API), **When** la carte s'ouvre, **Then** la scène est identique à aujourd'hui (lumières, exposition et fond à 12 h et 22 h, mêmes appels de rendu, au plus 2 programmes de plus : les repères sans brouillard) et rien n'attend
- [x] **Given** `?weather=cloudy`, **Then** la lumière devient plus douce et grise, les ombres s'effacent, le fond se grise (moitié du chemin en 2 s environ, fini en 10 s), **sans** image de plus de 50 ms (aucune bascule d'ombre)
- [x] **Given** `?weather=clear`, **Then** identique à aujourd'hui
- [x] **Given** `?weather=<condition>` (avec `&intensity=`, `&wind=`, `&windfrom=`, `&temp=` facultatifs), **Then** les valeurs types du contrat (`WEATHER_PRESETS`) s'appliquent, sans requête réseau ; une valeur inconnue est ignorée
- [x] **Given** `?debug`, **Then** le sélecteur (9 conditions, curseurs nuages, pluie, neige, brouillard, orage, vent) et `window.diorama.weather.set({…})` forcent une météo
- [x] **Given** la puce à côté de la puce Saison, **When** on l'ouvre, **Then** condition, température si connue, heure du modèle et état (Direct, Simulée, Forcée, Non disponible) ; « Simulée » dès que l'heure ou la saison quitte le direct, avec « Revenir au direct » ; une météo forcée (adresse, démo) reste à toute heure (question 1 posée à Dasco le 09/10)
- [x] **Given** la préférence « météo désactivée », **Then** le module météo n'est ni chargé ni exécuté par la page (le service worker, lui, pré-cache tout le code à son installation) et aucune requête `/api/weather` ; la puce propose de la réactiver
- [x] **Given** `prefers-reduced-motion`, **Then** la règle 10 de l'epic s'applique (même effet que l'interrupteur « Effets réduits » du panneau ; sans effet visible avant US005, US008 et US009)
- [x] **Given** les réglages posés au démarrage (correction des couleurs prémultipliées, voile, éclair), **Then** inactifs : image identique à aujourd'hui. *La correction ne peut pas rester active par beau temps : elle éteint les halos des bars posés sur le fond, la nuit ; elle s'active avec le brouillard (US006, qui reprend les captures avant / après)*
- [x] **Given** un écran de 1280 à 1365 px, **Then** la barre d'heure avec la puce ne passe pas sous la boussole (lever et coucher masqués, gardés dans l'info-bulle : question 3 posée à Dasco) ; à 375 et 320 px, la puce tient dans la barre (icône seule)
- [x] **Given** `npm run build` et `npm test`, **Then** ils passent ; la météo est dans un chunk à part ; le chunk principal prend 2,5 Ko gzip au plus (+ 1,2 Ko depuis le début d'EP009)

---

## Règles métier
Voir l'[epic](epic.md), règles 1, 2, 7, 9, 10, 12 et 13.

| Règle | Description |
|-------|-------------|
| R1 | Posés au démarrage, inactifs : l'objet brouillard (`scene.fog`, `near` immense), les uniformes de la passe finale (correction prémultipliée, voile, éclair), `fog: false` sur les repères de jeu, les halos des bars et la lueur au sol de la fontaine (les panneaux de parkings et les ombres « taches » restent dans le brouillard), l'objet `wind` partagé par la fumée et les drapeaux |
| R2 | Le modificateur du ciel est une fonction pure (`weather/sky.ts`, dans le module météo pour le poids) : par beau temps, il rend exactement les valeurs d'aujourd'hui (test Vitest) ; jusqu'à 20 % de nuages, rien ne change |
| R3 | Fondu indépendant de la cadence (τ = 3 s pour le ciel, 6 s pour le vent), sans dépassement ; aucun travail par image quand la météo est stable |
| R4 | `?weather=` reprend les valeurs types du contrat : même rendu que le forçage de l'admin (US012) |
| R5 | Le modificateur s'applique après le calcul de l'heure dans `daynight.apply()` : la relecture de l'horloge chaque minute ne défait jamais la météo |

---

## UI

**Écran** : barre d'heure de la carte (puce « Météo » après la puce « Saison ») et son panneau

### États UI
| État | Description |
|------|-------------|
| Direct | Icône et température sur ordinateur, icône seule sous 720 px de large |
| Simulée | Beau temps hors Direct, bouton « Revenir au direct » |
| Forcée (adresse) | `?weather=` dans l'adresse |
| Non disponible | Ciel par défaut, sans message bloquant |
| Debug | Sélecteur `?debug` ; avec US002 seule, « Direct », « Non disponible » et « Simulée » ne s'obtiennent qu'avec `diorama.weather.live(…)` (la puce reste masquée sans API ni `?weather=`) |
| Désactivée | Préférence du visiteur : rien n'est chargé |

À vérifier à 375 et 320 px de large : la barre d'heure est déjà serrée.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 3 (+ 0,25 pour la mise en page de la barre d'heure) |
| Complexité | Medium |
| Dépend de | contrat (1er commit d'US003) ; US001 conseillée avant |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 2.1 à 2.7 (points d'insertion : `daynight.ts` après la l. 86, `tiltshift.ts` l. 87-89, `stage.ts` l. 23, `markers.ts`, `ui.ts`, `main.ts`), § 3 (fichiers, chargement à la demande, fondu, `?weather=`, Direct ou simulée) et § 4.1 (couvert).

---

## Checklist dev
- [x] Branche `feat/EP009-US002-socle-meteo` depuis `feat/EP009-meteo`
- [x] `npm run build` et `npm test` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [x] Fluidité : compteur `?debug` avant / après, aucune image de plus de 50 ms quand la météo change (rendu logiciel non représentatif : mesure GPU sur le Mac notée à part)
- [x] Le site marche sans la météo
- [x] FEATURES, CHANGELOG, DECISIONS, README (puce, `?weather=`)
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026, itération 90) ; rendu du couvert et mise en page à juger par Dasco
