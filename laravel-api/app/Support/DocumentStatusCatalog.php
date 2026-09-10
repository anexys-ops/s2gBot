<?php

namespace App\Support;

/**
 * Catalogue des types de documents et statuts par défaut (seed + référence UI).
 */
class DocumentStatusCatalog
{
    /**
     * @return list<array{type: string, label: string}>
     */
    public static function documentTypes(): array
    {
        return [
            ['type' => 'quote', 'label' => 'Devis'],
            ['type' => 'invoice', 'label' => 'Factures'],
            ['type' => 'bon_commande', 'label' => 'Bons de commande'],
            ['type' => 'bon_livraison', 'label' => 'Bons de livraison'],
            ['type' => 'dossier', 'label' => 'Dossiers'],
            ['type' => 'order', 'label' => 'Commandes labo'],
            ['type' => 'sample', 'label' => 'Échantillons'],
            ['type' => 'lab_report', 'label' => 'Rapports labo'],
            ['type' => 'report', 'label' => 'Rapports essais'],
            ['type' => 'ordre_mission', 'label' => 'Ordres de mission'],
            ['type' => 'ordre_mission_ligne', 'label' => 'Lignes ordre de mission'],
            ['type' => 'mission_task', 'label' => 'Tâches terrain'],
            ['type' => 'expense_report', 'label' => 'Notes de frais'],
            ['type' => 'site', 'label' => 'Chantiers'],
            ['type' => 'equipment', 'label' => 'Matériel'],
            ['type' => 'non_conformity', 'label' => 'Non-conformités'],
            ['type' => 'corrective_action', 'label' => 'Actions correctives'],
            ['type' => 'situation_travaux', 'label' => 'Situations de travaux'],
            ['type' => 'invoice_credit', 'label' => 'Avoirs'],
            ['type' => 'mission', 'label' => 'Missions'],
            ['type' => 'devis_tache', 'label' => 'Tâches devis'],
        ];
    }

    /**
     * @return list<string>
     */
    public static function documentTypeKeys(): array
    {
        return array_column(self::documentTypes(), 'type');
    }

    /**
     * @return array<string, list<array{code: string, label: string, sort_order: int, is_initial: bool, is_terminal: bool, color_key: ?string}>>
     */
    public static function defaultStatuses(): array
    {
        return [
            'quote' => self::rows([
                ['draft', 'Brouillon', 0, true, false, 'amber'],
                ['validated', 'Validé', 10, false, false, 'teal'],
                ['signed', 'Signé', 20, false, false, 'teal'],
                ['sent', 'Envoyé', 30, false, false, 'coral'],
                ['relanced', 'Relancé', 40, false, false, 'orange'],
                ['lost', 'Perdu', 50, false, true, 'red'],
                ['invoiced', 'Facturé', 60, false, true, 'emerald'],
                ['accepted', 'Accepté', 70, false, true, 'emerald'],
                ['rejected', 'Refusé', 80, false, true, 'red'],
            ]),
            'invoice' => self::rows([
                ['draft', 'Brouillon', 0, true, false, 'amber'],
                ['validated', 'Validée', 10, false, false, 'teal'],
                ['signed', 'Signée', 20, false, false, 'teal'],
                ['sent', 'Envoyée', 30, false, false, 'coral'],
                ['relanced', 'Relancée', 40, false, false, 'orange'],
                ['paid', 'Encaissée', 50, false, true, 'emerald'],
            ]),
            'bon_commande' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['confirme', 'Confirmé', 10, false, false, 'teal'],
                ['en_cours', 'En cours', 20, false, false, 'orange'],
                ['livre', 'Livré', 30, false, true, 'emerald'],
                ['annule', 'Annulé', 40, false, true, 'red'],
            ]),
            'bon_livraison' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['livre', 'Livré', 10, false, false, 'teal'],
                ['signe', 'Signé', 20, false, true, 'emerald'],
            ]),
            'dossier' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['en_cours', 'En cours', 10, false, false, 'orange'],
                ['cloture', 'Clôturé', 20, false, true, 'emerald'],
                ['archive', 'Archivé', 30, false, true, 'slate'],
            ]),
            'order' => self::rows([
                ['draft', 'Brouillon', 0, true, false, 'amber'],
                ['submitted', 'Soumise', 10, false, false, 'teal'],
                ['in_progress', 'En cours', 20, false, false, 'orange'],
                ['completed', 'Terminée', 30, false, true, 'emerald'],
            ]),
            'sample' => self::rows([
                ['pending', 'En attente', 0, false, false, 'amber'],
                ['received', 'Reçu', 10, false, false, 'teal'],
                ['in_progress', 'En cours', 20, false, false, 'orange'],
                ['tested', 'Testé', 30, false, false, 'violet'],
                ['validated', 'Validé', 40, false, true, 'emerald'],
                ['en_transit', 'En transit', 50, true, false, 'teal'],
                ['receptionne', 'Réceptionné', 60, false, false, 'teal'],
                ['en_essai', 'En essai', 70, false, false, 'orange'],
                ['termine', 'Terminé', 80, false, true, 'emerald'],
                ['rejete', 'Rejeté', 90, false, true, 'red'],
                ['annule', 'Annulé', 100, false, true, 'red'],
            ]),
            'lab_report' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['en_validation', 'En validation', 10, false, false, 'orange'],
                ['valide', 'Validé', 20, false, false, 'teal'],
                ['signe', 'Signé', 30, false, false, 'teal'],
                ['emis', 'Émis', 40, false, true, 'emerald'],
            ]),
            'report' => self::rows([
                ['draft', 'Brouillon', 0, true, false, 'amber'],
                ['pending_review', 'En revue', 10, false, false, 'orange'],
                ['approved', 'Approuvé', 20, false, true, 'emerald'],
            ]),
            'ordre_mission' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['planifie', 'Planifié', 10, false, false, 'teal'],
                ['en_cours', 'En cours', 20, false, false, 'orange'],
                ['termine', 'Terminé', 30, false, true, 'emerald'],
                ['annule', 'Annulé', 40, false, true, 'red'],
            ]),
            'ordre_mission_ligne' => self::rows([
                ['a_faire', 'À faire', 0, true, false, 'amber'],
                ['en_cours', 'En cours', 10, false, false, 'orange'],
                ['realise', 'Réalisé', 20, false, true, 'emerald'],
                ['annule', 'Annulé', 30, false, true, 'red'],
            ]),
            'mission_task' => self::rows([
                ['todo', 'À faire', 0, true, false, 'amber'],
                ['in_progress', 'En cours', 10, false, false, 'orange'],
                ['paused', 'En pause', 20, false, false, 'slate'],
                ['frozen', 'Gelé', 30, false, false, 'violet'],
                ['done', 'Terminé', 40, false, false, 'teal'],
                ['validated', 'Validé', 50, false, true, 'emerald'],
                ['rejected', 'Rejeté', 60, false, true, 'red'],
            ]),
            'expense_report' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['soumis', 'Soumis', 10, false, false, 'teal'],
                ['valide', 'Validé', 20, false, false, 'emerald'],
                ['rembourse', 'Remboursé', 30, false, true, 'emerald'],
                ['rejete', 'Rejeté', 40, false, true, 'red'],
            ]),
            'site' => self::rows([
                ['not_started', 'Non démarré', 0, true, false, 'slate'],
                ['in_progress', 'En cours', 10, false, false, 'orange'],
                ['blocked', 'Bloqué', 20, false, false, 'red'],
                ['delivered', 'Livré', 30, false, true, 'emerald'],
                ['archived', 'Archivé', 40, false, true, 'slate'],
            ]),
            'equipment' => self::rows([
                ['active', 'Actif', 0, true, false, 'emerald'],
                ['maintenance', 'En maintenance', 10, false, false, 'orange'],
                ['retired', 'Retiré', 20, false, true, 'slate'],
            ]),
            'non_conformity' => self::rows([
                ['open', 'Ouverte', 0, true, false, 'red'],
                ['analyzing', 'Analyse', 10, false, false, 'orange'],
                ['action', 'Action', 20, false, false, 'teal'],
                ['closed', 'Clôturée', 30, false, true, 'emerald'],
            ]),
            'corrective_action' => self::rows([
                ['pending', 'En attente', 0, true, false, 'amber'],
                ['in_progress', 'En cours', 10, false, false, 'orange'],
                ['done', 'Terminée', 20, false, false, 'teal'],
                ['verified', 'Vérifiée', 30, false, true, 'emerald'],
            ]),
            'situation_travaux' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['valide', 'Validée', 10, false, false, 'teal'],
                ['facturee', 'Facturée', 20, false, true, 'emerald'],
                ['annulee', 'Annulée', 30, false, true, 'red'],
            ]),
            'invoice_credit' => self::rows([
                ['brouillon', 'Brouillon', 0, true, false, 'amber'],
                ['valide', 'Validé', 10, false, false, 'teal'],
                ['emis', 'Émis', 20, false, true, 'emerald'],
                ['annule', 'Annulé', 30, false, true, 'red'],
            ]),
            'mission' => self::rows([
                ['g1', 'G1', 0, true, false, 'slate'],
                ['g2', 'G2', 10, false, false, 'teal'],
                ['g3', 'G3', 20, false, false, 'orange'],
                ['g4', 'G4', 30, false, false, 'violet'],
                ['g5', 'G5', 40, false, true, 'emerald'],
            ]),
            'devis_tache' => self::rows([
                ['a_faire', 'À faire', 0, true, false, 'amber'],
                ['en_cours', 'En cours', 10, false, false, 'orange'],
                ['termine', 'Terminé', 20, false, true, 'emerald'],
                ['annule', 'Annulé', 30, false, true, 'red'],
            ]),
        ];
    }

    /**
     * @param  list<array{0: string, 1: string, 2: int, 3: bool, 4: bool, 5: string}>  $items
     * @return list<array{code: string, label: string, sort_order: int, is_initial: bool, is_terminal: bool, color_key: string}>
     */
    private static function rows(array $items): array
    {
        return array_map(static fn (array $row) => [
            'code' => $row[0],
            'label' => $row[1],
            'sort_order' => $row[2],
            'is_initial' => $row[3],
            'is_terminal' => $row[4],
            'color_key' => $row[5],
        ], $items);
    }
}
