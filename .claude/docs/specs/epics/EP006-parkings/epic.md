# Epic EP006 - Les parkings, en maquette

**Statut (06/10/2026) : prototype en cours sur `feat/EP006-parkings` (US001, US002 faites ; US003 en partie). Spec relue par Dasco le 06/10 ; revues de code et QA faites ([code](../../../tasks/ep006-review-code.md), [QA](../../../tasks/ep006-review-qa.md)).** Analyses des chercheurs : [données](../../../tasks/ep006-parkings-donnees-plan.md) · [idées](../../../tasks/ep006-parkings-concepts-plan.md) · [intégration et performance](../../../tasks/ep006-parkings-integration-plan.md).

## Résumé
Montrer les places de stationnement de Chambéry dans le diorama **comme une maquette qui sourit, pas comme un annuaire** : une couche « 🅿️ Parkings » qui colore la ville, des petites voitures-jouets garées dans les parkings, des fiches sourcées au ton du jeu, des chiffres rigolos, et « où me garer pour aller à… » avec l'avatar de la balade.

---

## Contexte & Problème
- Dasco veut présenter les parkings de manière fun. Les 412 parkings d'OpenStreetMap sont **déjà téléchargés** (`data/raw/overpass.json`) mais **aucun n'est exporté** dans `city.json`.
- Données **pauvres** (mesurées) : capacité sur 6 % des parkings, nom 7 %, tarif 10 %, horaires 2 % ; une quinzaine seulement sont documentés. Doublons (Château, Palais de Justice). Sources officielles (BNLS, jeu de la Ville, ODbL) : 12 parkings dans la zone, **déclarées obsolètes** (2024 et 2020), parfois contradictoires avec OSM (Ravet 400 / 474 places, Ducs 64 / 112). **Aucun flux de disponibilité en temps réel** pour Chambéry.
- Donc : le fun doit être **honnête**. Règle de l'epic : **chaque chiffre porte son étiquette** (« OSM », « ≈ estimé d'après la surface », « inconnu » assumé avec humour), jamais de faux temps réel.
- Contrainte forte : iPhone 12 Pro à ≤ 31 images/s en mouvement ; budget de rendu serré.

---

## Objectifs
1. Voir d'un coup d'œil où l'on se gare, et de quel type de parking il s'agit (couche activable)
2. Une fiche par parking documenté : type, capacité, tarif d'appel daté, source ; l'inconnu assumé
3. De la vie : petites voitures-jouets dans les parkings, des chiffres et un quiz malicieux
4. Une vraie utilité : « où me garer pour aller à… » avec le temps de marche réel de l'avatar
5. Zéro régression : **couche éteinte = +0 appel de rendu**, +5 au plus allumée

---

## Pistes retenues (et écartées)

| Piste | Décision proposée |
|---|---|
| Vue stationnement (aplats colorés au sol + couche) | **Socle** |
| Fiche parking sourcée, au ton du jeu | **Socle** |
| Voitures-jouets (une instance, rayon autour de la vue) | **Option A**, dans l'epic |
| Parkings en chiffres et quiz | **Option A**, dans l'epic |
| « Où me garer pour aller à… » avec l'avatar | **Option B**, dans l'epic |
| Vélos (supports OSM) | Dans l'epic, après les voitures |
| Souterrains en « radiographie » translucide | Option, plus tard (invente 2 niveaux : à étiqueter « décor ») |
| Éléphant qui cherche une place ; chasse aux parkings + anecdotes | Plus tard (il faut des anecdotes **sourcées**, aucune n'existe) |
| Maquette ouverte du Parking du Château | Plus tard, coupe étiquetée « schéma » |
| Créneau avec l'avatar | **Écarté** (mauvais au tactile, hors charte) |
| Voitures qui roulent sur les voies ; trou découpé dans le sol | **Écartés** (coût, risque) |

---

## User Stories

| ID | User Story | Priorité | Estimation | Dépend de | Status |
|----|------------|----------|------------|-----------|--------|
| [US001](US001-les-parkings-dans-les-donnees.md) | Les parkings dans les données (extraction, doublons, rapport chiffré) | High | 5 | — | 🟡 Fait, à valider |
| [US002](US002-vue-stationnement.md) | Vue stationnement : couche « 🅿️ Parkings » et aplats colorés | High | 3 | US001 | 🟡 Fait, à valider |
| [US003](US003-panneaux-et-fiche.md) | Panneaux « P » et fiche parking sourcée, au ton du jeu | High | 5 | US001, US002 | 🟡 Fait en partie (sans tarifs ni fiches officielles), à valider |
| [US004](US004-marquages-de-places.md) | Marquages de places (décor) | Medium | 3 | US002 | 🔲 Todo |
| [US005](US005-voitures-jouets.md) | Voitures-jouets garées (décor, d'après la capacité) | Medium | 5 | US002, US004 | 🔲 Todo |
| [US006](US006-parkings-en-chiffres.md) | Parkings en chiffres et quiz | Medium | 3 | US001, US003 | 🔲 Todo |
| [US007](US007-ou-me-garer.md) | « Où me garer pour aller à… ? » avec l'avatar | Medium | 5 | US003, EP005 | 🔲 Todo |
| [US008](US008-velos.md) | Vélos : supports et stations, couche à part | Low | 3 | US002 | 🔲 Todo |
| [US009](US009-mesures-et-tests.md) | Mesures, accessibilité, documentation, scénario de test | High | 3 | US002 à US007 | 🔲 Todo |

**Total : 35 points (≈ 4 à 5,5 sessions pour le cœur ; jalon prototype US001 à US003 ≈ 1,5 à 2 sessions).** Branche d'epic : `feat/EP006-parkings` ; une branche par US fusionnée dedans ; `main` au besoin ; correctifs par rebase (règle de l'epic EP005).

---

## Flux principal
```
Carte libre → bouton « 🅿️ Parkings » → la ville se colore : parkings par type, panneaux P, voitures-jouets
→ je touche un P : fiche (type, places « OSM » ou « ≈ », tarif d'appel daté, source) ; l'inconnu est assumé
→ « Parkings en chiffres » : équivalences rigolotes, quiz
→ en balade : « Où me garer pour aller à… ? » → classement par temps de marche → l'avatar y va
```

---

## Règles métier de l'epic
1. **Ne jamais inventer** (règle projet 1) : géométrie et noms d'OSM ; capacité et tarif viennent d'OSM, d'une fiche sourcée datée, ou d'une estimation **étiquetée « ≈ »** ; sinon « inconnu »
2. **Priorité des valeurs : fiche > OSM > estimation** ; contradictions entre sources tranchées par fiche et notées
3. **Estimation de capacité** : surface / 28 m² par place (±30 %, validée sur Roissard 138 contre 149), seulement pour les parkings de surface de plus de 300 m² ; **jamais** pour les souterrains ; multi-étages seulement avec les niveaux. **La surface en m² n'est jamais affichée** (Dasco : sans intérêt) : seul « ≈ N places » apparaît
4. **Pas de temps réel, et pas d'occupation simulée** (décision de Dasco, 06/10) : les voitures-jouets sont un décor proportionnel à la capacité, jamais un taux de remplissage
5. **Souterrains** : un **panneau cartoon low poly** à leur image (idée de Dasco, 06/10), à dessiner dans la maquette ; pas de radiographie dans cette epic
6. **Tarifs** : seulement la gratuité des 30 premières minutes et le tarif d'une heure, avec la date du relevé et le lien vers l'exploitant ; pas de 24 h ni d'abonnement
7. **Voirie** : décor (bandes de stationnement), sans nombre de places ni tarif
8. **Piège du Château** : le polygone « Parking du Château » (10 104 m², 604 places) est le **souterrain** du même nom : à classer souterrain, jamais peint comme un parking de surface sur l'esplanade
9. **Données** : script `scripts/` + `diorama.config.json` puis `npm run data -- --offline` (règle projet 2) ; jamais `city.json` à la main
10. **Attributions** : ligne de licence « BNLS / Ville de Chambéry (ODbL) » dans le README et l'`attribution` si leurs valeurs sont copiées (règle projet 5)
11. **Budget de rendu, mesuré par vue** : couche éteinte +0 ; allumée +1 en vue d'ensemble, +3 à +4 près des parkings, ≤ +5, ≤ +0,05 M de triangles, +0,15 s de chargement, pas plus de −3 images/s sur iPhone par rapport à la même vue sans la couche ; aucune ombre portée (taches)
12. **Rien ne casse la balade** : les voitures ne sont pas des obstacles (elles s'effacent à l'approche de l'avatar) ; le déplacement libre de l'avatar traverse les parkings
13. **Honnêteté** : « disposition illustrative » écrite là où les places sont tracées d'après la forme et non d'après un relevé

---

## Design à valider avant de coder (comme pour le lobby)
La couleur par type, la forme du panneau P, le ton des fiches, la voiture-jouet et le panneau « Parkings en chiffres » font l'objet d'une **maquette HTML** (2 pistes) validée par Dasco avant l'US002.

---

## Réponses de Dasco (06/10/2026) et points restants
**Tranché :**
- Véhicules : **voitures d'abord, vélos ensuite** ; motos, autopartage Citiz et bornes de recharge **hors périmètre**
- **Temps réel : oublié** (pas possible pour l'instant) ; **pas d'occupation simulée ni d'heures de pointe**
- Capacités estimées « ≈ » : oui, mais **on n'affiche jamais la taille (m²)**
- **Souterrains : un panneau cartoon low poly** à leur image (pas de radiographie)
- **Licences BNLS et Ville de Chambéry (ODbL)** ajoutées, valeurs copiées dans les fiches
- Défauts validés par la relecture : ressenti « sourire d'abord », couche éteinte au départ, 15 fiches documentées, tarifs minimaux datés (30 min gratuites, 1 h), voirie en décor sans chiffres, éléphants hors epic

**À préciser (question posée à Dasco) :** quels parkings reçoivent un panneau P et des voitures (les nommés et les grands ; les petits restent juste colorés au sol), et comment montrer les parkings privés (plus pâles ou masqués)

## Critères d'acceptation de l'epic
- [ ] US001 à US009 livrées ; `npm run build` passe
- [ ] Couche éteinte : aucune différence mesurée (appels de rendu, images/s, chargement)
- [ ] Budget tenu par vue (vue d'ensemble, Carré Curial, château, rue de Boigne) ; relevé iPhone 12 Pro via Vercel
- [ ] Tous les chiffres affichés portent leur étiquette ; aucune valeur sans source
- [ ] Scénario de test rejoué ; résultats (réussi, échoué, non vérifié) dans le CHANGELOG
- [ ] Revue de Dasco sur la maquette puis sur le prototype

---

## Estimation globale
- **Complexité** : M à L. **Effort** : 4 à 5,5 sessions (cœur), 6,5 à 8,5 avec les options. Incertain : performance iPhone, rendu des marquages sur les pentes, nuit.
