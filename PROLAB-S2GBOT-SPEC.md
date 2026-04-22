# PROLAB → s2gBot : Spécification Migration

> Date : 2026-04-22  
> Objectif : Intégrer l'architecture fonctionnelle de PROLAB (WinDev/HFSQL) dans s2gBot (Laravel 11 + React 18 + Expo), en conservant le design et les menus existants.

### État — phase P1 (catalogue produits, Linear)

| Livrable | Statut | Emplacement principal |
|----------|--------|------------------------|
| Migrations `ref_*` (familles, articles, packages, tâches, paramètres, résultats) | Fait | `laravel-api/database/migrations/2026_04_22_1000*.php`, `...12000*.php` |
| Modèles + relations + scopes `actif` / `ordonne` | Fait | `laravel-api/app/Models/Catalogue/*` |
| API v1 CRUD articles + lecture familles / arbre / packages | Fait | `laravel-api/routes/api.php` (prefix `v1/catalogue`), `.../Api/Catalogue/*` |
| Seeder 14 familles + ~60 articles + résultats | Fait | `database/seeders/CatalogueProLabSeeder.php` (appelé par `DatabaseSeeder`) |
| UI `/catalogue`, fiche article | Fait | `react-frontend/src/pages/catalogue/*`, `components/Catalogue/ArbreCatalogue.tsx` |

Projet Linear : [s2gBot — Migration PROLAB](https://linear.app/anexys/project/s2gbot-migration-prolab-f4833f6c540e/overview). Tickets P1 (BDC-107 … BDC-111) synchronisés avec cet état (voir historique `main`).

---

## 1. Analyse PROLAB

### 1.1 Modules identifiés

| Module | Préfixe | Description |
|--------|---------|-------------|
| Technique (Essais) | TECH | Saisie PV, résultats, rapports par type d'essai |
| Commercial | COMM | Tiers, Dossier, Devis, BCC, BLC, FAC, Règlement |
| Production | PROD | Planning, tâches, prestations |
| Administration | ADMIN | Référentiels, droits, paramétrage |
| Achats/Vente | ACH/Vente | BCF, DA, réception, caisse |
| Comptabilité | INC | Interface comptable, imputation analytique |

### 1.2 Types d'essais PROLAB (26 types)

- Béton armé (résistance compression, porosité, affaissement)
- Bordure (standard, pierre, type)
- Carreaux (eau, flexion, dimension)
- Compactage + Courbe Proctor (méthode 1 & 2, ISO/EN)
- Coulis / Mortier
- Entrevous (résistance mécanique, épaisseur)
- IDR (Indice de résistance)
- IP (Indice de plasticité)
- Maçonnerie (agglos, brique)
- Pavés (résistance, dimension, jugement conformité)
- RFF (Rapport fin de fabrication)
- VBS (Valeur bleu méthylène)
- AG (Analyses granulométriques)

### 1.3 Structure BDD HFSQL (tables principales)

#### Catalogue produits
```
REF_FamillesArticles          → Famille d'essais (ex: "Essais Béton")
  └── REF_Articles            → Article/Essai (ex: "Béton armé fc28")
        └── REF_Packages      → Package/Prestation groupée
              └── REF_FamillesPackages → Sous-groupement packages
PARAM_TaskList / REF_Taches   → Tâches associées aux articles
PARAM_ParametersList          → Paramètres/critères par essai
PARAM_ResultsList             → Résultats attendus
```

#### Flux commercial
```
REF_Tiers (Client/Fournisseur)
  └── OP_Dossier (Chantier/Mission)
        └── OP_Devis
              └── OP_DevisArticles (lignes = produits catalogue)
                    └── OP_BCC (Bon de commande client)
                          └── OP_BCCArticles
                    └── OP_BLC (Bon de livraison)
                          └── OP_BLCArticles
                    └── OP_FAC (Facture)
                          └── OP_FACArticles
                    └── OP_ProdTaches (tâches de production)
                          └── OP_AttachementGroupeArticles
```

#### Règlement
```
OP_Reglement → OP_LigneReglement
OP_Avoir     → OP_AvoirArticle → OP_LigneReglementAvoir
OP_Situation (situations de travaux)
```

---

## 2. Schéma s2gBot actuel

### Tables existantes

| Table | Description | Colonnes clés |
|-------|-------------|---------------|
| clients | Clients | id, name, ... |
| sites | Chantiers | id, client_id, name, address, reference |
| users | Utilisateurs | id, name, email, role, client_id, site_id |
| orders | Commandes d'analyse | id, reference, client_id, site_id, user_id, status |
| order_items | Lignes commande | id, order_id, test_type_id, quantity |
| samples | Échantillons | id, order_item_id, reference, received_at, status |
| test_results | Résultats essais | id, sample_id, test_type_param_id, value |
| quotes | Devis | id, number, client_id, site_id, status, amount_ht, amount_ttc |
| quote_lines | Lignes devis | id, quote_id, description, quantity, unit_price, tva_rate |
| invoices | Factures | id, number, client_id, status, amount_ht, amount_ttc |
| invoice_lines | Lignes facture | id, invoice_id, order_item_id, quantity, unit_price |
| client_addresses | Adresses client | id, client_id, type, line1, city, country |
| attachments | Pièces jointes | id, attachable (morph), path, mime_type |
| missions | Missions terrain | id, site_id, reference, title, mission_status |
| commercial_document_links | Liens documents | source_type/id, target_type/id, relation |
| document_pdf_templates | Templates PDF | id, document_type, slug, blade_view |
| mobile_measure_submissions | Saisies mobile | id, dossier_kind, values (JSON) |

---

## 3. Architecture cible (Delta PROLAB → s2gBot)

### 3.1 Nouvelles tables à créer

#### Phase 1 — Catalogue produits

```sql
-- Familles d'articles (Niveau 1)
ref_famille_articles
  id, code, libelle, description, ordre, actif

-- Articles / Essais (Niveau 2)
ref_articles
  id, ref_famille_article_id (FK), code, libelle, description,
  unite, prix_unitaire_ht, tva_rate, duree_estimee, normes, actif

-- Familles de packages (Niveau 3)
ref_famille_packages
  id, ref_article_id (FK), code, libelle, description, ordre, actif

-- Packages / Prestations groupées (Niveau 4)
ref_packages
  id, ref_famille_package_id (FK), code, libelle, description,
  prix_ht, tva_rate, actif

-- Tâches référentiel
ref_taches
  id, code, libelle, description, duree_estimee, ressource_type

-- Paramètres essais
ref_parametres_essai
  id, ref_article_id (FK), code, libelle, unite, valeur_min, valeur_max, ordre

-- Résultats attendus
ref_resultats
  id, ref_article_id (FK), code, libelle, norme, valeur_seuil
```

#### Phase 2 — Dossier chantier

```sql
-- Dossiers (lien client ↔ chantier ↔ mission)
dossiers
  id, reference (unique), titre, client_id (FK), site_id (FK),
  mission_id (FK nullable), statut, date_debut, date_fin_prevue,
  maitre_ouvrage, notes, created_by (FK users)

-- Contacts dossier
dossier_contacts
  id, dossier_id (FK), nom, prenom, email, telephone, role
```

#### Phase 3 — Enrichissement Devis

```sql
-- Modifier quotes : ajouter dossier_id
ALTER TABLE quotes ADD dossier_id (FK dossiers);

-- Modifier quote_lines : lier aux articles catalogue
ALTER TABLE quote_lines ADD ref_article_id (FK ref_articles nullable);
ALTER TABLE quote_lines ADD ref_package_id (FK ref_packages nullable);

-- Tâches devis
devis_taches
  id, quote_id (FK), ref_tache_id (FK), libelle, quantite,
  prix_unitaire_ht, statut, ordre
```

#### Phase 4 — BC / BL

```sql
-- Bon de commande client (BCC)
bons_commande
  id, numero (unique), quote_id (FK), dossier_id (FK), client_id (FK),
  statut, date_commande, date_livraison_prevue, montant_ht,
  montant_ttc, notes

bons_commande_lignes
  id, bon_commande_id (FK), ref_article_id (FK nullable),
  libelle, quantite, prix_unitaire_ht, tva_rate, montant_ht

-- Bon de livraison (BLC)
bons_livraison
  id, numero (unique), bon_commande_id (FK nullable), dossier_id (FK),
  client_id (FK), statut, date_livraison, notes

bons_livraison_lignes
  id, bon_livraison_id (FK), bon_commande_ligne_id (FK nullable),
  libelle, quantite_livree, ref_article_id (FK nullable)
```

#### Phase 5 — Tâches & Attachements production

```sql
-- Tâches de production (liées aux lignes BCC)
taches_production
  id, bon_commande_ligne_id (FK), dossier_id (FK), ref_tache_id (FK),
  statut, assignee_id (FK users), date_prevue, date_realisation,
  notes

-- Attachements tâches (PV essais, rapports)
tache_attachements
  id, tache_id (FK), type (pv_essai|rapport|photo|autre),
  ref_article_id (FK nullable), fichier_path, notes, created_by
```

#### Phase 6 — Module TECH (PV Essais)

```sql
-- En-tête PV (commun à tous les types)
pv_essais
  id, reference, dossier_id (FK), tache_id (FK nullable),
  type_essai, date_prelevement, date_essai, lieu, technicien_id (FK),
  statut (brouillon|validé|signé), norme, observations

-- Résultats PV (générique JSON + tables spécialisées par type)
pv_resultats
  id, pv_essai_id (FK), parametre, valeur, unite, conforme

-- Tables spécialisées : pv_beton, pv_compactage, pv_proctor, etc.
```

---

## 4. Roadmap par phase

### Phase 1 — Catalogue produits (Sprint 1)
- [ ] Migrations : ref_famille_articles, ref_articles, ref_famille_packages, ref_packages, ref_taches, ref_parametres_essai, ref_resultats
- [ ] Models + Relations Laravel (FamilleArticle hasMany Article hasMany FamillePackage hasMany Package)
- [ ] Seeders : importer catalogue PROLAB (26 types d'essais + packages)
- [ ] API REST CRUD catalogue (routes protégées admin)
- [ ] UI React : arbre catalogue (Famille → Article → Package)
- [ ] UI React : fiche article avec paramètres

### Phase 2 — Dossier chantier (Sprint 1-2)
- [ ] Migration : dossiers + dossier_contacts
- [ ] Refactoring : missions → liées aux dossiers
- [ ] Model Dossier + relations (Client, Site, Mission, User)
- [ ] API CRUD dossiers
- [ ] UI React : liste dossiers + fiche dossier
- [ ] UI React : dashboard dossier (chantier → essais → documents)

### Phase 3 — Devis enrichi (Sprint 2)
- [ ] Migration : ALTER quotes (+ dossier_id), ALTER quote_lines (+ ref_article_id, ref_package_id)
- [ ] Migration : devis_taches
- [ ] UI devis : sélecteur produits catalogue (modal arbre familles)
- [ ] UI devis : lignes liées aux articles avec prix auto
- [ ] Génération PDF devis avec détail essais
- [ ] Workflow : devis → statuts (brouillon, envoyé, accepté, refusé)

### Phase 4 — BC / BL (Sprint 3)
- [ ] Migrations : bons_commande + bons_commande_lignes
- [ ] Migrations : bons_livraison + bons_livraison_lignes
- [ ] Transformation devis → BC (endpoint API)
- [ ] Transformation BC → BL (endpoint API)
- [ ] UI : liste BC + fiche BC
- [ ] UI : liste BL + fiche BL
- [ ] PDF BC + BL

### Phase 5 — Tâches & Attachements (Sprint 3-4)
- [ ] Migrations : taches_production + tache_attachements
- [ ] API tâches : CRUD + changement statut
- [ ] UI : liste tâches par dossier/BCC
- [ ] Upload attachements (PJ, PV PDF)
- [ ] Workflow tâche : planifié → en cours → réalisé

### Phase 6 — Module TECH Essais (Sprint 4-5)
- [ ] Migrations : pv_essais + pv_resultats
- [ ] Tables spécialisées : pv_beton, pv_compactage, pv_proctor
- [ ] UI : formulaires de saisie PV par type d'essai
- [ ] Calculs automatiques (conformité, courbes Proctor)
- [ ] Génération rapports PDF essais (avec normes)
- [ ] Signature électronique PV

---

## 5. Règles de migration données

### Mapping PROLAB → s2gBot

| PROLAB | s2gBot | Notes |
|--------|--------|-------|
| REF_Tiers | clients | Filtrer type = client |
| REF_FamillesArticles | ref_famille_articles | Import direct |
| REF_Articles | ref_articles | + mapping prix/unité |
| REF_Packages | ref_packages | Via famille package |
| OP_Dossier | dossiers | Lier à site existant |
| OP_Devis | quotes | + dossier_id |
| OP_DevisArticles | quote_lines | + ref_article_id |
| OP_BCC | bons_commande | Nouveau |
| OP_BLC | bons_livraison | Nouveau |
| OP_FAC | invoices | Déjà existant |
| OP_ProdTaches | taches_production | Nouveau |

---

## 6. Conventions techniques

- **Migrations** : Laravel 11, nommage `YYYY_MM_DD_HHMMSS_create_xxx_table.php`
- **Models** : PascalCase, dans `app/Models/`, soft deletes sur toutes les nouvelles tables
- **API** : REST sous `/api/v1/`, authentification Sanctum, policy par rôle
- **Frontend** : React 18 + Vite, composants dans `src/components/`, pages dans `src/pages/`
- **PDF** : Blade templates dans `resources/views/pdf/`
- **Tests** : Feature tests Laravel pour chaque endpoint

---

## 7. Catalogue produits PROLAB à importer (Seed)

### Familles d'essais (ref_famille_articles)

| Code | Libellé |
|------|---------|
| BETON | Essais Béton |
| COMPACTAGE | Essais Compactage |
| PROCTOR | Courbe Proctor |
| BORDURE | Essais Bordure |
| CARREAUX | Essais Carreaux |
| ENTREVOUS | Essais Entrevous |
| MACONNERIE | Essais Maçonnerie |
| PAVES | Essais Pavés |
| MORTIER | Essais Coulis/Mortier |
| IDR | Indice de Résistance |
| IP | Indice de Plasticité |
| RFF | Rapport Fin de Fabrication |
| VBS | Valeur Bleu Méthylène |
| AG | Analyses Granulométriques |

### Articles essais béton (ref_articles — famille BETON)

| Code | Libellé | Norme |
|------|---------|-------|
| BETON-FC28 | Résistance compression 28j | NF EN 12390-3 |
| BETON-FC7 | Résistance compression 7j | NF EN 12390-3 |
| BETON-AFFAIS | Essai d'affaissement (Slump) | NF EN 12350-2 |
| BETON-POROSITE | Porosité béton | NF EN 12390-7 |
| BETON-ARME | Rapport béton armé | NF EN 206 |

### Articles essais compactage (ref_articles — famille COMPACTAGE)

| Code | Libellé | Norme |
|------|---------|-------|
| COMP-DENSSITE | Densité en place | NF P 94-061 |
| COMP-TENEUR | Teneur en eau | NF P 94-050 |
| COMP-RECAP | Récapitulatif compactage | — |
| PROC-NORMAL | Proctor Normal | NF P 94-093 |
| PROC-MOD | Proctor Modifié | NF P 94-093 |
| PROC-ISOEN | Proctor ISO/EN | EN 13286-2 |

*(Compléter avec le catalogue complet lors du seed)*
