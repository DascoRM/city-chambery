# EP010 - US008 - Session d'administration par cookie `HttpOnly`

## User Story

**En tant que** Dasco (administrateur),
**je veux** que ma session d'administration expire et ne soit pas lisible par un script,
**afin de** qu'un jeton volé ne donne pas un accès durable : les retouches de parkings s'écrivent déjà avec le jeton seul.

---

## Critères d'acceptation

- [ ] **Given** un jeton valide, **Then** l'API pose un cookie `HttpOnly`, `Secure`, `SameSite=Strict`, valable 2 h ; l'admin ne garde plus le jeton
- [ ] **Given** une session expirée, **Then** l'admin renvoie à la connexion
- [ ] **Given** les routes d'écriture, **Then** elles exigent la session et refusent les requêtes intersites
- [ ] **Given** la future connexion par identifiant et mot de passe (décision D6, EP008-US005), **Then** elle posera le même cookie : rien à refaire côté session

---

## Règles métier
Voir l'[epic](epic.md) : règles 1 à 7 et tableau « Qui a le droit d'utiliser quoi ».

---

## Estimation

| Critère | Valeur |
|---------|--------|
| Phase | 2 |
| Jours | 0,75 (0,5 back, 0,25 front) |
| Risque | Faible |
| Dépend de | US006 ; avant la reprise d'EP008 |

Détail : [plan de l'admin React](../../../tasks/admin-react-plan.md) § 3.3 (ADM-03).

---

## Checklist dev
- [ ] `npm run build` et `npm test` passent
- [ ] Tests Vitest : expiration, refus sans cookie
- [ ] Lock commité si les dépendances changent
- [ ] README, DECISIONS, CHANGELOG si besoin
- [ ] Validé par Dasco

---

**Priorité** : Medium
**Status** : 🔲 Todo
