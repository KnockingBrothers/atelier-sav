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
