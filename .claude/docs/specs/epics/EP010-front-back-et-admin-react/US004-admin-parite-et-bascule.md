# EP010 - US004 - Admin : parité avec l'actuelle, puis suppression de `public/admin`

## User Story

**En tant que** Dasco (administrateur),
**je veux** retrouver dans la nouvelle admin tout ce que fait l'actuelle (connexion par jeton, état de la base et des migrations, retouches de parkings livrées par EP008-US006),
**afin de** de basculer sans rien perdre.

---

## Critères d'acceptation

- [x] **Given** le jeton, **When** je me connecte, **Then** je vois version, environnement, région, état et taille de la base, lignes par table, avec les mêmes messages d'erreur
- [x] **Given** l'écran des retouches de parkings, **Then** on retrouve la recherche d'un parking, le formulaire de retouche (source obligatoire), l'ajout, la liste avec « Retirer » et le journal, avec les mêmes appels à l'API ; aucun HTML construit à partir de données
- [x] **Given** la parité vérifiée sur prévisualisation, **Then** `public/admin/` est supprimé
- [x] **Given** un service worker de la carte déjà installé dans le navigateur, **Then** `/admin/` s'ouvre quand même
- [x] **Given** les types de la réponse `/api/admin/status`, **Then** ils sont provisoirement dans l'admin et passeront dans `contrat/` en phase 2 (US007)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 1 |
| Jours | 1 à 1,5 |
| Risque | Faible |
| Dépend de | US003 ; l'écran des parkings sera repensé ensuite par EP008 (« admin par tables ») : ici, on reprend l'existant tel quel |

Détail : [plan de l'admin React](../../../tasks/admin-react-plan.md) § 4 (ADM-02).

---

## Checklist dev
- [x] `npm run build` et `npm test` passent
- [x] Prévisualisation `preview/front-back` : `/`, `/admin/`, `/api/health` répondent ; service worker sans fichier de l'admin
- [x] Lock commité si les dépendances changent
- [x] README, DECISIONS, CHANGELOG si besoin
- [x] Validé par Dasco

---

**Priorité** : High
**Status** : ✅ Done (09/10/2026), vérifié par Dasco sur `preview/front-back`
