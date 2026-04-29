# Changelog — s2gBot

## [1.2.0] — 2026-04-29

### LIMS géotechnique — catalogue & seeders
- **4 familles métier** géotechnique : Béton, Sol, In Situ, Chimique (couleurs + `type_ressource`)
- **40 essais normés** seedés (10 béton, 15 sol, 10 in situ, 5 chimiques) avec normes NF/EN, prix, durée, unité
- **20 matériels** géotechnique (presse 3000 kN, CBR/Marshall, triaxial, œdomètre, cisaillement, Proctor, tamis, étuve, balance, Casagrande, VBS, carotteuse, pressiomètre Ménard, PANDA, DPSH, CPT, gammadensimètre, plaque Westergaard…)
- **Liens article ↔ matériel requis** automatiques (`article_equipment_requirements`)
- **Actions standardisées par famille** (technicien / labo / ingénieur)
- **Prélèvements démo** (10) rattachés aux commandes existantes

### Formulaires dynamiques (FormTemplate ↔ DynamicForm)
- Composant React `DynamicForm` (`src/components/forms/DynamicForm.tsx`) générant le formulaire à partir d'une définition JSON
- Types de champs : `number`, `text` (multiline), `photo`, `file`, `coordinates` (avec capture GPS), `table`, `graph` (recharts, courbe alimentée par une table source)
- 4 templates seedés : Compression béton 28j, Proctor (avec courbe γd/w), Densité en place (terrain), Pressiomètre Ménard (avec courbe pression/volume)

### RBAC — rôles métier
- Nouveaux rôles : `commercial`, `ingenieur`, `laborantin`, `responsable`
- Helpers `User::isCommercial()`, `isIngenieur()`, `isLaborantin()`, `isResponsable()`, `canValidateStatus()`, `isInternal()`
- Constante `User::ROLES_INTERNAL` listant les rôles internes laboratoire

### Recherche globale — fix
- Bug : `RefArticle` (classe inexistante) et colonne `designation` (n'existe pas) → utilise désormais `App\Models\Catalogue\Article` avec `libelle`, `code`, `code_interne`, `sku`, `normes`
- Ajout types : sites/chantiers, matériel/équipements
- Recherche client groupée correctement (parenthèses sur `orWhere`)
- Devis route corrigée (`/devis/:id/editer`)

### Catalogue UI
- Chips de familles colorées au-dessus du sélecteur de famille (couleur DB + tooltip type_ressource)

### Page Fiches techniques `/labo/fiches`
- Nouvelle route qui liste les `ReportFormDefinition` actives et permet de saisir une fiche en sandbox via `DynamicForm`
- Cartes ajoutées dans le hub Labo : « Fiches techniques » et « Tâches labo »

### RBAC — middleware route
- Nouveau middleware `App\Http\Middleware\EnsureRole` enregistré sous l'alias `role:`
- Garde appliquée sur les transitions de statut critiques :
  - `POST /v1/bons-commande/{id}/confirmer` → `role:responsable`
  - `POST /v1/bons-commande/{id}/transformer-bl` → `role:responsable`
  - `POST /v1/bons-livraison/{id}/valider` → `role:responsable`
- `lab_admin` conserve le bypass implicite

### Menu RÉCEPTION (échantillons FOLD)
- Migration `extend_samples_for_reception` étendant la table `samples` avec :
  `fold_number` (unique, FOLD-XXXXXXXX 8 chiffres), `dossier_id`, `mission_order_id`,
  `task_id`, `product_id`, `description`, `sample_type`, `origin_location`, `depth_m`,
  `collected_by` / `collected_at`, `received_by`, `condition_state`, `storage_location`,
  `photo_path`, `weight_g`, `quantity`, `rejection_reason`. `order_item_id` rendu nullable.
- Modèle `Sample` étendu : génération automatique du `fold_number` via `Sequence::next('FOLD')` ;
  nouveaux statuts `en_transit / receptionne / en_essai / termine / rejete` ; relations
  `dossier`, `missionOrder`, `task`, `product`, `collectedBy`, `receivedBy`.
- Rôle RBAC `receptionnaire` ajouté.
- `SampleReceptionController` (distinct du `SampleController` historique) avec endpoints :
  - `GET    /api/v1/samples` — liste paginée + filtres (status, dossier, mission, fold, dates)
  - `GET    /api/v1/samples/stats` — compteurs dashboard
  - `GET    /api/v1/samples/search?fold=…` — recherche rapide par numéro FOLD
  - `GET    /api/v1/samples/{id}` — détail
  - `POST   /api/v1/samples` — création terrain (rôles `lab_technician/receptionnaire/laborantin/ingenieur`)
  - `PUT    /api/v1/samples/{id}` — modification
  - `PATCH  /api/v1/samples/{id}/receive` — validation réception (`receptionnaire/responsable/laborantin`)
  - `PATCH  /api/v1/samples/{id}/start-test` — démarrage essais (`laborantin/responsable`)
  - `PATCH  /api/v1/samples/{id}/complete` — fin essais (`laborantin/responsable`)
  - `PATCH  /api/v1/samples/{id}/reject` — rejet avec motif (`responsable`)

### Backend — fallback de version
- `App\Support\AppVersion::detect()` fallback `1.1.0` → `1.2.0` (la source de vérité reste `react-frontend/package.json`).

## [1.0.27] — 2026-04-28

### Familles articles & Catalogue enrichi
- Familles d'articles avec couleur et type de ressource (labo/terrain/ingénierie)
- Actions par article (`article_actions`) : durée, ressource, matériel requis
- Configuration des champs de mesure par action (`action_measure_configs`) : type (number/text/select/date/file/boolean), unité, bornes min/max, options select, champ requis, ordre

### Ordres de Mission (OdM)
- Modèle `OrdreMission` avec 3 types : labo / technicien / ingénieur
- Génération automatique depuis un Bon de Commande (`generate-ordres-mission`)
- Lignes d'OM liées aux lignes BC + articles catalogue
- Numéros séquentiels 8 chiffres : `OM-10000001` (via table `sequences` avec verrou pessimiste)

### Essais & Tâches de mission
- `MissionTask` (TSK-XXXXXXXX) : tâche concrète issue d'une ligne OM, avec statut todo/in_progress/done/validated/rejected
- `TaskMeasure` : saisie des mesures avec auto-conformité (calcul automatique depuis bornes min/max)
- `TaskResult` : résultat final validé par tâche
- Vue labo (`/labo/taches`) et vue terrain (`/terrain/taches`) pour saisie des mesures

### Planning & Indisponibilités
- `PlanningHuman` / `PlanningEquipment` : affectation des personnes et machines aux tâches
- `StockPersonnel` / `StockEquipment` : périodes d'indisponibilité
- Page planning global (`/planning`) : grille mensuelle par personne ou matériel, onglets Personnel / Matériel / Indisponibilités

### Notes de frais (NDF)
- `ExpenseReport` (NDF-XXXXXXXX) : rapport lié à un OM terrain/ingénieur
- `ExpenseLine` : lignes de dépenses (Essence, Hotel, Voyage, Repas, Péage, Parking, Divers)
- Workflow statut : brouillon → soumis → validé → remboursé
- Page `/notes-de-frais` : liste et gestion complète

### Recherche globale améliorée
- Couvre : clients, contacts, dossiers, ordres de mission, tâches, NDF, devis, factures, articles
- Recherche sur `unique_number` en plus du nom/référence
- Route `/api/global-search` déplacée sous le middleware `auth:sanctum`

## [1.0.37] — 2026-04-23

### Interface
- Navigation unifiée en regroupements : **Catalogue**, **Clients**, **Commercial**, **Chantier**, **Matériel**, **Laboratoire**, **Config**, **Rapports** ; raccourcis Aide + Paramètres conservés. Hub matériel `/materiel`, placeholder planning techniciens `/terrain/planning`.

## [1.0.36] — 2026-04-23

### Versions (alignement)
- **Source de vérité** : `react-frontend/package.json` → reprise dans le bundle (`__APP_VERSION__`), le footer Lab BTP, et `AppVersion::detect()` côté Laravel (`GET /api/version` si `APP_VERSION` absent).
- Alignement explicite après un affichage **1.0.26** en production (bump de version lié au lot PROLAB 2026-04-02) alors que l’app était déjà au-delà de **1.0.30** : pas de retrait de fonctionnalités, uniquement une **même version** partout (≥ 1.0.30) pour le déploiement et le support.

## [1.0.26] — 2026-04-02

### Migration PROLAB
- Import 84 utilisateurs depuis WinDev/HFSQL (`SYS_Utilisateur.FIC`) → seeder `ProlabUsersSeeder`
- Extraction structure catalogue WinDev/HFSQL : familles, articles, packages, tâches, paramètres
- Nettoyage base clients : suppression 3831 entrées vides/doublons, conservation 4 clients actifs
- Groupes PROLAB identifiés : BAHA, BAIH, GHCH, KHKH, RHCH (mapping workflow à venir)

### Infrastructure
- Nettoyage Docker build cache serveur (−9.2 Go)
- Fix port mapping HTTP_PORT=80 (proxy Proxmox → LXC)
- Ajout `php artisan migrate --force` dans `docker-prod-refresh.sh`

### Linear — Tickets créés (BDC-128 à BDC-138)
- [CLIENT] Contacts multiples par client (`client_contacts`)
- [CLIENT] Enrichissement fiche client (type, secteur, remise, paiement)
- [CATALOGUE] Enrichissement `ref_articles` (ref_interne, tarifs, sous-traitance)
- [DOC] CRUD complet documents commerciaux
- [DOC] Lignes libres sur devis/factures/BC/BL
- [DOC] Numérotation séquentielle unique (DOS/DEV/BC/BL/FAC/OM)
- [WORKFLOW] Moteur de validation configurable par service/équipe
- [WORKFLOW] Audit trail transitions d'états
- [MISSION] Ordres de mission terrain
- [MATERIEL] Inventaire matériel technique (n° série, calibration)
- [NDF] Notes de frais (saisie, validation, remboursement)

### Tickets clôturés
- BDC-107 à BDC-115 : catalogue produits P1 + dossiers P2 + devis enrichi P3
- BDC-128, 132, 133, 134, 135 : contacts clients, lignes libres, séquences, workflow BDD, audit trail
