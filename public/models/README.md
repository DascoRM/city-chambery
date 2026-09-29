# Modèles 3D (glTF)

Déposer ici les fichiers `.glb` exportés depuis Blender, puis les référencer dans `src/content/models.json`
avec `"source": "models/<fichier>.glb"`.

Conventions d'export :
- unité : 1 unité Blender = 1 mètre ;
- origine au centre de la base du monument, posée au sol ;
- axe Y vers le haut (réglage par défaut de l'export glTF de Blender) ;
- low-poly, idéalement moins de 300 Ko par modèle.
