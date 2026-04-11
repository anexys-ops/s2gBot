# Plateforme s2gBot — laboratoire géotechnique / BTP

**Partage (Git)** : voir [PUSH.md](PUSH.md).

## Une seule application web

Tout passe par **Laravel 11** (API) + **React 18** (interface unique) :

- **Backend** : [laravel-api/](laravel-api/) — REST, Sanctum, SQLite / MySQL / PostgreSQL  
- **Frontend** : [react-frontend/](react-frontend/) — Vite, React Router, React Query  

Dans l’interface, deux espaces métier coexistent (même URL, onglets distincts possibles) :

| Espace | URL | Usage |
|--------|-----|--------|
| **CRM** | http://localhost:5173/crm | Clients, chantiers, devis, factures, mails, PDF |
| **Terrain & labo** | http://localhost:5173/terrain | Commandes, saisie mesures (détail dossier), catalogue, graphiques, calculs |

Documentation détaillée : [LAB-BTP-README.md](LAB-BTP-README.md).  
Démarrage express : [DEMARRAGE-BTP.md](DEMARRAGE-BTP.md).  
Comparaison Dolibarr : [docs/DOLIBARR-VS-PLATEFORME-BTP.md](docs/DOLIBARR-VS-PLATEFORME-BTP.md).

---

## Démarrage rapide (recommandé)

```bash
./start.sh
```

ou :

```bash
./start-btp.sh
```

Puis ouvrir **http://localhost:5173** (compte démo : `admin@lab.local` / `password`).

En arrière-plan avec logs dans `.run/` :

```bash
./relaunch.sh
./stop.sh
```

---

## Dossier `services/` (Node)

Les anciens microservices Node (`services/api`, `back`, `calcul`, `auth`) ne sont **plus** lancés par les scripts par défaut. La plateforme produit repose sur **laravel-api** + **react-frontend**. Vous pouvez conserver ce dossier comme référence ou le retirer du dépôt si vous n’en avez plus l’usage.

---

## Docker

Le fichier `docker-compose.yml` à l’ancienne stack a été retiré. Le mode standard est **PHP + Node en local** via `./start.sh`. Pour un déploiement serveur, prévoir reverse proxy, TLS et process manager (voir LAB-BTP-README).
