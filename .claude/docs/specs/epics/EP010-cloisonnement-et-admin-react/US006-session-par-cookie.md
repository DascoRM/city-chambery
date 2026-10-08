# EP010 - US006 - Session d'administration par cookie `HttpOnly`

## User Story

**En tant que** Dasco (administrateur),
**je veux** que ma session d'administration expire et ne soit pas lisible par un script,
**afin de** qu'un jeton volé ne donne pas un accès durable, avant les premières écritures.

---

## Critères d'acceptation

- [ ] **Given** le jeton saisi, **When** il est valide, **Then** le serveur pose un cookie `HttpOnly`, `Secure`, `SameSite=Strict`, valable 2 h, et le jeton n'est plus gardé dans le navigateur
- [ ] **Given** une session expirée, **Then** l'admin renvoie à la connexion
- [ ] **Given** les routes d'écriture, **Then** elles exigent la session (et sont protégées contre les requêtes intersites)

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et règles d'import.

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Jours | 0,75 (0,25 front, 0,5 back) |
| Risque | Faible |
| Dépend de | US005 ; avant EP008-US006 |

Détail : [plan de l'admin React](../../../tasks/admin-react-plan.md) § 3.3 (ADM-03), décision D7.

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Tests Vitest de l'expiration et du refus sans cookie
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
