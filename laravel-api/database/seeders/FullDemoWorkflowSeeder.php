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

        // ── 0. Enrichir TOUS les articles (description / tags) ─────────────
        // Beaucoup d'articles sortent du HFSQL/PROLAB sans description ni
        // description technique : on remplit ces champs vides pour que la
        // fiche article ne soit plus vide en UI.
        $this->enrichArticles();

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

        // ── 6. Échantillons FOLD liés aux dossiers ─────────────────────────
        $this->ensureSamples($dossiers, $oms, $articles, $techniciens);

        $this->command?->info(sprintf(
            'FullDemoWorkflowSeeder OK : %d dossiers, %d BC, %d OdM, %d tasks, %d plannings, %d NDF, %d samples.',
            count($dossiers),
            count($bcs),
            count($oms),
            MissionTask::query()->count(),
            PlanningHuman::query()->count(),
            ExpenseReport::query()->count(),
            Sample::query()->count(),
        ));
    }

    /**
     * Remplit description / description_commerciale / description_technique
     * et tags pour les articles dont ces champs sont vides — sans toucher
     * aux articles déjà documentés.
     */
    private function enrichArticles(): void
    {
        $hasCom    = Schema::hasColumn('ref_articles', 'description_commerciale');
        $hasTech   = Schema::hasColumn('ref_articles', 'description_technique');
        $hasTags   = Schema::hasColumn('ref_articles', 'tags');

        $tagsByFamilleCode = [
            'GEO_BETON'   => ['béton', 'résistance', 'éprouvette'],
            'GEO_SOL'     => ['sol', 'géotechnique', 'laboratoire'],
            'GEO_IN_SITU' => ['terrain', 'in situ', 'sondage'],
            'GEO_CHIMIE'  => ['chimie', 'analyse', 'dosage'],
            'BETON'       => ['béton', 'NF EN 12390'],
            'PROCTOR'     => ['proctor', 'compactage'],
            'COMPACTAGE'  => ['compactage', 'CBR'],
            'IDR'         => ['indice', 'dr'],
            'IP'          => ['indice', 'plasticité'],
            'AG'          => ['agrégats', 'graves'],
        ];

        Article::query()->with('famille:id,code,libelle')->chunk(100, function ($chunk) use ($hasCom, $hasTech, $hasTags, $tagsByFamilleCode) {
            foreach ($chunk as $art) {
                $patch = [];
                $famLib = $art->famille?->libelle ?? 'essai géotechnique';
                $famCode = $art->famille?->code;

                if (empty($art->description)) {
                    $patch['description'] = sprintf(
                        "%s — %s. Réalisé selon %s. Article catalogue PROLAB destiné aux laboratoires de géotechnique BTP.",
                        $art->libelle,
                        $famLib,
                        $art->normes ?: 'normes en vigueur'
                    );
                }
                if ($hasCom && empty($art->description_commerciale)) {
                    $patch['description_commerciale'] = sprintf(
                        "Prestation %s — durée estimée %d min, prix unitaire %.2f €. Famille : %s.",
                        $art->libelle,
                        (int) ($art->duree_estimee ?? 0),
                        (float) ($art->prix_unitaire_ht ?? 0),
                        $famLib,
                    );
                }
                if ($hasTech && empty($art->description_technique)) {
                    $patch['description_technique'] = sprintf(
                        "Mode opératoire selon %s. Code interne : %s. Unité : %s. Famille : %s.",
                        $art->normes ?: 'norme à préciser',
                        $art->code,
                        $art->unite ?: 'U',
                        $famLib,
                    );
                }
                if ($hasTags && (empty($art->tags) || $art->tags === [])) {
                    $tags = $tagsByFamilleCode[$famCode] ?? ['catalogue', 'essai'];
                    $patch['tags'] = $tags;
                }

                if ($patch) {
                    $art->fill($patch)->save();
                }
            }
        });
    }

    /**
     * @param list<Dossier>             $dossiers
     * @param list<OrdreMission>        $oms
     * @param \Illuminate\Support\Collection<int, Article> $articles
     * @param \Illuminate\Support\Collection<int, User>    $techniciens
     */
    private function ensureSamples(array $dossiers, array $oms, $articles, $techniciens): void
    {
        $types   = Sample::TYPES;
        $statuts = Sample::STATUSES_RECEPTION;

        // En prod MySQL, samples.order_item_id est nullable depuis la migration
        // 2026_04_29_120000_extend_samples_for_reception (driver-aware ALTER).
        // Sur SQLite (CI), rester compatible NOT NULL : passer un order_item_id
        // existant si dispo, sinon skip.
        $fallbackOrderItemId = null;
        if (Schema::getConnection()->getDriverName() === 'sqlite' && Schema::hasColumn('samples', 'order_item_id')) {
            $fallbackOrderItemId = \App\Models\OrderItem::query()->value('id');
            if ($fallbackOrderItemId === null) {
                return;
            }
        }

        for ($i = 0; $i < 10; $i++) {
            $reference = sprintf('DEMOWF-SMP-%03d', $i + 1);
            $dossier = $dossiers[$i % count($dossiers)] ?? null;
            $om      = $oms[$i % max(count($oms), 1)] ?? null;
            $payload = array_filter([
                'order_item_id' => $fallbackOrderItemId,
            ], fn ($v) => $v !== null) + [
                'dossier_id'       => $dossier?->id,
                'mission_order_id' => $om?->id,
                'product_id'       => $articles[$i % $articles->count()]->id,
                'description'      => 'Échantillon workflow #' . ($i + 1),
                'sample_type'      => $types[$i % count($types)],
                'origin_location'  => 'Site démo — point #' . ($i + 1),
                'depth_m'          => 0.5 * ($i + 1),
                'collected_by'     => $techniciens[$i % max($techniciens->count(), 1)]->id ?? null,
                'collected_at'     => now()->subDays(7 - ($i % 7)),
                'status'           => $statuts[$i % count($statuts)],
                'condition_state'  => 'bon',
                'storage_location' => 'Étagère ' . chr(65 + ($i % 5)) . '-' . ($i + 1),
                'weight_g'         => 1500 + $i * 200,
                'quantity'         => 1,
                'notes'            => 'Échantillon de démo workflow.',
            ];
            Sample::firstOrCreate(['reference' => $reference], $payload);
        }
    }
}
