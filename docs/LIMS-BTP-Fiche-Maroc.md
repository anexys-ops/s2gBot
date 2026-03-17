# Fiche contexte Maroc – LIMS BTP

Points à avoir en tête pour le cadrage et les discussions avec les prestataires (chiffrage, intégration, conformité).

---

## Normes & qualité

| Référence | Description |
|-----------|-------------|
| **SNIMA** | Système national d’essais et de certification (équivalent marocain d’une accréditation type ISO 17025). Si le labo est (ou vise) l’accréditation, le LIMS doit prévoir audit trail, étalonnages, traçabilité. |
| **NM** | Normes marocaines (souvent alignées EN/ISO). À lister dans le catalogue essais (ex : NM 10.1.xxx pour béton, etc.). |
| **ISO 17025** | Référentiel reconnu pour les labos d’essais ; exigences fortes sur traçabilité, compétences, équipements, rapports. |

**À clarifier avec le labo** : accréditation actuelle (SNIMA ou autre), périmètre (quels essais), et si le LIMS doit supporter un futur audit.

---

## Facturation & juridique

- **TVA** : taux en vigueur au Maroc (à appliquer dans les grilles tarifaires et exports compta).
- **Devise** : MAD ; préciser si besoin multi-devises (projets internationaux).
- **Signature électronique** : valeur juridique des rapports signés électroniquement au Maroc à confirmer (pour validation/archivage).

---

## Langue & usage

- **Interface** : français courant dans les labos BTP ; arabe utile si équipes terrain ou clients arabophones.
- **Rapports** : préciser langue(s) de rédaction et si bilingue (FR/AR) requis.
- **Termes métier** : « dossier d’essais », « échantillon », « chaîne de custody », « non-conformité » – à aligner avec le vocabulaire du labo.

---

## Hébergement & données

- **Localisation** : savoir si les données doivent rester au Maroc (serveur sur site ou hébergeur marocain) ou si cloud étranger (UE, etc.) est accepté (contrats, RGPD si données personnelles).
- **Sauvegardes** : fréquence et rétention à prévoir dans le chiffrage (Docker + backups comme indiqué dans la spec).

---

## Références utiles (à vérifier à jour)

- **SNIMA** : site officiel / portail du ministère pour la liste des labos accrédités et exigences.
- **Normes NM** : Institut marocain de normalisation (IMANOR) pour les références exactes par domaine (béton, sols, granulats, etc.).

---

*À utiliser en complément du document « LIMS-BTP-Maroc-Cadrage-Pret-a-chiffrer.md ».*
