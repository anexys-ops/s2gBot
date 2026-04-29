<?php

namespace Database\Seeders;

use App\Models\BonCommande;
use App\Models\BonCommandeLigne;
use App\Models\Catalogue\Article;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\Equipment;
use App\Models\ExpenseLine;
use App\Models\ExpenseReport;
use App\Models\Invoice;
use App\Models\InvoiceLine;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\OrdreMissionLigne;
use App\Models\PlanningHuman;
use App\Models\Quote;
use App\Models\QuoteLine;
use App\Models\Sample;
use App\Models\Site;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

/**
 * v1.2.0 — Jeu de données démo complet et idempotent.
 *
 * Crée pour chaque réinstall :
 *  - 5 dossiers (statuts variés) + 5 chantiers
 *  - 10 devis avec lignes catalogue
 *  - 5 bons de commande
 *  - 3 factures
 *  - 5 ordres de mission (2 terrain, 2 labo, 1 ingénieur)
 *  - Planning techniciens sur les 7 prochains jours
 *  - 10 échantillons FOLD (statuts variés)
 *  - Notes de frais sur 2 OdM
 *
 * Idempotence : tout passe par firstOrCreate / updateOrCreate sur des
 * références stables (préfixe `DEMO-…`). Relancer le seeder ne duplique pas.
 */
class FullDemoDataSeeder extends Seeder
{
    /** @var list<User> */
    private array $techniciens = [];

    private ?User $commercial = null;
    private ?User $ingenieur = null;
    private ?User $responsable = null;
    private ?User $receptionnaire = null;
    private ?User $laborantin = null;

    public function run(): void
    {
        $this->ensureUsers();

        $clients   = $this->ensureClients();
        $sites     = $this->ensureSites($clients);
        $dossiers  = $this->ensureDossiers($clients, $sites);
        $articles  = Article::query()->limit(20)->get();
        if ($articles->isEmpty()) {
            $this->command?->warn('FullDemoDataSeeder : aucun Article — exécuter CatalogueProLabSeeder + GeotechniqueV12Seeder avant.');
            return;
        }

        $quotes  = $this->ensureQuotes($clients, $dossiers, $articles);
        $bcs     = $this->ensureBonsCommande($quotes, $articles);
        $this->ensureInvoices($clients, $articles);
        $oms     = $this->ensureOrdresMission($bcs, $dossiers, $articles);
        $this->ensurePlanning($oms);
        $this->ensureSamples($dossiers, $oms, $articles);
        $this->ensureExpenseReports($oms);

        $this->command?->info('FullDemoDataSeeder OK.');
    }

    private function ensureUsers(): void
    {
        $defs = [
            ['email' => 'commercial@demo.local',     'name' => 'Sofia Commerciale',  'role' => User::ROLE_COMMERCIAL],
            ['email' => 'ingenieur@demo.local',      'name' => 'Hicham Ingénieur',   'role' => User::ROLE_INGENIEUR],
            ['email' => 'responsable@demo.local',    'name' => 'Naima Responsable',  'role' => User::ROLE_RESPONSABLE],
            ['email' => 'receptionnaire@demo.local', 'name' => 'Yassine Réception', 'role' => User::ROLE_RECEPTIONNAIRE],
            ['email' => 'laborantin@demo.local',     'name' => 'Rachida Laborantin','role' => User::ROLE_LABORANTIN],
        ];

        foreach ($defs as $d) {
            $u = User::firstOrCreate(
                ['email' => $d['email']],
                ['name' => $d['name'], 'password' => Hash::make('password'), 'role' => $d['role']]
            );
            match ($d['role']) {
                User::ROLE_COMMERCIAL     => $this->commercial = $u,
                User::ROLE_INGENIEUR      => $this->ingenieur = $u,
                User::ROLE_RESPONSABLE    => $this->responsable = $u,
                User::ROLE_RECEPTIONNAIRE => $this->receptionnaire = $u,
                User::ROLE_LABORANTIN     => $this->laborantin = $u,
                default                   => null,
            };
        }

        // Techniciens : on prend les @labo.ma (ProlabSeeder/MaterielDemoSeeder), sinon 4 par défaut.
        $this->techniciens = User::query()
            ->where(function ($q) {
                $q->where('email', 'like', '%@labo.ma')
                  ->orWhere('role', User::ROLE_LAB_TECHNICIAN);
            })
            ->orderBy('id')
            ->limit(6)
            ->get()
            ->all();

        if (count($this->techniciens) < 4) {
            for ($i = count($this->techniciens); $i < 4; $i++) {
                $this->techniciens[] = User::firstOrCreate(
                    ['email' => "tech-demo-$i@demo.local"],
                    [
                        'name'     => "Technicien Demo $i",
                        'password' => Hash::make('password'),
                        'role'     => User::ROLE_LAB_TECHNICIAN,
                    ]
                );
            }
        }
    }

    /** @return list<Client> */
    private function ensureClients(): array
    {
        $defs = [
            ['name' => 'DEMO Atlas BTP',       'city' => 'Casablanca', 'phone' => '+212 522 30 00 01', 'email' => 'contact@atlas-btp.demo'],
            ['name' => 'DEMO Sahara Travaux',  'city' => 'Marrakech',  'phone' => '+212 524 30 00 02', 'email' => 'contact@sahara-travaux.demo'],
            ['name' => 'DEMO Rif Ingénierie',  'city' => 'Tanger',     'phone' => '+212 539 30 00 03', 'email' => 'contact@rif-ing.demo'],
            ['name' => 'DEMO Royal Construction','city' => 'Rabat',    'phone' => '+212 537 30 00 04', 'email' => 'contact@royal-construction.demo'],
            ['name' => 'DEMO Phosphates BTP',  'city' => 'Khouribga',  'phone' => '+212 523 30 00 05', 'email' => 'contact@phosphates-btp.demo'],
        ];
        $out = [];
        foreach ($defs as $d) {
            $out[] = Client::firstOrCreate(
                ['name' => $d['name']],
                ['city' => $d['city'], 'phone' => $d['phone'], 'email' => $d['email'], 'address' => "Adresse {$d['city']}"],
            );
        }
        return $out;
    }

    /** @param list<Client> $clients @return list<Site> */
    private function ensureSites(array $clients): array
    {
        $defs = [
            ['name' => 'DEMO Chantier Casa-Marrakech',     'city' => 'Casablanca', 'lat' => 33.5731, 'lng' => -7.5898],
            ['name' => 'DEMO Viaduc Bouregreg',            'city' => 'Rabat',      'lat' => 34.0209, 'lng' => -6.8417],
            ['name' => 'DEMO Tour Atlas',                  'city' => 'Marrakech',  'lat' => 31.6295, 'lng' => -7.9811],
            ['name' => 'DEMO Plateforme logistique Tanger','city' => 'Tanger',     'lat' => 35.7595, 'lng' => -5.8340],
            ['name' => 'DEMO Mine Khouribga',              'city' => 'Khouribga',  'lat' => 32.8811, 'lng' => -6.9063],
        ];
        $out = [];
        foreach ($defs as $i => $d) {
            $client = $clients[$i % count($clients)];
            $out[] = Site::firstOrCreate(
                ['name' => $d['name']],
                [
                    'client_id' => $client->id,
                    'address'   => "Site {$d['city']}",
                    'latitude'  => $d['lat'],
                    'longitude' => $d['lng'],
                    'status'    => 'actif',
                ]
            );
        }
        return $out;
    }

    /** @param list<Client> $clients @param list<Site> $sites @return list<Dossier> */
    private function ensureDossiers(array $clients, array $sites): array
    {
        $statuts = [
            Dossier::STATUT_BROUILLON,
            Dossier::STATUT_EN_COURS,
            Dossier::STATUT_EN_COURS,
            Dossier::STATUT_CLOTURE,
            Dossier::STATUT_ARCHIVE,
        ];
        $out = [];
        foreach ($statuts as $i => $st) {
            $ref = sprintf('DEMO-DOS-%03d', $i + 1);
            $out[] = Dossier::firstOrCreate(
                ['reference' => $ref],
                [
                    'titre'      => "Dossier démo #" . ($i + 1),
                    'client_id'  => $clients[$i % count($clients)]->id,
                    'site_id'    => $sites[$i % count($sites)]->id,
                    'statut'     => $st,
                    'date_debut' => now()->subDays(30 + $i * 5)->toDateString(),
                    'date_fin_prevue' => now()->addDays(60 - $i * 5)->toDateString(),
                    'created_by' => $this->commercial?->id,
                ]
            );
        }
        return $out;
    }

    /**
     * @param list<Client> $clients
     * @param list<Dossier> $dossiers
     * @param \Illuminate\Support\Collection<int, Article> $articles
     * @return list<Quote>
     */
    private function ensureQuotes(array $clients, array $dossiers, $articles): array
    {
        $statuses = ['draft','sent','sent','accepted','accepted','accepted','rejected','accepted','draft','sent'];
        $out = [];
        for ($i = 0; $i < 10; $i++) {
            $number = sprintf('DEMO-DEV-%05d', $i + 1);
            $client = $clients[$i % count($clients)];
            $dossier = $dossiers[$i % count($dossiers)];

            $quote = Quote::firstOrCreate(
                ['number' => $number],
                [
                    'client_id'  => $client->id,
                    'dossier_id' => $dossier->id,
                    'quote_date' => now()->subDays(20 - $i)->toDateString(),
                    'valid_until' => now()->addDays(30)->toDateString(),
                    'status'     => $statuses[$i] ?? 'draft',
                    'notes'      => "Devis démo #" . ($i + 1),
                    'tva_rate'   => 20,
                ]
            );

            // 3 lignes par devis si vide
            if ($quote->quoteLines()->count() === 0) {
                $totalHt = 0.0;
                for ($k = 0; $k < 3; $k++) {
                    $art = $articles[($i * 3 + $k) % $articles->count()];
                    $qty = 1 + ($k + 1);
                    $pu  = (float) $art->prix_unitaire_ht;
                    $line = QuoteLine::create([
                        'quote_id'       => $quote->id,
                        'ref_article_id' => $art->id,
                        'type_ligne'     => 'article',
                        'description'    => $art->libelle,
                        'quantity'       => $qty,
                        'unit_price'     => $pu,
                        'tva_rate'       => 20,
                        'discount_percent' => 0,
                        'total'          => $qty * $pu,
                    ]);
                    $totalHt += $line->total;
                }
                $quote->update([
                    'amount_ht'  => $totalHt,
                    'amount_ttc' => $totalHt * 1.2,
                ]);
            }
            $out[] = $quote->refresh();
        }
        return $out;
    }

    /**
     * @param list<Quote> $quotes
     * @param \Illuminate\Support\Collection<int, Article> $articles
     * @return list<BonCommande>
     */
    private function ensureBonsCommande(array $quotes, $articles): array
    {
        $statuts = ['brouillon','confirme','confirme','livre_partiel','solde'];
        $out = [];
        for ($i = 0; $i < 5; $i++) {
            $numero = sprintf('DEMO-BC-%05d', $i + 1);
            $quote = $quotes[$i] ?? null;
            $bc = BonCommande::firstOrCreate(
                ['numero' => $numero],
                [
                    'quote_id'      => $quote?->id,
                    'dossier_id'    => $quote?->dossier_id,
                    'client_id'     => $quote?->client_id,
                    'statut'        => $statuts[$i],
                    'date_commande' => now()->subDays(10 - $i)->toDateString(),
                    'montant_ht'    => 0,
                    'montant_ttc'   => 0,
                    'tva_rate'      => 20,
                    'created_by'    => $this->commercial?->id ?? $this->responsable?->id,
                ]
            );
            if ($bc->lignes()->count() === 0) {
                $totalHt = 0.0;
                for ($k = 0; $k < 2; $k++) {
                    $art = $articles[($i * 2 + $k) % $articles->count()];
                    $qty = 2 + $k;
                    $pu  = (float) $art->prix_unitaire_ht;
                    $line = BonCommandeLigne::create([
                        'bon_commande_id'  => $bc->id,
                        'ref_article_id'   => $art->id,
                        'libelle'          => $art->libelle,
                        'ordre'            => $k + 1,
                        'quantite'         => $qty,
                        'prix_unitaire_ht' => $pu,
                        'tva_rate'         => 20,
                        'montant_ht'       => $qty * $pu,
                        'date_debut_prevue'=> now()->addDays(2)->toDateString(),
                        'date_fin_prevue'  => now()->addDays(5)->toDateString(),
                    ]);
                    $totalHt += $line->montant_ht;
                }
                $bc->update(['montant_ht' => $totalHt, 'montant_ttc' => $totalHt * 1.2]);
            }
            $out[] = $bc->refresh();
        }
        return $out;
    }

    /**
     * @param list<Client> $clients
     * @param \Illuminate\Support\Collection<int, Article> $articles
     */
    private function ensureInvoices(array $clients, $articles): void
    {
        $statuses = ['issued', 'paid', 'overdue'];
        for ($i = 0; $i < 3; $i++) {
            $number = sprintf('DEMO-FAC-%05d', $i + 1);
            $client = $clients[$i % count($clients)];
            $inv = Invoice::firstOrCreate(
                ['number' => $number],
                [
                    'client_id'    => $client->id,
                    'invoice_date' => now()->subDays(15 - $i * 3)->toDateString(),
                    'due_date'     => now()->addDays(15 - $i * 3)->toDateString(),
                    'tva_rate'     => 20,
                    'amount_ht'    => 0,
                    'amount_ttc'   => 0,
                    'status'       => $statuses[$i],
                ]
            );
            if ($inv->invoiceLines()->count() === 0) {
                $totalHt = 0.0;
                for ($k = 0; $k < 2; $k++) {
                    $art = $articles[($i * 2 + $k) % $articles->count()];
                    $qty = 1 + $k;
                    $pu  = (float) $art->prix_unitaire_ht;
                    InvoiceLine::create([
                        'invoice_id'  => $inv->id,
                        'description' => $art->libelle,
                        'quantity'    => $qty,
                        'unit_price'  => $pu,
                        'tva_rate'    => 20,
                        'discount_percent' => 0,
                        'total'       => $qty * $pu,
                    ]);
                    $totalHt += $qty * $pu;
                }
                $inv->update(['amount_ht' => $totalHt, 'amount_ttc' => $totalHt * 1.2]);
            }
        }
    }

    /**
     * @param list<BonCommande> $bcs
     * @param list<Dossier> $dossiers
     * @param \Illuminate\Support\Collection<int, Article> $articles
     * @return list<OrdreMission>
     */
    private function ensureOrdresMission(array $bcs, array $dossiers, $articles): array
    {
        $defs = [
            ['type' => OrdreMission::TYPE_TECHNICIEN, 'statut' => OrdreMission::STATUT_PLANIFIE],
            ['type' => OrdreMission::TYPE_TECHNICIEN, 'statut' => OrdreMission::STATUT_EN_COURS],
            ['type' => OrdreMission::TYPE_LABO,       'statut' => OrdreMission::STATUT_EN_COURS],
            ['type' => OrdreMission::TYPE_LABO,       'statut' => OrdreMission::STATUT_TERMINE],
            ['type' => OrdreMission::TYPE_INGENIEUR,  'statut' => OrdreMission::STATUT_PLANIFIE],
        ];
        $out = [];
        foreach ($defs as $i => $d) {
            $numero = sprintf('DEMO-OM-%s-%03d', strtoupper(substr($d['type'], 0, 3)), $i + 1);
            $bc      = $bcs[$i % count($bcs)] ?? null;
            $dossier = $dossiers[$i % count($dossiers)];
            $om = OrdreMission::firstOrCreate(
                ['numero' => $numero],
                [
                    'bon_commande_id' => $bc?->id,
                    'dossier_id'      => $dossier->id,
                    'client_id'       => $dossier->client_id,
                    'site_id'         => $dossier->site_id,
                    'type'            => $d['type'],
                    'statut'          => $d['statut'],
                    'date_prevue'     => now()->addDays(2 + $i)->toDateString(),
                    'responsable_id'  => $this->responsable?->id,
                    'created_by'      => $this->commercial?->id ?? $this->responsable?->id,
                ]
            );

            if ($om->lignes()->count() === 0) {
                for ($k = 0; $k < 2; $k++) {
                    $art = $articles[($i * 2 + $k) % $articles->count()];
                    $assignedUserId = $d['type'] === OrdreMission::TYPE_LABO
                        ? $this->laborantin?->id
                        : ($this->techniciens[$k % count($this->techniciens)]->id ?? null);
                    $ligne = OrdreMissionLigne::create([
                        'ordre_mission_id' => $om->id,
                        'ref_article_id'   => $art->id,
                        'libelle'          => $art->libelle,
                        'quantite'         => 1 + $k,
                        'statut'           => 'todo',
                        'assigned_user_id' => $assignedUserId,
                        'date_prevue'      => now()->addDays(2 + $i)->toDateString(),
                        'ordre'            => $k + 1,
                    ]);

                    // Crée une MissionTask par ligne pour activer Planning + Tâches.
                    MissionTask::create([
                        'ordre_mission_ligne_id' => $ligne->id,
                        'assigned_user_id'       => $assignedUserId,
                        'statut'                 => 'todo',
                        'planned_date'           => $ligne->date_prevue?->toDateString(),
                        'due_date'               => $ligne->date_prevue?->copy()->addDays(2)->toDateString(),
                    ]);
                }
            }

            $out[] = $om;
        }
        return $out;
    }

    /** @param list<OrdreMission> $oms */
    private function ensurePlanning(array $oms): void
    {
        if (! Schema::hasTable('planning_humans')) {
            return;
        }
        // Planning sur les 7 prochains jours pour les techniciens présents.
        foreach ($oms as $om) {
            $tasks = MissionTask::query()
                ->whereHas('ordreMissionLigne', fn ($q) => $q->where('ordre_mission_id', $om->id))
                ->limit(2)
                ->get();
            foreach ($tasks as $idx => $task) {
                if (count($this->techniciens) === 0) {
                    break;
                }
                $tech = $this->techniciens[$idx % count($this->techniciens)];
                $start = Carbon::today()->addDays($idx);

                // Idempotence : on cherche par user + task (uniques par OdM)
                // sans inclure la date dans la clé pour éviter les soucis
                // de format datetime/date entre runs.
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
                        'notes'          => 'Affectation démo',
                    ]);
                }
            }
        }
    }

    /**
     * @param list<Dossier> $dossiers
     * @param list<OrdreMission> $oms
     * @param \Illuminate\Support\Collection<int, Article> $articles
     */
    private function ensureSamples(array $dossiers, array $oms, $articles): void
    {
        $types       = Sample::TYPES;
        $statuts     = Sample::STATUSES_RECEPTION;

        // SQLite (CI) ne supporte pas l'ALTER COLUMN sans rebuild — `samples.order_item_id`
        // y reste NOT NULL. On fournit un OrderItem de secours, et si aucun
        // n'existe on saute simplement la création des samples (CI passera
        // quand même ; en prod MySQL la colonne est nullable).
        $fallbackOrderItemId = null;
        if (Schema::getConnection()->getDriverName() === 'sqlite' && Schema::hasColumn('samples', 'order_item_id')) {
            $fallbackOrderItemId = \App\Models\OrderItem::query()->orderBy('id')->value('id');
            if ($fallbackOrderItemId === null) {
                $this->command?->warn('FullDemoDataSeeder : SQLite + samples.order_item_id NOT NULL et aucun OrderItem — skip échantillons.');
                return;
            }
        }

        for ($i = 0; $i < 10; $i++) {
            $reference = sprintf('DEMO-SMP-%03d', $i + 1);
            $dossier = $dossiers[$i % count($dossiers)];
            $om      = $oms[$i % count($oms)];
            $type    = $types[$i % count($types)];
            $status  = $statuts[$i % count($statuts)];
            Sample::firstOrCreate(
                ['reference' => $reference],
                array_filter([
                    'order_item_id'    => $fallbackOrderItemId,
                ], fn ($v) => $v !== null) + [
                    'dossier_id'       => $dossier->id,
                    'mission_order_id' => $om->id,
                    'product_id'       => $articles[$i % $articles->count()]->id,
                    'description'      => "Échantillon démo #" . ($i + 1) . " — type {$type}",
                    'sample_type'      => $type,
                    'origin_location'  => "Profondeur " . (0.5 * ($i + 1)) . " m — site démo",
                    'depth_m'          => 0.5 * ($i + 1),
                    'collected_by'     => $this->techniciens[$i % count($this->techniciens)]->id ?? null,
                    'collected_at'     => now()->subDays(7 - ($i % 7)),
                    'received_by'      => in_array($status, [Sample::STATUS_RECEPTIONNE, Sample::STATUS_EN_ESSAI, Sample::STATUS_TERMINE], true)
                        ? $this->receptionnaire?->id
                        : null,
                    'received_at'      => in_array($status, [Sample::STATUS_RECEPTIONNE, Sample::STATUS_EN_ESSAI, Sample::STATUS_TERMINE], true)
                        ? now()->subDays(3 - ($i % 3))
                        : null,
                    'status'           => $status,
                    'condition_state'  => 'bon',
                    'storage_location' => "Étagère " . chr(65 + ($i % 5)) . "-" . ($i + 1),
                    'weight_g'         => 1500 + $i * 250,
                    'quantity'         => 1,
                    'notes'            => 'Échantillon de démo généré par FullDemoDataSeeder',
                ]
            );
        }
    }

    /** @param list<OrdreMission> $oms */
    private function ensureExpenseReports(array $oms): void
    {
        $cibles = array_values(array_filter(
            $oms,
            fn (OrdreMission $om) => in_array($om->type, [OrdreMission::TYPE_TECHNICIEN, OrdreMission::TYPE_INGENIEUR], true)
        ));

        foreach (array_slice($cibles, 0, 2) as $i => $om) {
            $report = ExpenseReport::firstOrCreate(
                [
                    'ordre_mission_id' => $om->id,
                    'created_by'       => $this->techniciens[$i]->id ?? $this->commercial?->id,
                ],
                [
                    'statut' => $i === 0 ? 'brouillon' : 'soumis',
                    'notes'  => "Frais de déplacement OdM {$om->numero}",
                ]
            );

            if ($report->wasRecentlyCreated) {
                $cats = ['essence' => 350, 'hotel' => 800, 'repas' => 220, 'peage' => 95, 'voyage' => 1200];
                foreach ($cats as $cat => $amount) {
                    ExpenseLine::create([
                        'expense_report_id' => $report->id,
                        'user_id'           => $report->created_by,
                        'category'          => $cat,
                        'amount'            => $amount,
                        'date'              => now()->subDays(rand(1, 6))->toDateString(),
                        'description'       => "Frais {$cat} mission {$om->numero}",
                    ]);
                }
            }
        }
    }
}
