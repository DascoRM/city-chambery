# EP004 - US001 - Un design du chargement et du lobby, validé avant de coder

## User Story

**En tant que** créateur du projet (Dasco),
**je veux** voir et choisir un design du chargement et du lobby avant que le code soit écrit,
**afin que** le résultat soit épuré et beau, sans refaire du code.

---

## Critères d'acceptation

- [ ] **Given** les réponses de Dasco aux questions Q1 à Q7, **When** le design est préparé, **Then** il propose 2 ou 3 pistes visuelles du lobby (écran d'ordinateur et de téléphone), avec la page de chargement
- [ ] **Given** les pistes, **When** Dasco en choisit une (et note ses retours), **Then** le choix et les retours sont écrits dans l'epic (section Décisions) avant tout code
- [ ] **Given** le design choisi, **When** on le compare à la charte du projet, **Then** il réutilise les couleurs, polices et formes existantes (`--paper`, `--gold`, `--teal`, Fraunces et Inter, cartes arrondies) ou dit explicitement ce qu'il change
- [ ] **Given** le design du lobby, **When** on lit les textes, **Then** ils sont des textes d'exemple clairs, sans fait inventé (règle projet), à relire par Dasco
- [ ] **Given** le design, **When** on le regarde sur un écran de 320 px, **Then** rien ne dépasse et le bouton « Explorer » reste visible sans défiler

---

## Règles métier

| Règle | Description |
|-------|-------------|
| R1 | Livrable : une maquette consultable par Dasco (page HTML publiée en privé, ou fichier Figma, selon Q5) ; rien n'est codé dans `src/` avant la validation |
| R2 | Les pistes diffèrent par l'idée (fond, mise en page, ton), pas par des détails de couleur |
| R3 | Le design prévoit la place de plusieurs « expériences » dans le lobby (R8 de l'epic), même s'il n'y en a qu'une |
| R4 | La page de chargement de cette US est la version standard ; une version plus stylée est la US005 |

---

## UI / Maquettes

**Écrans** : chargement ; lobby (ordinateur, téléphone) ; transition vers la carte.

### États à dessiner
| État | Description |
|---|---|
| Chargement | Nom du projet, indicateur d'avancement, étape en cours |
| Chargement lent | Message qui rassure après quelques secondes |
| Lobby, ordinateur | Panneau d'accueil, sections, bouton « Explorer » |
| Lobby, téléphone | Même contenu, en une colonne, bouton fixe en bas |
| Démarrage raté | Message lisible (voir US004) |

---

## Cas limites / Edge cases

| Cas | Comportement attendu |
|-----|---------------------|
| Aucune piste ne plaît | Nouvelles pistes à partir des retours, avant tout code |
| Texte plus long que prévu | Le design montre comment il se replie (défilement ou sections repliables) |

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Points | 3 |
| Complexité | Medium |

---

## Checklist dev

- [x] Questions répondues
- [x] 2 ou 3 pistes présentées
- [x] Piste choisie et retours notés dans l'epic
- [x] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (01/10/2026) : piste B « Carte vivante » et écran initial validés par Dasco ; A et C écartées
