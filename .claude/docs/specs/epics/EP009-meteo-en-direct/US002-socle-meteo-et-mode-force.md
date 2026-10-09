# EP009 - US002 - Socle météo : état, fondu, couvert, `?weather=`, puce, réglages posés au démarrage

## User Story

**En tant que** visiteur,
**je veux** que la lumière du diorama change quand le ciel est couvert, et voir la météo dans une petite puce,
**afin de** sentir le temps qu'il fait sans quitter la maquette.

---

## Critères d'acceptation

- [ ] **Given** aucune météo (ni `?weather=`, ni API), **When** la carte s'ouvre, **Then** la scène est identique à aujourd'hui (captures à 12 h et 22 h, mêmes appels de rendu) et rien n'attend
- [ ] **Given** `?weather=cloudy`, **Then** en 3 s environ la lumière devient plus douce et grise, les ombres s'effacent, le fond se grise, **sans** image de plus de 50 ms (aucune bascule d'ombre)
- [ ] **Given** `?weather=clear`, **Then** identique à aujourd'hui
- [ ] **Given** `?weather=<condition>` (avec `&intensity=`, `&wind=`, `&windfrom=` facultatifs), **Then** les valeurs types du contrat (`WEATHER_PRESETS`) s'appliquent, sans requête réseau ; une valeur inconnue est ignorée
- [ ] **Given** `?debug`, **Then** le sélecteur (9 conditions, curseurs nuages, pluie, neige, brouillard, orage, vent) et `window.diorama.weather.set({…})` forcent une météo
- [ ] **Given** la puce à côté de la puce Saison, **When** on l'ouvre, **Then** condition, température si connue, heure du modèle et état (Direct, Simulée, Forcée, Non disponible) ; « Simulée » dès que l'heure ou la saison quitte le direct, avec « Revenir au direct »
- [ ] **Given** la préférence « météo désactivée », **Then** aucun chunk météo téléchargé ni aucune requête `/api/weather` ; la puce propose de la réactiver
- [ ] **Given** `prefers-reduced-motion`, **Then** la règle 10 de l'epic s'applique (même effet que l'interrupteur « Effets réduits » du panneau)
- [ ] **Given** la correction de la passe finale (couleurs prémultipliées), **Then** bords du socle et particules sur le fond inchangés à l'œil, de jour, de nuit et avec l'effet maquette (captures avant / après)
- [ ] **Given** `npm run build` et `npm test`, **Then** ils passent ; la météo est dans un chunk à part ; le chunk principal prend 2,5 Ko gzip au plus

---

## Règles métier
Voir l'[epic](epic.md), règles 1, 2, 7, 9, 10, 12 et 13.

| Règle | Description |
|-------|-------------|
| R1 | Posés au démarrage, inactifs : l'objet brouillard (`scene.fog`, `near` immense), les uniformes de la passe finale (voile, éclair), `fog: false` sur les repères de jeu, l'objet `wind` partagé par la fumée et les drapeaux |
| R2 | Le modificateur du ciel est une fonction pure (`scene/weather-sky.ts`) : par beau temps, il rend exactement les valeurs d'aujourd'hui (test Vitest) |
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
| Désactivée | Préférence du visiteur : rien n'est chargé |

À vérifier à 375 et 320 px de large : la barre d'heure est déjà serrée.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 3 |
| Complexité | Medium |
| Dépend de | contrat (1er commit d'US003) ; US001 conseillée avant |

Détail technique : [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 2.1 à 2.7 (points d'insertion : `daynight.ts` après la l. 86, `tiltshift.ts` l. 87-89, `stage.ts` l. 23, `markers.ts`, `ui.ts`, `main.ts`), § 3 (fichiers, chargement à la demande, fondu, `?weather=`, Direct ou simulée) et § 4.1 (couvert).

---

## Checklist dev
- [ ] Branche `feat/EP009-US002-socle-meteo` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après, aucune image de plus de 50 ms quand la météo change (rendu logiciel non représentatif : mesure GPU sur le Mac notée à part)
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, README (puce, `?weather=`)
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
