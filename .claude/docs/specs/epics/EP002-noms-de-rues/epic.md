# Epic EP002 - Noms de rues au sol

**Statut : 🔄 spec validée le 01/10/2026 (réponses Q1 à Q5 ci-dessous), ✅ livrée et validée par Dasco le 01/10/2026 (itérations 60 et 61).** Passe avant « Reprise vie dans la ville » (qui devient EP003).

## Résumé
Écrire le nom des rues à plat sur le sol, dans le sens de la rue. Les noms n'apparaissent que quand on zoome : en vue d'ensemble la carte reste propre, en s'approchant on lit les rues et on se repère.

---

## Contexte & Problème
Le diorama montre le tracé des rues mais ne les nomme pas : en naviguant, on ne sait pas où on est sans repérer un monument. Seuls les parcs et la Leysse ont un nom affiché (`labels.ts`, des sprites tournés vers la caméra, « 15 étiquettes »).

Les données sont déjà là : `public/data/city.json` contient 1 823 tronçons de rue dont **738 ont un nom OSM (225 noms distincts)**. Il n'y a donc rien à récupérer : il faut choisir où écrire chaque nom, et le dessiner.

---

## Décisions de Dasco (01/10/2026)

| Sujet | Décision |
|---|---|
| Où | **Sur le sol**, à plat, dans le sens de la rue (pas des étiquettes qui flottent face à la caméra) |
| Quand | **Seulement en zoomant** : absents en vue dézoomée, ils apparaissent quand on s'approche |
| But | Se situer au minimum pendant la navigation |
| Test | Un cas de test pour vérifier que ça fonctionne |

---

## Objectifs
- Les noms de rues lisibles sur le sol, orientés selon la rue, de près
- Aucun nom (aucun coût) en vue d'ensemble
- Une apparition douce (fondu), sans clignotement quand on zoome et dézoome
- Aucune perte de fluidité, notamment sur mobile
- Un scénario de vérification écrit, rejouable

---

## Hors scope
- Noms de lieux (bars, restaurants) : ils ont déjà leurs épingles
- Numéros de rue, sens de circulation
- Cliquer sur un nom de rue
- Rues hors du centre historique couvert par les données
- Traduction ou noms historiques des rues

---

## User Stories

| ID | User Story | Priorité | Points | Dépend de | Status |
|----|------------|----------|--------|-----------|--------|
| [US001](US001-choisir-les-noms-a-afficher.md) | Choisir où écrire chaque nom de rue (une rue = un nom, pas 738) | High | 3 | — | ✅ Done (01/10/2026) |
| [US002](US002-dessiner-les-noms-sur-le-sol.md) | Dessiner les noms à plat sur le sol, dans le sens de la rue | High | 5 | US001 | ✅ Done (validée par Dasco, 01/10/2026) |
| [US003](US003-apparition-au-zoom.md) | Les noms apparaissent en fondu quand je zoome, et disparaissent quand je dézoome | High | 3 | US002 | ✅ Done (validée par Dasco, 01/10/2026) |
| [US004](US004-cas-de-test.md) | Un cas de test pour vérifier l'affichage des noms | Medium | 2 | US003 | ✅ Done (validée par Dasco, 01/10/2026) |

**Ordre** : US001 → US002 → US003 → US004. 13 points.

---

## Flux principal
```
Ouverture de la carte (vue d'ensemble) : aucun nom de rue
→ zoom vers la rue de Boigne : les noms apparaissent en fondu, à plat, dans le sens des rues
→ je suis en « rue de Boigne », la rue d'à côté se lit aussi
→ je dézoome : les noms s'effacent, la carte redevient propre
```

---

## Règles métier de l'epic
1. **Rien d'inventé** : un nom vient du tag `name` d'OpenStreetMap, tel quel (règle projet : pas de fait inventé). Pas de nom corrigé à la main sans le noter ici
2. **Décor seulement** : les noms ne sont pas cliquables, les clics passent à travers
3. **Pas de coût hors zoom** : aucun nom n'est dessiné ni mis à jour quand la caméra est loin
4. **Cadence** : un fondu de noms ne force pas la pleine vitesse au repos (cf. TI-02) ; seul le zoom, déjà « en mouvement », la déclenche
5. **Mode debug** : `?debug` n'est pas nécessaire pour voir les noms ; avec `?debug`, la console indique le nombre de noms, la taille de l'atlas et la police au premier affichage

---

## Décisions sur les questions (Dasco, 01/10/2026)

| # | Question | Décision |
|---|----------|----------|
| Q1 | Quelles voies nommer ? | **Toutes sauf `cycleway`, `path` et `service`** ; escaliers et passages piétons nommés gardés |
| Q2 | Distance d'apparition | Fondu de **320 m à 200 m** de la caméra, valeurs à régler à l'écran (« ça me paraît bien ») |
| Q3 | Style | Majuscules, sans empattement, gris foncé avec halo clair ; **à revoir à l'usage** |
| Q4 | Nom répété sur les longues rues ? | **Non : écrit une seule fois par rue** (les tronçons de même nom à moins de 60 m forment une rue) |
| Q5 | Test | **Les deux** : scénario manuel (US004) + contrôle des données (`npm run check:streets`) |

---

## Critères d'acceptation
- [ ] Toutes les US sont livrées
- [ ] `npm run build` passe
- [ ] Le scénario de l'US004 est joué et consigné dans le CHANGELOG (ce qui est vérifié, ce qui ne l'est pas)
- [ ] Fluidité : pas de baisse sensible des images/s avec `?debug`, rue de Boigne zoomée
- [x] Revue PO validée par Dasco (01/10/2026)

---

## Estimation globale
- **Complexité** : M
- **Effort estimé** : 1 à 2 sessions (données ≈ ½, rendu au sol ≈ 1, fondu et test ≈ ½)

---

**Version** : v1.0
**Créé le** : 01/10/2026
