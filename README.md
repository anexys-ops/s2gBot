# Plateforme s2gBot

**Partage (Git)** : le projet est versionné. Pour pousser sur ton dépôt public : voir [PUSH.md](PUSH.md).

## Plateforme essais laboratoire BTP (Laravel + React)

Application dédiée aux essais de laboratoire BTP : commandes, échantillons, résultats, rapports PDF et facturation.

- **Backend** : [laravel-api/](laravel-api/) — API REST Laravel 11, Sanctum, MySQL/PostgreSQL
- **Frontend** : [react-frontend/](react-frontend/) — React 18, Vite, React Router, React Query

Voir [LAB-BTP-README.md](LAB-BTP-README.md) pour l’installation et le démarrage.

---

## Microservices (existant)

Plateforme composée de 5 microservices :

| Service | Port | Rôle |
|--------|------|------|
| **api** | 3000 | API Gateway — point d’entrée unique, routage vers back, calcul, auth |
| **back** | 3001 | Backend métier — logique applicative, données |
| **calcul** | 3002 | Service de calcul — opérations et traitements numériques |
| **auth** | 3003 | Authentification — tokens JWT, login |
| **front** | 5173 | Frontend — interface React (Vite) |

## Démarrage rapide

### Avec Docker

```bash
docker compose up --build
```

- API : http://localhost:3000  
- Front : http://localhost:5173  

### En local (développement)

```bash
# Terminal 1 - API
cd services/api && npm install && npm run dev

# Terminal 2 - Back
cd services/back && npm install && npm run dev

# Terminal 3 - Calcul
cd services/calcul && npm install && npm run dev

# Terminal 4 - Auth
cd services/auth && npm install && npm run dev

# Terminal 5 - Front
cd apps/front && npm install && npm run dev
```

## Endpoints (via Gateway http://localhost:3000)

- `GET /health` — santé du gateway
- `GET /api/back/items` — ex. ressources du back
- `POST /api/calcul/sum` — ex. calcul (body: `{ "a", "b" }`)
- `POST /api/auth/login` — login (body: `{ "email", "password" }`)
