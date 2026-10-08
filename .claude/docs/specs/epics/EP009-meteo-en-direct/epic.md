# Epic EP009 - La météo en direct sur le diorama

**Statut (08/10/2026) : spec à valider par Dasco ; rien n'est codé.** Études : [plan front / 3D](../../../tasks/meteo-front-plan.md) et [plan back / données](../../../tasks/meteo-back-plan.md) (sources et quotas consultés le 08/10/2026).

## Résumé
Afficher sur le diorama **la météo réelle de Chambéry** (soleil, couvert, pluie, brouillard, neige, orage, vent), rendue en 3D dans le style maquette, avec une petite route `/api/weather` qui interroge une source gratuite et garde le relevé en cache pour tous les visiteurs.

## Contexte & Problème
- Le diorama suit déjà l'heure réelle (jour/nuit, course du soleil) et les saisons ; la météo est la pièce qui manque pour que « la ville vive » vraiment.
- Le back-end léger d'EP008 (Hono sur Vercel, Pi/Coolify visé) permet maintenant de passer par un proxy au lieu d'appeler la source depuis le navigateur.
- Contrainte : **coût nul** et **fluidité mobile** (iPhone ≤ 31 img/s mesuré, voir [PERF-AUDIT](../../../architecture/PERF-AUDIT.md)). Le vrai coût est le rendu 3D, pas les données.

## Architecture proposée
```
Open-Meteo (modèle Météo-France AROME, gratuit, sans clé)
      ▲ 1 appel / 10 min au plus, quel que soit le nombre de visiteurs
      │
/api/weather (Hono) ── cache mémoire 10 min + s-maxage=600, stale-while-revalidate
      │                 repli : dernier bon relevé « stale » ≤ 3 h, puis 503
      ▼
Navigateur : module météo chargé à la demande ──► WeatherState lissé ──► daynight.apply() + effets 3D
             ?weather=rain (forcé, zéro réseau)     qualityLevel low/medium/high règle les effets
```

## Objectifs
1. Voir sur le diorama le temps qu'il fait à Chambéry en ce moment, sans retarder le chargement
2. Des effets lisibles et jolis, dans la palette pastel de la maquette
3. **0 €** : ≈ 4 400 appels par mois vers Open-Meteo, soit 1,5 % du quota gratuit
4. **Aucune régression de fluidité** : chaque effet coupable d'une baisse se dégrade ou se coupe tout seul
5. Le site marche sans la météo (hors ligne, API en panne, préférence « météo désactivée »)

---

## User Stories

| ID | User Story | Domaine | Jours | Lot | Status |
|----|------------|---------|-------|-----|--------|
| [US001](US001-niveaux-de-qualite-et-mesure.md) | Niveaux de qualité et mesure sur téléphone | Scène | 1 | Démo | 🔲 Todo |
| [US002](US002-socle-meteo-et-mode-force.md) | Socle météo : soleil / couvert, mode forcé, indicateur | Scène, UI | 3 | Démo | 🔲 Todo |
| [US003](US003-route-api-weather.md) | Route `/api/weather` : source, cache, repli, tests | API | 2 | MVP | 🔲 Todo |
| [US004](US004-meteo-reelle-cote-site.md) | Météo réelle côté site : récupération, relances, crédits | Site, UI | 1,5 | MVP | 🔲 Todo |
| [US005](US005-pluie.md) | Pluie | Scène | 3 | MVP | 🔲 Todo |
| [US006](US006-brouillard.md) | Brouillard | Scène | 1,5 à 2 | Démo | 🔲 Todo |
| [US007](US007-neige.md) | Neige (flocons, sol, toits, arbres) | Scène | 3 à 4 | Complet | 🔲 Todo |
| [US008](US008-orage.md) | Orage | Scène | 2 | Complet | 🔲 Todo |
| [US009](US009-vent.md) | Vent (fumées, drapeaux, arbres) | Scène | 2,5 | Complet | 🔲 Todo |
| [US010](US010-nuages-de-maquette.md) | Nuages de maquette | Scène | 1,5 | Complet | 🔲 Todo |
| [US011](US011-finitions-suivi-et-doc.md) | Finitions, dégradation selon la fluidité, suivi admin, doc | Tous | 2,5 | Complet | 🔲 Todo |

Estimations à ± 30 %, développement + vérification navigateur ; **le test sur téléphone réel n'est pas compté**.

### Lots
| Lot | US | Jours | Ce qu'on obtient |
|-----|----|-------|------------------|
| **Démo** (sans back) | US001, US002, US006 | ≈ 5,5 à 6 | Ambiance soleil / couvert / brouillard, indicateur, `?weather=` pour montrer. Aucun risque de fluidité |
| **MVP réaliste** | Démo + US003, US004, US005 | ≈ 12 à 12,5 | Météo réelle, avec pluie et brouillard : les temps les plus fréquents à Chambéry |
| **Complet** | MVP + US007 à US011 | ≈ 23,5 à 25 | Neige, orage, vent, nuages, dégradation automatique, suivi dans l'admin |

**Ordre conseillé** : US001 → US002 → US006 (démontrable à Dasco) ; US003 en parallèle (le site ne dépend que du contrat) → US004 → US005 ; le reste selon l'envie et la saison (neige à planifier avant l'hiver si on veut l'effet démo).

Branche d'epic : `feat/EP009-meteo`, une branche par US fusionnée dedans. US003 touche `server/` : à partir d'EP008 une fois fusionnée dans main (ou rebaser).

---

## Flux principal
```
Chargement du diorama (sans attendre la météo) → GET /api/weather (délai max 3 s)
  → WeatherState (fondu de quelques secondes) → éclairage + effets selon qualityLevel
  → relecture toutes les 15 min si l'onglet est visible
```

---

## Règles métier
1. **Rien d'inventé** : la scène montre le relevé de la source, horodaté (`observedAt`) ; un relevé de plus de 3 h n'est jamais montré comme actuel
2. **Le diorama n'attend jamais la météo** : sans réponse, ciel par défaut (comportement actuel), sans message d'erreur bloquant
3. **Position fixe** : coordonnées du centre de Chambéry (`src/time/chambery.ts`), **jamais la géolocalisation du visiteur**
4. **Le rendu se fonde sur les valeurs continues** (mm/h, couverture nuageuse, visibilité, vent), pas sur le code WMO : deux modèles donnent des codes différents au même instant (53 contre 61 constaté le 08/10/2026)
5. **Saison et température filtrent** : neige seulement si température ≤ ≈ 2 °C, sinon pluie
6. **Direct ou simulée** : dès que l'heure ou la saison quitte « Direct », la météo passe en « simulée » (soleil), avec un bouton pour revenir au direct *(à valider, décision D4)*
7. **Fluidité d'abord** : sous 40 img/s après la baisse de résolution maximale, on coupe d'abord les précipitations, puis le sol mouillé / enneigé ; l'éclairage (gratuit) reste
8. **Accessibilité** : `prefers-reduced-motion` coupe éclairs, flashs, balancement des arbres et ralentit les précipitations ; éclairs limités à 3 flashs par seconde
9. **Attributions** : Open-Meteo CC BY 4.0 dans le README (section Licences) et dans les crédits de l'app (règle projet n° 5)
10. **Le module météo est chargé à la demande** (chunk séparé) : + 10 Ko gzip au plus dans le chunk de l'appli

---

## Décisions à trancher par Dasco
| # | Question | Recommandation |
|---|----------|----------------|
| D1 | Quel lot engager : Démo, MVP ou Complet ? | Démo d'abord, puis décider avec les mesures de US001 |
| D2 | Le projet reste-t-il non commercial ? (Open-Meteo gratuit et Vercel Hobby l'exigent tous les deux) | Oui ; sinon revoir la source (MET Norway ou Météo-France autorisent le commercial) |
| D3 | Source : Open-Meteo seul, + MET Norway en secours (+0,5 j), ou Météo-France direct (+2 j) ? | Open-Meteo seul |
| D4 | Quitter l'heure « Direct » fait-il passer en météo simulée ? Ou faut-il les prévisions heure par heure (`hourly`, + ≈ 1 j) pour que la météo suive le curseur d'heure ? | Simulée en v1, `hourly` plus tard |
| D5 | Météo décorative seulement, ou aussi dans les fiches / le jeu (« il pleut, 12 °C ») ? | Décorative + indicateur |
| D6 | Forçage pour les démos : `?weather=` seul, ou aussi une route admin pour que tous les amis voient la même météo ? | `?weather=` seul |

---

## Critères d'acceptation
- [ ] Les US du lot choisi sont terminées
- [ ] `npm run build` passe ; tests Vitest de la route météo passent
- [ ] Mesure sur au moins un téléphone réel : pas de baisse de fluidité au repos par beau temps, budget pluie respecté
- [ ] Hors ligne et API en panne : le diorama démarre et tourne comme aujourd'hui
- [ ] Crédits Open-Meteo dans le README et dans l'app
- [ ] Rendu de chaque météo validé par Dasco (`?weather=`)
- [ ] Documents de suivi à jour (FEATURES, CHANGELOG, DECISIONS, README)

---

## Estimation globale
- **Complexité** : L (Démo / MVP) à XL (Complet)
- **Effort estimé** : Démo ≈ 6 j, MVP ≈ 12 j, Complet ≈ 23,5 à 25 j (dont ≈ 3,5 j back / données)
- **Coût en euros** : 0 € tant que le projet reste non commercial

---

**Version** : v1.0
**Créé le** : 08/10/2026
