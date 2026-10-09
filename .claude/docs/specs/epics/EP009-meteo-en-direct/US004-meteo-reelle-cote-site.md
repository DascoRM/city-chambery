# EP009 - US004 - Météo réelle côté site : récupération, relances, crédits

## User Story

**En tant que** visiteur,
**je veux** que la météo affichée soit celle de Chambéry en ce moment,
**afin de** que le diorama reflète la ville réelle.

---

## Critères d'acceptation

- [ ] **Given** l'API disponible, **When** le diorama démarre, **Then** la météo arrive après le chargement (délai max 3 s) et s'installe en fondu
- [ ] **Given** l'onglet visible, **Then** la météo est relue toutes les 15 minutes ; rien n'est demandé quand l'onglet est caché
- [ ] **Given** hors ligne ou API en panne, **Then** ciel par défaut, puce « Météo non disponible », nouvel essai au retour du réseau
- [ ] **Given** la neige annoncée avec une température > 2 °C, **Then** la scène montre de la pluie
- [ ] **Given** les crédits de l'app, **Then** « Météo : Open-Meteo.com (CC BY 4.0) » y figure avec un lien, et le README (section Licences) est à jour

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 10.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 1,5 |
| Complexité | Medium |
| Dépend de | US002, US003 |

Détail technique : [plan front](../../../tasks/meteo-front-plan.md) § 6 et [plan back](../../../tasks/meteo-back-plan.md) § 3 (le service worker ne met pas la météo en cache).

---

## Checklist dev
- [ ] Code ; `npm run build` ; vérifié dans le navigateur avec `?weather=` et `?debug`
- [ ] Fluidité : compteur `?debug` avant / après (rendu logiciel non représentatif : mesure GPU ou téléphone notée à part)
- [ ] Le site marche sans la météo
- [ ] FEATURES, CHANGELOG, DECISIONS, README si besoin
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
