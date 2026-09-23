# Formulaires d'essai reliés aux tâches

Le module [Types d’essais](/catalogue/essais) permet de créer un type d’essai, de définir ses champs de formulaire puis de l’affecter à un ou plusieurs **produits** du catalogue. Une affectation peut viser toutes les actions du produit ou une action précise (`article_action_id`). Les tâches terrain, laboratoire et ingénierie issues de ce produit héritent du même formulaire réutilisable.

Le menu principal **Essais → Types d’essais et formulaires** ouvre ce module. Sur la fiche d’un produit, l’onglet **Actions, matériel & essais** permet à un administrateur laboratoire d’ajouter les essais nécessaires et de cibler une action. L’enregistrement sur une fiche produit ne modifie pas les affectations des autres produits.

Un essai est classé **terrain**, **ingénierie** ou **laboratoire**. Les anciens essais sans domaine continuent d’être visibles. Ils peuvent être modifiés pour ajouter leur formulaire avant d’être affectés à un produit.

Champs pris en charge : `number`, `text`, `date`, `select`, `checkboxes`, `boolean`, `photo`, `table` et `formula`. Chaque champ a une clé stable (`key`), un libellé, un caractère obligatoire et éventuellement une unité ou des choix. Un tableau contient des colonnes typées et autant de lignes que nécessaire lors de la saisie. Une formule peut utiliser les clés numériques qui la précèdent et les opérateurs `+`, `-`, `*`, `/` avec parenthèses ; dans un tableau, elle utilise les clés des colonnes précédentes de la même ligne. Le serveur recalcule les résultats et ne fait pas confiance à la valeur envoyée par le mobile.

Les champs `select` et `checkboxes` peuvent utiliser des choix locaux ou une **liste commune** créée dans **Configuration → Listes de choix des essais**. Les choix sont copiés dans la tâche à sa première saisie : modifier ensuite la liste commune ne change pas le formulaire déjà commencé. Une liste utilisée par un modèle ne peut pas être supprimée. Les paramètres d’essai historiques destinés aux résultats d’échantillons restent distincts des champs de ce formulaire de tâche.

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
| `PUT` | `/v1/catalogue/articles/{article}/test-types` | Synchroniser les essais d’un seul produit `{assignments:[{test_type_id,article_action_id?}]}` |
| `GET` / `POST` | `/form-option-lists` | Lister ou créer les listes de choix communes |
| `PUT` / `DELETE` | `/form-option-lists/{id}` | Modifier ou retirer une liste inutilisée |
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

La création d’un type peut aussi recevoir `context` (`terrain`, `ingenieur` ou `labo`) et `assignments` pour enregistrer le formulaire et ses produits dans une seule opération. Un champ calculé utilise `type: "formula"` et `formula: "longueur * largeur"`. Un tableau utilise `type: "table"` avec `columns`; chaque colonne porte sa propre clé, son libellé et son type. Pour une liste commune, un champ de type `select` ou `checkboxes` indique `list_id` au lieu de ses `options` locales.

Les photos sont stockées hors du répertoire public et ne sont téléchargées qu'après contrôle d'accès. Le rédacteur ne peut pas valider son propre formulaire. Les endpoints renvoient `403` pour une tâche ou photo inaccessible, `404` pour un formulaire non affecté au produit/action, et `422` pour une saisie invalide ou une transition d'état interdite.
