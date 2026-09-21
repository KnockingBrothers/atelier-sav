#!/bin/bash
set -e

# ── À adapter à votre installation (mêmes valeurs que backup.sh) ──
APP_DIR="$HOME/atelier-sav"
DB_FILE="$APP_DIR/server/atelier-sav.db"
BACKUP_DIR="$HOME/atelier-sav-backups"
PM2_APP_NAME="atelier-sav"
# ────────────────────────────────────────────────────────────────

if [ -z "$1" ]; then
  echo "Sauvegardes disponibles dans $BACKUP_DIR (de la plus récente à la plus ancienne) :"
  echo ""
  ls -1t "$BACKUP_DIR"/atelier-sav-*.db.gz 2>/dev/null | xargs -n1 basename || echo "  (aucune sauvegarde trouvée)"
  echo ""
  echo "Usage : ./restore.sh <nom_du_fichier.db.gz>"
  echo "Exemple : ./restore.sh atelier-sav-20260902-020000.db.gz"
  exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Erreur : fichier introuvable : $BACKUP_FILE"
  exit 1
fi

echo "⚠️  Ceci va REMPLACER la base de données actuelle par la sauvegarde : $1"
read -p "Continuer ? (o/N) " CONFIRM
if [ "$CONFIRM" != "o" ] && [ "$CONFIRM" != "O" ]; then
  echo "Annulé."
  exit 0
fi

echo "→ Arrêt de l'application..."
pm2 stop "$PM2_APP_NAME" || true

# Sécurité : on garde une copie de la base actuelle avant de l'écraser,
# au cas où la restauration ne serait pas celle voulue.
if [ -f "$DB_FILE" ]; then
  SAFETY_COPY="$DB_FILE.avant-restauration-$(date +%Y%m%d-%H%M%S)"
  cp "$DB_FILE" "$SAFETY_COPY"
  echo "→ Base actuelle sauvegardée par sécurité : $SAFETY_COPY"
fi

echo "→ Restauration de la sauvegarde..."
TMP_FILE=$(mktemp)
gunzip -c "$BACKUP_FILE" > "$TMP_FILE"
cp "$TMP_FILE" "$DB_FILE"
rm "$TMP_FILE"

echo "→ Redémarrage de l'application..."
pm2 restart "$PM2_APP_NAME" || pm2 start "npm run server" --name "$PM2_APP_NAME"

echo ""
echo "✓ Restauration terminée."
echo "  Si ce n'était pas la bonne sauvegarde, votre base d'avant est ici :"
echo "  $SAFETY_COPY"

# ─────────────────────────────────────────────────────────────────────────────
# PROCÉDURE OPTIONNELLE : RESTAURATION DEPUIS UN PARTAGE RÉSEAU SMB/CIFS
#
# Le partage peut être hébergé sur un NAS, un ordinateur Windows ou tout
# équipement compatible SMB/CIFS.
#
# Exemple :
#
#   //adresse_ip/nom_du_partage
#
# L'adresse IP et le nom du partage sont à déterminer lors de l'installation.
#
# 1. Installer le support SMB/CIFS :
#
#      sudo apt update
#      sudo apt install -y cifs-utils
#
# 2. Créer le point de montage :
#
#      sudo mkdir -p /mnt/atelier-sav-backup
#
# 3. Créer le fichier d'identifiants sécurisé :
#
#      sudo nano /root/.smb-atelier-sav
#
#      username=UTILISATEUR
#      password=MOT_DE_PASSE
#
#   Ajouter éventuellement :
#
#      domain=WORKGROUP
#
#   Puis :
#
#      sudo chmod 600 /root/.smb-atelier-sav
#
# 4. Ajouter dans /etc/fstab :
#
#      //adresse_ip/nom_du_partage /mnt/atelier-sav-backup cifs credentials=/root/.smb-atelier-sav,iocharset=utf8,vers=3.0,_netdev,nofail,x-systemd.automount 0 0
#
# 5. Monter le partage :
#
#      sudo mount -a
#
# 6. Pour utiliser les sauvegardes présentes sur le partage, adapter :
#
#      BACKUP_DIR="/mnt/atelier-sav-backup"
#
# Avec une organisation par dates et une rotation de 30 jours :
#
#      /mnt/atelier-sav-backup/
#      ├── 2026-09-16/
#      ├── 2026-09-15/
#      ├── 2026-09-14/
#      └── ...
#
# IMPORTANT :
# - Cette procédure est uniquement documentaire et commentée.
# - L'adresse "adresse_ip" doit être remplacée lors de l'installation.
# - "nom_du_partage" doit correspondre au nom réel du partage SMB/CIFS.
# - Le partage doit être monté avant toute restauration.
# ─────────────────────────────────────────────────────────────────────────────
