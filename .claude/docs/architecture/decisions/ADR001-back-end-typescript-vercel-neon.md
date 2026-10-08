# ADR-001 - Back-end : TypeScript sur les fonctions Vercel, base Neon

## Statut
**Accepté** (Dasco, 08/10/2026)

## Date
2026-10-08

---

## Contexte
Le site est statique (Vite, TypeScript, Three.js, Vercel Hobby). Il faut un petit back-end pour la progression des joueurs, un classement, le partage entre amis et une administration (retouches des parkings et des lieux, carte de position), **sans rien payer** et sans entretien. Coûts vérifiés le 08/10/2026 : Vercel Hobby (1 000 000 d'invocations de fonctions par mois, usage non commercial) ; les bases Supabase (pause après 1 semaine) et Turso (archivage après 10 jours) s'arrêtent sans activité, Render supprime sa base gratuite après 30 jours, Fly.io facture un Postgres géré 38 $ par mois ; Neon se met en veille après 5 minutes et se réveille seul.

## Décision
**Nous avons décidé** d'écrire l'API en **TypeScript** (frameworks légers **Hono**, validation **Zod**, accès base et migrations **Drizzle**), dans **le même dépôt** que le site, déployée comme **fonctions Vercel**, avec une base **PostgreSQL chez Neon** branchée par l'intégration Vercel. Le site continue de fonctionner sans l'API.

---

## Options considérées

### Option 1 : TypeScript (Hono, Zod, Drizzle) sur Vercel + Neon ← **Choix retenu**
- ✅ Même langage et mêmes types que le site : une erreur de contrat entre le site et l'API est une erreur de compilation
- ✅ `npm run build` vérifie tout ; retours du compilateur clairs pour le travail avec l'assistant
- ✅ Démarrage léger (important en serverless), aucune infrastructure à tenir
- ✅ Les outils d'administration (carte, outil de position) réutilisent le code du site
- ❌ Pas d'écran d'administration fourni : il faut le construire (c'est l'objet de l'epic EP008)

### Option 2 : Django (Python) sur Vercel + Neon
- ✅ Administration générée automatiquement (tables, formulaires, comptes)
- ❌ Deuxième langage, écran générique sans lien avec la carte

### Option 3 : FastAPI / Flask (Python)
- ✅ Typé (FastAPI), simple (Flask)
- ❌ Deuxième langage ; pas d'administration fournie

### Option 4 : NestJS
- ✅ Très structuré
- ❌ Lourd pour des fonctions serverless

### Option 5 : Rust (Axum)
- ✅ Très structuré, compilateur très explicite, très léger
- ❌ Écriture et compilation plus lentes, peu de types partagés avec le site, gain inutile (usage prévu : environ 9 % du quota gratuit) ; la runtime Rust de Vercel existe mais n'a pas été essayée ici
- ➡ Reste possible plus tard pour un composant précis (génération lourde de données, par exemple)

### Option 6 : Postgres auto-hébergé (Raspberry Pi / Coolify)
- ✅ Gratuit, données chez soi
- ❌ Joignable depuis Internet (tunnel, TLS), disponibilité liée au Pi et à la box, sauvegardes et mises à jour à gérer, répartiteur de connexions nécessaire pour le serverless

---

## Conséquences
- Le schéma de la base reste du SQL standard : un export (`pg_dump`) permet de partir sur n'importe quel Postgres.
- Plan Hobby : usage **personnel et non commercial** ; un usage commercial demanderait le plan Pro.
- Prévisualisations Vercel : base séparée de la production.
- Sécurité : validation côté serveur (Zod) de tout ce qui est écrit, assainissement de tout texte avant affichage.
