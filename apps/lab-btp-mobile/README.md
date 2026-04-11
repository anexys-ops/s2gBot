# Lab BTP — application mobile (Expo)

Application **native** (iOS / Android) qui parle au **même backend Laravel** que le site (`/api`, token Sanctum).

## Prérequis

- Node 20+
- Compte [Expo](https://expo.dev) pour **EAS Build** (fichiers `.ipa` / `.aab` pour les stores)

## Démarrage

```bash
cd apps/lab-btp-mobile
cp .env.example .env
# Adapter EXPO_PUBLIC_API_URL si besoin (IP locale pour test sur téléphone)
npm install
npx expo start
```

- **Simulateur iOS** : `i` dans le terminal Expo (macOS + Xcode).
- **Émulateur Android** : `a`.
- **Téléphone physique** : app **Expo Go** + même réseau Wi‑Fi, ou `npx expo start --tunnel` si l’API est sur Internet (ex. `https://s2g.apps-dev.fr`).

Pour un **backend local** (`php artisan serve`), mettre l’IP de ton Mac dans `.env` :

`EXPO_PUBLIC_API_URL=http://192.168.x.x:8000`

### « Impossible de joindre l’API » (HTTPS prod)

1. Sur le **téléphone**, ouvre le navigateur : `https://s2g.apps-dev.fr/api/version` — si ça ne charge pas, le souci est réseau / DNS / pare-feu (Wi‑Fi invité, VPN, etc.), pas l’app.
2. **Expo Web** (bouton `w`) : la CORS du serveur doit autoriser l’origine Expo ; le dépôt inclut `exp.direct` / `exp.host` dans `laravel-api/config/cors.php` — déployer le backend après mise à jour.
3. **`EXPO_PUBLIC_API_URL`** : les variables `EXPO_PUBLIC_*` sont figées au démarrage de Metro ; après modification du `.env`, lancer `npx expo start -c`.

## Publication sur les stores

1. Installer EAS CLI : `npm i -g eas-cli`
2. `eas login` puis à la racine de ce dossier : `eas build:configure` (une fois)
3. **iOS** : `eas build --platform ios --profile production` puis soumission App Store Connect (`eas submit`)
4. **Android** : `eas build --platform android --profile production` puis Play Console (`eas submit`)

À ajuster dans `app.json` : `ios.bundleIdentifier` et `android.package` (actuellement `fr.appsdev.labbtp`) pour votre compte développeur.

## Écrans inclus (MVP)

- Connexion (e-mail / mot de passe)
- Accueil, liste **commandes** + détail, liste **clients**, **déconnexion**

Étendre avec les mêmes endpoints que `react-frontend/src/api/client.ts`.
