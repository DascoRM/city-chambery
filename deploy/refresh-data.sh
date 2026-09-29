#!/bin/sh
# Régénère les données pendant le build Docker (REFRESH_DATA=true) :
#   1. npm run data   : OpenStreetMap + hauteurs BD TOPO + relief RGE ALTI → public/data/city.json
#   2. npm run nature : arbres du pack Quaternius → public/models/nature/*.glb
#
# Filet de sécurité : si un service est indisponible (Overpass saturé, IGN en panne…), on garde
# les données du dépôt au lieu de faire échouer le build ou de publier une carte dégradée.
# (Quand l'IGN ne répond pas, `npm run data` ne plante pas : il retombe sur des hauteurs estimées
# et un relief interpolé. On le détecte grâce à l'attribution écrite dans city.json.)
set -u
CITY=public/data/city.json
cp "$CITY" /tmp/city.committed.json

restore() {
  echo "⚠️  $1 → on garde le city.json du dépôt"
  cp /tmp/city.committed.json "$CITY"
}

echo "▶ Régénération des données (OSM, BD TOPO, RGE ALTI)…"
if npm run data; then
  if node -e "const a = require('./$CITY').attribution || ''; process.exit(/BD TOPO/.test(a) && /RGE ALTI/.test(a) ? 0 : 1)"; then
    echo "✓ city.json régénéré avec toutes les sources"
  else
    restore "BD TOPO ou RGE ALTI indisponible (données incomplètes)"
  fi
else
  restore "téléchargement impossible (OpenStreetMap ou script en erreur)"
fi

echo "▶ Conversion des arbres (pack nature)…"
if [ -d assets-src/quaternius-nature/obj ]; then
  npm run nature || echo "⚠️  conversion des arbres en erreur → on garde les .glb du dépôt"
else
  echo "⚠️  assets-src/ absent du contexte de build → on garde les .glb du dépôt"
fi
exit 0
