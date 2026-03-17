# Référence des fonctions DiData (swissdidata.com)

Document de référence des fonctionnalités de la plateforme DiData (Di-Freeze, Di-LIMS, Di-EDC) pour s’en inspirer sur la plateforme essais laboratoire BTP.

---

## 1. Produits DiData

| Produit     | Rôle principal |
|------------|----------------|
| **Di-Freeze** | Gestion des congélateurs / stockage physique (biobanques) |
| **Di-LIMS**   | LIMS : laboratoire, analyses, échantillons, workflows |
| **Di-EDC**    | EDC : capture de données cliniques, formulaires, études |

---

## 2. Liste des fonctions (features)

### Performance & UX
- **Rendu rapide** — Interface performante sur grands volumes de données
- **Raccourcis clavier** — Copier/coller et actions principales au clavier
- **Interface intuitive** — Conception orientée expérience utilisateur
- **Web-based** — Accès navigateur, pas d’installation client
- **Recherche globale** — Recherche disponible dans tous les modules

### Gestion des données
- **DataView** — Filtres, colonnes éditables, surlignage (highlighter)
- **Vue personnalisée** — Colonnes et filtres spécifiques par utilisateur
- **Types de champs** — Texte, nombres, fichiers, dates, etc.
- **Validation des données** — Types, règles et workflows pour qualité / zéro erreur
- **Données sensibles** — Colonnes marquées “sensibles” avec permissions renforcées
- **Audit trail complet** — Qui / Quoi / Quand pour toutes les modifications
- **Import Excel** — Import de fichiers Excel en un clic
- **Export de données** — Export CSV, Excel, SPSS
- **Import asynchrone** — Import en arrière-plan sans bloquer l’accès aux autres modules
- **Restitution des données** — Export Excel, REST API ou accès base direct

### Formulaires & formulaires publics
- **Form builder** — Création de formulaires, champs, validations
- **Formulaire public** — Lien public pour partager des enquêtes / formulaires
- **Champ signature** — Champ signature dans les formulaires
- **Template Excel** — Création/export de modèles Excel (ex. cas “sans résultat” en DataView)

### Échantillons & stockage
- **Gestion des échantillons** — Du prélèvement à l’expédition
- **Gestion des stockages** — Création et gestion de tous types de stockages
- **Vue 2D du stockage** — Visualisation 2D simulée des emplacements
- **Recherche dans le stockage** — Recherche dans tout le stockage, même hors vue courante
- **Congélateurs réalistes** — Types de congélateurs avec vues réalistes
- **Emplacements** — Freezers, tiroirs, étagères, boîtes, plaques

### Workflows
- **Workflows** — Processus définis étape par étape
- **Filtres de nœuds** — Filtres sur les nœuds des workflows

### Impression & étiquettes
- **Imprimantes** — Création d’imprimantes et de modèles d’impression
- **Impression d’étiquettes** — Impression des infos échantillon
- **Générateur de rapports PDF** — Génération de rapports PDF

### Sécurité & droits
- **Gestion des droits** — Permissions et rôles par projet
- **Rôles** — Rôles avec permissions associées
- **Authentification 2FA** — Double facteur pour environnements sensibles
- **Projets multiples** — Projets avec droits et configuration dédiés

### Intégration & technique
- **REST API** — Automatisation de toutes les fonctions via API REST
- **Plugins** — Création et personnalisation de modules via plugins
- **Routes personnalisées** — Routes GET/POST personnalisables
- **Règles avancées** — Règles en PHP (côté DiData)
- **Détecteur de liens** — Détection des liens internes
- **Déploiement rapide** — Intégration via librairies et REST API

### Partage & collaboration
- **Partage de données** — Lien vers une vue de données précise pour collègues
- **QR code** — Génération de QR pour entités et liens publics (formulaires)
- **Notifications** — Email, Slack, in-app pour différents événements du projet
- **Secure Drive** — Dossier sécurisé pour stocker et partager des fichiers

### Autres
- **Tableau de bord** — Module personnalisable selon les besoins
- **Statistiques** — Graphiques simples sur données et champs
- **Actions** — Actions personnalisées (une ou plusieurs opérations)
- **Bibliothèque d’icônes** — Amélioration de la lisibilité et de l’UX
- **Multi-langues** — Traductions et langue par profil utilisateur
- **Surligneur avancé** — Mise en évidence des cellules contenant une valeur recherchée
- **Email / notifications** — Templates Excel et notifications (ex. cas sans résultat)

---

## 3. Correspondance avec la plateforme Lab BTP

| Fonction DiData           | Équivalent / à prévoir Lab BTP |
|---------------------------|---------------------------------|
| Gestion des échantillons  | ✅ `samples` (commandes, réception, résultats) |
| Commandes / projets       | ✅ `orders`, `clients`, `sites` |
| Formulaires / EDC         | À étendre (form builder, validations) |
| Rapports PDF              | ✅ Génération rapports |
| Rôles et permissions      | ✅ lab_admin, lab_technician, client, site_contact |
| REST API                  | ✅ Laravel API + Sanctum |
| Audit trail               | À ajouter (qui/quand quoi sur commandes, échantillons, résultats) |
| Import / export Excel     | À ajouter (import Excel, export CSV/Excel) |
| Workflows                 | À définir (réception → essais → validation → rapport) |
| Stockage / emplacements   | Optionnel (congélateurs → casiers/armoires lab BTP) |
| 2FA                       | Optionnel (Sanctum + 2FA) |
| Notifications             | À ajouter (email, in-app) |
| Recherche globale         | À renforcer sur commandes, échantillons, clients |
| Données sensibles         | Optionnel (champs protégés par rôle) |

---

## 4. Pistes d’évolution court terme (inspirées DiData)

1. **Audit trail** — Log des modifications sur commandes, échantillons, résultats (user_id, date, champ, ancienne/nouvelle valeur).
2. **Import Excel** — Import de listes d’échantillons ou de résultats depuis Excel.
3. **Export** — Export CSV/Excel des commandes, échantillons, résultats (avec filtres).
4. **Workflow simple** — Statuts explicites : brouillon → reçu → en cours → terminé → rapporté.
5. **Notifications** — Email à la réception, à la fin des essais, à la mise à disposition du rapport.
6. **Recherche globale** — Barre de recherche unique (commandes, échantillons, clients, chantiers).
7. **Vues sauvegardées** — Filtres/colonnes favoris par utilisateur (custom view).
8. **2FA** — Option double facteur pour comptes admin/technicien.

---

*Source : swissdidata.com (page d’accueil, /features, /freezer-management-software, /lims-system, /electronic-data-capture).*
