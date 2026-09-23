# API mobile terrain — contrat d'intégration

Base de production : `https://s2g.apps-dev.fr/api`. Toutes les routes ci-dessous exigent `Authorization: Bearer <token Sanctum>` et `Accept: application/json`. Le login existant est `POST /api/login` ; fournir un `device_name` stable par appareil. Les dates sont au format `YYYY-MM-DD` et les montants en DH.

Ces routes sont **personnelles** : elles renvoient uniquement les tâches terrain, laboratoire ou ingénierie affectées à l'utilisateur du jeton. Ne pas envoyer de `user_id` dans les filtres. Les routes administratives `/api/mission-tasks`, `/api/v1/planning-terrain` et `/api/expense-reports` ne sont pas le contrat de l'application mobile. Pour les formulaires de ces tâches, voir [Formulaires d’essai reliés aux tâches](formulaires-essais-taches.md).

## Agenda et tâches

| Méthode | Route | Usage |
|---|---|---|
| GET | `/mobile/terrain/calendar?from=2026-09-21&to=2026-09-27` | Agenda : tâches datées, autres événements personnels et mouvements de matériel |
| GET | `/mobile/terrain/tasks?active_only=1` | Mes tâches à faire, y compris celles sans date |
| GET | `/mobile/terrain/tasks?from=2026-09-21&to=2026-09-27&statut=todo` | Filtrer par période et statut |
| GET | `/mobile/terrain/tasks/{id}` | Fiche tâche, client, chantier, dossier et matériel |
| PATCH | `/mobile/terrain/tasks/{id}/status` | Démarrer, mettre en pause, terminer ou annuler ma tâche |

`calendar` renvoie trois tableaux : `tasks`, `events`, `equipment_movements`. Les tâches sont prises dans l'OM ; les événements sont les entrées personnelles du planning sans tâche liée. Une ancienne affectation directe du BC figure dans `events` avec `source_type: "terrain_bc"`, son libellé et son contexte BC/client/dossier. Le calendrier ne duplique pas les événements de planning rattachés aux tâches. Un mouvement fournit `a_recuperer_le` et `a_deposer_le` ; la date de dépôt effective remplace la date prévue lorsqu'elle existe.

Exemple abrégé de `GET /mobile/terrain/tasks/{id}` :

```json
{
  "id": 348,
  "numero": "TSK-10000348",
  "statut": "todo",
  "planned_date": "2026-09-23",
  "due_date": null,
  "libelle": "Contrôle de compacité",
  "quantite": 1,
  "ordre_mission": { "id": 33, "numero": "OM-T-2026-0016", "type": "technicien", "statut": "planifie" },
  "bon_commande": { "id": 51, "numero": "BCC-2026-0037/HQ" },
  "client": { "id": 12, "name": "Client", "phone": "+212...", "address": "...", "city": "...", "email": "...", "lat": null, "lng": null },
  "site": { "id": 8, "name": "Chantier", "address": "...", "latitude": null, "longitude": null },
  "dossier": { "id": 15, "reference": "DOS-2026-0035/HQ", "titre": "..." },
  "equipment": [
    { "source": "affectation", "equipment": { "id": 7, "name": "Densitomètre", "code": "MAT-7", "type": "Essai", "status": "active" }, "a_recuperer_le": "2026-09-23", "a_deposer_le": "2026-09-24", "etat_depart": null, "etat_retour": null }
  ]
}
```

`equipment` peut également contenir une entrée `source: "ligne_om"` (matériel prévu sur la ligne) ou `source: "planning"` (réservation, avec `date_debut`/`date_fin`). Ces sources indiquent le **type d'affectation**, pas une remise matérielle confirmée. Seules les entrées `source: "affectation"` portent les dates de récupération et dépôt. Les tâches sans date restent dans `tasks`, pas dans `calendar.tasks`.

Statuts possibles des tâches : `todo`, `in_progress`, `paused`, `frozen`, `rescheduled`, `done`, `validated`, `rejected`. `active_only=1` exclut `done`, `validated` et `rejected`. Une tâche d'un autre utilisateur donne `403` à la lecture de sa fiche.

### Changer le statut d'une tâche

Une seule route : `PATCH /mobile/terrain/tasks/{id}/status` avec `Content-Type: application/json`. Le champ `statut` accepte uniquement `in_progress`, `paused`, `done` ou `rejected`. Pour annuler, fournir aussi `motif` (chaîne obligatoire de 3 à 2000 caractères après retrait des espaces extérieurs) :

```json
{ "statut": "rejected", "motif": "Chantier annulé par le client" }
```

| Statut demandé | Action | Statuts de départ autorisés |
|---|---|---|
| `in_progress` | Démarrer / reprendre | `todo`, `paused`, `rescheduled` |
| `paused` | Mettre en pause | `in_progress` |
| `done` | Terminer, en attente de validation | `in_progress` |
| `rejected` | Annuler | `todo`, `in_progress`, `paused`, `rescheduled` |

Une tâche `frozen`, `done`, `validated` ou `rejected` ne peut pas être relancée depuis cette route. `done` n'est pas une validation définitive : la validation du rapport ou des formulaires d'essai reste nécessaire pour passer à `validated`. Le motif d'annulation est conservé dans `cancellation_reason`. Le serveur fixe `started_at` et `completed_at` lors du premier démarrage et de la fin, et synchronise la ligne d'OM, l'OM et le planning. La réponse `200` est la même fiche complète que `GET /mobile/terrain/tasks/{id}`, avec client, site, dossier et matériel actualisés. Une transition interdite renvoie `422` avec `errors.statut` ; un motif manquant ou invalide renvoie `422` avec `errors.motif`. Une tâche non affectée au compte renvoie `403`.

## Notes de frais

| Méthode | Route | Usage |
|---|---|---|
| GET | `/mobile/terrain/expense-options` | OM éligibles assignés, catégories, moyens de paiement, barème utilisateur |
| GET | `/mobile/terrain/expense-reports` | Mes notes de frais et leurs lignes |
| POST | `/mobile/terrain/expense-reports` | Créer un brouillon sur un OM assigné |
| POST | `/mobile/terrain/expense-reports/standalone` | Créer un brouillon sans OM |
| POST | `/mobile/terrain/expense-reports/{id}/lines` | Ajouter une dépense à mon brouillon |
| POST | `/mobile/terrain/expense-reports/{id}/lines/{lineId}/photo` | Joindre ou remplacer une photo (multipart) |
| GET | `/mobile/terrain/expense-reports/{id}/lines/{lineId}/photo` | Télécharger ma photo |
| POST | `/mobile/terrain/expense-reports/{id}/submit` | Soumettre ma note après ajout d'au moins une ligne |

Créer le brouillon :

```json
{ "ordre_mission_id": 33, "notes": "Déplacement chantier du 23 septembre" }
```

Pour une note **sans OM**, appeler `POST /mobile/terrain/expense-reports/standalone` avec `{ "notes": "Déplacement hors mission" }` ou `{}`. Ne pas envoyer `ordre_mission_id` ni `user_id`. Le serveur crée un brouillon dont `ordre_mission_id` vaut `null` et fixe `user_id` au compte connecté.

Ajouter une ligne :

```json
{
  "category": "Voyage",
  "date": "2026-09-23",
  "distance_km": 120,
  "lieu_depart": "Casablanca",
  "lieu_arrivee": "Rabat",
  "payment_method": "especes",
  "description": "Aller-retour chantier"
}
```

Si `distance_km` est fourni sans `amount`, le serveur calcule le montant avec le barème kilométrique de l'utilisateur ; `taux_km` peut être fourni. Pour `Repas`, le forfait utilisateur s'applique si le montant est absent ou nul. Les catégories autorisées sont `Essence`, `Hotel`, `Voyage`, `Repas`, `Peage`, `Parking`, `Divers`. Les moyens de paiement sont `especes`, `cb`, `virement`, `cheque`, `autre`. Le serveur fixe toujours `user_id` au compte connecté. Une ligne ne peut être ajoutée qu'à son propre brouillon. Après soumission, la note passe à `soumis` et n'est plus modifiable par ces routes.

Après la création d'une ligne, envoyer la photo en `multipart/form-data` avec le champ **`photo`** à `POST /mobile/terrain/expense-reports/{id}/lines/{lineId}/photo`. Types acceptés : JPEG, PNG, WebP ; taille maximale : 10 Mio. La réponse `200` contient la ligne avec `receipt_path` et `receipt_filename`. Une nouvelle photo remplace l'ancienne. La lecture par `GET` exige le même jeton utilisateur et renvoie le fichier. L'upload est réservé aux brouillons et à leurs propres lignes.

## Réponses et erreurs

- `200` pour les lectures et la soumission ; `201` pour la création de brouillon ou de ligne.
- `401` sans jeton valide, `403` pour une tâche, un OM ou une note d'autrui.
- `422` pour des paramètres invalides, une note non brouillon ou une soumission sans ligne. Les erreurs de validation Laravel sont renvoyées dans `message` et `errors`.
- Les identifiants (`id`) sont numériques ; une relation absente vaut `null`, un groupe vide vaut `[]`.

Le matériel est affiché à titre informatif dans cette première étape. La confirmation physique de récupération/dépôt demande un flux distinct.
