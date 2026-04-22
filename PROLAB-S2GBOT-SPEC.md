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

### État — phases P2 (dossier) & P3 (devis enrichi)

| Phase | Livrable | Statut | Remarques |
|-------|----------|--------|-----------|
| P2 | Dossiers + contacts, `missions.dossier_id`, API `/api/v1/dossiers` | Fait | Voir `DossierController`, UI `/dossiers` |
| P3 | `quotes.dossier_id`, `quote_lines.ref_article_id` / `ref_package_id`, table `devis_taches`, API lecture `GET /api/v1/catalogue/taches` | Fait (API) | Migrations **idempotentes** (`hasTable` / `hasColumn`) — voir `2026_04_24_100000_*` |

**Prod / anti-régression** : ne jamais écraser le `.env.docker` serveur (mots de passe DB). Le workflow exclut déjà ce fichier. `scripts/docker-prod-refresh.sh` exécute `php artisan migrate --force` à l’étape 5/6 (complémentaire au `migrate` du `docker-entrypoint` au boot).

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

---

## 8. Analyse approfondie PROLAB (WinDev / HFSQL) — portée et limites

**Constat** : le code source WinDev (fenêtres, classes, procedures) n’est **pas** présent dans ce dépôt Git. L’analyse ci‑dessous est donc une **reconstruction fonctionnelle** cohérente avec :

1. La modélisation HFSQL déjà recensée (OP\_Devis, OP\_BCC, OP\_BLC, OP\_ProdTaches, etc.).
2. Le fonctionnement habituel des ERP labo BTP (séparation **Commercial → Production → Livraison → Facturation**).
3. L’existant s2gBot (devis / factures / dossiers / missions / équipements `serial_number`).

### 8.1 Chaînes de valeur et points de contrôle (logique type PROLAB)

Chaque document ou étape n’est pas « libre » : il est **dans un circuit** (souvent : saisie → contrôle service → validation → passage au maillon suivant). Sur WinDev, cela se traduit le plus souvent par des **statuts** + des **droit par profil** + parfois une **file d’attente par service** (agenda / liste de production).

| Chaîne | Entités HFSQL (réf.) | Validations typiques | Service souvent responsable |
|--------|----------------------|----------------------|--------------------------------|
| **Commercial** | OP\_Devis, OP\_DevisArticles | Montants, conditions, adresses, accord client | Commercial / direction |
| **Engagement** | OP\_BCC, OP\_BCCArticles | Cohérence devis signé, délais, disponibilité | Adjoint commercial / planification |
| **Production** | OP\_ProdTaches, ressources | Tâches affectées, dépendances, conformité | Laboratoire / responsable d’exploitation |
| **Livraison** | OP\_BLC, OP\_BLCArticles | Conformité quantités / références | Magasin / logistique |
| **Facturation** | OP\_FAC | Pièces justificatives, BL, commande | Comptabilité / admin |
| **Règlement** | OP\_Reglement | Affectation, lettrage | Comptabilité |
| **Terrain** | Missions, ordres, déplacements | Périmètre, sécurité, moyens | Géotechnique / terrain |

> **Exigence produit (demande 2026)** : tout devis, commande, BL ou tâche de production devrait **appartenir à un circuit** où l’on sait **quel service valide**, **qui peut modifier** avant envoi à l’étape suivante, et **l’équipe** (ou pôle) **porteuse** de la fiche.

### 8.2 Granularité « équipe / service »

Côté WinDev, cela correspond en général à un **découpage paramétrable** (pôles, bureaux, rôles) mappé sur des **comptes utilisateur**. Côté s2gBot, aujourd’hui : `User.role` (ex. `lab_admin`, `lab_technician`) + `agencies` — **pas** encore de moteur de workflow ni d’affectation systématique par pôle.

### 8.3 Notes de frais (hors cœur livraison actuel)

Dans beaucoup de portails terrain / mission : **dépenses justifiées** (carburant, hôtel, péage) liées à un **dossier** ou à une **mission** ; circuit fréquent : brouillon → **validation responsable d’équipe** → **comptabilité** (ou trésorerie). À modéliser explicitement (absent de la BDD s2gBot aujourd’hui).

### 8.4 Matériel technique, inventaire et fiches

PROLAB côtie « matériel » mélange souvent :

- **Petit outillage / consommables** (stock quantitatif).
- **Gros appareils** (étiquetés **N° de série**), sujets à **métrologie** / étalonnage, **affectation** temporaire à un technicien ou un véhicule.

Dans s2gBot, la table `equipments` couvre déjà `serial_number`, étalonnages, rattachement `agency_id` — manquent en revanche : **mouvements d’inventaire** (entrée / sortie / prêt), **affectation à une mission ou un ordre**, et **fiche** terrain dédiée (checklists, photos) si on veut parité avec l’existant PROLAB riche.

### 8.5 « Ordres de missions » pour un dossier

Les ERP terrain distinguent souvent **mission longue** (dossier / chantier) et **ordre d’exécution** :

- un **dossier** = enveloppe (client, site, période) ;
- des **ordres** (sous-projets) : ordre d’**intervention**, d’**échantillonnage**, d’**essai**, de **lancement production**, chacun avec **priorité**, **échéance**, **équipe assignée** et **état du workflow** propre.

Le modèle `missions` côté s2gBot existe (`dossier_id` possible) — à enrichir en **tâches ordonnées** / **étapes** avec validation par service, alignées sur le module workflow cible (voir section 9).

---

## 9. Module **Workflow** (cible s2gBot) — principe

Objectif : **déclarer** des workflows paramétrables (sans redéploiement), affecter chaque enregistrement (devis, BC, BL, tâche, note de frais, fiche matériel…) à un **graphe d’états** + **pôles** + **transitions** nommées.

### 9.1 Concepts

| Concept | Rôle |
|---------|------|
| **Définition** | Ex. `workflow_devis_labo`, `workflow_bcc`, `workflow_blc`, `workflow_tache_production` |
| **Étape (step)** | État + `service` ou `team` responsable, droits (valider, rejeter, renvoyer, modifier) |
| **Transition** | Passe d’une étape A → B, éventuellement **condition** (seuil, pièce jointe) |
| **Instance** | Lien `subject_type` / `subject_id` (Eloquent morph) + `current_step_id` + `locked_by` |
| **File d’attente** | Vue : « Mes validations » = instances où l’équipe de l’utilisateur = équipe requise à l’étape courante |
| **Historique** | Journal : qui, quand, d’où, où, commentaire, pièces jointes optionnelles |

### 9.2 Schéma SQL (implémentation partielle 2026-04-25)

Les tables `workflow_definitions`, `workflow_steps`, `workflow_transitions`, `workflow_instances` et `workflow_histories` sont **créées** (migration `2026_04_25_100000_create_workflow_engine_tables.php`). **API** : `GET /api/v1/workflow-definitions` et `GET /api/v1/workflow-definitions/{id}` (laboratoire authentifié) — listage des définitions et étapes ; câblage devis/BC/BL et transitions restent à implémenter (BDC-134, BDC-135).

#### Ébauche de schéma (référence, alignée sur le code)

```sql
workflow_definitions
  id, code (unique), name, document_type, active

workflow_steps
  id, workflow_definition_id, code, label, sort_order
  -- team_id nullable OU service_key (ex. 'commercial'|'labo'|'logistique'|'compta'|'metrologie')
  can_edit, can_approve, can_reject, sla_days

workflow_transitions
  id, workflow_definition_id, from_step_id, to_step_id, name
  is_default, requires_comment

workflow_instances
  id, workflow_definition_id, current_step_id
  subject_type, subject_id, started_at, completed_at
  -- locked_by, meta JSON

workflow_histories
  id, workflow_instance_id, from_step_id, to_step_id
  user_id, action, comment, created_at
```

### 9.3 Affectation utilisateurs / équipes

- Option A : table **`teams`** (pôles) + `team_user` + règles d’inclusion.
- Option B (complément) : reposer sur `agencies` + extension **sous-équipes** pour multi-pôles au sein d’une agence.
- Toute transition **approuvée** doit vérifier `Policy` (membre de l’équipe, ou rôle de substitution).

### 9.4 Câblage par entité (roadmap d’intégration)

| Entité s2gBot / PROLAB | Champ statut aujourd’hui | Cible |
|------------------------|--------------------------|--------|
| `quotes` | `status` (string) | Instance workflow **ou** miroir : statut dérivé de l’étape (compat API) |
| BCC (à créer, cf. phase 4) | `statut` | 100% piloté par workflow |
| BL (à créer) | `statut` | idem + étape « prêt logistique » |
| Tâches production (à créer) | `statut` | étapes : planifié / contrôle / terminé, service labo |
| `missions` (terrain) | `mission_status` | Sous-fiches **ordre de mission** avec propre instance workflow |
| Notes de frais (à créer) | — | Brouillon → valideur équipe → compta |
| Mouvement matériel (à créer) | — | Résidence / prêt / retour, validation éventuelle métrologie |

### 9.5 UX (principes)

- Chaque fiche (devis, commande, BL, tâche) : bandeau **où** se situe le document dans le circuit, **qui** doit agir, actions **Valider** / **Renvoyer** / **Demande d’éclaircissement** (comme beaucoup de moteurs WinDev maison, mais ici explicite et unifié).
- Tableau de bord **« Tâches à valider par mon équipe »** (cohérent cross-modules).

---

## 10. Notes de frais (cible)

```sql
expense_reports
  id, user_id, dossier_id, mission_id (nullable)
  amount_total, currency, status, notes, submitted_at, meta

expense_report_lines
  id, expense_report_id, date, category, amount_ht, vat_rate, attachment_id

expense_report_history (morph vers workflow history ou lié)
```

- Circuit type : **Brouillon** (utilisateur) → **Validation encadrement (équipe)** → **Compta** (saisie règlement / refus) → **Clôture**.
- L’instance de workflow (section 9) réutilise le même moteur que le commercial, avec une définition dédiée.

---

## 11. Matériel, inventaire et fiche « parc »

S’appuie sur `equipments` existant, à compléter.

### 11.1 Entités cibles (exemples)

- **`inventory_movements`** : type (réception, affectation, retour, mise au rebut, correction), `equipment_id`, `qty` ou 1× si série, `mission_id` / `user_id` cible, `dossier_id` option.
- **`equipment_sheets` ou extension `meta`** : fiche terrain (champs pannes, dernière vérif, prochaine vérif) — le besoin de **fiche** détaillée peut aussi être un simple **morph** `Attachment` + formulaire structuré.
- Lien **workflow** pour prêt d’appareil sensible : validation par **métrologie** ou **chef de labo**.

### 11.2 Synchronisation inventaire

- Tout **BL** (sortie client) / **BCC** (engagement) peut, si c’est le cas chez le client, déclencher un **mouvement** consommable — à règler en paramétrage (optionnel, selon atelier).

---

## 12. Ordres de mission (liés à un `dossier`)

### 12.1 Modélisation cible (léger, évolutif)

- **`dossier_mission_orders`** (ou renommage) : en-tête d’un **ordre d’exécution** dans le dossier : intitulé, dates, `team_id` ou `responsible_id`, `priority`, `order_status`.
- Lignes **`dossier_mission_order_tasks`** : tâches ordonnées, références optionnelles vers `ref_taches` / catalogues, avec **sous-workflow** (optionnel) ou simple statut (à faire / fait / validé QSE).

### 12.2 Cohabitation avec `missions` (terrain classique)

- `missions` reste la mission **géo** (site, ressource terrain).
- Les **ordres** sont la **décomposition** du dossier en opérations **numérotables** (OM1, OM2…) avec suivi d’**équipe** + **validations** alignées sur le moteur de la section 9.

---

## 13. Prochaines étapes (linéarisation en tickets)

1. **Dictionnaire** des étapes métier (atelier utilisateurs) : pour chaque type (devis, BCC, BL, tâche, NDF, matériel) lister *qui valide* et *les conditions* — figer avant modèle SQL.
2. **MVP moteur** : tables section 9 + 1 seul type pilote (ex. **devis** : brouillon → commerciaux → direction → envoyé) — sans tout migrer d’un coup.
3. **Teams** : tables + UI admin, rattachement utilisateurs.
4. **Câblage progressif** : BCC, BL, tâches, puis NDF / inventaire, puis ordres de mission dossier.
5. **Reporting** : file d’attente par pôle, SLA, audit.

> Cette feuille de route complète le schéma initial (sections 3–7) : elle n’invalide pas le catalogue / dossier / devis, mais **superpose** une **couche de pilotage** indispensable pour s’aligner sur les exigences PROLAB/WinDev sur les **circuits** et l’**organisation** par service.
