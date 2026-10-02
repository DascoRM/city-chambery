# EP005 - US009 - Une balade fluide et confortable sur téléphone

## User Story

**En tant que** visiteur sur téléphone,
**je veux** me promener sans saccades et sans conflit de gestes,
**afin de** que la balade fonctionne aussi bien sur téléphone que sur ordinateur.

---

## Critères d'acceptation

- [ ] **Given** le téléphone de référence (Q11), **When** mon avatar marche, **Then** les images/s relevées sont ≥ 30 (seuil à confirmer), avec la densité de pixels qui peut descendre à 1
- [ ] **Given** la marche, **When** la fluidité baisse, **Then** une baisse temporaire d'un cran de densité pendant la marche, rétablie à l'arrêt, est essayée avec prudence (changer la densité redimensionne les cibles de rendu)
- [ ] **Given** un doigt qui bouge de 6 à 10 px sans le vouloir, **When** je touche pour aller, **Then** ce n'est pas pris pour un glissement (seuil réglé sur appareil)
- [ ] **Given** une fiche en tiroir bas (62 % de l'écran), **When** elle s'ouvre, **Then** l'avatar reste visible (point regardé décalé vers le haut, bande nette sur l'avatar)
- [ ] **Given** un écran de 320 px, **When** j'utilise la balade, **Then** boutons Balade / Vue libre, boussole et « ? » ne se chevauchent pas
- [ ] **Given** les options de repli si nécessaire, **When** le mobile est trop lent, **Then** une des pistes est appliquée : `samples: 2` de l'effet maquette, passants réduits, arbres découpés par quartier

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Aucune mesure mobile n'existe aujourd'hui : c'est le risque n° 1 de l'epic |
| R2 | Les mesures sur Mac (Chrome for Testing avec GPU) ne remplacent pas le téléphone |
| R3 | Pas de joystick virtuel : « toucher pour aller » suffit (la zone du pouce est déjà prise par l'heure) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Téléphone ancien | Dégradation documentée, seuil à décider avec toi |
| Mode économie d'énergie | Non vérifié |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium (dépend d'un appareil réel) |

---

## Checklist dev

- [ ] Mesures sur le téléphone de Dasco
- [ ] Réglages de densité et de gestes
- [ ] Validé par Dasco

---

**Priorité** : High
**Status** : 🔲 Todo
