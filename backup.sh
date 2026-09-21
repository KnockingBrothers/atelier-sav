#!/bin/bash
set -e

# ── À adapter à votre installation ─────────────────────────────
APP_DIR="$HOME/atelier-sav"
DB_FILE="$APP_DIR/server/atelier-sav.db"
BACKUP_DIR="$HOME/atelier-sav-backups"
KEEP_COUNT=30   # nombre de dernières sauvegardes conservées avant purge
# ────────────────────────────────────────────────────────────────

mkdir -p "$BACKUP_DIR"

if [ ! -f "$DB_FILE" ]; then
  echo "Erreur : base de données introuvable ($DB_FILE)"
  exit 1
fi

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/atelier-sav-$TIMESTAMP.db"

# Sauvegarde "à chaud" sûre via l'API de sauvegarde native de SQLite :
# fonctionne même si le serveur est en train d'écrire dans la base au
# même moment (contrairement à un simple "cp" qui pourrait copier un
# fichier à moitié écrit).
sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"

# Compression pour économiser l'espace disque
gzip "$BACKUP_FILE"

echo "$(date '+%Y-%m-%d %H:%M:%S') — Sauvegarde créée : $BACKUP_FILE.gz"

# Rotation : ne garde que les KEEP_COUNT sauvegardes les plus récentes,
# quelle que soit leur ancienneté (et non plus une purge par nombre de
# jours). Les fichiers les plus anciens au-delà de ce nombre sont
# supprimés.
ls -1t "$BACKUP_DIR"/atelier-sav-*.db.gz 2>/dev/null | tail -n +$((KEEP_COUNT + 1)) | xargs -r rm --

echo "Sauvegardes actuellement conservées dans $BACKUP_DIR ($(ls -1 "$BACKUP_DIR"/atelier-sav-*.db.gz 2>/dev/null | wc -l) / $KEEP_COUNT) :"
ls -lh "$BACKUP_DIR"/atelier-sav-*.db.gz 2>/dev/null | tail -n 10

# ── Optionnel : copier aussi la sauvegarde sur une autre machine ──
# Une sauvegarde sur le même disque que le Raspberry Pi/serveur ne
# protège pas contre une panne de disque ou de matériel. Pour une
# vraie protection, décommentez et adaptez la ligne ci-dessous pour
# envoyer aussi la sauvegarde ailleurs (autre PC, NAS, etc.) :
#
# rsync -az "$BACKUP_DIR/" utilisateur@autre-machine:/chemin/vers/sauvegardes/atelier-sav/

# ─────────────────────────────────────────────────────────────────────────────
# PROCÉDURE OPTIONNELLE : SAUVEGARDE SUR UN PARTAGE RÉSEAU SMB/CIFS
#
# Cette procédure permet d'utiliser un partage réseau hébergé sur :
#   - un NAS ;
#   - un ordinateur Windows ;
#   - tout autre équipement compatible SMB/CIFS.
#
# Exemple de partage :
#
#   //adresse_ip/nom_du_partage
#
# L'adresse IP est volontairement générique et doit être déterminée lors
# de l'installation.
#
# 1. Installer le support SMB/CIFS :
#
#      sudo apt update
#      sudo apt install -y cifs-utils rsync
#
# 2. Créer le point de montage :
#
#      sudo mkdir -p /mnt/atelier-sav-backup
#
# 3. Créer un fichier d'identifiants sécurisé :
#
#      sudo nano /root/.smb-atelier-sav
#
#   Contenu :
#
#      username=UTILISATEUR
#      password=MOT_DE_PASSE
#
#   Pour un environnement utilisant un domaine/workgroup, ajouter si nécessaire :
#
#      domain=WORKGROUP
#
#   Protéger le fichier :
#
#      sudo chmod 600 /root/.smb-atelier-sav
#
# 4. Ajouter le partage dans /etc/fstab :
#
#      //adresse_ip/nom_du_partage /mnt/atelier-sav-backup cifs credentials=/root/.smb-atelier-sav,iocharset=utf8,vers=3.0,_netdev,nofail,x-systemd.automount 0 0
#
# 5. Tester le montage :
#
#      sudo mount -a
#      ls -la /mnt/atelier-sav-backup
#
# 6. La sauvegarde peut ensuite être copiée vers le partage monté :
#
#      rsync -az "$BACKUP_DIR/" /mnt/atelier-sav-backup/
#
# Pour une rotation de 30 sauvegardes quotidiennes avec rsync --link-dest,
# organiser les sauvegardes par date, par exemple :
#
#      /mnt/atelier-sav-backup/
#      ├── 2026-09-16/
#      ├── 2026-09-15/
#      ├── 2026-09-14/
#      └── ...
#
# La méthode --link-dest permet de conserver des sauvegardes restaurables
# tout en partageant physiquement les fichiers inchangés.
#
# IMPORTANT :
# - Cette procédure est uniquement documentaire et commentée.
# - L'adresse "adresse_ip" doit être remplacée lors de l'installation.
# - "nom_du_partage" doit correspondre au nom réel du partage SMB/CIFS.
# - Le partage doit être monté avant toute copie.
# - Pour une base SQLite active, utiliser sqlite3 .backup avant le transfert
#   afin de disposer d'une copie cohérente de la base.
# ─────────────────────────────────────────────────────────────────────────────
