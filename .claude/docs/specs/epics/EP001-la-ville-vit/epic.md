# Epic EP001 - La ville vit

**Statut : 📝 spec à valider par Dasco** (rédigée le 30/09/2026, aucune ligne de code écrite)

## Résumé
Faire vivre le diorama : des passants dans les rues (plus nombreux de jour, des petits groupes devant les bars
ouverts la nuit), des fenêtres qui s'allument et s'éteignent, des pigeons, de la fumée de cheminée, des drapeaux,
et des détails de façade (auvents, portes, balcons…) tirés du pack de bâtiments Kenney.

---

## Contexte & Problème
Le diorama est beau à l'arrêt, mais seuls les quatre éléphants bougent. Les visiteurs (les amis testeurs, sur
ordinateur ou téléphone) regardent une maquette immobile, où la nuit ne change que la lumière. L'hypothèse du POC est
qu'explorer le quartier doit être assez plaisant pour y passer dix minutes : une ville qui vit donne des raisons de
zoomer, de revenir à une autre heure, et de regarder ce qui se passe devant un bar ouvert à 23 h.

Les fondations sont faites (itérations 39 à 43) : réseau de voies partagé (`walkways.ts`), liste de modules de la
boucle de rendu (`Ticker`), cadence à 30 images/s au repos, `three.js` séparé du code de l'appli.

---

## Décisions de Dasco (30/09/2026)

| Sujet | Décision |
|---|---|
| Style des passants | **Silhouettes simples d'abord** (figurines low-poly instanciées) ; des personnages animés restent une option, non planifiée (US010) |
| Autres « vies » | Fenêtres qui s'allument / s'éteignent, pigeons et oiseaux, fumée de cheminées, drapeaux. **Pas de voitures ni de bus** |
| Interaction | **Décor seulement** : pas de clic sur les passants, ils ne réagissent ni aux éléphants ni au jeu |
| Pack de bâtiments (`assets-src/buiding`, Kenney) | **Détails de façade sur les bâtiments existants** (auvents, portes, balcons, climatiseurs, lucarnes). Les 2 067 bâtiments OSM restent tels quels |

---

## Objectifs
- Des passants qui marchent sur les voies piétonnes, sans traverser les bâtiments, à une densité qui suit l'heure
- La nuit : moins de monde dans les rues, des groupes devant les bars, pubs et boîtes de nuit ouverts (horaires OSM)
- Des animations discrètes de jour comme de nuit : fenêtres, pigeons, fumée en automne et en hiver, drapeaux
- Des détails de façade qui donnent vie aux rues commerçantes (auvents colorés selon la catégorie du lieu)
- Sans perdre en fluidité, notamment sur mobile, et sans toucher au jeu des éléphants

---

## Hors scope
- Voitures, bus, vélos
- Personnages animés (marche en squelette) : US010, optionnelle, non planifiée
- Passants cliquables, anecdotes, réactions aux éléphants (décision ci-dessus)
- Remplacer les bâtiments OSM par des assemblages de modules : c'est une autre epic (« bâtiments »), à part
- Back-end, comptes, partage entre amis

---

## User Stories

| ID | User Story | Priorité | Points | Dépend de | Status |
|----|------------|----------|--------|-----------|--------|
| [US001](US001-passants-de-jour.md) | Des passants qui marchent dans les rues, de jour | High | 5 | — | 🔲 Todo |
| [US002](US002-rythme-jour-nuit.md) | Le monde suit l'heure : rues plus calmes la nuit, groupes devant les bars ouverts | High | 5 | US001 | 🔲 Todo |
| [US003](US003-fenetres-qui-vivent.md) | Des fenêtres qui s'allument et s'éteignent au fil de la soirée | High | 2 | — | 🔲 Todo |
| [US004](US004-pigeons-et-oiseaux.md) | Des pigeons sur les places et des oiseaux autour des monuments | Medium | 3 | — | 🔲 Todo |
| [US005](US005-fumee-de-cheminees.md) | De la fumée qui sort de cheminées, en automne et en hiver | Medium | 3 | — | 🔲 Todo |
| [US006](US006-drapeaux.md) | Des drapeaux qui flottent sur des mâts sourcés | Medium | 3 | décision sur les emplacements | 🔲 Todo |
| [US007](US007-preparer-le-pack-kenney.md) | Préparer le pack de bâtiments Kenney (nom, licence, conversion) | Medium | 3 | — | 🔲 Todo |
| [US008](US008-auvents-des-lieux.md) | Des auvents devant les bars, cafés et restaurants | Medium | 5 | US007 | 🔲 Todo |
| [US009](US009-details-de-facade.md) | Portes, balcons, climatiseurs et lucarnes sur les façades et les toits | Low | 5 | US007 (US008 conseillée) | 🔲 Todo |
| [US010](US010-personnages-animes.md) | *(Option)* Des personnages animés près de la caméra | Low | — | US001, US002 | ⏸ Non planifiée |

Ordre conseillé : US001 → US002 → US003 → US004 → US005 → US006 → US007 → US008 → US009. Les US003 à US006
sont indépendantes des passants et peuvent passer avant si Dasco veut un effet visible plus vite (US003, la plus
courte, est un bon premier pas).

---

## Flux principal
```
Ouverture de la carte (12 h) → zoom dans la rue de Boigne → des passants marchent, des pigeons sur la place
→ curseur sur 19 h → les fenêtres s'allument une à une → 23 h : rues presque vides, un groupe devant un bar ouvert
→ hiver : des panaches de fumée sur les toits → l'auvent d'un restaurant, à la façade, côté rue
```

---

## Règles métier de l'epic
1. **Décor seulement** : rien de ce qui est ajouté n'est cliquable (les clics passent à travers : les zones de
   sélection des gemmes, épingles et éléphants restent les seules cibles) et rien ne change le jeu.
2. **Rien d'inventé** (règle du projet) : les positions qui affirment quelque chose (un mât de drapeau, un lieu ouvert)
   viennent d'OpenStreetMap ou de Dasco. Le reste (passants, pigeons, cheminées, auvents) est du décor, et la section
   « Limites connues » du README le dit.
3. **Réglages dans `src/content/life.json`**, comme `mascot.json` et `nature.json` : nombres, courbe horaire,
   vitesses, échelle, saisons de la fumée. Documentés dans le README.
4. **Fluidité** : chaque US mesure avant / après avec `?debug` (images/s, appels de rendu, triangles) sur Chrome avec
   la carte graphique (la mémoire « tests avec GPU » décrit le réglage) et, dès que possible, sur un vrai téléphone.
   Budget de l'epic (à confirmer par les mesures) : au plus **+25 appels de rendu** et **+0,5 M de triangles**
   (aujourd'hui ≈ 2 400 appels et ≈ 1,5 M de triangles par image), tout en instances.
5. **Cadence au repos** : les animations lentes et continues (passants, pigeons au sol, fumée, drapeaux) ne comptent
   **pas** comme « ça bouge » (`Ticker.moving()` reste faux) : la carte reste à 30 images/s au repos, comme avec les
   éléphants. Seuls les événements brefs qui demandent de la fluidité l'utilisent.
6. **Ombres** : la carte d'ombres n'est recalculée que quand le soleil bouge ; ce qui bouge ne projette donc pas
   d'ombre. Les passants ont une pastille d'ombre au sol (comme les éléphants), les pigeons aucune.
7. **Mobile** : un facteur de densité réduit le nombre de passants et d'oiseaux sur les petits écrans et les
   appareils tactiles (valeur de départ : ×0,5, à régler).
8. **Licences** : tout asset tiers a sa licence dans le README (section Licences), avec un crédit dans l'application
   seulement si la licence l'exige (règle 5 du projet).
9. **Après un changement du script de données** (par exemple mâts de drapeaux dans la requête Overpass) :
   `npm run data -- --offline` ; `public/data/city.json` n'est jamais modifié à la main.

---

## Questions ouvertes (à trancher avec Dasco avant de coder)

| # | Question | Proposition par défaut |
|---|---|---|
| Q1 | **Échelle des passants** : taille réelle (1,7 m) ou agrandie comme l'éléphant (4,5 m au lieu de 3 à 4 m) ? Au zoom maximal, 1,7 m fait environ 45 pixels de haut ; de loin, ils sont invisibles | ×1,5 (≈ 2,5 m), réglable dans `life.json` |
| Q2 | **Grandes rues** (`primary`, `secondary`, `tertiary`, ≈ 255 tronçons) : les trottoirs séparés ne sont pas dans les données. Les passants marchent-ils sur l'axe de ces rues, les traversent-ils seulement aux carrefours, ou les évitent-ils ? | Rues piétonnes, résidentielles, chemins et cours ; traversée des grandes rues aux carrefours seulement (à vérifier : le réseau doit rester d'un seul tenant) |
| Q3 | **Fumée** : seulement en automne et en hiver (saison de l'horloge), ou toute l'année ? | Automne et hiver, plus dense l'hiver et aux heures froides (matin, soir) |
| Q4 | **Drapeaux** : quels bâtiments (château, hôtel de ville, Carré Curial…) et quels motifs ? Aucune donnée dans notre extrait OSM (la requête actuelle ne demande pas `man_made=flagpole`) | Ajouter `man_made=flagpole` à la requête et voir ce qu'OSM contient ; sinon Dasco place les mâts avec l'outil de placement |
| Q5 | **Couleur des auvents** : celle de la catégorie du lieu (violet bar, bleu café, orange restaurant, comme les épingles) ou des couleurs libres ? | Couleur de la catégorie : lisible, et cohérent avec la légende (qui masque aussi les auvents d'une catégorie décochée) |
| Q6 | **Nom du dossier** `assets-src/buiding` (faute de frappe) | Le renommer `assets-src/kenney-buildings` (US007) |
| Q7 | **Lieux sans horaires OSM** : 65 lieux sur 169 n'ont pas d'horaire utilisable (63 sans horaires, 2 au texte illisible), dont 15 bars sur 25, 4 pubs sur 7 et les 4 boîtes de nuit sans horaires du tout (seuls 10 bars et 3 pubs en ont). Sans eux, presque personne devant les bars la nuit. Ont-ils des groupes ? | Oui pour bars, pubs et boîtes de nuit, entre 21 h et 2 h, avec un poids réduit (×0,5) : c'est du décor, déclaré comme tel dans « Limites connues ». Un lieu dont l'horaire OSM dit « fermé » n'a jamais de groupe |
| Q8 | **Légende** : quand la case « Bars » est décochée, les groupes de passants devant les bars restent-ils ? (la légende masque aujourd'hui les épingles et les halos) | Oui : la légende ne concerne que les épingles et les halos ; les auvents (US008), eux, suivent la légende |

---

## Risques

| Risque | Effet | Parade |
|---|---|---|
| Réseau piéton des passants trop morcelé (une fois les grandes rues et les façades retirées) | Passants confinés à quelques îlots | Mesurer la plus grande partie connexe en US001 ; repli : accepter les axes de grandes rues |
| Coût des passants sur mobile | Images/s en baisse | Instanciation, foule limitée autour du point visé (voir US001), facteur mobile, mesure sur téléphone |
| Décor qui passe pour des faits (mât, cheminée, auvent) | Contredit la règle « rien d'inventé » | Règle 2, section « Limites connues » du README |
| Échelle et couleurs du pack Kenney différentes de celles du diorama | Détails qui jurent avec la maquette | Conversion avec la palette du projet (US007), essai sur un bâtiment avant le lot |
| Licence du pack Kenney non confirmée (aucun fichier de licence dans le dossier) | Impossible de publier le pack | Vérifier sur le site de l'auteur avant la conversion ; Kenney publie habituellement ses packs en CC0 |

---

## Critères d'acceptation de l'epic
- [ ] Les US 001 à 009 sont terminées (ou écartées par Dasco, avec la raison dans DECISIONS)
- [ ] `npm run build` passe ; les mesures `?debug` de chaque US sont dans le CHANGELOG
- [ ] Budget de fluidité respecté ; la carte reste à 30 images/s au repos avec tout activé
- [ ] Le jeu des éléphants fonctionne comme avant (clic, survol, retour à la fontaine)
- [ ] README à jour : `life.json`, structure du code, Limites connues, Licences
- [ ] Revue de Dasco sur son téléphone et sur son ordinateur

---

## Estimation globale
- **Complexité** : L
- **Effort estimé** : 34 points, environ 6 à 8 sessions (une user story ≈ une itération)

---

## Annexe — `src/content/life.json` (proposition, à affiner US par US)
```json
{
  "people": {
    "max": 300, "mobileFactor": 0.5, "radius": 250, "scale": 1.5, "speed": [1.0, 1.5],
    "network": { "excludeKinds": ["steps", "primary", "secondary", "tertiary", "cycleway", "track"], "clearance": 1.0 },
    "dayCurve": [[0, 0.05], [5, 0.05], [7, 0.4], [8, 0.8], [9, 0.6], [12, 1.0], [14, 0.6], [17, 0.9], [19, 0.5], [22, 0.25], [24, 0.05]],
    "groups": { "from": 20, "to": 3, "max": 12, "size": [2, 5], "nightWeight": { "bar": 1, "pub": 1, "nightclub": 1, "restaurant": 0.5, "cafe": 0.3 } }
  },
  "windows": { "litCurve": [[0, 0.2], [2, 0.1], [4, 0.05], [6, 0.12], [7, 0.2], [9, 0.1], [16, 0.15], [18, 0.35], [22, 0.4], [24, 0.25]] },
  "birds": { "pigeons": 40, "circling": 8 },
  "smoke": { "seasons": ["autumn", "winter"], "chimneys": 30, "distance": 300 }
}
```
Toutes ces valeurs sont des points de départ, à régler à l'œil après les premiers essais.

---

**Version** : v1.0
**Créé le** : 30/09/2026
