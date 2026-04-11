# Démarrer la plateforme BTP (Laravel + React)

Tu n’as **ni PHP, ni Homebrew, ni MySQL** ? Suis ces étapes dans l’ordre, dans le **Terminal** (pas dans Cursor).

---

## Étape 1 : Installer PHP et Composer

Copie-colle **tout** le bloc dans le Terminal, puis valide avec Entrée :

```bash
cd /Users/admin/Documents/s2gBot
chmod +x scripts/install-php-mac.sh
./scripts/install-php-mac.sh
```

- Si on te demande ton **mot de passe Mac**, c’est normal (installation de Homebrew).
- Ça peut prendre 2 à 5 minutes la première fois.
- À la fin, tu dois voir « Installation terminée » et des lignes avec `php -v` et `composer -V`.

---

## Étape 2 : Configurer Laravel avec SQLite (sans MySQL)

Dans le **même** terminal, lance :

```bash
chmod +x scripts/setup-btp-sqlite.sh
./scripts/setup-btp-sqlite.sh
```

Ça installe les dépendances Laravel, crée la base SQLite, fait les migrations et le seed.

---

## Étape 3 : Lancer l’application

Toujours dans le même terminal :

```bash
./start-btp.sh
```

Puis ouvre dans ton navigateur : **http://localhost:5173**

- Connexion démo : **admin@lab.local** / **password**
- Après connexion : **CRM** → http://localhost:5173/crm · **Terrain & labo** → http://localhost:5173/terrain (tu peux ouvrir les deux en parallèle dans deux onglets).

---

## En cas d’erreur

- **« php: command not found »** → Tu n’as pas fait l’étape 1, ou tu as ouvert un **nouveau** terminal sans refaire le chemin. Relance l’étape 1.
- **« Permission denied »** → Les scripts ne sont pas exécutables. Lance :  
  `chmod +x scripts/install-php-mac.sh scripts/setup-btp-sqlite.sh scripts/seed-btp.sh`
- **« composer: command not found »** → Même terminal que l’étape 1, ou relance `./scripts/install-php-mac.sh`.
