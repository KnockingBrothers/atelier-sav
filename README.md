# Atelier — Prise en charge

> Il n'existait pas de logiciel qui collait à mon atelier.
> Alors je l'ai écrit.
> Le SAV, sans le papier qui se perd.

Atelier SAV remplace le formulaire papier de prise en charge par une application partagée entre plusieurs postes, sans dépendre d'un logiciel généraliste mal adapté à un atelier de réparation informatique et téléphonie.

Application de gestion des fiches de prise en charge SAV (client, appareil, check-up, tarification), avec base de données partagée : toutes les fiches sont centralisées sur le serveur et visibles depuis tous les postes du réseau.

**Licence :** [AGPL v3](LICENSE) — voir la section [Licence](#licence) plus bas.

**Version :** V262009

## Prérequis

- **Node.js** version 18 ou plus. Sur Ubuntu Server ou Raspberry Pi (Raspberry Pi OS), installez la version LTS via NodeSource :
  ```bash
  sudo apt install -y curl
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt install -y nodejs
  ```
  Cette méthode installe déjà npm avec Node.js. Si besoin de l'installer séparément (autre méthode d'installation, ou si `npm` manque après coup) :
  ```bash
  sudo apt install -y npm
  ```
  Vérifiez ensuite avec `node -v` et `npm -v`.
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

## Statuts, archivage et fiches non réclamées

Une fiche passe par plusieurs statuts (Reçu, En cours, Attente retour client, Attente pièces, Prêt, Appel/SMS, Restitué). Deux mécanismes automatiques gèrent ensuite son cycle de vie :

- **Archivage** : une fiche au statut **Restitué** depuis plus de **24h** est archivée automatiquement (ou manuellement à tout moment via l'icône dédiée sur sa carte). Les fiches archivées sont classées par mois puis par jour dans l'onglet **Archivées**, et supprimées **définitivement après 367 jours** d'archivage.
- **Non réclamé** : une fiche au statut **Appel/SMS** depuis plus de **15 jours** bascule automatiquement dans l'onglet **Non réclamé** (juste après Archivées) et disparaît des onglets normaux. Même classement par mois/jour, et même suppression définitive après **367 jours**. Si le statut de la fiche change entre-temps, elle redevient visible normalement et le délai repart de zéro s'il repasse un jour en Appel/SMS. Si une fiche Non réclamé passe directement au statut Restitué, elle est archivée immédiatement (sans attendre les 24h habituelles).

Ces deux suppressions définitives sont **irréversibles**, contrairement à l'archivage ou au passage en Non réclamé, qui peuvent toujours être annulés en changeant le statut de la fiche.

## Tarification et pièces détachées

En plus des champs **Total** et **Prise en charge à déduire**, un bouton **+** permet d'ajouter jusqu'à **10 lignes** de pièces détachées, chacune avec : désignation de la pièce et tarif pièce € TTC. Seule la **première ligne** propose en plus **Main d'œuvre € TTC** et **Total € TTC**. Chaque ligne peut être supprimée individuellement via son bouton **−**, et toutes sont alignées sur la même grille (mêmes largeurs de colonnes).

Le champ **Total € TTC** (ligne 1) se calcule **automatiquement** : somme de tous les Tarif pièce (lignes 1 à 10) + Main d'œuvre (ligne 1) — il est en lecture seule, affiché en ambre. Les champs numériques valent **0** par défaut sur une nouvelle ligne.

## Fonctionnalité SMS

Un bouton **SMS** permet de prévenir un client par message, sans quitter l'application.

### Où il apparaît

Le bouton n'est visible **que si toutes ces conditions sont réunies** :
- Vous consultez l'application depuis un **téléphone ou une tablette Android** (il est invisible sur PC, Windows, Mac, iPhone...).
- La fiche a l'un de ces statuts : **Appel/SMS**, **Attente retour client**, **Attente pièces**, ou **En cours**.
- Le téléphone du client est renseigné sur la fiche.

### Ce qu'il propose

Selon le statut de la fiche, un choix de messages prédéfinis s'affiche :

| Statut de la fiche | Messages proposés |
|---|---|
| **Appel/SMS** | Les 8 messages : Appareil prêt, En attente de pièces, Besoin d'informations/accord, Devis/accord, Rappel de récupération, Réparation impossible, Refus de réparation, Message personnalisé |
| **Attente retour client** | Besoin d'informations/accord, Devis/accord, Message personnalisé |
| **Attente pièces** | En attente de pièces, Message personnalisé |
| **En cours** | 📞 Appel Client (toujours visible) et Message personnalisé — Mess.Abs. s'ajoute en plus si le Service de la fiche est "Appeler le client" (voir plus bas) |

Chaque message est rédigé sur plusieurs lignes (retours à la ligne inclus dans le SMS), avec le nom et le téléphone du magasin insérés automatiquement (configurés une seule fois au premier envoi, modifiables ensuite depuis la fenêtre SMS).

Le message **"Devis / accord nécessaire"** est **construit dynamiquement** à partir des lignes de pièces détachées (voir plus haut) : seules les lignes dont le nom de la pièce est rempli apparaissent, chacune avec son tarif ; la Main d'œuvre n'apparaît que si elle est supérieure à 0 ; le Total ne s'affiche que s'il y a au moins une ligne de détail. Si aucune ligne n'est remplie, le SMS reste un simple message d'accord, sans détail de prix.

### Service "Appeler le client"

Dans le champ **Service** de la fiche (obligatoire, comme Nom et Téléphone), l'option **Appeler le client** (en blanc) fait apparaître un sous-menu pour préciser le département concerné (**Informatique** ou **Téléphonie**, avec leurs couleurs habituelles), ainsi qu'un sélecteur de **date et heure** dans la section "Interventions à prévoir".

Sur la page principale, la fiche affiche alors par exemple `Informatique Appeler le client 12/12/26 à 10h20`, et cette date/heure passe automatiquement en **rouge** si elle est dépassée de plus de 30 minutes. La fiche apparaît aussi dans l'onglet du département concerné (Informatique ou Téléphonie), en plus de son statut habituel.

Quand ce service est actif, la fenêtre SMS propose en plus :
- **📞 Appel Client** : ouvre directement le composeur téléphonique (`tel:`) avec le numéro déjà renseigné sur la fiche — un vrai appel, pas un message.
- **Mess.Abs.** : message prédéfini pour prévenir que l'appel prévu n'a pas abouti, avec la date et l'heure de la tentative insérées automatiquement dans le texte.

### Comment ça fonctionne

Un clic sur SMS puis sur un message ouvre l'application SMS par défaut du téléphone (généralement Google Messages sur Android), avec le numéro du client et le texte déjà prêts. **L'envoi reste toujours manuel** : Atelier SAV ne prépare que le message, c'est vous qui appuyez sur Envoyer.

Aucun historique de conversation n'est lu, synchronisé ou stocké par Atelier SAV — la fonctionnalité se limite à préparer le message.

### Retour à l'accueil automatique

Toujours dans la fenêtre de configuration du nom/téléphone du magasin, un réglage **"Retour à l'accueil automatique"** permet de choisir un délai d'inactivité (Désactivé par défaut, puis 22, 42, 62, 82... secondes par tranches de 20). Si une fiche ouverte en modification reste inactive ce délai, elle est automatiquement enregistrée (comme un clic sur "Enregistrer") puis l'application revient à la liste.

## Atelier SAV — Application Android

Application Android qui affiche l'app web Atelier SAV (hébergée sur le serveur local, port 3001) dans une WebView plein écran, avec quelques fonctionnalités natives ajoutées pour un usage en atelier.

### Fonctionnalités

- **Écran de connexion** : saisie unique de l'adresse IP du serveur (ex : `192.168.1.50`), conservée automatiquement au lancement suivant. Modifiable à tout moment par un appui long sur l'écran.
- **Port fixe** : `3001`, codé en dur, pas besoin de le ressaisir.
- **Vérification Wi-Fi** : si le Wi-Fi n'est pas connecté, l'appli affiche un message clair au lieu d'un écran blanc.
- **Scanner de codes-barres** (bouton flottant, icône caméra) : utilise la caméra du téléphone (ML Kit, fonctionne hors-ligne) pour lire un code-barres et reproduit fidèlement le comportement d'une douchette USB — frappe rafale des chiffres + Entrée — afin d'ouvrir directement la fiche correspondante (`ean14`) sur l'écran liste.
- **Liens `sms:` / `tel:` / `mailto:`** : interceptés et délégués aux applications externes du téléphone (Messages, Téléphone...), au lieu d'échouer dans la WebView.
- **Écran maintenu allumé pendant l'édition d'une fiche** : via un pont JavaScript (`AndroidBridge.setKeepScreenOn`), l'écran ne s'éteint pas tant qu'une fiche client est ouverte, mais peut se mettre en veille normalement sur l'écran principal.
- **Fermeture automatique après inactivité** : configurable (en minutes) directement depuis l'écran de connexion IP, 2 minutes par défaut.

### Installation de l'application (fichier APK)

Le code source de cette application Android se trouve dans le dossier [`android/`](android/) de ce dépôt. Le fichier `.apk` prêt à installer est disponible dans l'onglet **[Releases](../../releases)** du dépôt GitHub (pas besoin de compiler soi-même le code Android pour l'utiliser).

1. Téléchargez le fichier `.apk` depuis la page Releases, directement depuis le navigateur du téléphone Android.
2. Android bloque par défaut l'installation d'applications venant d'ailleurs que le Play Store. Au moment de l'installation, un message d'avertissement s'affiche (normal, l'application n'est pas publiée sur le Play Store et n'est pas signée par Google) — appuyez sur **"Installer quand même"** ou **"Paramètres"** puis activez **"Autoriser depuis cette source"** pour l'application utilisée pour le téléchargement (Chrome, Fichiers...).
3. Une fois installée, ouvrez l'application : au premier lancement, elle demande l'adresse IP du serveur (ex. `192.168.1.50`) — le port `3001` est automatique, inutile de le saisir.
4. Pour changer cette adresse IP plus tard (changement de serveur, nouvelle box...), faites un appui long n'importe où sur l'écran de connexion.

Cet avertissement de sécurité est normal et attendu pour toute application installée en dehors du Play Store (on parle d'installation "en side-load") — il ne signifie pas que l'application est dangereuse, seulement qu'elle n'a pas été vérifiée par Google. Puisque vous contrôlez vous-même le code source (dossier `android/`) et sa provenance, ce mode d'installation est parfaitement adapté à un usage interne d'atelier.

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

Crée une copie compressée et horodatée de la base dans `~/atelier-sav-backups/` (créé automatiquement), en utilisant l'API de sauvegarde native de SQLite — fiable même si le serveur est en train d'écrire dans la base au même moment. Seules les **30 dernières sauvegardes** sont conservées : les plus anciennes au-delà de ce nombre sont supprimées automatiquement (nombre modifiable en tête du script, variable `KEEP_COUNT`).

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

### Sauvegarder vers un partage réseau SMB/CIFS (NAS, PC Windows partagé...)

`backup.sh` et `restore.sh` contiennent chacun, en commentaire à la fin du fichier, une procédure documentaire complète pour utiliser un partage réseau SMB/CIFS comme destination des sauvegardes — utile si vous avez un NAS ou un PC Windows avec un dossier partagé sur le réseau de l'atelier. Cette procédure n'est **jamais exécutée automatiquement** (elle reste en commentaire) ; elle sert de guide si vous souhaitez la mettre en place vous-même. Elle couvre :

- l'installation du support SMB/CIFS (`cifs-utils`) ;
- la création d'un point de montage et d'un fichier d'identifiants sécurisé ;
- le montage automatique du partage au démarrage via `/etc/fstab` ;
- l'adaptation de `backup.sh` (ligne `rsync`) et de `restore.sh` (variable `BACKUP_DIR`) pour utiliser ce partage monté.

Ouvrez les fichiers `backup.sh` et `restore.sh` pour lire le détail des étapes, à adapter avec l'adresse IP et le nom réel de votre partage.

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
├── LICENSE                 texte complet de la licence AGPL v3
├── VERSION                  identifiant de version courant (V14092026)
├── .gitignore              exclut node_modules/, dist/, server/*.db, sauvegardes
├── README.md
├── package.json
├── vite.config.js
├── deploy.sh                script de mise à jour automatisée (à configurer)
├── backup.sh                 sauvegarde de la base de données (rotation sur les 30 dernières)
├── restore.sh                 restauration d'une sauvegarde
├── index.html
├── android/                 code source de l'application Android (WebView + scanner + pont natif)
├── server/
│   ├── server.js             API Express + service de l'application construite
│   └── atelier-sav.db        base de données (créée automatiquement au premier lancement, jamais publiée)
└── src/
    ├── main.jsx               point d'entrée
    ├── App.jsx                 l'application (formulaire + liste + impression)
    └── storageShim.js          pont entre l'application et l'API du serveur
```

## Licence

Ce projet est distribué sous licence **[GNU Affero General Public License v3.0 (AGPL-3.0)](LICENSE)**, ou toute version ultérieure au choix de l'utilisateur.

En résumé (ceci ne remplace pas le texte complet de la licence, voir le fichier [`LICENSE`](LICENSE)) :

- Vous pouvez utiliser, modifier et redistribuer ce logiciel librement.
- Si vous distribuez une version modifiée, elle doit rester sous la même licence (copyleft).
- **Particularité de l'AGPL par rapport à une GPL classique** : si vous faites tourner une version modifiée de ce logiciel accessible par un réseau (par exemple en l'hébergeant comme service pour des tiers), vous devez proposer aux utilisateurs de ce service le code source correspondant. Pour un usage interne classique (l'atelier utilise sa propre instance sur son propre réseau, sans la proposer à des tiers), cette clause n'a pas d'effet pratique.
- Le logiciel est fourni **sans aucune garantie**, dans les limites permises par la loi.

Copyright © Serge Mata.

