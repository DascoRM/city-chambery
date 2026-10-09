# EP010 - US008 - Session d'administration par cookie `HttpOnly`

## User Story

**En tant que** Dasco (administrateur),
**je veux** que ma session d'administration expire et ne soit pas lisible par un script,
**afin de** qu'un jeton volé ne donne pas un accès durable : les retouches de parkings s'écrivent déjà avec le jeton seul.

---

## Critères d'acceptation

- [x] **Given** un jeton valide, **Then** l'API pose un cookie `HttpOnly`, `Secure`, `SameSite=Strict`, valable 2 h ; l'admin ne garde plus le jeton
- [x] **Given** une session expirée, **Then** l'admin renvoie à la connexion
- [x] **Given** les routes d'écriture, **Then** elles exigent la session et refusent les requêtes intersites
- [x] **Given** la future connexion par identifiant et mot de passe (décision D6, EP008-US005), **Then** elle posera le même cookie : rien à refaire côté session

> **Décisions du 09/10/2026** : le jeton ne sert plus qu'à ouvrir la session, ensuite seul le cookie est accepté (D8) ; **session prolongée à chaque action** (renouvellement silencieux) : expire après 2 h sans activité, 8 h au plus depuis la connexion (D9, confirmé) ; clé tirée d'`ADMIN_TOKEN`, pas de nouvelle variable pour l'instant (D10). Conception : [plan de la phase 2](../../../tasks/ep010-phase2-plan.md) § 4 (écrit pour 2 h fixes : à adapter au renouvellement).

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
- [x] `npm run build` et `npm test` passent
- [x] Tests Vitest : expiration, refus sans cookie
- [x] Lock commité si les dépendances changent
- [x] README, DECISIONS, CHANGELOG si besoin
- [x] Validé par Dasco

---

**Priorité** : Medium
**Status** : ✅ Done (09/10/2026, itération 87) ; connexion, cookie et retouche d'essai vérifiés par Dasco sur la prévisualisation
