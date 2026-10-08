# Analyse 3 : un back-end pour l'administration

Auteur : Claude (analyse seule, aucun code modifié). Date : 06/10/2026. « Mesuré » = vérifié dans le dépôt ce jour ; « non vérifié » = de mémoire, à confirmer (prix, quotas, fonctionnalités des services cités).

## 1. Deux besoins différents, qu'il faut séparer

« Gérer la partie admin » peut vouloir dire deux choses, qui n'ont pas la même réponse :

| Besoin | Exemples | Qui l'utilise |
|---|---|---|
| **A. Administrer le contenu** | corriger un parking, ajouter une fiche d'histoire, changer un texte d'accueil, placer un lieu sur la carte, relancer la génération de la ville | Dasco (et peut-être quelques relecteurs) |
| **B. Un vrai back-end d'application** | comptes, progression partagée avec des amis, classements, scores du jeu des éléphants, statistiques | Les visiteurs, et Dasco pour modérer |

Le projet est aujourd'hui un **site 100 % statique** (décision du 28/09 : « pas de backend », hébergeable partout) ; la progression est dans `localStorage` (« sans compte ») ; le BACKLOG cite déjà « l'ouverture aux amis (back-end, partage de progression) ». A et B peuvent venir **à des moments différents**.

## 2. Ce qui existe (mesuré)

- **Contenu en fichiers JSON dans le dépôt** : `pois.json` (8 fiches sourcées), `parkings.json` (textes et retouches `overrides` / `added`, appliquées au chargement), `lobby.json`, `mascot.json`, `place-hours.json`, `avatar.json`, `life.json`… ; la ville elle-même (`city.json`) est un **produit du script** (`npm run data`), jamais écrit à la main.
- **Édition aujourd'hui** : à la main dans un éditeur, ou via Claude ; un **outil de placement** réservé au développement (`src/dev/placement.ts`) écrit `pois.json` par le serveur Vite, absent de la production.
- **Publication** : commit → GitHub → Vercel (prévisualisation par branche, production sur `main`).
- **Règle de qualité** : chaque fiche est sourcée, rien d'inventé ; la relecture de code a trouvé une **faille d'injection HTML** dans une note de fiche (corrigée) : tout contenu édité par quelqu'un d'autre devra être assaini.

## 3. Les options

### Option 1 : un CMS « dans Git » (pas de serveur à nous)
Une interface d'édition (type Decap CMS, TinaCMS, Keystatic, Sveltia : **non vérifié** pour la version courante de chacun) qui **modifie les JSON dans le dépôt** par l'API de GitHub et ouvre une branche ou une PR ; Vercel construit une prévisualisation ; la fusion déploie.
- ✅ Aucun serveur, aucune base, historique et retour arrière gratuits (Git), prévisualisation par modification, authentification par GitHub, coût nul ou très bas.
- ✅ Colle à l'existant (les JSON restent la source de vérité, comme les parkings).
- ❌ Pas de données **dynamiques** (comptes, progression, scores) ; chaque publication = un build.
- ❌ Les formulaires doivent suivre le schéma de chaque JSON ; la carte (placement) demande un composant sur mesure.

### Option 2 : un back-end « prêt à l'emploi » (BaaS)
Base de données + comptes + stockage de fichiers + API déjà fournis : Supabase (Postgres, authentification, stockage ; peut s'auto-héberger), Firebase, Appwrite, PocketBase (un seul exécutable, **auto-hébergeable sur le Raspberry Pi / Coolify** déjà évoqués dans les décisions du projet) : tous **non vérifiés** ici pour les offres et quotas actuels.
- ✅ Comptes, progression, classements, modération : ce qu'il faut pour le besoin B.
- ✅ Interface d'administration de base fournie (tables), rôles, règles d'accès.
- ❌ Dépendance à un fournisseur (moindre avec Supabase / PocketBase auto-hébergés) ; coûts selon le trafic ; le contenu éditorial passerait de Git à une base : il faut garder **une version dans Git** (sauvegarde, relecture).
- ❌ Contenu chargé à l'exécution : cache, mode hors ligne (le site a un service worker), temps de chargement.

### Option 3 : une API sur mesure (fonctions Vercel + base ou SQLite/Turso)
- ✅ Contrôle total, exactement les écrans voulus.
- ❌ Le plus de travail (authentification, validation, sécurité, sauvegardes, hébergement) pour peu de bénéfice par rapport à 1 + 2.

## 4. Recommandation : en deux étages

1. **Étage éditorial (besoin A) : option 1.** Un CMS dans Git pour `pois.json`, `parkings.json` (retouches), `lobby.json`, `place-hours.json` : formulaires, schéma de validation, **champ « source » obligatoire** (la règle du projet devient une contrainte technique), prévisualisation Vercel, retour arrière par Git. Une action GitHub (`workflow_dispatch`) pourra **relancer la génération de la ville** (`npm run data`) et ouvrir la PR : l'« admin » déclenche le moteur de l'analyse 2 sans ligne de commande.
2. **Étage applicatif (besoin B) : option 2, seulement quand les amis arrivent.** Un BaaS (Supabase, ou PocketBase auto-hébergé) pour comptes **facultatifs**, progression synchronisée, scores ; le site reste utilisable sans compte (comme aujourd'hui), le contenu éditorial reste statique et versionné.
Le point clé : **ne pas déplacer le contenu dans une base tant qu'il n'est pas dynamique.** Git le versionne, le relit et le sauvegarde déjà.

## 5. Ce que l'admin devrait permettre (premier périmètre)

| Écran | Fonction | Remarque |
|---|---|---|
| Lieux d'histoire | créer / modifier une fiche : titre, époque, résumé, histoire, anecdote, **sources obligatoires** | refus d'enregistrer sans source |
| Carte de placement | cliquer pour placer un lieu, un panneau, un parking ajouté | reprend `src/dev/placement.ts` en version protégée |
| Parkings | retouches par identifiant (masquer, nom, tarif, capacité, note + source), parkings ajoutés | modèle `parkings.json` ; aperçu direct |
| Textes | accueil, messages du jeu, fiches de parkings | par langue si besoin |
| Génération | « régénérer la ville » : lance `npm run data`, montre le rapport (hauteurs réelles, parkings, anomalies) | action GitHub |
| Publication | liste des modifications en attente, prévisualisation, **fusion = production** | accord explicite requis (règle du projet) |
| Journal | qui a changé quoi, quand | gratuit avec Git |

Pour le besoin B (plus tard) : liste des comptes, modération des pseudos et scores, remise à zéro.

## 6. Modèle de données (besoin B, esquisse)
`users(id, pseudo, créé)` · `progress(user_id, lieux_découverts[], points, éléphants_ramenés[], mis_à_jour)` · `scores(user_id, jeu, valeur, date)` · `friends(user_id, ami_id)` (si partage). **Aucune donnée personnelle superflue** : pseudo seulement, adresse électronique si connexion par lien magique. Hébergement dans l'Union européenne, mentions et consentement à prévoir (RGPD ; non vérifié juridiquement).

## 7. Sécurité et conformité
- **Authentification** : connexion GitHub pour l'éditorial (un compte, des rôles) ; lien magique ou compte social pour les visiteurs (facultatif).
- **Assainir tout texte édité** avant affichage (l'injection de la note de fiche l'a montré) ; le CMS ne doit jamais produire de HTML brut.
- **Droits** : les visiteurs lisent ; seul l'étage éditorial écrit le contenu ; règles d'accès par ligne pour la progression (chacun ne voit que la sienne et celle de ses amis).
- **Secrets** hors du dépôt (variables de Vercel / GitHub), **sauvegardes** (Git pour le contenu ; export planifié pour la base).
- **Abus** : limites de débit sur les scores, validation côté serveur (jamais confiance au navigateur : un score envoyé par le client se triche).

## 8. Coûts : vérifiés le 08/10/2026 sur les pages officielles

**Vercel, plan Hobby (gratuit)** : 100 Go de transfert rapide, 1 000 000 de requêtes CDN, **1 000 000 d'invocations de fonctions**, 4 heures de CPU actif, 360 Go-heures de mémoire, **100 déploiements par jour**, 200 projets, durée maximale d'une fonction 300 s ; au-delà d'une limite, la fonctionnalité s'arrête jusqu'à 30 jours plus tard (pas de facture surprise). **Réserve importante : le plan Hobby est réservé à un usage personnel et non commercial** (règles d'usage équitable) ; un usage commercial demande le plan Pro (20 $ par utilisateur et par mois).

| Service gratuit | Limites gratuites | Piège |
|---|---|---|
| **Neon (Postgres)**, branchable à Vercel | 1 Go par projet, 100 heures de calcul par mois et par projet, 100 projets ; le calcul **se met en veille après 5 minutes** et **se réveille tout seul** à la requête | Premier appel après une veille un peu plus lent (non mesuré) |
| **Supabase** (base + comptes + fichiers + écran d'administration) | 500 Mo de base, 50 000 utilisateurs actifs par mois, 1 Go de fichiers, 5 Go de sortie, 500 000 appels de fonctions, 2 projets | **Projet mis en pause après 1 semaine sans activité** : à relancer à la main |
| **Turso (SQLite hébergé)** | 100 bases, 5 Go, 500 millions de lignes lues et 10 millions écrites par mois | **Base archivée après 10 jours d'inactivité** (à désarchiver à la main) |
| **Cloudflare Workers + D1** | 100 000 requêtes par jour, 10 ms de CPU par appel ; D1 : 5 Go, 5 millions de lignes lues et 100 000 écrites par jour | Autre plateforme que Vercel (domaine ou CORS à gérer) |

**Conclusion coûts** : pour un projet entre amis, **le coût peut rester nul**. Les limites ne se frôlent pas : cent amis qui synchronisent trente fois par jour font environ 90 000 appels par mois, soit 9 % du million d'invocations Hobby. Le vrai risque n'est pas la facture mais les **mises en pause** de Supabase (1 semaine) et de Turso (10 jours), qui casseraient le jeu après quelques semaines sans visite. **Neon se réveille seul** : c'est le meilleur choix pour une base sans entretien, avec les **fonctions Vercel du même dépôt** pour l'API.

## 9. Impacts sur l'architecture
- Le contenu éditorial reste chargé **au build** (comme `pois.json`) : pas de requête de plus au chargement, mode hors ligne intact.
- Les données dynamiques (étage B) ajoutent des appels réseau **optionnels** ; sans réseau ou sans compte, repli sur `localStorage` (comportement actuel).
- Avec plusieurs villes (analyse 2), l'admin devient **par ville** (`cities/<slug>/`), ce qui plaide pour la forme « dossier de JSON » dès maintenant.

## 10. Jalons (en sessions d'une demi-journée, estimation)

| Jalon | Contenu | Sessions |
|---|---|---|
| S0 · Schémas | JSON Schema (ou zod) pour chaque fichier de contenu, script de contrôle en CI : source obligatoire, positions dans l'emprise, identifiants connus | 1 |
| S1 · CMS dans Git | Interface pour fiches, textes, parkings ; prévisualisation Vercel ; rôles | 1,5 à 2 |
| S2 · Génération depuis l'admin | Action GitHub qui relance `npm run data`, rapport, PR automatique | 1 |
| S3 · Carte de placement protégée | Placement et retouches par la carte | 2 à 3 |
| S4 · Comptes et progression (besoin B) | BaaS, connexion facultative, synchronisation, règles d'accès | 3 |
| S5 · Scores, amis, modération | classements, partage, écrans de modération | 3 |
Total : **S0 à S3 (besoin A) : 5,5 à 7 sessions** ; **S4 à S5 (besoin B) : 6 sessions de plus**.

## 11. Questions pour Dasco (proposition par défaut)

1. **Le besoin le plus pressé** : corriger et enrichir le contenu (A), ou ouvrir aux amis (B) ? *Défaut : A d'abord.*
2. **Qui administrera** : toi seul, ou d'autres relecteurs ? *Défaut : toi seul, rôles prévus.*
3. **Les comptes visiteurs** : indispensables, ou facultatifs ? *Défaut : facultatifs, le site reste utilisable sans.*
4. **Hébergement** : tout chez les services actuels (GitHub, Vercel), ou auto-hébergé sur ton Raspberry Pi / Coolify ? *Défaut : services actuels pour A ; choix à refaire pour B.*
5. **Faut-il publier sans passer par Git** (publication instantanée) ou accepter « modification → prévisualisation → fusion » ? *Défaut : accepter ce cycle, il protège la production.*
