# Atelier — Prise en charge

Application de gestion des fiches de prise en charge SAV (client, appareil, check-up, tarification), avec base de données partagée : toutes les fiches sont centralisées sur le serveur et visibles depuis tous les postes du réseau.

## Prérequis

- [Node.js](https://nodejs.org) version 18 ou plus (inclut npm)
- Sur Ubuntu Server, `better-sqlite3` compile un petit module natif à l'installation. Si `npm install` échoue à cette étape, installez d'abord les outils de compilation :
  ```bash
  sudo apt install -y build-essential python3
  ```

## Installation et lancement (production)

Dans le dossier du projet :

```bash
npm install
npm run build
npm run server
```

`npm run server` démarre le serveur (API + application) sur le port `3001`, accessible depuis tout le réseau à l'adresse `http://<ip_du_serveur>:3001`.

Raccourci qui fait les deux à la fois : `npm run start`.

## Garder le serveur actif en permanence

```bash
sudo npm install -g pm2
pm2 start "npm run server" --name atelier-sav
pm2 save
pm2 startup
```
Suivez l'instruction affichée par `pm2 startup` pour que le serveur redémarre automatiquement après un reboot.

## Ouvrir le port dans le pare-feu

```bash
sudo ufw allow 3001
```

## Mode développement

Pour travailler sur le code avec rechargement automatique, lancez dans deux terminaux séparés :

```bash
npm run server   # API sur le port 3001
npm run dev      # interface sur le port 5173, avec proxy vers l'API
```

## Stockage des données

Les fiches sont maintenant stockées dans une base **SQLite** côté serveur (`server/atelier-sav.db`), pas dans le navigateur. Tous les postes qui se connectent à l'adresse du serveur voient et modifient les mêmes fiches en temps réel.

## Sauvegarde et restauration de la base de données

Deux scripts sont fournis pour ne jamais perdre vos données.

### Installer sqlite3 (une seule fois)

```bash
sudo apt install -y sqlite3
```

### Sauvegarder manuellement

```bash
./backup.sh
```

Crée une copie compressée et horodatée de la base dans `~/atelier-sav-backups/` (créé automatiquement), en utilisant l'API de sauvegarde native de SQLite — fiable même si le serveur est en train d'écrire dans la base au même moment. Les sauvegardes de plus de 60 jours sont supprimées automatiquement (durée modifiable en tête du script).

### Programmer une sauvegarde automatique quotidienne (cron)

```bash
crontab -e
```

Ajoutez cette ligne (sauvegarde tous les jours à 2h du matin) :

```
0 2 * * * /home/VOTRE_UTILISATEUR/atelier-sav/backup.sh >> /home/VOTRE_UTILISATEUR/atelier-sav-backups/backup.log 2>&1
```

Remplacez `VOTRE_UTILISATEUR` par votre nom d'utilisateur Linux (celui donné par la commande `whoami`).

### Restaurer une sauvegarde

```bash
./restore.sh
```

Sans argument, liste les sauvegardes disponibles. Pour restaurer une sauvegarde précise :

```bash
./restore.sh atelier-sav-20260902-020000.db.gz
```

Le script arrête l'application, garde une copie de sécurité de la base actuelle (au cas où), restaure la sauvegarde choisie, puis redémarre l'application.

### Important : protéger contre une panne matérielle

Une sauvegarde stockée sur le même disque que le serveur ne protège **pas** contre une panne de disque, un vol, ou une casse du Raspberry Pi/serveur. Pour une vraie protection, copiez aussi régulièrement le dossier `~/atelier-sav-backups/` ailleurs (un autre ordinateur, une clé USB, un NAS, un espace cloud...). La ligne `rsync` en commentaire à la fin de `backup.sh` peut automatiser cet envoi si vous avez une autre machine accessible en SSH.

## Mettre à jour l'application après une modification

Un script `deploy.sh` est fourni pour automatiser les mises à jour depuis votre PC :

1. Ouvrez `deploy.sh` et modifiez les 4 premières lignes avec vos informations :
   ```bash
   SERVER_USER="votre_utilisateur"
   SERVER_HOST="192.168.1.50"
   SERVER_PATH="/home/votre_utilisateur/atelier-sav"
   PM2_APP_NAME="atelier-sav"
   ```
2. Rendez-le exécutable une seule fois : `chmod +x deploy.sh`
3. À chaque mise à jour, lancez simplement :
   ```bash
   ./deploy.sh
   ```
   Il envoie les fichiers modifiés vers le serveur (via `rsync`, en gardant votre base de données intacte), réinstalle les dépendances si besoin, reconstruit l'application et redémarre le service automatiquement.

Prérequis sur votre PC : `rsync` et un accès SSH par clé (sans mot de passe) au serveur — sinon le script vous demandera le mot de passe à chaque étape. Sous Windows, utilisez WSL ou Git Bash pour l'exécuter.

## Mise à jour manuelle (sans le script)

```bash
cd atelier-sav
npm run build
pm2 restart atelier-sav
```

## Structure du projet

```
atelier-sav/
├── index.html
├── package.json
├── vite.config.js
├── server/
│   ├── server.js         API Express + service de l'application construite
│   └── atelier-sav.db    base de données (créée automatiquement au premier lancement)
├── deploy.sh              script de mise à jour automatisée (à configurer)
└── src/
    ├── main.jsx           point d'entrée
    ├── App.jsx             l'application (formulaire + liste + impression)
    └── storageShim.js      pont entre l'application et l'API du serveur
```
