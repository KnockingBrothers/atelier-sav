#!/bin/bash
set -e

# ── À adapter à votre installation ─────────────────────────────
SERVER_USER="votre_utilisateur"
SERVER_HOST="192.168.1.50"
SERVER_PATH="/home/votre_utilisateur/atelier-sav"
PM2_APP_NAME="atelier-sav"
# ────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "→ Envoi des fichiers vers ${SERVER_HOST}..."
rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude 'dist' \
  --exclude 'server/atelier-sav.db' \
  --exclude '.git' \
  "${SCRIPT_DIR}/" "${SERVER_USER}@${SERVER_HOST}:${SERVER_PATH}/"

echo "→ Installation, build et redémarrage sur le serveur..."
ssh "${SERVER_USER}@${SERVER_HOST}" bash -s << EOF
  set -e
  cd "${SERVER_PATH}"
  npm install
  npm run build
  if pm2 describe ${PM2_APP_NAME} > /dev/null 2>&1; then
    pm2 restart ${PM2_APP_NAME}
  else
    pm2 start "npm run server" --name ${PM2_APP_NAME}
    pm2 save
  fi
EOF

echo "→ Déploiement terminé. Application à jour sur http://${SERVER_HOST}:3001"
