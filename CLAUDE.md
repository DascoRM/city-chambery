# Consignes pour Claude

Projet : diorama 3D interactif du centre historique de Chambéry (Vite + TypeScript + Three.js, données OSM).

- Lire `claude/` en début de session : FEATURES, BACKLOG, CHANGELOG, DECISIONS.
- En fin d'itération : mettre à jour FEATURES.md, BACKLOG.md et ajouter une entrée dans CHANGELOG.md ; noter toute décision structurante dans DECISIONS.md.
- Ne jamais inventer de coordonnées ni de faits historiques : sourcer chaque fiche dans `src/content/pois.json`.
- Après toute modification du script de données : `npm run data -- --offline` pour régénérer `public/data/city.json`.
