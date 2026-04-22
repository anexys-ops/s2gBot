# Protection de branche `main` (BDC-62 / DT-3)

La configuration se fait **dans l’UI GitHub** (pas via le dépôt) : *Settings* → *Branches* → *Add rule* pour `main` :

1. **Require a pull request before merging** (au moins 1 relecteur, ou 0 si équipe restreinte).
2. **Require status checks to pass before merging** — activer :
   - `Laravel API`
   - `React Vitest`
   - `React build`
3. **Dismiss stale pull request approvals when new commits are pushed** (recommandé).
4. (Option) **Require branches to be up to date** avant merge.
5. (Option) **Include administrators** si vous voulez vous soumettre à la règle aussi côté admins.

Cela évite un push direct sur `main` avec un workflow rouge alors que *Deploy production* s’y déclenche.

Vérification : ouvrir une PR de test ; les trois jobs du workflow [Tests](https://github.com/anexys-ops/s2gBot/actions/workflows/tests.yml) doivent être requis (noms des jobs tels qu’affichés dans l’onglet *Checks* de la PR).
