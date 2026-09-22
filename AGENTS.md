# Consignes de livraison

- Chaque livraison qui modifie le code ou le comportement de l'application doit incrémenter la version dans `react-frontend/package.json`, au minimum au niveau correctif (patch).
- Synchroniser `react-frontend/package-lock.json` avec la même version, de préférence avec `npm version <version> --no-git-tag-version` depuis `react-frontend`.
- Ne jamais réutiliser une version déjà présente sur la branche de base.
- Indiquer dans le compte rendu final la version effectivement déployée.

