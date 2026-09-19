# Atelier SAV — Application Android

Application Android qui affiche l'app web **atelier-sav** (hébergée sur le serveur local, port 3001) dans une WebView plein écran, avec quelques fonctionnalités natives ajoutées pour un usage en atelier.

## Fonctionnalités

- **Écran de connexion** : saisie unique de l'adresse IP du serveur (ex: `192.168.1.50`), conservée automatiquement au lancement suivant. Modifiable à tout moment par un appui long sur l'écran.
- **Port fixe** : `3001`, codé en dur, pas besoin de le ressaisir.
- **Vérification Wi-Fi** : si le Wi-Fi n'est pas connecté, l'appli affiche un message clair au lieu d'un écran blanc.
- **Scanner de codes-barres** (bouton flottant, icône caméra) : utilise la caméra du téléphone (ML Kit, fonctionne hors-ligne) pour lire un code-barres et reproduit fidèlement le comportement d'une douchette USB — frappe rafale des chiffres + Entrée — afin d'ouvrir directement la fiche correspondante (`ean14`) sur l'écran liste.
- **Liens `sms:` / `tel:` / `mailto:`** : interceptés et délégués aux applications externes du téléphone (Messages, Téléphone...), au lieu d'échouer dans la WebView.
- **Écran maintenu allumé pendant l'édition d'une fiche** : via un pont JavaScript (`AndroidBridge.setKeepScreenOn`), l'écran ne s'éteint pas tant qu'une fiche client est ouverte, mais peut se mettre en veille normalement sur l'écran principal.
- **Fermeture automatique après inactivité** : configurable (en minutes) directement depuis l'écran de connexion IP, 2 minutes par défaut.

## Structure du projet

```
AtelierSAV/
├── app/
│   ├── build.gradle                # Dépendances (ML Kit, CameraX, AndroidX...)
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── java/.../MainActivity.kt          # Logique principale (WebView, IP, scan, inactivité)
│       ├── java/.../BarcodeScannerActivity.kt # Écran caméra de scan
│       └── res/
│           ├── layout/                # Écrans (WebView + saisie IP, scanner)
│           └── mipmap-*/              # Icône de l'appli
├── build.gradle                    # Config Gradle racine (AGP 8.13.2)
├── settings.gradle                 # pluginManagement + dépôts
└── gradle/wrapper/                 # Gradle 8.13
```

## Compiler le projet

1. Ouvrir le dossier `AtelierSAV` dans Android Studio (**File > Open**).
2. Laisser Gradle synchroniser (télécharge automatiquement Gradle 8.13 et l'AGP 8.13.2).
3. **Build > Assemble Project** pour compiler, ou **Run 'app'** (▶️) pour tester directement sur un appareil connecté au même réseau que le serveur atelier-sav.
4. Pour un APK définitif signé : **Build > Generate Signed App Bundle or APK > APK**, avec un keystore `.jks` (à créer une seule fois et à conserver précieusement — indispensable pour toute mise à jour future).

Le fichier généré s'appelle **`AtelierSAV-release.apk`** (ou `AtelierSAV-debug.apk` en debug).

## Intégration côté app web (atelier-sav)

Le pont `AndroidBridge` n'a d'effet que dans l'appli Android — sans risque en navigateur classique. Dans `App.jsx`, un `useEffect` sur `view` appelle :

```js
window.AndroidBridge?.setKeepScreenOn(view === "edit");
```

Aucune autre modification du code web n'est nécessaire : le scan de codes-barres et les liens `sms:`/`tel:` fonctionnent avec le code existant.

## Prérequis

- Android Studio (2026.x ou plus récent recommandé)
- JDK 17 (Gradle JDK, à vérifier dans **Settings > Build Tools > Gradle**)
- Un appareil/émulateur Android en API 21 minimum, sur le même réseau Wi-Fi que le serveur atelier-sav
