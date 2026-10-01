# Epic EP004 - Page de chargement et lobby de démarrage

**Statut : 📝 brouillon du 01/10/2026, questions ouvertes ci-dessous ; un design est à valider par Dasco avant de coder.** Passe avant EP003 « Reprise vie dans la ville ».

## Résumé
Quand on arrive sur le site : d'abord une page de chargement (standard au départ, plus soignée plus tard), puis un **lobby** épuré qui explique ce qu'est le projet, ce qu'on peut y faire (exploration, mini-jeu, ambiances) et qui mène à la carte. Le lobby est pensé pour devenir plus tard une **page d'arrimage** qui redirige vers d'autres jeux ou expériences.

---

## Contexte & Problème
Aujourd'hui, à l'ouverture, le visiteur voit un fond beige vide pendant le chargement (code, `city.json`, modèles), puis la carte apparaît d'un coup. Rien n'explique le projet, ni qu'il y a des lieux à découvrir, un mini-jeu d'éléphants, une heure réelle ou des saisons. Seul un petit bandeau d'aide (« Glisse pour tourner… ») apparaît sur la carte. Pour les amis testeurs (premier public, sur ordinateur ou téléphone), la première impression compte : l'hypothèse du POC est qu'on y passe dix minutes.

Si le chargement échoue, le visiteur voit le message développeur « Lance `npm run data` » ; une erreur plus tard donne une page vide (`main()` n'a pas de `catch`).

---

## Décisions de Dasco (01/10/2026)

| Sujet | Décision |
|---|---|
| Ordre | Cette epic passe **avant** « Reprise vie dans la ville » (EP003) |
| Chargement | D'abord une page de chargement **standard** ; plus tard, quelque chose de plus stylé |
| Lobby | À court terme : informer (c'est quoi le projet, quels mini-jeux, quelles fonctionnalités), puis entrer sur la carte |
| Style | **Épuré, design, beau visuellement** |
| Process | **Un design validé avant de coder**, et des questions de ma part |
| Plus tard | Une page d'arrimage pour rediriger vers des jeux ou la carte seule (hors de cette epic, mais le lobby doit pouvoir grandir) |

---

## Objectifs
- Un premier écran affiché tout de suite, avant même que le code de l'appli soit chargé
- Une page de chargement qui montre que ça avance (étapes réelles)
- Un lobby clair, rapide à lire, qui donne envie d'entrer
- Du texte facile à modifier par Dasco, et des chiffres jamais périmés
- Un lobby qui peut accueillir d'autres expériences plus tard sans refonte
- Aucun coût sur la fluidité de la carte

---

## Hors scope
- Plusieurs jeux réels et leur navigation (un routeur) : seulement la place pour eux
- Comptes, connexion, progression partagée, back-end
- Traductions (le site est en français)
- Une page de chargement animée et soignée : c'est la US005, plus tard

---

## User Stories

| ID | User Story | Priorité | Points | Dépend de | Status |
|----|------------|----------|--------|-----------|--------|
| [US001](US001-design-chargement-et-lobby.md) | Un design du chargement et du lobby, validé par Dasco avant de coder | High | 3 | réponses aux questions | 🔲 Todo |
| [US002](US002-page-de-chargement.md) | Une page de chargement standard dès l'ouverture, avec une vraie progression | High | 3 | US001 | 🔲 Todo |
| [US003](US003-lobby.md) | Un lobby épuré qui explique le projet, les jeux et les fonctionnalités, puis mène à la carte | High | 5 | US001, US002 | 🔲 Todo |
| [US004](US004-demarrage-rate.md) | Un message lisible quand le démarrage échoue | Medium | 2 | US002 | 🔲 Todo |
| [US005](US005-chargement-style.md) | Une page de chargement plus stylée (plus tard) | Low | à estimer | US002 | ⏳ Plus tard |
| [US006](US006-page-d-arrimage.md) | Le lobby devient une page d'arrimage vers plusieurs expériences (plus tard) | Low | à estimer | US003 | ⏳ Plus tard |

**Ordre** : US001 (design) → US002 → US003 → US004. US005 et US006 : après, quand Dasco les ouvre. 13 points pour les quatre premières.

---

## Flux principal
```
J'ouvre le site → un écran de chargement s'affiche tout de suite (nom du projet, barre qui avance)
→ la ville se charge (étapes : données, relief, bâtiments, modèles…)
→ le lobby apparaît : « Chambéry en diorama », ce qu'on peut faire (lieux d'histoire, mini-jeu des éléphants,
  heure réelle et saisons), comment se déplacer
→ « Explorer la carte » → transition → la carte, prête à explorer
```

---

## Règles métier de l'epic
1. **Premier écran immédiat** : un écran minimal (nom, fond, indicateur) en HTML et CSS dans `index.html`, visible avant le chargement du code de l'appli
2. **Progression réelle** : la barre suit des étapes vraies de `main()` (données, relief, bâtiments, arbres, monuments, mascottes…), pas un faux pourcentage ; sans information, un indicateur sans pourcentage
3. **Textes dans un fichier** : le contenu du lobby vit dans `src/content/lobby.json` (comme `pois.json`), modifiable sans toucher au code ; **les chiffres** (nombre de lieux, de bars…) sont **lus dans les données**, jamais écrits en dur
4. **Rien d'inventé** (règle projet) : ce que dit le lobby sur le projet vient de `FEATURES.md` ou des données ; pas de fait historique non sourcé
5. **Fluidité** : le lobby ne ralentit pas la carte ; si la scène tourne derrière, elle reste à la cadence au repos (30 images/s, TI-02)
6. **Raccourci de dev** : `?debug` (et `?lobby=0`) passent directement à la carte, pour les tests et la mesure de performance
7. **Mobile d'abord** : lisible dès 320 px, utilisable au clavier et au toucher, `prefers-reduced-motion` respecté
8. **Prêt à grandir** : le lobby est construit comme une liste d'expériences (`lobby.json` : aujourd'hui une seule, « la carte ») ; en ajouter une plus tard = ajouter une entrée
9. **Crédits** : les attributions et licences restent visibles (règle projet 5), au pied du lobby ou comme aujourd'hui

---

## Questions ouvertes pour Dasco

| # | Question | Proposition par défaut |
|---|----------|------------------------|
| Q1 | **Quand voit-on le lobby ?** À chaque visite, ou seulement la première ? | À chaque visite, avec un bouton « Explorer » bien visible ; une icône « ? » pour le rouvrir depuis la carte |
| Q2 | **Chargement puis lobby, ou lobby pendant le chargement ?** | Ton schéma d'abord : chargement, puis lobby (simple à dessiner et à tester). Variante plus tard : le lobby s'affiche tout de suite et la carte se charge derrière, le bouton « Explorer » s'active quand c'est prêt (aucune attente perdue) |
| Q3 | **Fond du lobby** : uni et doux, ou la carte vivante derrière (caméra qui tourne lentement, sous un voile) ? | Carte vivante derrière un panneau clair, si le coût reste nul au repos ; à valider sur maquette |
| Q4 | **Contenu du lobby** : quelles sections ? | Le projet (c'est quoi, d'où viennent les données) · les lieux d'histoire · le mini-jeu des éléphants · les ambiances (heure réelle, saisons, ville qui vit) · comment se déplacer · crédits |
| Q5 | **Outil de design** : maquette HTML (rapide, aux vraies polices et couleurs du projet, je la republie pour itérer) ou Figma (si tu veux la garder et la modifier dans Figma) | Maquette HTML d'abord (2 ou 3 pistes), Figma si tu le veux |
| Q6 | **Ton et voix** : tutoiement ou vouvoiement, présentation de toi (Dasco) comme créateur ? | Tutoiement (comme l'app), une ligne sur le créateur au pied du lobby |
| Q7 | **Bandeau d'aide actuel** (« Glisse pour tourner… ») : que devient-il ? | Il disparaît s'il est repris dans le lobby (« comment se déplacer ») |

---

## Critères d'acceptation
- [ ] Toutes les US prévues sont livrées (US001 à US004)
- [ ] `npm run build` passe
- [ ] Vérifié en navigateur : ordinateur et téléphone (320 px), jour et nuit
- [ ] Mesuré : le premier écran apparaît avant le code de l'appli ; images/s de la carte inchangées
- [ ] Revue PO validée par Dasco, sur le design puis sur le rendu

---

## Estimation globale
- **Complexité** : M
- **Effort estimé** : 2 sessions (design et chargement ≈ 1, lobby et démarrage raté ≈ 1)

---

**Version** : v1.0 (brouillon)
**Créé le** : 01/10/2026
