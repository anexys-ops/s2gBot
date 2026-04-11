# API mobile laboratoire / terrain (implémentation s2gBot)

Ce document résume ce qui est **branché dans Laravel** ; le détail fonctionnel reste aligné sur le cahier des charges mobile (chemins, JSON, Bearer).

## Routes existantes (déjà en place)

Toutes sous préfixe `/api`, groupe `auth:sanctum` sauf `login` / `register` / `version` :

| Méthode | Chemin | Contrôleur |
|---------|--------|------------|
| POST | `login` | `AuthController@login` |
| POST | `logout` | `AuthController@logout` |
| GET | `user` | `AuthController@user` |
| GET | `orders` | `OrderController@index` (`search`, `status`, pagination) |
| GET | `orders/{order}` | `OrderController@show` |
| GET | `sites` | `SiteController@index` (`search`) |
| GET | `sites/{site}` | `SiteController@show` |
| GET | `clients` | `ClientController@index` (`search`) |
| GET | `clients/{client}` | `ClientController@show` |

## Routes module mobile dossier (ajout)

`kind` = littéralement `order` ou `site` ; `id` = identifiant numérique.

| Méthode | Chemin | Action |
|---------|--------|--------|
| GET | `mobile/dossiers/{kind}/{id}/measure-forms` | Gabarits de mesures (JSON) |
| POST | `mobile/dossiers/{kind}/{id}/measure-submissions` | Saisie mesures (idempotence `client_submission_id`) |
| GET | `mobile/dossiers/{kind}/{id}/photos` | Photos = pièces jointes `Attachment` sur la commande ou le chantier |
| POST | `mobile/dossiers/{kind}/{id}/photos` | Métadonnées photo + lien vers upload fichier |

## Données & configuration

- **Gabarits mesures** : table `module_settings`, clé `mobile_labo_terrain`, JSON `settings.measure_form_templates` (seed + défaut code si vide).
- **Soumissions** : table `mobile_measure_submissions`.
- **Métadonnées photo (étape JSON)** : table `mobile_dossier_photos` ; envoi fichier : `POST /api/attachments` avec `attachable_type` = `order` ou `site` et `attachable_id` (voir réponse `hint` du POST photos).
- **Chantier** : modèle `Site` expose désormais `attachments()` (même mécanisme polymorphique que `Order`).

## Auth mobile

- Le corps de `POST /login` peut inclure **`device_name`** (optionnel). S’il est fourni, le jeton Sanctum est nommé ainsi : un nouvel login sur le **même** `device_name` révoque l’ancien jeton de ce nom, sans invalider les autres appareils (contrairement au seul nom fixe `spa`).

## Fichiers clés

- `routes/api.php` — groupe `mobile/dossiers`
- `app/Http/Controllers/Api/Mobile/MobileDossierController.php`
- `app/Http/Controllers/Api/AttachmentController.php` — type `site` + droits d’upload alignés sur l’accès au dossier
- Migration `database/migrations/2026_04_11_200000_mobile_labo_dossier_api.php`
