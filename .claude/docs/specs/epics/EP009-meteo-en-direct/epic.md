# Epic EP009 - La météo en direct sur le diorama

**Statut (09/10/2026) : reprise à la demande de Dasco (« géré par le back et affiché sur le front ») ; spec v2 à valider par Dasco avant de coder ; rien n'est codé.** Réécrite après EP010 à partir de deux plans : [back, contrat et admin](../../../tasks/ep009-back-plan-v2.md) (appels réels à Open-Meteo, route prototypée avec 19 tests) et [front 3D](../../../tasks/ep009-front-plan-v2.md) (pluie prototype mesurée sur la puce graphique du Mac). Les études du 08/10 ([front](../../../tasks/meteo-front-plan.md), [back](../../../tasks/meteo-back-plan.md)) sont remplacées.

## Résumé
Afficher sur le diorama **la météo réelle de Chambéry** (soleil, couvert, pluie, brouillard, neige, orage, vent), rendue en 3D dans le style maquette.
- **Le back gère la météo** : il interroge la source, traduit ses codes en une liste fermée de conditions définie dans le contrat, garde le relevé en cache pour tous les visiteurs, et l'administration peut forcer ou couper la météo.
- **La carte l'affiche** : elle ne voit jamais la source, seulement le format du contrat, qu'elle vérifie.

## Contexte & Problème
- Le diorama suit déjà l'heure réelle (jour/nuit, course du soleil) et les saisons ; la météo est la pièce qui manque pour que « la ville vive ».
- EP010 a posé le back (`backend/src`, Hono sur Vercel), le contrat partagé (`contrat/`, zod/mini) et l'administration React : la météo s'y range sans nouvelle infrastructure.
- Contraintes : **coût nul** et **fluidité mobile** (iPhone 12 Pro à 30-31 img/s en mouvement, mesuré sans météo, voir [PERF-AUDIT](../../../architecture/PERF-AUDIT.md)). Le vrai coût est le rendu 3D, pas les données.

## Architecture
```
Open-Meteo, modèle ICON du DWD (icon_seamless) : gratuit, sans clé
      ▲ au plus 1 appel / 10 min par instance, et seulement si quelqu'un regarde
      │ coordonnées fixes du centre (45,5658 ; 5,9205), aucune donnée du visiteur
backend/src/meteo/
      open-meteo.ts   appel (délai 4 s), réponse amont vérifiée par Zod
      normalize.ts    codes WMO + valeurs continues → 9 conditions et intensités 0..1 (l'enum et son mapper)
      service.ts      cache 10 min, une seule requête amont en vol, pas de nouvel essai pendant 60 s après un échec,
                      repli : dernier bon relevé « stale » jusqu'à 3 h, puis 503 meteo-indisponible
                      forçage de l'admin lu dans app_meta, au plus toutes les 30 min par instance (US012)
      │
GET /api/weather ── public, max-age=0, s-maxage=60, stale-while-revalidate=300 (CDN de Vercel)
      │  format : contrat/meteo.ts (zod/mini), partagé par le back, la carte et l'admin
      ▼
frontend/carte   module météo chargé à la demande → vérification par le contrat → état lissé (fondu)
                 → lumière (daynight) + passe finale (voile, éclair) + effets selon qualityLevel
                 ?weather=… : mêmes valeurs types que le forçage de l'admin, zéro réseau
frontend/admin   écran « Météo » : ce que voient les visiteurs, relevé brut, forcer ou couper pour tous (US012)
```
- **9 conditions** (`weatherCondition`, libellés dans le contrat) : `clear` Ciel dégagé, `partly` Éclaircies, `cloudy` Couvert, `fog` Brouillard, `drizzle` Bruine, `rain` Pluie, `snow` Neige, `sleet` Pluie et neige, `thunder` Orage.
- **Relevé à la demande, pas planifié** (D10) : les visiteurs lisent notre API, jamais Open-Meteo ; 100 amis en même temps font 1 appel à la source, aucun visiteur n'en fait aucun. Rejoué sur 2 mois d'historique, un relevé 3 fois par jour aurait montré un temps différent du vrai 39 % du temps, raté une averse sur deux et tous les orages ([plan back](../../../tasks/ep009-back-plan-v2.md) § 14).
- **Carte du Pi** : pas d'API (nginx répond 404 sur `/api/`), donc pas de météo et pas de relance. C'est voulu.

## Objectifs
1. Voir sur le diorama le temps qu'il fait à Chambéry (au plus 10 min de retard), sans retarder le chargement
2. Des effets lisibles et jolis, dans la palette pastel de la maquette
3. **0 €** : au pire 1,5 % du quota gratuit d'Open-Meteo par instance active en continu (3 % avec deux), 4,3 % au plus des invocations Vercel gratuites, aucun réveil de la base sans forçage
4. **Aucune régression de fluidité** : effets mesurés, niveaux de qualité, dégradation automatique, aucune image figée par une recompilation
5. Le site marche sans la météo : hors ligne, API en panne, carte du Pi, préférence « météo désactivée », météo coupée depuis l'admin
6. Dasco pilote la météo depuis l'administration : voir ce que reçoivent les visiteurs, forcer une météo pour une démo, la couper

---

## User Stories

| ID | User Story | Domaine | Jours | Lot | Status |
|----|------------|---------|-------|-----|--------|
| [US001](US001-niveaux-de-qualite-et-mesure.md) | Niveaux de qualité, temps GPU, mesure de la pluie sur téléphone | Scène | 0,75 à 1 | Démo | 🔲 Todo |
| [US002](US002-socle-meteo-et-mode-force.md) | Socle météo : état, fondu, couvert, `?weather=`, puce, réglages posés au démarrage | Scène, UI | 3 | Démo | 🔲 Todo |
| [US003](US003-route-api-weather.md) | Contrat météo et route `/api/weather` (ICON, cache, repli, tests, contrôle du build) | Contrat, API | 1,5 à 2 (dont contrat 0,25) | Démo (contrat), MVP | 🔲 Todo |
| [US004](US004-meteo-reelle-cote-site.md) | Météo réelle côté carte : lecture, relances, états, crédits | Carte, UI | 1 à 1,5 | MVP | 🔲 Todo |
| [US005](US005-pluie.md) | Pluie | Scène | 2,5 à 3 | MVP | 🔲 Todo |
| [US006](US006-brouillard.md) | Brouillard | Scène | 1,5 | Démo | 🔲 Todo |
| [US007](US007-neige.md) | Neige (flocons, sol, toits, arbres) | Scène | 3 à 4 | Complet | 🔲 Todo |
| [US008](US008-orage.md) | Orage | Scène | 2 | Complet | 🔲 Todo |
| [US009](US009-vent.md) | Vent (fumées, drapeaux, arbres) | Scène | 2 à 2,5 | Complet | 🔲 Todo |
| [US010](US010-nuages-de-maquette.md) | Nuages de maquette | Scène | 1,5 | Complet | 🔲 Todo |
| [US011](US011-finitions-suivi-et-doc.md) | Finitions, calibrage, documentation | Tous | 1,5 à 2 | Complet | 🔲 Todo |
| [US012](US012-meteo-dans-l-admin.md) | Météo dans l'administration : écran, forçage pour les démos, coupure | API, admin | 1 à 1,25 | Admin | 🔲 Todo |
| [US013](US013-previsions-heure-par-heure.md) | Prévisions heure par heure (facultative) | Contrat, API, carte | 1,5 | Plus tard | 🔲 Todo |

Estimations à ± 30 %, développement + vérification navigateur ; **le test sur téléphone réel n'est pas compté**. US001 à US011 gardent leur numéro de la v1 ; le suivi dans l'admin quitte US011 pour US012.

### Lots
| Lot | US | Jours | Ce qu'on obtient |
|-----|----|-------|------------------|
| **Démo** (sans la route) | contrat (1er commit d'US003), US001, US002, US006 | ≈ 5,5 à 5,75 | Couvert et brouillard, puce, `?weather=` pour montrer ; mesure sur téléphone ; aucun risque de fluidité |
| **MVP** | Démo + route (reste d'US003), US004, US005 | ≈ 10,25 à 12 | La météo réelle, gérée par le back, avec pluie et brouillard : les temps les plus fréquents à Chambéry |
| **Admin** | MVP + US012 | ≈ 11,25 à 13,25 | Voir ce que reçoivent les visiteurs ; forcer la neige pour une démo à plusieurs ; couper la météo |
| **Complet** | Admin + US007 à US011 | ≈ 21 à 25 | Neige, orage, vent, nuages, finitions |

**Ordre conseillé** (une US à la fois, un seul développeur)
1. Contrat et route (US003) : le back gère la météo dès le départ, sans risque pour la fluidité, et peut passer avant EP008 ; son premier commit (le contrat seul) suffit à la carte pour coder `?weather=`
2. US001 : Dasco mesure sur son téléphone pendant la suite ; le budget sert à la pluie (US005)
3. US002 (socle), puis US004 (météo réelle sur la carte) : la météo du back s'affiche de bout en bout
4. US006 (brouillard), puis US005 (pluie) : fin du MVP
5. US012 : de préférence après EP008-US013 (journal avec auteur, `audit_log`) ; sinon avec le journal actuel (`edit_log`), en prévenant EP008 de la correspondance
6. Le reste selon l'envie et la saison (neige avant l'hiver pour l'effet démo) ; US011 en dernier

Pour montrer le rendu avant d'avoir la route, la Démo reste possible : contrat, US001, US002, US006.

Branche d'epic : `feat/EP009-meteo` (partie de `main` après EP010), une branche par US fusionnée dedans (`feat/EP009-US003-contrat-et-route`…). L'API se vérifie sur une prévisualisation `preview/EP009-meteo`.

---

## Flux principal
```
Démarrage du diorama (rien n'attend la météo)
  → import() du module météo, en parallèle de city.json (sauf préférence « météo désactivée »)
  → GET /api/weather (délai 8 s ; échec → nouvel essai à 60 s, puis 2, 4, 8 min, au plus 15 min, et au retour du réseau)
  → réponse vérifiée par le contrat → fondu d'environ 3 s, derrière l'écran d'accueil → lumière + effets selon qualityLevel
  → relecture toutes les 15 min si l'onglet est visible et qu'il y a eu une interaction dans les 30 min
```

---

## Règles métier
1. **Rien d'inventé** : la scène montre le relevé du modèle avec son heure de validité (`observedAt`) ; la puce dit « modèle ICON, 10 h 00 », **jamais « observé »** ; un relevé de plus de 3 h n'est jamais montré comme actuel (ni par le back, ni par la carte) ; une météo forcée n'affiche pas de température
2. **Le diorama n'attend jamais la météo** : sans réponse, ciel par défaut (comportement actuel), sans message d'erreur bloquant
3. **Position fixe** : 45,5658 ; 5,9205, les coordonnées de `CHAMBERY` (`frontend/carte/src/time/chambery.ts`), recopiées dans le back avec leur source puisque le back n'importe pas la carte. **Jamais la géolocalisation du visiteur**, et aucun paramètre de sa requête n'est transmis à la source
4. **Seul le back parle à la source** et traduit ses codes : l'énumération et sa correspondance sont dans `backend/src/meteo/normalize.ts` ; la carte ne voit jamais un code WMO
5. **Intensités par les valeurs continues, libellé par la source** (D9) : présence et force de la pluie, de la neige et du brouillard tirées des mm/h, de la visibilité et de la couverture nuageuse ; bruine ou pluie, et ciel par temps sec, selon le code de la source ; orage seulement pour les codes 95 à 99 (déduit, pas mesuré). Les seuils sont des choix de rendu : constantes nommées dans le code (D7), calibrées avec Dasco
6. **Température** : neige seulement à 2 °C ou moins, sinon pluie (appliqué par le back, et par la carte pour `?weather=snow`)
7. **Direct ou simulée** (D4) : météo réelle seulement à l'heure « Direct » et en saison automatique ; sinon « simulée » (beau temps), avec un bouton « Revenir au direct »
8. **Fluidité d'abord** : si la densité de pixels est déjà au minimum et que deux mesures de suite en mouvement passent sous 24 img/s, densité des précipitations divisée par 2, puis coupure ; jamais de remontée dans la session ; la lumière et le brouillard (gratuits) restent. *Remplace le seuil de 40 img/s de la v1, qui aurait coupé la pluie en permanence sur l'iPhone, déjà à 30-31 img/s sans météo*
9. **Aucune recompilation en cours de route** : tout ce qui touche aux matériaux standards (objet brouillard inactif, crochets du sol mouillé, de la neige et du balancement, à 0) est posé **au démarrage**, et `castShadow` n'est jamais basculé. Mesuré : brouillard créé après le démarrage = 4,4 s d'image figée, bascule des ombres = 3 s. Critère de chaque US de rendu : aucune image de plus de 50 ms quand un effet apparaît
10. **Accessibilité** : `prefers-reduced-motion` ou « Effets réduits » coupe éclairs, flashs et balancement et ralentit les précipitations ; jamais plus de 3 éclairs par seconde
11. **Attributions** (règle projet n° 5) : « Météo : Open-Meteo.com, modèle ICON du DWD » (CC BY 4.0, données adaptées pour le diorama) dans le README (section Licences), à côté de la puce (panneau) et dans les crédits de l'app ; pas de crédit quand la météo est forcée
12. **Poids** : module météo chargé à la demande (≈ 8 à 10 Ko gzip une fois complet) ; chunk principal + 2,5 Ko gzip au plus
13. **Forçage** (D6) : priorité à l'adresse (`?weather=`), puis à l'administration (`forced`), puis au direct ; un forçage de l'admin dure de 5 min à 6 h, puis la météo réelle revient seule

---

## Décisions
| # | Question | Décision ou recommandation | Statut |
|---|----------|----------------------------|--------|
| D1 | Quel lot engager ? | Le MVP, dans l'ordre conseillé (contrat et route d'abord) ; la suite selon la mesure sur téléphone (US001) | **À trancher** |
| D2 | Le projet reste-t-il non commercial ? (Open-Meteo gratuit et Vercel Hobby l'exigent tous les deux) | Oui ; sinon MET Norway (commercial permis, +0,5 j) ou Open-Meteo payant (≈ 29 €/mois, non vérifié) + Vercel Pro | **À reconfirmer** |
| D3 | Source | Open-Meteo avec le **modèle ICON** (`icon_seamless`), pas AROME : AROME ne donne ni la visibilité ni l'orage à Chambéry (0 h de brouillard et d'orage sur 1 434 h d'historique). Pas de source de secours au départ | Retenu (09/10) |
| D4 | Hors de l'heure « Direct » | Météo « simulée » (beau temps) ; prévisions heure par heure plus tard (US013) | Retenu (09/10) |
| D5 | Décorative, ou aussi dans les fiches et le jeu ? | Décorative + puce | Retenu (09/10) |
| D6 | Forçage pour les démos | `?weather=` pour régler le rendu **et** forçage ou coupure depuis l'admin, vus par tous les visiteurs (US012) | Retenu (09/10) |
| D7 | Seuils de rendu réglables dans l'admin ? | Non : constantes nommées dans `backend/src/meteo/normalize.ts` (sinon +1 j, et des états incohérents possibles) | Recommandé |
| D8 | Où ranger le forçage ? | Dans la table existante `app_meta` (clé `meteo.forcage`) : **aucune migration**, aucun conflit avec EP008 | Recommandé |
| D9 | Libellé de la condition | Règle 5 : même libellé que la source 98 % du temps, contre 82 % avec la seule couverture nuageuse | Recommandé |
| D10 | Relevé planifié (matin, après-midi, soir) ou à la demande ? | **À la demande, avec cache** ; la carte attend 8 s puis réessaie à 60 s. Une tâche planifiée une fois par jour pourra servir plus tard à un historique | Retenu (09/10) |
| D11 | Pluie et neige au-dessus du socle seulement, ou partout à l'écran ? | Socle seulement : partout, la pluie dessine des tirets sur le fond beige, qui font penser à de la neige | **À trancher** |
| D12 | Repères de jeu (gemmes ✦, épingles, éléphants) dans le brouillard | Toujours visibles : ils percent le brouillard | **À trancher** |

D3 à D6 et D10 : accord de Dasco le 09/10 sur les recommandations de l'agent du back. D7 à D9 se valident avec la spec.

---

## Arbitrages entre les deux plans
| Sujet | Plan front | Plan back | Retenu |
|-------|-----------|-----------|--------|
| Délai de la carte | 8 s, nouvel essai à 60 s | 3 s (§ 5.7, écrit avant la réponse à Dasco du § 14) | 8 s et 60 s (D10) |
| Estimations du MVP | front réestimé : 9 à 10 j, + US003 | « ≈ 12 j » (front non réestimé) | Celles du plan front |
| Écran admin | + lien « Aperçu sur la carte » (`/?weather=…`) | sans | Avec le lien : mêmes valeurs types, donc même rendu |
| Relevé réel pendant un forçage | — | souhaitable, non prototypé | Dans US012 : l'écran montre aussi le relevé réel |

Les plans v2 corrigent aussi la v1 : brouillard **linéaire** calé sur la distance de la caméra (au lieu de `FogExp2`) ; ombres effacées par la baisse du soleil (au lieu d'être coupées) ; règle de fluidité à 24 img/s (règle 8) ; rien à retirer dans `backend/src/app.ts`, dont le `no-store` global n'écrase déjà plus l'en-tête d'une route ; suivi dans l'admin sur une route dédiée (`/api/admin/weather`), sans toucher `/api/admin/status`.

## Constats et risques
- **Mesuré sur le Mac** (puce M1, Chrome sur la vraie puce graphique) : 3 000 traînées de pluie GPU = 1 appel de rendu, +0,1 à +0,45 ms de GPU par image, cadence inchangée (30 img/s au repos, 60 en mouvement) ; cas extrême de 20 000 traînées larges : −3 % d'img/s. **Aucun téléphone mesuré** (US001)
- **Les recompilations de shaders sont la vraie menace** (règle 9), bien plus que le coût des effets
- **Défaut existant découvert** : la passe finale de l'effet maquette éclaircit les bords du socle (couleurs prémultipliées) ; invisible aujourd'hui, liseré blanc avec le brouillard. Correction de 4 lignes dans US002
- **TI-02** : la boucle ne s'arrête déjà jamais (les éléphants marchent) ; la pluie n'ajoute aucune image, seulement du travail par image
- **Quotas d'Open-Meteo par adresse IP** : les fonctions Vercel sortent par des IP partagées, des refus (429) dus à d'autres projets sont possibles [non constaté] ; parade : repli « stale » de 3 h, erreur visible dans l'écran admin, source de secours MET Norway (+0,5 j) si ça arrive
- **Réveils de la base Neon** (US012 seulement) : lecture du forçage bornée ; ≈ 0 à 10 CU-h par mois selon l'usage, sur 100 gratuites [estimé] ; un onglet oublié ne coûte rien, puisque la carte cesse de relire après 30 min sans interaction
- **Coordination avec EP008** (autre session) : fichiers communs `backend/src/app.ts`, `contrat/erreurs.ts` (une ligne par chantier), `scripts/check-api-esm.mjs`, navigation de l'admin. EP008 doit garder `app_meta` et prévoir les lignes météo du journal dans `audit_log` ; le second chantier à fusionner se rebase
- **Sans garantie de service** : les offres gratuites n'en ont pas ; le repli « ciel par défaut » rend une panne invisible
- **Ne pas promettre** d'éclairs ni de brouillard « en temps réel » : ils sont déduits d'un modèle (code orage, visibilité), pas observés

## Non vérifié
- Aucune mesure sur téléphone : coût réel de la pluie, du balancement des arbres, de la neige au sol
- Cache du CDN de Vercel sur la fonction (`HIT` / `MISS`, `stale-while-revalidate`) : à constater sur la prévisualisation
- Consommation réelle de Neon ; refus 429 sur les IP partagées de Vercel
- Fiabilité de l'orage et du brouillard d'ICON face à des observations ; l'hiver (historique testé d'août à octobre)
- Prix payant d'Open-Meteo (pages tierces seulement)
- Neige, orage, vent, nuages, panneau de la puce, écran admin : non prototypés ; aucun rendu encore vu par Dasco

---

## Critères d'acceptation
- [ ] Les US du lot choisi sont terminées
- [ ] `npm run build` (dont le contrôle de la route météo par `check-api-esm`) et `npm test` passent
- [ ] Mesure sur au moins un téléphone réel : pas de baisse de fluidité au repos par beau temps, budget pluie respecté
- [ ] Hors ligne, API en panne, carte du Pi : le diorama démarre et tourne comme aujourd'hui
- [ ] Cache du CDN constaté sur la prévisualisation (`MISS` puis `HIT`)
- [ ] Crédits Open-Meteo dans le README et dans l'app
- [ ] Rendu de chaque météo validé par Dasco (`?weather=`)
- [ ] Documents de suivi à jour (FEATURES, CHANGELOG, DECISIONS, README)

---

## Estimation globale
- **Complexité** : L (Démo, MVP) à XL (Complet)
- **Effort estimé** : Démo ≈ 5,5 j, MVP ≈ 10,25 à 12 j, Admin ≈ 11,25 à 13,25 j, Complet ≈ 21 à 25 j (dont back, contrat et admin ≈ 2,5 à 3,25 j)
- **Coût en euros** : 0 € tant que le projet reste non commercial
- **Ce que Dasco aura à faire** : trancher D1, D2, D11 et D12 ; mesurer sur son téléphone (US001, protocole fourni) ; valider les rendus avec `?weather=` ; vérifier que la prévisualisation a une base (US012) ; donner son accord pour la production. Ni clé, ni variable d'environnement, ni migration

---

**Version** : v2.0 (v1.0 du 08/10/2026, écrite avant EP010)
**Créé le** : 08/10/2026 · **Mis à jour le** : 09/10/2026
