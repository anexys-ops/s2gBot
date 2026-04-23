# Changelog — s2gBot

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
