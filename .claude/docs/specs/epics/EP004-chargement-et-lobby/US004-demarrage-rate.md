# EP004 - US004 - Un message lisible quand le démarrage échoue

## User Story

**En tant que** visiteur dont le chargement a échoué,
**je veux** un message clair et un moyen de réessayer,
**afin de** ne pas rester devant une page vide ou un message de développeur.

---

## Critères d'acceptation

- [ ] **Given** `city.json` ne se charge pas, **When** le visiteur arrive, **Then** il voit un message lisible (« La ville n'a pas pu se charger ») et un bouton « Réessayer », pas « Lance `npm run data` »
- [ ] **Given** une erreur après le chargement des données (terrain, monuments…), **When** elle remonte, **Then** le message lisible s'affiche au lieu d'une page vide (garde autour de `main()`)
- [ ] **Given** un développeur en mode dev, **When** la même erreur arrive, **Then** le détail technique (et l'indication `npm run data`) reste visible
- [ ] **Given** un échec, **When** je clique sur « Réessayer », **Then** la page se recharge
- [ ] **Given** une étape facultative qui échoue (mascottes, arbres modélisés…), **When** elle échoue, **Then** la carte démarre quand même, comme aujourd'hui (message dans la console seulement)

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Les étapes **indispensables** (données, relief, bâtiments) arrêtent le démarrage avec le message ; les étapes **facultatives** (mascottes, passants, oiseaux, cheminées, drapeaux) ne l'arrêtent pas |
| R2 | Le message visiteur est court et en français ; le détail technique reste dans la console et en mode dev |
| R3 | Même style que la page de chargement (US002) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Hors ligne, première visite | Message adapté (« Pas de connexion ») |
| Erreur WebGL (navigateur sans accélération) | Message dédié si on peut la détecter |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 2 |
| Complexité | Simple |

---

## Checklist dev

- [ ] Code implémenté (`src/main.ts`, `src/ui/loading.ts`)
- [ ] `npm run build` passe
- [ ] Vérifié en coupant le réseau et en renommant `city.json`
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
