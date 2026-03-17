# Pousser sur ton dépôt Git public

Le dépôt est initialisé et le premier commit est fait. Pour pousser sur ton repo distant (GitHub, GitLab, etc.) :

## 1. Créer un repo vide sur GitHub/GitLab (si pas déjà fait)

- GitHub : https://github.com/new → crée un repo **public** (sans README, sans .gitignore).
- Récupère l’URL du repo (ex. `https://github.com/TON_USER/s2gBot.git` ou `git@github.com:TON_USER/s2gBot.git`).

## 2. Ajouter le remote et pousser

Remplace `URL_DE_TON_REPO` par l’URL réelle :

```bash
cd /Users/admin/Documents/s2gBot

git remote add origin URL_DE_TON_REPO
git branch -M main
git push -u origin main
```

Exemple avec HTTPS :

```bash
git remote add origin https://github.com/TON_USER/s2gBot.git
git push -u origin main
```

Exemple avec SSH :

```bash
git remote add origin git@github.com:TON_USER/s2gBot.git
git push -u origin main
```

Ensuite, pour les prochains changements :

```bash
git add -A
git commit -m "Description des modifs"
git push
```
