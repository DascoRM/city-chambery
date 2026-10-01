# Epic EP001 - La ville vit

**Statut : 🟡 toutes les user stories livrées (01/10/2026), US006 en attente de validation ; US010 abandonnée.** Suite : epic « Reprise vie dans la ville » (BACKLOG).

## Résumé
Faire vivre le diorama : des passants dans les rues (plus nombreux de jour, des petits groupes devant les bars
ouverts la nuit), des fenêtres qui s'allument et s'éteignent, des pigeons, de la fumée de cheminée, des drapeaux,
et des auvents tirés du pack de bâtiments de Kenney (le reste du pack a été écarté).

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
| Style des passants | **Silhouettes simples** (figurines low-poly instanciées, US001). Personnages animés essayés (pack Kenney, puis personnage Mixamo) et **abandonnés le 01/10/2026** : on garde les silhouettes |
| Autres « vies » | Fenêtres qui s'allument / s'éteignent, pigeons et oiseaux, fumée de cheminées, drapeaux. **Pas de voitures ni de bus** |
| Interaction | **Décor seulement** : pas de clic sur les passants, ils ne réagissent ni aux éléphants ni au jeu |
| Pack de bâtiments (`assets-src/buildings`, auteur : Kenney) | **Auvents gardés** (« ça me va »). Le reste du pack, y compris un essai de bâtiment reconstruit en modules, **écarté** : Dasco préfère les bâtiments actuels. Les 2 067 bâtiments OSM restent tels quels |

---

## Objectifs
- Des passants qui marchent sur les voies piétonnes, sans traverser les bâtiments, à une densité qui suit l'heure
- La nuit : moins de monde dans les rues, des groupes devant les bars, pubs et boîtes de nuit ouverts (horaires OSM)
- Des animations discrètes de jour comme de nuit : fenêtres, pigeons, fumée en automne et en hiver, drapeaux
- Des auvents colorés selon la catégorie du lieu devant les bars, cafés et restaurants, et des fenêtres et portes visibles de jour
- Sans perdre en fluidité, notamment sur mobile, et sans toucher au jeu des éléphants

---

## Hors scope
- Voitures, bus, vélos
- Personnages animés au lieu des silhouettes : essayés puis abandonnés le 01/10 (US010) ; les silhouettes de l'US001 restent
- Passants cliquables, anecdotes, réactions aux éléphants (décision ci-dessus)
- Remplacer les bâtiments OSM par des assemblages de modules : c'est une autre epic (« bâtiments »), à part
- Back-end, comptes, partage entre amis

---

## User Stories

| ID | User Story | Priorité | Points | Dépend de | Status |
|----|------------|----------|--------|-----------|--------|
| [US001](US001-passants-de-jour.md) | Des passants qui marchent dans les rues, de jour | High | 5 | — | ✅ Done (itération 51) |
| [US002](US002-rythme-jour-nuit.md) | Le monde suit l'heure : rues plus calmes la nuit, groupes devant les bars ouverts | High | 5 | US001 | ✅ Done (itération 55) |
| [US003](US003-fenetres-qui-vivent.md) | Des fenêtres qui s'allument et s'éteignent au fil de la soirée | High | 2 | — | ✅ Done (itération 56) |
| [US004](US004-pigeons-et-oiseaux.md) | Des pigeons sur les places et des oiseaux autour des monuments | Medium | 3 | — | ✅ Done (itération 57) |
| [US005](US005-fumee-de-cheminees.md) | De la fumée qui sort de cheminées, en automne et en hiver | Medium | 3 | — | ✅ Done (itération 58) |
| [US006](US006-drapeaux.md) | Des drapeaux qui flottent sur des mâts sourcés | Medium | 3 | décision sur les emplacements | 🟡 Livrée (itération 59), à valider par Dasco |
| [US007](US007-preparer-le-pack-batiments.md) | Préparer le pack de bâtiments (nom, licence, conversion) : réduit aux 2 pièces d'auvent | Medium | 3 | — | ✅ Done (itération 46) |
| [US008](US008-auvents-des-lieux.md) | Des auvents devant les bars, cafés et restaurants | Medium | 5 | US007 | ✅ Done (itérations 46 et 48, validée par Dasco) |
| [US009](US009-fenetres-et-portes-de-jour.md) | Des fenêtres et des portes visibles de jour sur les bâtiments (dans le shader, sans pack) | Medium | 3 | — | ✅ Done (itération 49) |
| [US010](US010-personnages-animes.md) | ~~Des personnages animés à la place des silhouettes~~ | — | — | — | ❌ Abandonnée (01/10 : style cartoon, coût ; on garde les silhouettes) |
| [US011](US011-horaires-provisoires-des-bars.md) | Des horaires provisoires pour les bars, pubs et boîtes de nuit | High | 1 | — | ✅ Done (itération 46) |

**Ordre** : US007, US008 et US011 sont faites. Suite conseillée : US001 → US002 → US003 → US004 → US005 → US006, et US009 (fenêtres et portes de jour) quand Dasco veut la préciser : elle est indépendante des passants et peu coûteuse.

---

## Pack de bâtiments : ce qui a été jugé (itérations 46 à 48)

- **Auvents (US008)** : gardés. Ils viennent de 2 pièces du pack (`roof-flat-awning-b` et `-c`), d'où les seuls fichiers sources conservés dans `assets-src/buildings`.
- **Bâtiment reconstruit en modules (essai de l'itération 47)** : écarté. Il donnait un bâtiment plus riche (fenêtres à appuis, balcon, toit), mais Dasco trouve les bâtiments actuels mieux, et le coût d'un remplacement général (≈ +2,4 M de triangles pour les 2 067 bâtiments) n'était pas tenable sur mobile. Le code, les pièces et les sources de cet essai ont été supprimés.
- **Regret de Dasco retenu** : de jour, les bâtiments n'ont ni fenêtres ni portes → US009, dans le shader existant.

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

## Questions tranchées (réponses de Dasco, 30/09/2026)

| # | Question | Décision |
|---|---|---|
| Q1 | Échelle des passants | **Taille réelle, 1,7 m** (`scale` à 1) ; Dasco la changera au besoin |
| Q2 | Grandes rues et trottoirs | **Pas de trottoirs pour l'instant** : Chambéry est surtout piétonne. Les passants marchent sur toutes les voies sauf les escaliers. Les axes que les piétons devront éviter, et les véhicules, feront l'objet d'une autre spec |
| Q3 | Fumée de cheminée | **Pas de fumée l'été.** Au printemps, à l'automne et en hiver (plus dense en hiver). Suivant la saison seulement : **aucune règle d'heure** (pas de complication pour peu de chose) |
| Q4 | Drapeaux | **Le château et l'hôtel de ville, c'est tout.** Le drapeau de la Savoie (croix blanche sur fond rouge) si c'est faisable ; le motif sera montré à Dasco |
| Q5 | Couleur des auvents | **Couleur de la catégorie** (violet bar, bleu café, orange restaurant) ; on juge au rendu, puis on ajuste |
| Q6 | Nom du dossier du pack | **`assets-src/buildings`** (sans « kenney »), fait le 30/09 |
| Q7 | Lieux sans horaires OSM | **Horaires fictifs** pour les bars, pubs et boîtes de nuit dans `src/content/place-hours.json` (US011), puis un script de Dasco reprendra les vraies données de son projet bar / restau (ligne ajoutée au BACKLOG). Plus de cas « horaire inconnu » pour ces lieux |
| Q8 | Légende « Bars » décochée | Les groupes de passants devant un bar sont **liés à la catégorie du bar** : case décochée → ils disparaissent. Dasco jugera si c'est bien |

## Risques

| Risque | Effet | Parade |
|---|---|---|
| Réseau piéton des passants trop morcelé (une fois les façades et les escaliers retirés) | Passants confinés à quelques îlots | Mesurer la plus grande partie connexe en US001 ; repli : réduire la marge aux façades |
| Coût des passants sur mobile | Images/s en baisse | Instanciation, foule limitée autour du point visé (voir US001), facteur mobile, mesure sur téléphone |
| Décor qui passe pour des faits (mât, cheminée, auvent) | Contredit la règle « rien d'inventé » | Règle 2, section « Limites connues » du README |
| Échelle et couleurs du pack différentes de celles du diorama | Détails qui jurent avec la maquette | Conversion avec la palette du projet (US007), essai sur un bâtiment avant le lot |
| Licence du pack de bâtiments (auteur : Kenney) non confirmée (aucun fichier de licence dans le dossier) | Impossible de publier le pack | Vérifier sur le site de l'auteur avant la conversion (US007) ; le pack reste hors du dépôt tant que ce n'est pas fait |

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
- **Effort estimé** : 35 points, environ 6 à 8 sessions (une user story ≈ une itération)

---

## Annexe — `src/content/life.json` (proposition, à affiner US par US)
```json
{
  "people": {
    "max": 300, "mobileFactor": 0.5, "radius": 250, "scale": 1.0, "speed": [1.0, 1.5],
    "network": { "excludeKinds": ["steps"], "clearance": 1.0 },
    "dayCurve": [[0, 0.05], [5, 0.05], [7, 0.4], [8, 0.8], [9, 0.6], [12, 1.0], [14, 0.6], [17, 0.9], [19, 0.5], [22, 0.25], [24, 0.05]],
    "groups": { "from": 20, "to": 3, "max": 12, "size": [2, 5], "nightWeight": { "bar": 1, "restaurant": 0.5, "cafe": 0.3 } }
  },
  "windows": { "litCurve": [[0, 0.2], [2, 0.1], [4, 0.05], [6, 0.12], [7, 0.2], [9, 0.1], [16, 0.15], [18, 0.35], [22, 0.4], [24, 0.25]] },
  "birds": { "pigeons": 40, "circling": 8 },
  "smoke": { "density": { "spring": 0.4, "summer": 0, "autumn": 0.7, "winter": 1 }, "chimneys": 30, "distance": 300 },
  "flags": [{ "id": "chateau", "anchor": "chateau", "design": "savoie" }, { "id": "hotel-de-ville", "design": "savoie", "pos": "à placer" }]
}
```
Toutes ces valeurs sont des points de départ, à régler à l'œil après les premiers essais.

---

**Version** : v1.0
**Créé le** : 30/09/2026
