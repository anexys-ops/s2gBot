<?php

namespace Database\Seeders;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\PlanningHuman;
use App\Models\Quote;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;

/**
 * v1.2.0 — Workflow démo branché sur les données EXISTANTES en prod.
 *
 * Ce seeder ne crée NI clients NI users NI articles : il les utilise tels
 * qu'ils sont déjà en base et complète le workflow manquant :
 *  - 5 dossiers
 *  - 5 bons de commande (liés aux devis existants quand possible)
 *  - 5 ordres de mission (2 terrain, 2 labo, 1 ingénieur)
 *  - 10 mission_tasks
 *  - Planning sur 7 jours
 *  - 3 notes de frais avec lignes
 *  - Statuts variés
 *
 * Idempotent : préfixes DEMOWF- sur référence/numéro pour les nouvelles
 * entités (distincts des préfixes DEMO- de FullDemoDataSeeder).
 */
class FullDemoWorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $clients = Client::query()->orderBy('id')->limit(5)->get();
        if ($clients->isEmpty()) {
            $this->command?->warn('FullDemoWorkflowSeeder : aucun client — abandon.');
            return;
        }

        $articles = Article::query()->orderBy('id')->limit(20)->get();
        if ($articles->isEmpty()) {
            $this->command?->warn('FullDemoWorkflowSeeder : aucun article — abandon.');
            return;
        }

        $sites = Site::query()->orderBy('id')->limit(5)->get();

        $users = User::query()
            ->whereIn('role', [
                User::ROLE_LAB_ADMIN, User::ROLE_LAB_TECHNICIAN,
                User::ROLE_COMMERCIAL, User::ROLE_INGENIEUR,
                User::ROLE_LABORANTIN, User::ROLE_RESPONSABLE,
            ])
            ->orderBy('id')->get();

        $commercial    = $users->firstWhere('role', User::ROLE_COMMERCIAL)    ?? $users->first();
        $responsable   = $users->firstWhere('role', User::ROLE_RESPONSABLE)   ?? $users->first();
        $ingenieur     = $users->firstWhere('role', User::ROLE_INGENIEUR)     ?? $users->first();
        $laborantin    = $users->firstWhere('role', User::ROLE_LABORANTIN)    ?? $users->first();

        $techniciens = $users->where('role', User::ROLE_LAB_TECHNICIAN)->values();
        if ($techniciens->isEmpty()) {
            $techniciens = $users;
        }

        // ── 1. Dossiers ────────────────────────────────────────────────────
        $statutsDossier = [
            Dossier::STATUT_BROUILLON,
            Dossier::STATUT_EN_COURS,
            Dossier::STATUT_EN_COURS,
            Dossier::STATUT_CLOTURE,
            Dossier::STATUT_ARCHIVE,
        ];
        $dossiers = [];
        foreach ($statutsDossier as $i => $st) {
            $client = $clients[$i % $clients->count()];
            $site   = $sites[$i % max($sites->count(), 1)] ?? null;
            $dossiers[] = Dossier::firstOrCreate(
                ['reference' => sprintf('DEMOWF-DOS-%03d', $i + 1)],
                [
                    'titre'       => "Dossier workflow #" . ($i + 1) . " — {$client->name}",
                    'client_id'   => $client->id,
                    'site_id'     => $site?->id,
                    'statut'      => $st,
                    'date_debut'  => now()->subDays(20 + $i * 4)->toDateString(),
                    'date_fin_prevue' => now()->addDays(60 - $i * 5)->toDateString(),
                    'created_by'  => $commercial?->id,
                ]
            );
        }

        // ── 2. Bons de commande (liés aux devis existants si possible) ─────
        $existingQuotes = Quote::query()->orderBy('id')->limit(5)->get();
        $statutsBC = ['brouillon', 'confirme', 'confirme', 'livre_partiel', 'solde'];
        $bcs = [];
        for ($i = 0; $i < 5; $i++) {
            $quote   = $existingQuotes[$i] ?? null;
            $dossier = $dossiers[$i % count($dossiers)];
            $bc = BonCommande::firstOrCreate(
                ['numero' => sprintf('DEMOWF-BC-%03d', $i + 1)],
                [
                    'quote_id'      => $quote?->id,
                    'dossier_id'    => $dossier->id,
                    'client_id'     => $quote?->client_id ?? $dossier->client_id,
                    'statut'        => $statutsBC[$i],
                    'date_commande' => now()->subDays(15 - $i * 2)->toDateString(),
                    'montant_ht'    => 0,
                    'montant_ttc'   => 0,
                    'tva_rate'      => 20,
                    'created_by'    => $commercial?->id ?? $responsable?->id,
                ]
            );

            if ($bc->lignes()->count() === 0) {
                $totalHt = 0.0;
                for ($k = 0; $k < 3; $k++) {
                    $art = $articles[($i * 3 + $k) % $articles->count()];
                    $qty = 1 + $k;
                    $pu  = (float) $art->prix_unitaire_ht;
                    $line = BonCommandeLigne::create([
                        'bon_commande_id'   => $bc->id,
                        'ref_article_id'    => $art->id,
                        'libelle'           => $art->libelle,
                        'ordre'             => $k + 1,
                        'quantite'          => $qty,
                        'prix_unitaire_ht'  => $pu,
                        'tva_rate'          => 20,
                        'montant_ht'        => $qty * $pu,
                        'date_debut_prevue' => now()->addDays(2 + $i)->toDateString(),
                        'date_fin_prevue'   => now()->addDays(5 + $i)->toDateString(),
                    ]);
                    $totalHt += $line->montant_ht;
                }
                $bc->update(['montant_ht' => $totalHt, 'montant_ttc' => $totalHt * 1.2]);
            }
            $bcs[] = $bc->refresh();
        }

        // ── 3. Ordres de mission (2 terrain, 2 labo, 1 ingénieur) ──────────
        $defs = [
            ['type' => OrdreMission::TYPE_TECHNICIEN, 'statut' => OrdreMission::STATUT_PLANIFIE,  'assignee' => fn ($k) => $techniciens[$k % $techniciens->count()] ?? null],
            ['type' => OrdreMission::TYPE_TECHNICIEN, 'statut' => OrdreMission::STATUT_EN_COURS,  'assignee' => fn ($k) => $techniciens[$k % $techniciens->count()] ?? null],
            ['type' => OrdreMission::TYPE_LABO,       'statut' => OrdreMission::STATUT_EN_COURS,  'assignee' => fn ($k) => $laborantin],
            ['type' => OrdreMission::TYPE_LABO,       'statut' => OrdreMission::STATUT_TERMINE,   'assignee' => fn ($k) => $laborantin],
            ['type' => OrdreMission::TYPE_INGENIEUR,  'statut' => OrdreMission::STATUT_PLANIFIE,  'assignee' => fn ($k) => $ingenieur],
        ];

        $oms = [];
        foreach ($defs as $i => $d) {
            $bc       = $bcs[$i] ?? null;
            $dossier  = $dossiers[$i % count($dossiers)];
            $om = OrdreMission::firstOrCreate(
                ['numero' => sprintf('DEMOWF-OM-%s-%03d', strtoupper(substr($d['type'], 0, 3)), $i + 1)],
                [
                    'bon_commande_id' => $bc?->id,
                    'dossier_id'      => $dossier->id,
                    'client_id'       => $dossier->client_id,
                    'site_id'         => $dossier->site_id,
                    'type'            => $d['type'],
                    'statut'          => $d['statut'],
                    'date_prevue'     => now()->addDays(2 + $i)->toDateString(),
                    'responsable_id'  => $responsable?->id,
                    'created_by'      => $commercial?->id ?? $responsable?->id,
                ]
            );

            if ($om->lignes()->count() === 0) {
                for ($k = 0; $k < 2; $k++) {
                    $art = $articles[($i * 2 + $k) % $articles->count()];
                    $assignee = ($d['assignee'])($k);
                    $ligne = OrdreMissionLigne::create([
                        'ordre_mission_id' => $om->id,
                        'ref_article_id'   => $art->id,
                        'libelle'          => $art->libelle,
                        'quantite'         => 1 + $k,
                        'statut'           => 'todo',
                        'assigned_user_id' => $assignee?->id,
                        'date_prevue'      => now()->addDays(2 + $i)->toDateString(),
                        'ordre'            => $k + 1,
                    ]);
                    MissionTask::create([
                        'ordre_mission_ligne_id' => $ligne->id,
                        'assigned_user_id'       => $assignee?->id,
                        'statut'                 => 'todo',
                        'planned_date'           => now()->addDays(2 + $i)->toDateString(),
                        'due_date'               => now()->addDays(4 + $i)->toDateString(),
                    ]);
                }
            }
            $oms[] = $om;
        }

        // ── 4. Planning sur 7 jours ────────────────────────────────────────
        if (Schema::hasTable('planning_humans') && $techniciens->isNotEmpty()) {
            foreach ($oms as $i => $om) {
                $tasks = MissionTask::query()
                    ->whereHas('ordreMissionLigne', fn ($q) => $q->where('ordre_mission_id', $om->id))
                    ->limit(2)
                    ->get();
                foreach ($tasks as $idx => $task) {
                    $tech = $techniciens[($i + $idx) % $techniciens->count()];
                    $start = Carbon::today()->addDays(($i + $idx) % 7);

                    $exists = PlanningHuman::query()
                        ->where('user_id', $tech->id)
                        ->where('mission_task_id', $task->id)
                        ->exists();
                    if (! $exists) {
                        PlanningHuman::create([
                            'user_id'        => $tech->id,
                            'mission_task_id'=> $task->id,
                            'date_debut'     => $start->toDateString(),
                            'date_fin'       => $start->copy()->addDay()->toDateString(),
                            'heure_debut'    => '08:00',
                            'heure_fin'      => '17:00',
                            'type_evenement' => 'mission',
                            'notes'          => 'Affectation démo workflow',
                        ]);
                    }
                }
            }
        }

        // ── 5. Notes de frais (sur OdM terrain + ingénieur) ────────────────
        $cibles = array_values(array_filter(
            $oms,
            fn (OrdreMission $om) => in_array($om->type, [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR], true)
        ));

        $statutsNDF = ['brouillon', 'soumis', 'valide'];
        foreach (array_slice($cibles, 0, 3) as $i => $om) {
            $author = $techniciens[$i % $techniciens->count()] ?? $commercial;
            $report = ExpenseReport::firstOrCreate(
                [
                    'ordre_mission_id' => $om->id,
                    'created_by'       => $author?->id,
                ],
                [
                    'statut' => $statutsNDF[$i] ?? 'brouillon',
                    'notes'  => "Frais déplacement workflow OdM {$om->numero}",
                ]
            );
            if ($report->wasRecentlyCreated) {
                $cats = ['essence' => 320, 'hotel' => 750, 'repas' => 180, 'peage' => 75, 'voyage' => 1100];
                foreach ($cats as $cat => $amount) {
                    ExpenseLine::create([
                        'expense_report_id' => $report->id,
                        'user_id'           => $author?->id,
                        'category'          => $cat,
                        'amount'            => $amount,
                        'date'              => now()->subDays(rand(1, 6))->toDateString(),
                        'description'       => "Frais {$cat} — {$om->numero}",
                    ]);
                }
            }
        }

        $this->command?->info(sprintf(
            'FullDemoWorkflowSeeder OK : %d dossiers, %d BC, %d OdM, %d tasks, %d plannings, %d NDF.',
            count($dossiers),
            count($bcs),
            count($oms),
            MissionTask::query()->count(),
            PlanningHuman::query()->count(),
            ExpenseReport::query()->count(),
        ));
    }
}
