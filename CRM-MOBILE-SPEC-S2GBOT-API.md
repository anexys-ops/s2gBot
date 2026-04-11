# Spécification CRM mobile — backend s2gBot (Laravel API)

Document à copier dans un autre dépôt (React Native / Expo, Flutter, etc.) pour brancher une application mobile **gestion dossiers clients**, **factures** et **suivi des impayés** sur l’API existante du projet **s2gBot**.

**Vérification effectuée** sur le dépôt s2gBot : routes dans `laravel-api/routes/api.php`, contrôleurs `ClientController`, `ClientCommercialController`, `InvoiceController`, `OrderController`, `SiteController`, `QuoteController`, `AttachmentController`, `PdfController`, `AuthController`.

---

## 1. Base URL et authentification

| Élément | Valeur |
|--------|--------|
| Préfixe API | `/api` (voir `bootstrap/app.php`, `apiPrefix: 'api'`) |
| Base complète | `{ORIGIN}/api` — ex. `https://votre-serveur.fr/api` |
| Auth | **Laravel Sanctum** — header `Authorization: Bearer {token}` |
| Content-Type | `application/json` pour le JSON |

### Connexion

- `POST /login`  
  Body : `{ "email": "...", "password": "..." }`  
  Réponse : `{ "user": { ... }, "token": "...", "token_type": "Bearer" }`

### Session

- `GET /user` — utilisateur courant (`user` avec relations `client`, `site` selon le rôle)
- `POST /logout` — révoque le token courant

**Rôles** (`User`) : `lab_admin`, `lab_technician`, `client`, `site_contact`.

- **Client / contact chantier** : accès **filtré** à leur `client_id` (clients, sites, commandes, devis, factures).
- **Labo** : accès élargi + création / modification factures, PDF, mails, etc.

---

## 2. Table de vérification des besoins CRM

| Besoin | API présente ? | Détail |
|--------|----------------|--------|
| Liste / fiche client | Oui | `GET /clients`, `GET /clients/{id}` |
| Dossier commercial (devis, factures, stats, impayé TTC) | Oui | `GET /clients/{id}/commercial-overview` |
| Liste / détail facture | Oui | `GET /invoices`, `GET /invoices/{id}` (pagination, `search`, `status`) |
| Filtre par statut facture | Oui | Query `?status=...` sur `GET /invoices` |
| Montant « à payer » agrégé | Oui | Champ `stats.amount_due_ttc` dans `commercial-overview` |
| Endpoint dédié « /invoices/unpaid » | Non | À dériver côté app (filtre sur statuts + somme, ou réutiliser l’overview) |
| Marquer facture « payée » | Partiel | `PATCH /invoices/{id}` avec `status: "paid"` — **réservé `lab_admin`** (hors brouillon) |
| PDF facture téléchargeable | Partiel | `POST /pdf/generate` `{ "type": "invoice", "id": <id> }` — **403 si l’utilisateur n’est pas labo** (`isLab()`). Pour un **portail client**, il faudrait étendre l’API ou exposer une URL signée. |
| Commandes (dossiers techniques labo) | Oui | `GET /orders`, `GET /orders/{id}` |
| Chantiers / sites | Oui | `GET /sites`, `GET /sites/{id}` |
| Devis | Oui | `GET /quotes`, `GET /quotes/{id}` |
| Pièces jointes (dossier) | Oui | `GET /attachments?attachable_type=client&attachable_id=…` (+ `invoice`, `order`, `quote`) ; `GET /attachments/{id}/download` |
| Relance e-mail depuis l’app | Non côté client | `POST /mail/send` — **labo uniquement** |

---

## 3. Statuts de facture (impayés)

Définis dans `App\Models\Invoice` :

- `draft` — brouillon (exclu du « montant dû » dans l’overview)
- `validated`, `signed`, `sent`, `relanced` — considérés comme **non soldés** pour le total `amount_due_ttc`
- `paid` — payé (exclu du montant dû)

**Logique serveur du montant dû** (`ClientCommercialController@overview`) :

- Somme des `amount_ttc` des factures du client dont le statut **n’est pas** `paid` ni `draft`.

**Implémentation mobile « liste impayés »** :

1. Appeler `GET /clients/{clientId}/commercial-overview` et utiliser `invoices` + `stats.amount_due_ttc`, **ou**
2. Appeler `GET /invoices?status=sent` (ou enchaîner plusieurs statuts en plusieurs requêtes si l’API ne permet qu’un seul `status` à la fois), **ou**
3. Récupérer la page paginée `GET /invoices` et filtrer côté client : garder tout sauf `draft` et `paid`.

---

## 4. Endpoints utiles (résumé)

Toutes les routes ci-dessous sont sous **`/api`** et protégées par **`auth:sanctum`**, sauf `POST /login` et `POST /register`.

### Auth

| Méthode | Chemin |
|---------|--------|
| POST | `/login` |
| POST | `/register` |
| POST | `/logout` |
| GET | `/user` |

### Clients et vue « dossier »

| Méthode | Chemin | Notes |
|---------|--------|--------|
| GET | `/clients` | Query `?search=` — liste ; client limité à son entreprise |
| GET | `/clients/{client}` | Détail + `sites` |
| POST/PATCH/DELETE | `/clients/...` | Création / suppression : **lab_admin** |
| GET | `/clients/{client}/commercial-overview` | **Vue clé CRM** : `client`, `quotes`, `invoices`, `stats` (dont `amount_due_ttc`, `invoices_by_status`), `document_links` |
| GET | `/clients/{client}/addresses` | Adresses |
| POST | `/clients/{client}/addresses` | |
| PUT/DELETE | `/client-addresses/{id}` | |

### Factures

| Méthode | Chemin | Notes |
|---------|--------|--------|
| GET | `/invoices` | Pagination Laravel ; `?search=`, `?status=` |
| GET | `/invoices/{invoice}` | Inclut `invoiceLines`, `orders`, `attachments`, adresses |
| POST | `/invoices` | **lab_admin** |
| PATCH | `/invoices/{invoice}` | **lab_admin** ; hors brouillon : champs limités (`status`, `due_date`, `pdf_template_id`) |
| DELETE | `/invoices/{invoice}` | **lab_admin** |
| POST | `/invoices/from-orders` | **labo** — génération depuis commandes |

### Devis, commandes, sites

| Méthode | Chemin | Notes |
|---------|--------|--------|
| GET | `/quotes` | Paginé ; `search`, `status` |
| GET | `/quotes/{quote}` | |
| GET | `/orders` | Paginé ; `search`, `status` — dossiers commandes labo |
| GET | `/orders/{order}` | Détail riche (items, échantillons, rapports…) |
| GET | `/sites` | Chantiers liés au client |

### Pièces jointes

| Méthode | Chemin | Notes |
|---------|--------|--------|
| GET | `/attachments?attachable_type=client&attachable_id={id}` | `attachable_type` : `client`, `quote`, `invoice`, `order` |
| GET | `/attachments/{attachment}/download` | Fichier (binaire) |
| POST | `/attachments` | Upload : **labo** |

### PDF (limitation portail client)

| Méthode | Chemin | Notes |
|---------|--------|--------|
| POST | `/pdf/generate` | Body : `{ "type": "invoice", "id": 123 }` — **labo uniquement** |

---

## 5. Formats de réponse utiles

### Pagination (factures, devis, commandes)

Réponse type Laravel : `data`, `current_page`, `last_page`, `per_page`, `total`, liens `first_page_url`, etc.

### `GET /clients/{id}/commercial-overview` — extrait `stats`

```json
{
  "stats": {
    "quotes_by_status": {},
    "invoices_by_status": {},
    "amount_due_ttc": 0,
    "total_invoiced_ttc": 0,
    "total_quotes_ttc": 0,
    "open_quotes_count": 0
  }
}
```

Les objets `quotes_by_status` / `invoices_by_status` sont des map `statut → nombre`.

---

## 6. Proposition d’écrans mobile

1. **Connexion** — `POST /login`, stockage du token.
2. **Accueil client** — `GET /user` ; si un seul client, `GET /clients/{id}/commercial-overview` pour synthèse + `amount_due_ttc`.
3. **Liste factures** — `GET /invoices?page=…` avec onglets ou filtres par `status`.
4. **Impayés** — même liste filtrée (statuts ≠ `paid`, `draft`) ou données issues de `commercial-overview`.
5. **Détail facture** — `GET /invoices/{id}` ; lignes, échéance, liens commandes.
6. **Dossiers techniques** — `GET /orders` / `GET /orders/{id}`.
7. **Chantiers** — `GET /sites`.
8. **Documents** — `GET /attachments?attachable_type=…` + téléchargement.

**Gestion impayés « métier »** (relances, passage à payé, PDF officiel) : aujourd’hui côté **labo** (web ou app interne). Pour un **vrai** portail client avec PDF et paiement en ligne, prévoir des évolutions API dédiées.

---

## 7. Client HTTP minimal (Exemple TypeScript)

```typescript
const API_BASE = 'https://votre-serveur.fr/api';

export async function api<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof data.message === 'string' ? data.message : `HTTP ${res.status}`);
  return data as T;
}

// Exemples
// api('/user', token)
// api(`/clients/${id}/commercial-overview`, token)
// api(`/invoices?page=1`, token)
```

---

## 8. Fichiers sources de référence (s2gBot)

- Routes : `laravel-api/routes/api.php`
- Vue dossier client + impayé TTC : `laravel-api/app/Http/Controllers/Api/ClientCommercialController.php`
- Factures : `laravel-api/app/Http/Controllers/Api/InvoiceController.php`
- Modèle statuts : `laravel-api/app/Models/Invoice.php`

*Généré pour réutilisation inter-projets ; aligner la base URL et les rôles utilisateurs avec votre environnement.*
