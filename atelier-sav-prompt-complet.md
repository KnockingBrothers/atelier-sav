# Prompt de recréation complet — Atelier SAV

Copiez-collez tout ce qui suit dans une nouvelle conversation avec un assistant IA (Claude ou autre) pour recréer l'application à l'identique.

---

## Contexte et objectif

Crée une application web de gestion des fiches de prise en charge pour un atelier de réparation informatique/téléphonie (SAV). Elle remplace un formulaire papier et doit être utilisable simultanément par plusieurs postes sur un réseau local (donc pas de stockage uniquement local au navigateur).

## Stack technique imposée

- **Frontend** : React 18 + Vite. CSS custom écrit à la main (pas de Tailwind, pas de framework UI), avec un design "atelier technique" (voir section Design).
- **Backend** : Node.js + Express, sur le port 3001, qui sert à la fois l'API et les fichiers statiques buildés par Vite.
- **Base de données** : SQLite via `better-sqlite3`, un seul fichier `server/atelier-sav.db`, créé automatiquement au premier lancement.
- **Génération de PDF** : `jsPDF`, importé en **dynamique** (`await import("jspdf")`) au moment du clic sur "Imprimer", pas en import statique, pour garder le bundle initial léger.
- **Icônes** : `lucide-react`.
- Gestion des process : `pm2` en production, avec un script `deploy.sh` (rsync + npm install + build + pm2 restart) pour les mises à jour.

## Architecture de stockage (important)

Ne pas utiliser `localStorage` directement dans le composant React. À la place :
1. Crée un module `src/storageShim.js` qui expose un objet `window.storage` avec les méthodes `get(key)`, `set(key, value)`, `delete(key)`, `list(prefix)`, chacune retournant une Promise.
2. Ce module fait des appels `fetch` vers une API REST (`/api/storage/:key` en GET/PUT/DELETE, `/api/storage?prefix=` en GET pour lister les clés).
3. Le serveur Express (`server/server.js`) implémente cette API en s'appuyant sur une table SQLite générique `storage(key TEXT PRIMARY KEY, value TEXT)`.
4. Le composant React n'a donc aucune idée qu'il parle à SQLite — il utilise juste `window.storage.get/set/delete/list` comme si c'était une API de stockage clé-valeur asynchrone.
5. Chaque fiche est stockée sous la clé `sav:ticket:<id>` (valeur = JSON de la fiche). Le compteur de numérotation est stocké sous la clé `sav:counter`. Les préférences d'étiquette sous `sav:labelsize`.

## Modèle de données d'une fiche (ticket)

```js
{
  id: string,              // généré : `${Date.now()}-${random}`
  numero: string,          // format : T-{année}-{compteur sur 4 chiffres}-{jjmmaa}-{hhmm}
                            // ex : T-2026-0001-100826-0821
  ean14: string,           // 14 chiffres, voir section Code-barres
  statut: "Reçu" | "En cours" | "Attente retour client" | "Attente pièces" | "Prêt" | "Appel/SMS" | "Restitué",
  createdAt: number, updatedAt: number,
  restituedAt: number|null,   // timestamp du passage à "Restitué"
  archived: boolean, archivedAt: number|null,

  nom: string,              // OBLIGATOIRE
  telephone: string,        // OBLIGATOIRE
  email: string,
  motDePasse: string,
  codeDeverrouillage: string,
  schema: number[],         // ex [1,5,9,7] = points du schéma Android dans l'ordre

  marqueModele: string,
  imei: string,
  panne: string,
  diagnostic: string,       // libellé "Diagnostic / Intervention", juste sous Panne constatée dans le formulaire ;
                            // saisie affichée en rouge (#FF0000) à l'écran, mais toujours en noir à l'impression
  accessoires: { sacoche: bool, chargeur: bool, souris: bool, usbWifi: bool, autres: bool, autresTexte: string },
  etat: "Excellent" | "Bon" | "Moyen" | "Mauvais" | "Autres",
  etatAutresTexte: string,

  remarque: string,          // libellé affiché : "Remarque précision"
  total: string,
  priseEnCharge: string,

  checkup: {                 // valeurs : "OK" | "KO" | absent (undefined)
    hp, ecouteur, mic1, mic2, camAv, camArr, lcd, connecteur, charge,
    chargeurCk, antivirus, nettoyage, clone, smart, w11
  },
  // labels d'affichage du checkup : HP, Écouteur, Mic 1, Mic 2, Cam av., Cam arr.,
  // Lcd, Connecteur, Charge, Chargeur, Antivirus, Nettoyage, Clone, SMART, Windows
  // (w11 affiché "Windows", pas "W11")

  taches: {                  // valeurs : "à faire" | "OK" | absent — cycle à 3 états au clic
    nett, antivirus, installOs, remplacementDisque, clone, password,
    lcd, batterie, connecteur, faceArriere, ecouteurInterne, reinitialiser, imprimante
  },
  // labels d'affichage : Nettoyage, Antivirus, "Install Os à préciser", Remplacement disque,
  // Clone, Password, "Ecran" (pas "Lcd"), Batterie, Connecteur, Face arrière,
  // Ecouteur interne, Réinitialiser, "Imprimante à préciser"
  installOsDetail: string,   // affiché seulement si taches.installOs est actif
  imprimanteDetail: string,  // affiché seulement si taches.imprimante est actif
}
```

## Fonctionnalités détaillées

### 1. CRUD de base
- Liste des fiches en cartes (grille), style étiquette d'atelier : encoche en haut façon tag suspendu, **liseré coloré sur le bord droit qui suit la couleur du STATUT de la fiche** (table `STATUT_COLOR`, voir section 2 — pas la couleur de l'état du matériel).
- Formulaire de création/édition en plusieurs sections, **dans cet ordre exact** : Informations client, Appareil (dont Panne constatée puis, juste en dessous, un champ **Diagnostic / Intervention** — saisie affichée en **rouge `#FF0000`** dans l'app, mais toujours en noir à l'impression), **Tarification** (Total et Prise en charge à déduire), Accessoires laissés, État du matériel, Check-up SAV, Remarque précision.
- Dans les champs **Total** et **Prise en charge à déduire** : si le texte saisi contient "ko" (insensible à la casse), l'afficher en rouge ; si il contient "ok", l'afficher en vert ; sinon ne pas changer la couleur ("ko" prioritaire si les deux apparaissent). Ne s'applique qu'à l'écran, jamais à l'impression.
- **Nom et Téléphone obligatoires** : astérisque rouge dans le label, bordure rouge + message d'erreur sous le champ dès qu'on le quitte vide (`onBlur`), bouton "Enregistrer" désactivé tant que l'un des deux manque.
- Suppression avec confirmation (modale), possible directement depuis la carte de la liste (icône poubelle) ou depuis la fiche ouverte.
- Sur chaque carte de la liste, une rangée de mini-icônes cliquables (sans ouvrir la fiche) : imprimer l'étiquette, supprimer (avec confirmation), et archiver/désarchiver (icône qui bascule selon l'état `archived` de la fiche — pas de bouton "Archivage" dans la fiche ouverte elle-même, seulement "Désarchiver" quand elle est déjà archivée).

### 2. Statuts, couleurs et archivage automatique
- 7 statuts, dans cet ordre exact : Reçu, En cours, Attente retour client, Attente pièces, Prêt, **Appel/SMS**, Restitué.
- Table de correspondance `STATUT_COLOR` utilisée à la fois pour le badge de statut sur la carte ET pour le liseré coloré du bord droit de la carte : Reçu = gris (texte atténué), En cours = ambre, **Attente retour client = rouge**, **Attente pièces = rouge**, **Prêt = vert**, **Appel/SMS = `#C5F527`** (vert-jaune fluo, hex exact), Restitué = vert.
- Les onglets de filtrage (Toutes, un par statut, Archivées) affichent, quand sélectionnés, une ombre portée et une bordure dans la couleur correspondante (fonction `tabColor` : ambre pour "Toutes", gris pour "Archivées", sinon `STATUT_COLOR` du statut).
- Onglets de filtrage en haut de liste avec compteur par statut, plus "Toutes".
- Quand une fiche passe au statut "Restitué", enregistrer `restituedAt = Date.now()`. Si le statut change à nouveau, remettre `restituedAt = null` et `archived = false`.
- À chaque synchronisation (voir section 3), vérifier les fiches "Restitué" non archivées dont `Date.now() - restituedAt >= 24h` : les marquer `archived = true, archivedAt = Date.now()` et persister.
- Les fiches archivées disparaissent des onglets normaux. Un onglet supplémentaire **"Archivées"** les affiche, **classées par mois puis par jour** (regroupement hiérarchique basé sur `archivedAt`, du plus récent au plus ancien, avec un titre de mois et des sous-titres de jour), et à l'intérieur d'un même jour triées par ordre alphabétique du nom du client.
- **Suppression définitive automatique** : à chaque synchronisation, toute fiche archivée depuis plus de **367 jours** (`Date.now() - archivedAt >= 367 * 24h`) est supprimée définitivement de la base (pas juste masquée) — c'est irréversible, contrairement à l'archivage.
- Bouton "Désarchiver" (icône dédiée sur la carte + bouton dans la fiche ouverte) qui remet `archived = false`, `archivedAt = null`, et réinitialise `restituedAt = Date.now()` (pour redonner un délai de 24h plein si la fiche reste "Restitué"). L'archivage manuel (sans attendre les 24h) se fait uniquement via l'icône sur la carte de la liste, pas depuis la fiche ouverte.

### 3. Synchronisation multi-poste
- Au chargement de la liste et toutes les 8 secondes (tant qu'on est sur l'écran liste), recharger toutes les fiches depuis le serveur.
- Recharger aussi immédiatement quand la fenêtre/onglet reprend le focus.
- Indicateur visuel dans l'en-tête de liste : petit point vert fixe + texte "Synchronisé il y a X min/s/h" habituellement, point orange qui pulse + "Synchronisation..." pendant le rechargement.

### 4. Sauvegarde automatique pendant l'édition
- Toutes les 20 secondes pendant qu'une fiche est ouverte en édition, sauvegarder automatiquement et silencieusement (sans redirection, sans message), **uniquement si** Nom et Téléphone sont tous les deux remplis. Sinon, ne rien faire.
- Utiliser un `useRef` pour lire la dernière valeur du formulaire dans l'intervalle (éviter les closures obsolètes), pas une dépendance d'effet sur l'état complet du formulaire (qui redémarrerait l'intervalle à chaque frappe).
- Pour une fiche neuve (pas encore d'id), la première sauvegarde auto lui attribue un id définitif ; reporter cet id dans l'état du formulaire pour que les sauvegardes suivantes mettent à jour la même fiche.

### 5. Schéma de déverrouillage
- Composant `PatternLock` : grille 3x3 de points, dessinée en SVG pur (pas de canvas, pas de librairie externe). Cliquer les points dans l'ordre trace des lignes entre eux et numérote chaque point cliqué. Bouton "Effacer le schéma".
- Accepte une prop `readOnly` (pour l'affichage en impression) et `monochrome` (force noir/blanc au lieu des couleurs du thème, pour l'impression).
- Affiché uniquement s'il contient au moins un point (ni dans le formulaire vide, ni à l'impression si vide).

### 6. Code-barres EAN-14
- Générer, à la création de chaque fiche, un code de 14 chiffres numériques valides (GTIN-14) :
  - 13 chiffres de payload : indicateur "0" + année sur 2 chiffres + mois + jour + n° de séquence sur 6 chiffres.
  - Calculer la clé de contrôle (14e chiffre) selon l'algorithme standard GTIN : en partant du chiffre le plus à droite des 13, poids alternés 3 puis 1 ; check = (10 - (somme mod 10)) mod 10.
- Rendre ce code en code-barres **ITF-14** (Interleaved 2 of 5), la norme physique réelle pour les GTIN-14, en SVG pur (table de correspondance chiffre → motif barre/espace codée à la main, pas de librairie de code-barres).
- Afficher ce code-barres : (a) en mini-aperçu dans l'en-tête du formulaire d'édition, (b) sur l'étiquette imprimée, (c) centré en haut du PDF de la fiche complète.
- **Scan pour ouvrir une fiche** : sur l'écran liste, écouter les événements clavier globaux (`keydown` sur `window`). Détecter une frappe "rafale" (délai entre caractères < 300ms, terminée par Entrée) caractéristique d'une douchette USB. Si la séquence capturée est composée de 14 chiffres et correspond à l'`ean14` d'une fiche existante, ouvrir cette fiche directement (sans que l'utilisateur ait besoin de cliquer un champ de recherche au préalable). Sinon, afficher une erreur "Aucune fiche ne correspond au code scanné".

### 7. Interventions à prévoir (nouvelle section, à droite du schéma de déverrouillage dans le formulaire)
- 13 items, chacun un "switch" cliquable à **3 états en cycle** : `-` (gris, par défaut) → `à faire` (orange) → `OK` (vert) → retour à `-`.
- Liste complète et libellés exacts : Nettoyage, Antivirus, "Install Os à préciser", Remplacement disque, Clone, Password, Ecran, Batterie, Connecteur, Face arrière, Ecouteur interne, Réinitialiser, "Imprimante à préciser".
- Disposition : les 8 premiers items dans une grille à colonnes multiples (auto-fill) à gauche ; les 6 items **Ecran, Batterie, Connecteur, Face arrière, Ecouteur interne, Réinitialiser** regroupés dans une **colonne dédiée à droite**, dans cet ordre précis du haut vers le bas.
- Quand "Install Os à préciser" ou "Imprimante à préciser" est activé (état ≠ `-`), afficher un champ de texte libre juste en dessous pour préciser l'intervention.

### 8. Check-up SAV (section existante, distincte des "Interventions à prévoir")
- 15 items en cycle à 2 états (`OK`/`KO`, pas de 3e état) : HP, Écouteur, Mic 1, Mic 2, Cam av., Cam arr., Lcd, Connecteur, Charge, Chargeur, Antivirus, Nettoyage, Clone, SMART, **Windows** (et non "W11").

### 9. Impression — PDF de la fiche complète
- Bouton "Imprimer (PDF)" qui **génère et télécharge directement un fichier PDF** (pas une boîte de dialogue d'impression navigateur), nommé `<numero>.pdf`.
- Format **B5** (176 × 250 mm), texte entièrement en **noir**, fond transparent (aucun remplissage de page).
- Contenu, dans cet ordre :
  1. Code-barres EAN-14 centré en haut, avec les 14 chiffres en dessous
  2. Titre "Fiche de prise en charge - {numero}" + date
  3. Champs Nom, Téléphone, Marque/modèle, IMEI, État du matériel (toujours affichés) + Email, Mot de passe, Code déverrouillage, Total, Prise en charge à déduire (**affichés seulement si non vides**), sur 2 colonnes
  4. Schéma de déverrouillage (si renseigné) — dessiné en vectoriel noir directement dans le PDF (pas une image), via des `doc.circle()`/`doc.line()`
  5. **Interventions à prévoir** (si au moins un item est renseigné) — placé **avant** "Panne constatée"
  6. Panne constatée (si non vide) — dans un encadré
  7. **Diagnostic / Intervention** (si non vide) — dans un encadré, juste après Panne constatée, même style
  8. Accessoires (si au moins un coché)
  9. Remarque précision (si non vide) — dans un encadré, **même style que Panne constatée**
  10. Check-up SAV (si au moins un item renseigné)
  11. Pied de page légal (voir section 11), en italique, séparé par une ligne
- **Règle générale de minimisation** : chacune des zones listées ci-dessus (Schéma, Interventions à prévoir, Panne constatée, Diagnostic / Intervention, Accessoires, Remarque précision, Check-up SAV) est **entièrement omise** (titre + contenu + espace) si elle est vide — pas de cadre vide, pas de ligne blanche à la place. Le champ Diagnostic / Intervention s'imprime toujours en **noir** (jamais en rouge), même si sa saisie à l'écran est en rouge.

### 10. Impression — étiquette
- Bouton "Étiquette" séparé, qui utilise **l'impression navigateur classique** (`window.print()`) avec une taille de page CSS dédiée (`@page { size: ... }`), pas un PDF généré par jsPDF.
- Formats sélectionnables et mémorisés : 50×30mm, 40×30mm, 62×29mm (Brother DK), 57×32mm, ou dimensions personnalisées (mm).
- Contenu, conçu pour **tenir sur une seule étiquette même au plus petit format** :
  - Numéro découpé en code court (ex "T-2026-0001") en plus gros, et date/heure séparée en tout petit en dessous
  - Nom du client et marque/modèle, chacun sur **une seule ligne**, tronqués avec "…" s'ils sont trop longs (`white-space: nowrap; overflow: hidden; text-overflow: ellipsis`)
  - Code-barres EAN-14 réduit (32×7mm) + les 14 chiffres en tout petit
- Icône de réimpression rapide directement sur chaque carte de la liste (pas besoin d'ouvrir la fiche).

### 11. Pied de page légal
Affiché en italique, en petit, sous une ligne de séparation, à 3 endroits : bas de la page liste, fiche imprimée navigateur, PDF. Texte exact (avec les titres de clause en gras) :

> **Devis et prise en charge :** le montant du devis ou des frais de prise en charge sera déduit du montant total de la réparation si celle-ci est effectuée par nos soins.
>
> **Données personnelles :** nous déclinons toute responsabilité en cas de perte, d'altération ou d'inaccessibilité des données présentes sur l'appareil. Le client est invité à effectuer, dans la mesure du possible, une sauvegarde complète de ses données sur un support externe avant tout dépôt ou envoi de matériel.
>
> **Éléments endommagés :** lors du démontage, des éléments préalablement fragilisés, usés ou endommagés peuvent être découverts. Nous ne saurions être tenus responsables des dommages ou dysfonctionnements résultant de cet état préexistant. Toute réparation supplémentaire rendue nécessaire fera l'objet d'un devis complémentaire avant intervention.
>
> **Imprimantes et consommables compatibles :** en cas d'utilisation de consommables compatibles, un jeu de consommables d'origine pourra être installé afin d'effectuer les tests et/ou le diagnostic de l'imprimante. Le coût de ces consommables reste entièrement à la charge du client, quel que soit le résultat des tests ou de la réparation.

### 12. Pied de page technique (page liste, sous le pied de page légal)
- Texte : "Créé par Serge Mata avec Claude AI — V: {version}"
- `{version}` = date/heure de compilation au format `AAAAMMJJ-HHMM`, injectée par Vite (`define: { __BUILD_DATE__: JSON.stringify(new Date().toISOString()) }` dans `vite.config.js`), lue côté app via `typeof __BUILD_DATE__ !== "undefined"` avec repli sur `"dev"` si absent (utile pour un aperçu hors build Vite).

### 13. Sauvegarde et restauration de la base de données (scripts serveur, hors app React)
- `backup.sh` : script bash exécutable à la racine du projet. Utilise `sqlite3 "$DB_FILE" ".backup '$BACKUP_FILE'"` (API de sauvegarde native SQLite, sûre même si le serveur écrit en même temps — pas un simple `cp`), compresse le résultat en `.gz`, horodate le nom de fichier, stocke dans `~/atelier-sav-backups/` (en dehors du dossier du projet). **Rotation par nombre de sauvegardes** (pas par ancienneté) : ne conserve que les 30 sauvegardes les plus récentes (`ls -1t ... | tail -n +31 | xargs -r rm`), la plus ancienne est supprimée dès qu'une 31e est créée. Variables `APP_DIR`, `DB_FILE`, `BACKUP_DIR`, `KEEP_COUNT` (=30) configurables en tête de fichier. Contient une ligne `rsync` commentée pour copier aussi les sauvegardes vers une autre machine (protection contre panne de disque/matériel).
- `restore.sh` : sans argument, liste les sauvegardes disponibles (les plus récentes en premier). Avec un nom de fichier en argument, demande confirmation, arrête l'app (`pm2 stop`), fait une copie de sécurité de la base actuelle avant de l'écraser, décompresse et restaure la sauvegarde choisie, puis redémarre l'app (`pm2 restart`).
- Documenté dans le README : installer `sqlite3` (`sudo apt install -y sqlite3`), programmer une exécution quotidienne via `crontab -e` (ex. `0 2 * * * /home/UTILISATEUR/atelier-sav/backup.sh >> /home/UTILISATEUR/atelier-sav-backups/backup.log 2>&1`).
- `.gitignore` exclut aussi les sauvegardes (`atelier-sav-backups/`, `*.db.gz`, `server/*.db.avant-restauration-*`) — mêmes données sensibles que la base elle-même.

## Design (à respecter précisément)

- Palette : fond graphite très sombre (`#14171B`/`#1D2126`/`#262B32`), bordures `#383F48`, accent ambre `#E8A33D`, vert succès `#4FB08A`, rouge danger `#E2604F`, texte clair `#EDEFF2`, texte atténué `#8B93A1`.
- Typographies : **Oswald** (condensée, majuscules) pour les titres/affichage, **IBM Plex Sans** pour le texte courant, **IBM Plex Mono** pour les numéros de fiche, IMEI, codes-barres.
- Cartes de la liste façon étiquette d'atelier : petite encoche circulaire en haut à gauche (façon tag suspendu à un fil), liseré coloré vertical sur le bord droit selon l'état du matériel.
- Impression : toujours fond blanc/transparent et texte noir, jamais les couleurs du thème sombre (sauf le code-barres qui est toujours noir sur blanc de toute façon).

## Structure de fichiers attendue

```
atelier-sav/
├── .gitignore              # exclut node_modules/, dist/, server/*.db, sauvegardes
├── README.md
├── deploy.sh                # rsync + npm install + build + pm2 restart, variables à configurer en tête
├── backup.sh                 # sauvegarde SQLite compressée et horodatée, rotation sur les 30 dernières
├── restore.sh                 # restauration d'une sauvegarde, avec copie de sécurité avant écrasement
├── index.html
├── package.json
├── vite.config.js           # proxy /api vers :3001 en dev, define __BUILD_DATE__, manualChunks vendor (react/react-dom/lucide-react)
├── server/
│   └── server.js             # Express : API storage (GET/PUT/DELETE /api/storage/:key, GET /api/storage?prefix=) + sert dist/
└── src/
    ├── main.jsx               # importe storageShim puis monte App
    ├── App.jsx                # tout le code applicatif (composant unique, ~1700 lignes)
    └── storageShim.js         # window.storage → fetch vers l'API du serveur
```

## Dépendances npm

```json
{
  "dependencies": {
    "better-sqlite3": "^11.3.0",
    "express": "^4.19.2",
    "jspdf": "^2.5.2",
    "lucide-react": "^0.383.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.0"
  }
}
```

## Scripts package.json attendus

```json
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "server": "node server/server.js",
    "start": "npm run build && npm run server"
  }
}
```

## Contraintes de déploiement à documenter dans le README

- Sur Linux/Raspberry Pi, `better-sqlite3` compile un module natif : nécessite `build-essential` et `python3` installés avant `npm install`.
- L'app tourne sur le port 3001, accessible en HTTP simple sur le réseau local par défaut (`http://<ip>:3001`).
- HTTPS optionnel : nginx en reverse proxy devant l'app + certificat généré avec `mkcert` (autorité de certification locale), dont le certificat racine doit être installé une fois sur chaque poste client pour un accès sans avertissement navigateur.

---

*Fin du prompt. Un assistant IA recevant ce document devrait pouvoir reconstruire l'application quasiment à l'identique, y compris les détails de comportement (états, ordres d'affichage, conditions d'impression) qui sont le résultat de nombreux ajustements successifs.*
