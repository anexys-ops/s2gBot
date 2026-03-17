# LIMS BTP – Cadrage & Spécification « Prêt à chiffrer »
## Contexte : Laboratoire BTP au Maroc

**Version** : Semaine 0 – Cadrage  
**Objectif** : Document de cadrage couvrant le flux de bout en bout (demande → prélèvement → essai → résultats → rapport → facturation), adapté au marché marocain, pour obtenir des devis cohérents.

---

## 1. Cadrage (Semaine 0)

### 1.1 Objectif du projet
Couvrir le flux complet : **demande → prélèvement → essai → résultats → rapport → facturation**, avec un LIMS structuré pour « aller vite sans se tromper ».

### 1.2 Checklist à clarifier (à remplir avant chiffrage)

| # | Thème | Question / Point à clarifier | Réponse / Statut |
|---|--------|------------------------------|------------------|
| **Types d’essais** | | | |
| 1.1 | Familles d’essais au démarrage | Quelles familles en MVP ? (béton, sols, granulats, bitume, acier, autres) | ☐ À remplir |
| 1.2 | Essais prioritaires | Liste des 5–10 essais les plus fréquents (ex : résistance béton, CBR, Los Angeles…) | ☐ À remplir |
| 1.3 | Essais à horizon 12 mois | Familles à intégrer en V1/V2 | ☐ À remplir |
| **Normes & référentiels** | | | |
| 2.1 | Normes utilisées | NF, EN, ASTM, **NM (normes marocaines)** – lesquelles ? | ☐ À remplir |
| 2.2 | SNIMA / accréditation | Labo accrédité SNIMA (équivalent ISO 17025) ? Exigences spécifiques ? | ☐ Oui ☐ Non ☐ En cours |
| 2.2b | Référentiel qualité | ISO 17025, ISO 9001, autre ? | ☐ À remplir |
| 2.3 | Méthodes internes | Méthodes maison à documenter dans le LIMS ? | ☐ Oui ☐ Non |
| **Périmètre** | | | |
| 3.1 | Sites | 1 labo ou multi-sites ? Villes / régions ? | ☐ À remplir |
| 3.2 | Prélèvements mobiles | Prélèvements sur chantier (véhicules, techniciens terrain) ? | ☐ Oui ☐ Non |
| 3.3 | Nombre d’utilisateurs | Techniciens, responsables, admin (estimation) | ☐ À remplir |
| **Traçabilité & conformité** | | | |
| 4.1 | Audit trail | Exigence : qui a modifié quoi, quand (obligatoire si accréditation) ? | ☐ Oui ☐ Non |
| 4.2 | Signatures électroniques | Signature des rapports / validations (valeur juridique au Maroc) ? | ☐ Oui ☐ Non |
| 4.3 | Étalonnages | Gestion des étalonnages équipements (dates, certificats) ? | ☐ Oui ☐ Non |
| 4.4 | Chaîne de custody | Traçabilité complète échantillon (réception → stockage → essai) ? | ☐ Oui ☐ Non |
| **Interfaces** | | | |
| 5.1 | Instruments | Balances, presses, capteurs – import CSV / API / Bluetooth / RS232 ? Liste des appareils. | ☐ À remplir |
| 5.2 | ERP / Compta | Logiciel actuel (Sage, Ciel, autre) ? Export facturation / écritures ? | ☐ À remplir |
| 5.3 | E-mail / envoi rapports | Envoi automatique par e-mail, portail client ? | ☐ À préciser |
| **Langue & réglementation Maroc** | | | |
| 6.1 | Langue(s) du système | Arabe, français, anglais ? Interface bilingue (FR/AR) ? | ☐ À remplir |
| 6.2 | Facturation | TVA marocaine, devises (MAD uniquement ou multi-devises) ? | ☐ À remplir |
| 6.3 | Hébergement | Données au Maroc ou autorisation cloud (UE/autre) ? | ☐ À remplir |

---

## 2. Process cible (workflows) – Résumé

| Processus | Contenu (à valider) |
|-----------|---------------------|
| **A. Demande / commande** | Client, chantier, projet → Devis / BC → Demande d’essais (liste + délais + urgence) → N° affaire/dossier |
| **B. Échantillons** | Enregistrement (origine, lot, date, préleveur) → Étiquettes code-barres/QR → Chaîne de custody (réception, stockage, conservation, température) |
| **C. Planification & exécution** | Planning poste/équipement/technicien → Checklists préparation → Saisie résultats (manuel + import) → Non-conformités / reprises |
| **D. Validation & rapports** | Relecture / double validation → Signature électronique + versioning → Rapport PDF → Envoi mail + archivage |
| **E. Facturation** | Grille tarifaire (essai, remises, forfaits) → Export compta/ERP |

---

## 3. Modules (MVP → V1 → V2)

| Phase | Délai indicatif | Contenu |
|-------|-----------------|--------|
| **MVP** | 6–10 semaines | Référentiel (clients, chantiers, catalogue essais, utilisateurs/roles) • Dossiers + échantillons • QR/Code-barres • Saisie résultats (formulaires + calculs) • Rapports PDF (modèles + historique) |
| **V1** | 10–16 semaines | Planning techniciens/équipements • Équipements + étalonnages • Non-conformités + actions correctives • Audit trail |
| **V2** | 16+ semaines | Connecteurs instruments • Portail client • BI / KPI • Multi-labos, multi-sociétés |

---

## 4. Données clés (modèle)

Entités principales : **Client**, **Chantier/Projet**, **Devis/Commande**, **DossierEssais**, **Échantillon**, **Prélèvement**, **Essai** (instance), **Méthode/Norme**, **Résultat** (valeurs + calculs), **Rapport** (version, statut, fichier), **Équipement**, **Étalonnage**, **Utilisateur**, **Rôle**, **Signature**, **AuditLog**, **NonConformité**, **ActionCorrective**.

---

## 5. UI (écrans indispensables)

- Tableau de bord (à traiter aujourd’hui, retards)
- Recherche dossiers/échantillons (scan QR)
- Fiche dossier (timeline)
- Fiche échantillon (traçabilité)
- Fiche essai (saisie + calculs)
- Générateur de rapport + aperçu
- Admin : catalogue essais, modèles, équipements

---

## 6. Stack technique recommandée (pragmatique)

- **Backend** : Python FastAPI ou Node/NestJS
- **DB** : PostgreSQL
- **Front** : React (web + mode tablette)
- **PDF** : templates HTML→PDF (ex. wkhtmltopdf/Playwright) ou Docx→PDF
- **Auth** : JWT + RBAC, SSO en option
- **Audit** : table d’événements immuable + signatures
- **Déploiement** : Docker + reverse proxy (Nginx) + sauvegardes

---

## 7. Plan projet (phases)

1. **Ateliers métier** (2–3 jours) : flux + essais prioritaires + maquettes  
2. **MVP** (6–10 semaines) : 1 à 2 familles d’essais  
3. **Pilote labo** (2 semaines) : retours terrain  
4. **Industrialisation (V1)** : audit trail, équipements, planning  
5. **Portail client (V2)**

---

## 8. Questions pour le Maroc – « Prêt à chiffrer »

### À remplir par vous (réponses courtes suffisent)

**Général**
1. Nom du laboratoire / société et ville(s) d’implantation ?
2. Nombre de techniciens (saisie/essais) et de responsables (validation, admin) ?
3. Volume annuel approximatif : nombre de dossiers, nombre d’essais/an ?

**Essais & normes**
4. Liste des 5–10 essais les plus fréquents (ex : résistance béton 7j/28j, CBR, Los Angeles, Marshall…) ?
5. Normes utilisées : NM, NF, EN, ASTM (liste ou « comme actuellement en Excel ») ?
6. Accréditation SNIMA (ou équivalent) : oui / non / en cours ? Si oui, périmètre (quels essais) ?

**Périmètre**
7. Un seul site ou plusieurs ? Si plusieurs : partage des dossiers entre sites ou bases séparées ?
8. Prélèvements sur chantier : besoin de saisie/consultation en mobilité (tablette/smartphone) ?

**Existant**
9. Outils actuels : Excel, logiciel métier, ERP (quel nom) ? Export facturation nécessaire (format : CSV, API, autre) ?
10. Instruments à connecter : quels appareils (marque, modèle) et type de liaison (fichier CSV, clé USB, RS232, API) si connu ?

**Contraintes**
11. Langue(s) : français uniquement, arabe, anglais ? Rapport client en FR, AR ou les deux ?
12. Hébergement : serveur sur site (Maroc), cloud autorisé (quelle zone : Maroc, UE, autre) ?
13. Budget indicatif (fourchette) ou contrainte « MVP minimal » pour prioriser ?

**Délais**
14. Date de démarrage souhaitée et date cible pour le MVP en production ?

---

## 9. Livrable cadrage (Semaine 0)

- [ ] **Spécification courte** (~10 pages) : flux validés, périmètre MVP, liste des écrans, modèle de données simplifié.
- [ ] **MVP priorisé** : liste des user stories ou lots livrables (référentiel, dossiers/échantillons, saisie résultats, rapports) avec critères d’acceptation.
- [ ] **Checklist remplie** : toutes les cases du § 1.2 remplies ou marquées « à préciser en atelier ».

Une fois ce document complété, il pourra être envoyé tel quel (ou en version anonymisée) à des éditeurs ou intégrateurs pour obtenir des **devis comparables** (même périmètre, mêmes hypothèses).

---

*Document généré pour le projet LIMS BTP – Maroc. À compléter avant envoi aux prestataires.*
