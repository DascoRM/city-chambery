# EP009 - US012 - Météo dans l'administration : écran, forçage pour les démos, coupure

## User Story

**En tant que** Dasco,
**je veux** voir la météo que reçoivent les visiteurs, et pouvoir en forcer une pour une démo ou la couper,
**afin de** montrer la neige ou l'orage à tous les amis en même temps, et de réagir à une panne.

---

## Critères d'acceptation

**Back**
- [ ] **Given** aucune session, **When** `GET /api/admin/weather` ou `PUT /api/admin/weather/override`, **Then** 401
- [ ] **Given** une session, **When** `GET /api/admin/weather`, **Then** 200 conforme à `adminWeatherResponse` (réponse publique, relevé brut et point de grille, forçage, compteurs de l'instance présentés comme tels), `no-store`
- [ ] **Given** une session, **When** `PUT { mode: 'forcee', condition: 'snow', intensity: 0.9, minutes: 30, note }`, **Then** la réponse publique devient `forced: true`, `source: 'admin'`, `condition: 'snow'`, `temperatureC: null`, `attribution: null` : tout de suite sur cette instance, au plus 30 min après sur une autre instance déjà démarrée, plus 2 min au plus de cache du CDN
- [ ] **Given** la durée écoulée, **Then** retour à la météo réelle, sans action ni écriture
- [ ] **Given** `PUT { mode: 'coupee', minutes: 60 }`, **Then** `GET /api/weather` répond 503 `meteo-desactivee` (la carte garde son ciel par défaut)
- [ ] **Given** `DELETE /api/admin/weather/override`, **Then** 204 et météo réelle ; sans forçage en cours, 404
- [ ] **Given** une valeur illisible dans `app_meta`, **Then** elle est ignorée (météo réelle) et signalée dans les journaux
- [ ] **Given** la base indisponible, **Then** `PUT` et `DELETE` répondent 503 `base-indisponible`, et la route publique continue sans forçage après 1,5 s au plus
- [ ] **Given** chaque changement, **Then** une ligne de journal, absente du journal des parkings
- [ ] **Given** un forçage en cours, **Then** l'écran montre aussi le relevé réel (le service relit la source pour la vue admin)
- [ ] **Given** la fin d'un forçage (`forcedUntil`), **Then** la carte relit `/api/weather` peu après (en tenant compte des 2 min du CDN) au lieu d'attendre sa relecture de 15 min (aujourd'hui, elle abandonne le forçage à l'heure dite et affiche « Indisponible » jusqu'à la relecture)

**Écran « Météo »**
- [ ] **Given** l'onglet « Météo », **Then** quatre cartes : ce que voient les visiteurs (libellé, température, âge, pastille Direct, Ancien relevé, Forcée, Coupée ou Indisponible), relevé brut (point de grille, valeurs et unités d'Open-Meteo), cette instance de l'API (appels à la source, échecs, dernière erreur, avec « compteurs depuis le démarrage de cette instance, ce ne sont pas des totaux »), forcer la météo ; relu toutes les 60 s quand la page est ouverte
- [ ] **Given** le formulaire (React Hook Form, validé par `weatherOverrideInput`), **Then** forcer ou couper, condition (9 libellés), intensité et vent facultatifs, durée de 15 min à 6 h (1 h par défaut), note ; avertissement « Visible par tous les visiteurs d'ici 1 à 2 minutes ; retour automatique à la fin » ; bouton « Revenir à la météo réelle »
- [ ] **Given** une condition choisie, **Then** un lien « Aperçu sur la carte » ouvre `/?weather=<condition>&intensity=<x>` : même rendu que le forçage, à vérifier avant de l'imposer à tous
- [ ] **Given** la prévisualisation avec sa base, **When** Dasco force la neige 15 min, **Then** son téléphone la montre en moins de 2 min (avec US004 côté carte)

---

## Règles métier
Voir l'[epic](epic.md), règles 1, 11 et 13.

| Règle | Description |
|-------|-------------|
| R1 | Forçage rangé dans `app_meta` (clé `meteo.forcage`, valeur JSON vérifiée par le contrat à l'écriture et à la lecture) : aucune migration (D8) |
| R2 | Lecture bornée par instance : au plus toutes les 30 min sans forçage connu, toutes les 2 min pendant un forçage, jamais plus de 1,5 s d'attente ; l'écriture met aussi à jour la mémoire de l'instance qui la reçoit |
| R3 | Routes sous le routeur admin : session, même origine, JSON seulement (comme les parkings) |
| R4 | Auteur du forçage = `sub` de la session (`admin` aujourd'hui, le compte après EP008) ; la note sert à donner un motif, pas une donnée personnelle (l'écran le dit) |
| R5 | Journal : aujourd'hui `edit_log` (`target: 'meteo'`, actions `meteo-forcee`, `meteo-coupee`, `meteo-reelle`), exclu de la liste des parkings ; après EP008-US013, `audit_log` (`table_name: 'app_meta'`, `row_id: 'meteo.forcage'`) |
| R6 | Aucun HTML construit à partir de données (`check-boundaries`) |

---

## API

### Endpoints
```
GET    /api/admin/weather            → 200 adminWeatherResponse
PUT    /api/admin/weather/override   → 200 weatherOverride (corps : weatherOverrideInput)
DELETE /api/admin/weather/override   → 204
```

### Erreurs
| Code | Corps | Cause |
|------|-------|-------|
| 400 | `donnees-invalides` | Condition absente pour `forcee`, durée hors de 5 à 360 min, condition inconnue |
| 401 | `non-autorise` ou `session-expiree` | Pas de session valide |
| 404 | `introuvable` | `DELETE` sans forçage en cours |
| 503 | `base-indisponible` | Pas de base |

---

## Cas limites

| Cas | Comportement attendu |
|-----|---------------------|
| Base en veille (Neon) | La route publique attend 1,5 s au plus, puis répond avec le dernier état connu du forçage et relit la base 60 s plus tard |
| Onglet de la carte resté ouvert | La carte ne relit plus après 30 min sans interaction (US004) : un onglet oublié ne réveille pas la base. Sans cette règle, ≈ 30 CU-h de Neon par mois pour un onglet ouvert 24 h/24, sur 100 gratuites [estimé] |
| Forçage écrit à la main, hors contrat | Ignoré : météo réelle |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1 à 1,25 (back ≈ 0,5, écran ≈ 0,6, vérification sur la prévisualisation) |
| Complexité | Medium |
| Dépend de | US003 ; de préférence EP008-US013 (journal avec auteur) |

Détail technique : [plan back v2](../../../tasks/ep009-back-plan-v2.md) § 6 (stockage comparé, réveils de Neon, routes, écran, journal) et § 9 (coordination avec EP008) ; [plan front v2](../../../tasks/ep009-front-plan-v2.md) § 7 (lien d'aperçu).

---

## Checklist dev
- [ ] Branche `feat/EP009-US012-meteo-admin` depuis `feat/EP009-meteo`
- [ ] `npm run build` et `npm test` (back et `Meteo.test.tsx`)
- [ ] Prévisualisation avec sa base (`DATABASE_URL_PREVIEW`) : forçage, coupure, retour, vus depuis un téléphone
- [ ] EP008 prévenue de la correspondance du journal (`edit_log` vers `audit_log`)
- [ ] FEATURES, CHANGELOG, DECISIONS, README
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
