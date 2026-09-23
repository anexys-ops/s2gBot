# Formulaires d'essai reliés aux tâches

Le module [Types d’essais](/catalogue/essais) permet de créer un type d’essai, de définir ses champs de formulaire puis de l’affecter à un ou plusieurs **produits** du catalogue. Une affectation peut viser toutes les actions du produit ou une action précise (`article_action_id`). Les tâches terrain, laboratoire et ingénierie issues de ce produit héritent du même formulaire réutilisable.

Champs pris en charge : `number`, `text`, `date`, `select`, `boolean`, `photo`. Chaque champ a une clé stable (`key`), un libellé, un caractère obligatoire et éventuellement une unité ou des choix. Les paramètres d’essai historiques destinés aux résultats d’échantillons restent distincts des champs de ce formulaire de tâche.

## Cycle de vie

1. Le technicien ouvre sa tâche dans l'application mobile, voit les formulaires affectés à son produit et son action, puis enregistre un brouillon (`draft`). La première saisie copie la définition du formulaire dans `form_snapshot` ; les modifications ultérieures du catalogue ne modifient pas ce dossier.
2. Il peut joindre des photos à un champ `photo`, modifier les réponses et soumettre (`submitted`). Les champs obligatoires et les types de valeurs sont contrôlés côté serveur.
3. Un responsable ou administrateur laboratoire différent du rédacteur consulte les réponses et photos dans la tâche, demande une correction (`correction_requested`) avec un motif, ou valide (`validated`). Après correction, le technicien reprend le brouillon et soumet à nouveau.
4. Quand **tous** les formulaires affectés à la tâche sont validés, la tâche et la ligne d'OM sont clôturées via le service de clôture existant ; l'OM suit son état opérationnel. Le formulaire et ses photos restent attachés à la tâche.

## API

Base : `https://s2g.apps-dev.fr/api`, avec `Authorization: Bearer <token>` et `Accept: application/json`.

| Méthode | Route | Rôle |
|---|---|---|
| `GET` | `/test-types` | Types d’essais et produits liés |
| `POST` / `PUT` | `/test-types` / `/test-types/{id}` | Créer ou modifier le type et `form_fields` |
| `PUT` | `/test-types/{id}/products` | Synchroniser les affectations `{assignments:[{article_id,article_action_id?}]}` |
| `GET` | `/mobile/task-forms/tasks/{task}` | Formulaires disponibles, réponses et statuts |
| `PUT` | `/mobile/task-forms/tasks/{task}/types/{testType}` | Enregistrer `{answers:{"valeur":12.5}}` en brouillon |
| `POST` | `/mobile/task-forms/tasks/{task}/types/{testType}/photos` | Joindre un `multipart/form-data` avec `field_key` et `photo` |
| `GET` / `DELETE` | `/mobile/task-forms/photos/{photo}` | Voir ou retirer une photo, selon les droits et l’état du brouillon |
| `POST` | `/mobile/task-forms/tasks/{task}/types/{testType}/submit` | Soumettre le formulaire complet |
| `POST` | `/mobile/task-forms/tasks/{task}/types/{testType}/review` | Décision `validate` ou `correction` avec `correction_note` obligatoire pour une correction |

Exemple de définition :

```json
{
  "form_fields": [
    { "key": "resistance", "label": "Résistance mesurée", "type": "number", "required": true, "unit": "MPa" },
    { "key": "etat", "label": "État visuel", "type": "select", "required": true, "options": ["Bon", "Dégradé"] },
    { "key": "photo_echantillon", "label": "Photo de l'échantillon", "type": "photo", "required": true }
  ]
}
```

Les photos sont stockées hors du répertoire public et ne sont téléchargées qu'après contrôle d'accès. Le rédacteur ne peut pas valider son propre formulaire. Les endpoints renvoient `403` pour une tâche ou photo inaccessible, `404` pour un formulaire non affecté au produit/action, et `422` pour une saisie invalide ou une transition d'état interdite.
