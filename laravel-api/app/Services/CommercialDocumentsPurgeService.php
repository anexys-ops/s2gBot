<?php

namespace App\Services;

use App\Models\BonCommande;
use App\Models\BonLivraison;
use App\Models\DevisTache;
use App\Models\DocumentSequence;
use App\Models\ExpenseReport;
use App\Models\Invoice;
use App\Models\LabReport;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\Quote;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class CommercialDocumentsPurgeService
{
    /**
     * @return array<string, int>
     */
    public function purge(bool $dryRun = true, bool $resetSequences = true): array
    {
        $counts = [];

        DB::transaction(function () use ($dryRun, $resetSequences, &$counts): void {
            $this->purgeLabReception($dryRun, $counts);
            $this->purgePlanningMissionTasks($dryRun, $counts);
            $this->nullifyLooseForeignKeys($dryRun, $counts);
            $this->purgePolymorphicMetadata($dryRun, $counts);
            $this->purgePaymentsAndCredits($dryRun, $counts);
            $this->purgeCommercialDocuments($dryRun, $counts);

            if ($resetSequences) {
                $counts['document_sequences_reset'] = $this->resetDocumentSequences($dryRun);
                $counts['sequences_reset'] = $this->resetUniqueNumberSequences($dryRun);
            }
        });

        return $counts;
    }

    /**
     * @param  array<string, int>  $counts
     */
    private function purgeLabReception(bool $dryRun, array &$counts): void
    {
        $counts['corrective_actions'] = $this->deleteTable('corrective_actions', $dryRun);
        $counts['non_conformities'] = $this->deleteTable('non_conformities', $dryRun);
        $counts['lab_report_sections'] = $this->deleteTable('lab_report_sections', $dryRun);
        $counts['lab_reports'] = $this->forceDeleteAll(LabReport::class, $dryRun);
        $counts['test_results'] = $this->deleteTable('test_results', $dryRun);
        $counts['samples'] = $this->deleteTable('samples', $dryRun);
    }

    /**
     * @param  array<string, int>  $counts
     */
    private function purgePlanningMissionTasks(bool $dryRun, array &$counts): void
    {
        $counts['planning_humans (mission tasks)'] = $this->deleteTable(
            'planning_humans',
            $dryRun,
            fn ($q) => $q->whereNotNull('mission_task_id')
        );
        $counts['planning_equipments (mission tasks)'] = $this->deleteTable(
            'planning_equipments',
            $dryRun,
            fn ($q) => $q->whereNotNull('mission_task_id')
        );
    }

    /**
     * @param  array<string, int>  $counts
     */
    private function nullifyLooseForeignKeys(bool $dryRun, array &$counts): void
    {
        if (Schema::hasTable('materiel_affectations') && Schema::hasColumn('materiel_affectations', 'ordre_mission_id')) {
            $counts['materiel_affectations (ordre_mission_id nulled)'] = DB::table('materiel_affectations')
                ->whereNotNull('ordre_mission_id')
                ->count();
            if (! $dryRun && $counts['materiel_affectations (ordre_mission_id nulled)'] > 0) {
                DB::table('materiel_affectations')->whereNotNull('ordre_mission_id')->update(['ordre_mission_id' => null]);
            }
        }

        if (Schema::hasTable('missions') && Schema::hasColumn('missions', 'bon_commande_id')) {
            $counts['missions (bon_commande_id nulled)'] = DB::table('missions')
                ->whereNotNull('bon_commande_id')
                ->count();
            if (! $dryRun && $counts['missions (bon_commande_id nulled)'] > 0) {
                DB::table('missions')->whereNotNull('bon_commande_id')->update(['bon_commande_id' => null]);
            }
        }

        if (Schema::hasTable('situations_travaux') && Schema::hasColumn('situations_travaux', 'invoice_id')) {
            $counts['situations_travaux (invoice_id nulled)'] = DB::table('situations_travaux')
                ->whereNotNull('invoice_id')
                ->count();
            if (! $dryRun && $counts['situations_travaux (invoice_id nulled)'] > 0) {
                DB::table('situations_travaux')->whereNotNull('invoice_id')->update(['invoice_id' => null]);
            }
        }
    }

    /**
     * @param  array<string, int>  $counts
     */
    private function purgePolymorphicMetadata(bool $dryRun, array &$counts): void
    {
        $documentTypes = [
            Quote::class,
            Invoice::class,
            BonCommande::class,
            BonLivraison::class,
            OrdreMission::class,
        ];

        $counts['document_status_histories'] = $this->deleteTable(
            'document_status_histories',
            $dryRun,
            fn ($q) => $q->whereIn('document_type', $documentTypes)
        );

        $counts['commercial_document_links'] = $this->deleteTable(
            'commercial_document_links',
            $dryRun,
            fn ($q) => $q->where(function ($inner) {
                $inner->whereIn('source_type', ['quote', 'invoice', 'order'])
                    ->orWhereIn('target_type', ['quote', 'invoice', 'order']);
            })
        );

        $attachableTypes = [Quote::class, Invoice::class];
        $counts['attachments'] = $this->deleteTable(
            'attachments',
            $dryRun,
            fn ($q) => $q->whereIn('attachable_type', $attachableTypes)
        );

        $extrafieldEntityTypes = ['quote', 'invoice', 'bon_commande', 'bon_livraison'];
        if (Schema::hasTable('extrafield_definitions') && Schema::hasTable('extrafield_values')) {
            $definitionIds = DB::table('extrafield_definitions')
                ->whereIn('entity_type', $extrafieldEntityTypes)
                ->pluck('id');
            $counts['extrafield_values'] = $definitionIds->isEmpty()
                ? 0
                : $this->deleteTable(
                    'extrafield_values',
                    $dryRun,
                    fn ($q) => $q->whereIn('extrafield_definition_id', $definitionIds)
                );
        }

        $taggableTypes = [
            Quote::class,
            BonCommande::class,
            BonLivraison::class,
        ];
        $counts['taggables'] = $this->deleteTable(
            'taggables',
            $dryRun,
            fn ($q) => $q->whereIn('taggable_type', $taggableTypes)
        );

        if (Schema::hasTable('workflow_instances')) {
            $instanceIds = DB::table('workflow_instances')
                ->whereIn('subject_type', $documentTypes)
                ->pluck('id');

            $counts['workflow_histories'] = $instanceIds->isEmpty()
                ? 0
                : $this->deleteTable(
                    'workflow_histories',
                    $dryRun,
                    fn ($q) => $q->whereIn('workflow_instance_id', $instanceIds)
                );

            $counts['workflow_instances'] = $instanceIds->isEmpty()
                ? 0
                : $this->deleteTable(
                    'workflow_instances',
                    $dryRun,
                    fn ($q) => $q->whereIn('id', $instanceIds)
                );
        }

        if (Schema::hasTable('activity_logs')) {
            $counts['activity_logs'] = $this->deleteTable(
                'activity_logs',
                $dryRun,
                fn ($q) => $q->whereIn('subject_type', $documentTypes)
            );
        }
    }

    /**
     * @param  array<string, int>  $counts
     */
    private function purgePaymentsAndCredits(bool $dryRun, array &$counts): void
    {
        $counts['reglements'] = $this->deleteTable('reglements', $dryRun);
        $counts['invoice_credits'] = $this->deleteTable('invoice_credits', $dryRun);
    }

    /**
     * @param  array<string, int>  $counts
     */
    private function purgeCommercialDocuments(bool $dryRun, array &$counts): void
    {
        $counts['expense_reports'] = $this->forceDeleteAll(ExpenseReport::class, $dryRun);
        $counts['mission_tasks'] = $this->forceDeleteAll(MissionTask::class, $dryRun);
        $counts['ordres_mission'] = $this->forceDeleteAll(OrdreMission::class, $dryRun);
        $counts['bons_livraison'] = $this->forceDeleteAll(BonLivraison::class, $dryRun);
        $counts['invoices'] = $this->forceDeleteAll(Invoice::class, $dryRun);
        $counts['bons_commande'] = $this->forceDeleteAll(BonCommande::class, $dryRun);
        $counts['devis_taches'] = $this->forceDeleteAll(DevisTache::class, $dryRun);
        $counts['quote_lines'] = $this->deleteTable('quote_lines', $dryRun);
        $counts['quotes'] = $this->forceDeleteAll(Quote::class, $dryRun);
    }

    private function deleteTable(string $table, bool $dryRun, ?callable $scope = null): int
    {
        if (! Schema::hasTable($table)) {
            return 0;
        }

        $query = DB::table($table);
        if ($scope) {
            $scope($query);
        }

        $count = (clone $query)->count();
        if (! $dryRun && $count > 0) {
            if ($scope) {
                $scoped = DB::table($table);
                $scope($scoped);
                $scoped->delete();
            } else {
                DB::table($table)->delete();
            }
        }

        return $count;
    }

    /**
     * @param  class-string<Model>  $modelClass
     */
    private function forceDeleteAll(string $modelClass, bool $dryRun): int
    {
        if (! class_exists($modelClass)) {
            return 0;
        }

        $usesSoftDeletes = in_array(SoftDeletes::class, class_uses_recursive($modelClass), true);
        $query = $usesSoftDeletes ? $modelClass::withTrashed() : $modelClass::query();
        $count = $query->count();

        if (! $dryRun && $count > 0) {
            if ($usesSoftDeletes) {
                $modelClass::withTrashed()->forceDelete();
            } else {
                $modelClass::query()->delete();
            }
        }

        return $count;
    }

    private function resetDocumentSequences(bool $dryRun): int
    {
        if (! Schema::hasTable('document_sequences')) {
            return 0;
        }

        $types = [
            DocumentSequence::TYPE_DEVIS,
            DocumentSequence::TYPE_BON_COMMANDE,
            DocumentSequence::TYPE_BON_LIVRAISON,
            DocumentSequence::TYPE_FACTURE,
            DocumentSequence::TYPE_ORDRE_MISSION,
            DocumentSequence::TYPE_REGLEMENT,
            DocumentSequence::TYPE_SITUATION,
            DocumentSequence::TYPE_AVOIR,
        ];

        $count = DB::table('document_sequences')->whereIn('type', $types)->count();
        if (! $dryRun && $count > 0) {
            DB::table('document_sequences')->whereIn('type', $types)->update(['last_number' => 0]);
        }

        return $count;
    }

    private function resetUniqueNumberSequences(bool $dryRun): int
    {
        if (! Schema::hasTable('sequences')) {
            return 0;
        }

        $types = ['OM', 'NDF', 'TSK', 'MAT'];
        $count = DB::table('sequences')->whereIn('type', $types)->count();
        if (! $dryRun && $count > 0) {
            DB::table('sequences')->whereIn('type', $types)->update(['last_value' => 10_000_000]);
        }

        return $count;
    }
}
