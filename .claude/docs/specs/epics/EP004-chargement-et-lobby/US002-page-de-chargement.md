# EP004 - US002 - Une page de chargement standard dès l'ouverture

## User Story

**En tant que** visiteur qui ouvre le site,
**je veux** voir tout de suite un écran qui me dit que ça charge et où ça en est,
**afin de** ne pas croire que la page est vide ou cassée.

---

## Critères d'acceptation

- [ ] **Given** j'ouvre le site, **When** la page arrive, **Then** un écran de chargement (nom du projet, indicateur) s'affiche avant que le code de l'appli soit téléchargé (HTML et CSS dans `index.html`)
- [ ] **Given** la ville se charge, **When** une étape se termine (données, relief, bâtiments, arbres, monuments, mascottes…), **Then** l'indicateur avance et le texte nomme l'étape en cours
- [ ] **Given** le chargement se termine, **When** la ville est prête, **Then** l'écran de chargement s'efface en fondu et laisse place au lobby (US003)
- [ ] **Given** une connexion lente, **When** le chargement dépasse quelques secondes, **Then** un message rassure (« ça arrive, la ville est détaillée ») sans fausse promesse de durée
- [ ] **Given** `?debug` ou `?lobby=0`, **When** j'ouvre le site, **Then** la page de chargement reste affichée pendant le chargement, puis la carte s'ouvre directement, sans lobby
- [ ] **Given** une visite hors ligne (service worker), **When** le chargement est rapide, **Then** l'écran ne clignote pas (durée minimale d'affichage d'une fraction de seconde, ou pas d'écran si tout est déjà prêt)
- [ ] **Given** `prefers-reduced-motion`, **When** l'indicateur s'anime, **Then** l'animation est réduite à un changement simple
- [ ] **Given** `?debug`, **When** je compare avec avant, **Then** le temps de chargement de la carte n'augmente pas de façon sensible

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | L'écran initial est autonome : HTML et CSS en ligne dans `index.html`, aucune ressource externe pour s'afficher (la police du projet arrive plus tard : police système d'abord) |
| R2 | La progression est **réelle** : un petit module (`src/ui/loading.ts`) reçoit les étapes de `main()` ; il ne simule rien |
| R3 | Style **standard** : sobre, aux couleurs du projet (fond crème, or et turquoise), prêt à être remplacé par la US005 sans toucher à `main()` |
| R4 | L'écran est retiré du DOM une fois fini (pas de couche invisible qui bloque les clics) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| JavaScript désactivé | Message « Cette carte demande JavaScript » dans l'écran initial |
| Une étape échoue | Voir US004 |
| Chargement quasi instantané | Pas de clignotement |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [ ] Code implémenté (`index.html`, `src/ui/loading.ts`, `main.ts`)
- [ ] `npm run build` passe
- [ ] Vérifié avec une connexion lente simulée
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
