<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\ArticleAction;
use App\Models\ArticleEquipmentRequirement;
use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Equipment;
use App\Models\OrderItem;
use App\Models\ReportFormDefinition;
use App\Models\Sample;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * v1.2.0 — LIMS géotechnique complet :
 *   • 4 familles métier   (Béton, Sol, In Situ, Chimique)
 *   • 40 essais normés    (10 béton + 15 sol + 10 in situ + 5 chimiques)
 *   • 20 matériels        (presse, CBR, triaxial, oedomètre, carotteuse, pressiomètre…)
 *   • 10 prélèvements     démo
 *   • Templates de fiches techniques (formulaires dynamiques)
 *
 * Idempotent : updateOrCreate / firstOrCreate.
 */
class GeotechniqueV12Seeder extends Seeder
{
    public function run(): void
    {
        $familles  = $this->seedFamilles();
        $articles  = $this->seedEssais($familles);
        $equipments = $this->seedMateriel();
        $this->seedPrelevements($articles);
        $this->seedFormTemplates();
        $this->linkActionsAndEquipement($articles, $equipments);
    }

    /** @return array<string, FamilleArticle> */
    private function seedFamilles(): array
    {
        $defs = [
            ['code' => 'GEO_BETON',    'libelle' => 'Essais Béton',    'color' => '#3B82F6', 'type_ressource' => 'labo',       'ordre' => 100],
            ['code' => 'GEO_SOL',      'libelle' => 'Essais Sol',      'color' => '#A16207', 'type_ressource' => 'labo',       'ordre' => 110],
            ['code' => 'GEO_IN_SITU',  'libelle' => 'Essais In Situ',  'color' => '#15803D', 'type_ressource' => 'technicien', 'ordre' => 120],
            ['code' => 'GEO_CHIMIE',   'libelle' => 'Essais Chimiques','color' => '#9333EA', 'type_ressource' => 'labo',       'ordre' => 130],
        ];
        $out = [];
        foreach ($defs as $f) {
            $out[$f['code']] = FamilleArticle::query()->updateOrCreate(
                ['code' => $f['code']],
                [
                    'libelle'        => $f['libelle'],
                    'color'          => $f['color'],
                    'type_ressource' => $f['type_ressource'],
                    'ordre'          => $f['ordre'],
                    'actif'          => true,
                ]
            );
        }
        return $out;
    }

    /**
     * @param  array<string, FamilleArticle>  $familles
     * @return array<string, Article>
     */
    private function seedEssais(array $familles): array
    {
        // [code, libelle, normes, prix, durée_min, unite]
        $essais = [
            // ── 10 Béton ────────────────────────────────────────────────────
            ['GEO_BETON', 'BET-FC28',     'Résistance compression 28j sur cylindre',     'NF EN 12390-3',  90.00,   90, 'éprouvette'],
            ['GEO_BETON', 'BET-FC7',      'Résistance compression 7j sur cylindre',      'NF EN 12390-3',  85.00,   90, 'éprouvette'],
            ['GEO_BETON', 'BET-FCT',      'Résistance traction par fendage',             'NF EN 12390-6', 110.00,  120, 'éprouvette'],
            ['GEO_BETON', 'BET-FLEX',     'Résistance flexion 3 points sur poutrelle',   'NF EN 12390-5', 120.00,  120, 'éprouvette'],
            ['GEO_BETON', 'BET-CONS',     'Consistance affaissement (Slump test)',       'NF EN 12350-2',  35.00,   20, 'essai'],
            ['GEO_BETON', 'BET-AIR',      "Air occlus du béton frais",                   'NF EN 12350-7',  45.00,   25, 'essai'],
            ['GEO_BETON', 'BET-MV',       'Masse volumique apparente du béton durci',    'NF EN 12390-7',  55.00,   60, 'éprouvette'],
            ['GEO_BETON', 'BET-MOD',      "Module d'élasticité statique",                'NF EN 12390-13',180.00,  180, 'éprouvette'],
            ['GEO_BETON', 'BET-CARBO',    'Profondeur de carbonatation',                 'NF EN 14630',    95.00,   45, 'éprouvette'],
            ['GEO_BETON', 'BET-PERM',     "Perméabilité à l'eau sous pression",          'NF EN 12390-8', 140.00,  120, 'éprouvette'],

            // ── 15 Sol (laboratoire) ────────────────────────────────────────
            ['GEO_SOL', 'SOL-W',          "Teneur en eau pondérale",                     'NF P 94-050',    35.00,   30, 'essai'],
            ['GEO_SOL', 'SOL-MV',         'Masse volumique humide / sèche',              'NF P 94-053',    40.00,   45, 'essai'],
            ['GEO_SOL', 'SOL-GRANULO',    'Analyse granulométrique par tamisage',        'NF P 94-056',    85.00,   90, 'essai'],
            ['GEO_SOL', 'SOL-SEDIM',      'Analyse granulométrique par sédimentation',   'NF P 94-057',   140.00,  240, 'essai'],
            ['GEO_SOL', 'SOL-LL',         "Limite de liquidité Casagrande",              'NF P 94-051',    65.00,   90, 'essai'],
            ['GEO_SOL', 'SOL-LP',         "Limite de plasticité (rouleau)",              'NF P 94-051',    50.00,   60, 'essai'],
            ['GEO_SOL', 'SOL-VBS',        "Valeur de bleu de méthylène (VBS)",           'NF P 94-068',    75.00,   60, 'essai'],
            ['GEO_SOL', 'SOL-ES',         "Équivalent de sable",                         'NF EN 933-8',    60.00,   45, 'essai'],
            ['GEO_SOL', 'SOL-PROC-N',     'Proctor normal',                              'NF P 94-093',   110.00,  240, 'essai'],
            ['GEO_SOL', 'SOL-PROC-M',     'Proctor modifié',                             'NF P 94-093',   120.00,  240, 'essai'],
            ['GEO_SOL', 'SOL-CBR',        "Indice CBR après immersion",                  'NF P 94-078',   180.00,  360, 'essai'],
            ['GEO_SOL', 'SOL-IPI',        "Indice Portant Immédiat (IPI)",               'NF P 94-078',    95.00,  120, 'essai'],
            ['GEO_SOL', 'SOL-OEDO',       'Essai œdométrique à chargement par paliers',  'NF P 94-090-1', 320.00, 1440, 'essai'],
            ['GEO_SOL', 'SOL-CISAIL',    "Cisaillement rectiligne à la boîte (CD)",      'NF P 94-071-1', 280.00,  720, 'essai'],
            ['GEO_SOL', 'SOL-TRIAX',      'Triaxial UU / CU / CD',                       'NF P 94-074',   480.00, 1440, 'essai'],

            // ── 10 In Situ ──────────────────────────────────────────────────
            ['GEO_IN_SITU', 'INS-DENS',   'Densité en place au densitomètre à membrane', 'NF P 94-061-1',  95.00,   45, 'point'],
            ['GEO_IN_SITU', 'INS-GAMMA',  "Densité en place gammadensimètre nucléaire",  'NF P 94-062',    85.00,   30, 'point'],
            ['GEO_IN_SITU', 'INS-SABLE',  'Densité en place au sable',                   'NF P 94-061-2',  90.00,   60, 'point'],
            ['GEO_IN_SITU', 'INS-PMT',    'Essai pressiométrique Ménard',                'NF EN ISO 22476-4', 220.00, 60, 'palier'],
            ['GEO_IN_SITU', 'INS-PDL',    'Pénétromètre dynamique léger PANDA',          'NF P 94-105',   140.00,   45, 'sondage'],
            ['GEO_IN_SITU', 'INS-PDM',    'Pénétromètre dynamique lourd (DPSH)',         'NF EN ISO 22476-2', 180.00, 90, 'sondage'],
            ['GEO_IN_SITU', 'INS-CPT',    'Pénétromètre statique CPT',                   'NF EN ISO 22476-1', 260.00, 120, 'sondage'],
            ['GEO_IN_SITU', 'INS-PLAQ',   'Essai à la plaque (Westergaard / EV2)',       'NF P 94-117-1', 160.00,   60, 'point'],
            ['GEO_IN_SITU', 'INS-LEFR',   "Essai d'eau Lefranc",                         'NF X 30-423',   210.00,  180, 'essai'],
            ['GEO_IN_SITU', 'INS-LUG',    'Essai Lugeon',                                'NF EN ISO 22282-3', 280.00, 240, 'essai'],

            // ── 5 Chimiques ─────────────────────────────────────────────────
            ['GEO_CHIMIE', 'CHM-SO4',     'Teneur en sulfates solubles',                 'NF EN 1744-1',   75.00,  120, 'analyse'],
            ['GEO_CHIMIE', 'CHM-CL',      'Teneur en chlorures solubles',                'NF EN 1744-1',   70.00,  120, 'analyse'],
            ['GEO_CHIMIE', 'CHM-MO',      'Teneur en matières organiques',               'NF P 94-055',    65.00,   90, 'analyse'],
            ['GEO_CHIMIE', 'CHM-CACO3',   "Teneur en carbonates (CaCO₃)",                'NF EN 196-2',    60.00,   90, 'analyse'],
            ['GEO_CHIMIE', 'CHM-PH',      'pH et conductivité électrique',               'NF ISO 10390',   45.00,   30, 'analyse'],
        ];

        $out = [];
        foreach ($essais as [$familleCode, $code, $libelle, $normes, $prix, $duree, $unite]) {
            $famille = $familles[$familleCode] ?? null;
            if (!$famille) {
                continue;
            }
            $art = Article::query()->updateOrCreate(
                ['code' => $code],
                [
                    'ref_famille_article_id' => $famille->id,
                    'libelle'                => $libelle,
                    'normes'                 => $normes,
                    'prix_unitaire_ht'       => $prix,
                    'duree_estimee'          => $duree,
                    'unite'                  => $unite,
                    'tva_rate'               => 20,
                    'actif'                  => true,
                ]
            );
            $out[$code] = $art;
        }
        return $out;
    }

    /** @return array<string, Equipment> */
    private function seedMateriel(): array
    {
        if (! Schema::hasTable('equipments')) {
            return [];
        }

        $agency = Agency::query()->orderBy('id')->first();

        // 20 matériels géotechnique : presse, CBR, triaxial, oedomètre, carotteuse, pressiomètre, tamis, Proctor…
        $defs = [
            ['MAT-PRESSE-3000', 'Presse hydraulique 3000 kN',          'appareil_mesure', 'laboratoire', 'Compression béton — Controls C56-Z00'],
            ['MAT-PRESSE-FLEX', 'Presse flexion 100 kN',               'appareil_mesure', 'laboratoire', 'Flexion poutrelles béton'],
            ['MAT-CBR-50',      'Presse CBR / Marshall 50 kN',         'appareil_mesure', 'laboratoire', 'Indice CBR / IPI'],
            ['MAT-TRIAX',       'Cellule triaxiale 100 kN',            'appareil_mesure', 'laboratoire', 'Triaxial UU/CU/CD — GDS / Wykeham'],
            ['MAT-OEDO',        'Bâti œdométrique haute capacité',     'appareil_mesure', 'laboratoire', 'Consolidation — paliers automatiques'],
            ['MAT-CISAIL',      'Boîte de cisaillement 60×60 mm',      'appareil_mesure', 'laboratoire', 'Cisaillement direct'],
            ['MAT-PROCTOR',     'Moule Proctor + dame automatique',    'appareil_mesure', 'laboratoire', 'Proctor normal / modifié'],
            ['MAT-TAMIS',       'Tamiseuse vibrante + colonne tamis',  'appareil_mesure', 'laboratoire', 'Granulométrie 0,063 → 80 mm'],
            ['MAT-BAL-PREC',    'Balance de précision 6 kg / 0,01 g',  'appareil_mesure', 'laboratoire', 'Pesées teneur en eau / granulo'],
            ['MAT-ETUVE',       'Étuve ventilée 105 °C — 250 L',       'appareil_mesure', 'laboratoire', 'Séchage échantillons sols'],
            ['MAT-CASA',        'Appareil de Casagrande motorisé',     'appareil_mesure', 'laboratoire', 'Limite de liquidité'],
            ['MAT-VBS-KIT',     "Banc d'essai bleu de méthylène (VBS)",'appareil_mesure', 'laboratoire', 'NF P 94-068'],
            ['MAT-CAROT',       'Carotteuse thermique 350 mm',         'outil_terrain',   'terrain',     'Carottage béton'],
            ['MAT-PRESS-MEN',   'Pressiomètre Ménard GC',              'appareil_mesure', 'terrain',     'Essai pressiométrique en forage'],
            ['MAT-PANDA',       'Pénétromètre dynamique PANDA 2',      'appareil_mesure', 'terrain',     'Sondages PDL — NF P 94-105'],
            ['MAT-DPSH',        'Pénétromètre dynamique lourd DPSH',   'appareil_mesure', 'terrain',     'Sondage dynamique lourd'],
            ['MAT-CPT',         'Camion CPT 20 tonnes',                'vehicule',        'parc',        'Pénétration statique'],
            ['MAT-DENS-MEM',    'Densitomètre à membrane',             'appareil_mesure', 'terrain',     'Densité en place — NF P 94-061-1'],
            ['MAT-GAMMA',       'Gammadensimètre nucléaire Troxler',   'appareil_mesure', 'terrain',     'Densité in situ — radiation'],
            ['MAT-PLAQ',        "Plaque d'essai Westergaard 600 mm",   'appareil_mesure', 'terrain',     'EV2 / coefficient de réaction'],
        ];

        $out = [];
        foreach ($defs as [$code, $name, $categorie, $location, $notes]) {
            $payload = [
                'name'      => $name,
                'type'      => $categorie,
                'location'  => $location,
                'status'    => Equipment::STATUS_ACTIVE,
                'agency_id' => $agency?->id,
            ];
            if (Schema::hasColumn('equipments', 'categorie')) {
                $payload['categorie'] = $categorie;
            }
            if (Schema::hasColumn('equipments', 'notes')) {
                $payload['notes'] = $notes;
            }

            $out[$code] = Equipment::query()->updateOrCreate(['code' => $code], $payload);
        }
        return $out;
    }

    /** @param array<string, Article> $articles */
    private function seedPrelevements(array $articles): void
    {
        if (! Schema::hasTable('samples') || ! Schema::hasTable('order_items')) {
            return;
        }

        // Find an existing order_item to attach samples to (samples.order_item_id is required).
        // On ne crée pas de commande factice si la base n'a pas encore été initialisée par les autres seeders.
        $orderItem = OrderItem::query()->orderBy('id')->first();
        if (!$orderItem) {
            return;
        }

        $candidates = [
            ['SOL-PRO-001', 'Prélèvement sol couche A — autoroute Casa-Marrakech',     0.0,  1.5,  'SOL-PROC-N'],
            ['SOL-PRO-002', 'Prélèvement sol couche B — autoroute Casa-Marrakech',     1.5,  3.0,  'SOL-PROC-N'],
            ['BET-PRO-001', 'Béton C30/37 — pile P3 viaduc',                            0.0,  0.0,  'BET-FC28'],
            ['BET-PRO-002', 'Béton C25/30 — radier station de pompage',                 0.0,  0.0,  'BET-FC28'],
            ['SOL-PRO-003', 'Carotte sol fin — site logistique Tanger',                 2.0,  4.0,  'SOL-OEDO'],
            ['SOL-PRO-004', 'Sondage SC-12 / 4-6 m — sol argileux',                     4.0,  6.0,  'SOL-CISAIL'],
            ['GRA-PRO-001', 'Grave non traitée 0/31.5 — carrière Sidi Hajjaj',          0.0,  0.0,  'SOL-GRANULO'],
            ['GRA-PRO-002', 'Sable concassé 0/4 — usine BPE Casablanca',                0.0,  0.0,  'SOL-ES'],
            ['SOL-PRO-005', 'Sol limoneux — projet ferroviaire LGV Kenitra',            0.5,  2.0,  'SOL-VBS'],
            ['BET-PRO-003', 'Carotte béton ouvrage existant — pont Bouregreg',         0.10, 0.30, 'BET-CARBO'],
        ];

        foreach ($candidates as [$ref, $note, $depthTop, $depthBottom, $essaiCode]) {
            $article = $articles[$essaiCode] ?? null;

            Sample::query()->updateOrCreate(
                ['reference' => $ref],
                [
                    'order_item_id'   => $orderItem->id,
                    'received_at'     => now()->subDays(rand(1, 30))->toDateString(),
                    'status'          => Sample::STATUS_RECEIVED,
                    'notes'           => $note . ($article ? " — essai prévu : {$article->libelle}" : ''),
                    'depth_top_m'     => $depthTop,
                    'depth_bottom_m'  => $depthBottom,
                ]
            );
        }
    }

    /**
     * Templates de fiches techniques (formulaires dynamiques).
     * Les FormTemplate sont stockés via ReportFormDefinition (modèle existant).
     */
    private function seedFormTemplates(): void
    {
        if (! class_exists(ReportFormDefinition::class) || ! Schema::hasTable('report_form_definitions')) {
            return;
        }

        $defs = [
            [
                'slug' => 'fiche-bet-fc28',
                'name' => 'Fiche essai — Compression béton 28j',
                'service_key' => 'labo',
                'fields' => [
                    ['key' => 'reference_eprouvette', 'type' => 'text',   'label' => 'Réf. éprouvette',  'required' => true],
                    ['key' => 'date_confection',      'type' => 'text',   'label' => 'Date confection'],
                    ['key' => 'date_essai',           'type' => 'text',   'label' => "Date d'essai"],
                    ['key' => 'diametre_mm',          'type' => 'number', 'label' => 'Diamètre (mm)',    'unit' => 'mm'],
                    ['key' => 'hauteur_mm',           'type' => 'number', 'label' => 'Hauteur (mm)',     'unit' => 'mm'],
                    ['key' => 'masse_g',              'type' => 'number', 'label' => 'Masse (g)',        'unit' => 'g'],
                    ['key' => 'force_kn',             'type' => 'number', 'label' => 'Force rupture',    'unit' => 'kN', 'required' => true],
                    ['key' => 'fc_mpa',               'type' => 'number', 'label' => 'Résistance fc',    'unit' => 'MPa', 'computed' => true],
                    ['key' => 'photo_eprouvette',     'type' => 'photo',  'label' => 'Photo éprouvette'],
                    ['key' => 'observations',         'type' => 'text',   'label' => 'Observations',     'multiline' => true],
                ],
            ],
            [
                'slug' => 'fiche-sol-proctor',
                'name' => 'Fiche essai — Proctor normal / modifié',
                'service_key' => 'labo',
                'fields' => [
                    ['key' => 'reference_echantillon','type' => 'text',   'label' => 'Réf. échantillon', 'required' => true],
                    ['key' => 'type_proctor',         'type' => 'text',   'label' => 'Type (normal / modifié)'],
                    ['key' => 'mesures_paliers',      'type' => 'table',  'label' => 'Paliers',
                     'columns' => [
                         ['key' => 'palier',  'label' => 'Palier'],
                         ['key' => 'w',       'label' => 'Teneur en eau (%)'],
                         ['key' => 'gd',      'label' => 'Densité sèche (g/cm³)'],
                     ],
                    ],
                    ['key' => 'courbe_proctor',       'type' => 'graph',  'label' => 'Courbe Proctor (γd vs w)',
                     'x' => 'w', 'y' => 'gd', 'source' => 'mesures_paliers'],
                    ['key' => 'wopt',                 'type' => 'number', 'label' => "Teneur en eau optimum", 'unit' => '%', 'computed' => true],
                    ['key' => 'gd_max',               'type' => 'number', 'label' => 'Densité sèche max',     'unit' => 'g/cm³', 'computed' => true],
                ],
            ],
            [
                'slug' => 'fiche-ins-densite',
                'name' => 'Fiche terrain — Densité en place',
                'service_key' => 'terrain',
                'fields' => [
                    ['key' => 'point',                'type' => 'text',   'label' => 'N° point',          'required' => true],
                    ['key' => 'coordonnees',          'type' => 'coordinates', 'label' => 'Coordonnées GPS'],
                    ['key' => 'profondeur_m',         'type' => 'number', 'label' => 'Profondeur (m)',    'unit' => 'm'],
                    ['key' => 'volume_cm3',           'type' => 'number', 'label' => 'Volume (cm³)',      'unit' => 'cm³'],
                    ['key' => 'masse_humide_g',       'type' => 'number', 'label' => 'Masse humide (g)',  'unit' => 'g'],
                    ['key' => 'masse_seche_g',        'type' => 'number', 'label' => 'Masse sèche (g)',   'unit' => 'g'],
                    ['key' => 'gd_kg_m3',             'type' => 'number', 'label' => 'γd (kg/m³)',        'unit' => 'kg/m³', 'computed' => true],
                    ['key' => 'compactage_pct',       'type' => 'number', 'label' => '% compactage',      'unit' => '%',     'computed' => true],
                    ['key' => 'photo_essai',          'type' => 'photo',  'label' => 'Photo essai'],
                    ['key' => 'fiche_etalonnage',     'type' => 'file',   'label' => "Fiche étalonnage gammadensimètre"],
                ],
            ],
            [
                'slug' => 'fiche-ins-pmt',
                'name' => 'Fiche terrain — Pressiomètre Ménard',
                'service_key' => 'terrain',
                'fields' => [
                    ['key' => 'sondage',              'type' => 'text',   'label' => 'N° sondage',  'required' => true],
                    ['key' => 'coordonnees',          'type' => 'coordinates', 'label' => 'Coordonnées GPS'],
                    ['key' => 'paliers',              'type' => 'table',  'label' => 'Paliers de chargement',
                     'columns' => [
                         ['key' => 'pression', 'label' => 'Pression (MPa)'],
                         ['key' => 'volume',   'label' => 'Volume (cm³)'],
                     ],
                    ],
                    ['key' => 'courbe',               'type' => 'graph',  'label' => 'Courbe pressiométrique',
                     'x' => 'pression', 'y' => 'volume', 'source' => 'paliers'],
                    ['key' => 'em_mpa',               'type' => 'number', 'label' => 'Module Em',     'unit' => 'MPa', 'computed' => true],
                    ['key' => 'pl_mpa',               'type' => 'number', 'label' => 'Pression limite Pl', 'unit' => 'MPa', 'computed' => true],
                ],
            ],
        ];

        foreach ($defs as $d) {
            ReportFormDefinition::query()->updateOrCreate(
                ['slug' => $d['slug']],
                [
                    'name'        => $d['name'],
                    'service_key' => $d['service_key'],
                    'fields'      => $d['fields'],
                    'active'      => true,
                ]
            );
        }
    }

    /**
     * @param array<string, Article>   $articles
     * @param array<string, Equipment> $equipments
     */
    private function linkActionsAndEquipement(array $articles, array $equipments): void
    {
        // Mapping article → matériel(s) requis
        $reqs = [
            'BET-FC28'    => ['MAT-PRESSE-3000', 'MAT-BAL-PREC'],
            'BET-FC7'     => ['MAT-PRESSE-3000', 'MAT-BAL-PREC'],
            'BET-FCT'     => ['MAT-PRESSE-3000'],
            'BET-FLEX'    => ['MAT-PRESSE-FLEX'],
            'BET-CONS'    => [],
            'SOL-W'       => ['MAT-ETUVE', 'MAT-BAL-PREC'],
            'SOL-GRANULO' => ['MAT-TAMIS', 'MAT-BAL-PREC', 'MAT-ETUVE'],
            'SOL-LL'      => ['MAT-CASA'],
            'SOL-VBS'     => ['MAT-VBS-KIT'],
            'SOL-PROC-N'  => ['MAT-PROCTOR', 'MAT-BAL-PREC', 'MAT-ETUVE'],
            'SOL-PROC-M'  => ['MAT-PROCTOR', 'MAT-BAL-PREC', 'MAT-ETUVE'],
            'SOL-CBR'     => ['MAT-CBR-50', 'MAT-PROCTOR'],
            'SOL-IPI'     => ['MAT-CBR-50'],
            'SOL-OEDO'    => ['MAT-OEDO', 'MAT-BAL-PREC'],
            'SOL-CISAIL'  => ['MAT-CISAIL'],
            'SOL-TRIAX'   => ['MAT-TRIAX'],
            'INS-DENS'    => ['MAT-DENS-MEM'],
            'INS-GAMMA'   => ['MAT-GAMMA'],
            'INS-SABLE'   => ['MAT-DENS-MEM'],
            'INS-PMT'     => ['MAT-PRESS-MEN'],
            'INS-PDL'     => ['MAT-PANDA'],
            'INS-PDM'     => ['MAT-DPSH'],
            'INS-CPT'     => ['MAT-CPT'],
            'INS-PLAQ'    => ['MAT-PLAQ'],
        ];

        foreach ($reqs as $artCode => $eqCodes) {
            $art = $articles[$artCode] ?? null;
            if (!$art) {
                continue;
            }
            foreach ($eqCodes as $eqCode) {
                $eq = $equipments[$eqCode] ?? null;
                if (!$eq) {
                    continue;
                }
                ArticleEquipmentRequirement::query()->updateOrCreate(
                    ['ref_article_id' => $art->id, 'equipment_id' => $eq->id],
                    ['quantite' => 1]
                );
            }
        }

        // Actions standardisées par famille
        $actionsByFamilleCode = [
            'GEO_BETON' => [
                ['type' => 'technicien', 'libelle' => 'Confection des éprouvettes',     'duree_heures' => 1, 'ordre' => 1],
                ['type' => 'technicien', 'libelle' => 'Démoulage / cure 24 h',          'duree_heures' => 1, 'ordre' => 2],
                ['type' => 'labo',       'libelle' => "Mise en place sur presse",       'duree_heures' => 1, 'ordre' => 3],
                ['type' => 'labo',       'libelle' => 'Essai de rupture + relevés',     'duree_heures' => 1, 'ordre' => 4],
                ['type' => 'ingenieur',  'libelle' => 'Validation résultat + rapport',  'duree_heures' => 1, 'ordre' => 5],
            ],
            'GEO_SOL' => [
                ['type' => 'technicien', 'libelle' => "Préparation de l'échantillon",   'duree_heures' => 1, 'ordre' => 1],
                ['type' => 'labo',       'libelle' => 'Exécution essai labo',           'duree_heures' => 2, 'ordre' => 2],
                ['type' => 'labo',       'libelle' => 'Calculs + édition fiche',        'duree_heures' => 1, 'ordre' => 3],
                ['type' => 'ingenieur',  'libelle' => 'Interprétation + validation',    'duree_heures' => 1, 'ordre' => 4],
            ],
            'GEO_IN_SITU' => [
                ['type' => 'technicien', 'libelle' => 'Implantation point + sécurité',  'duree_heures' => 1, 'ordre' => 1],
                ['type' => 'technicien', 'libelle' => 'Exécution essai sur site',       'duree_heures' => 2, 'ordre' => 2],
                ['type' => 'technicien', 'libelle' => 'Saisie données + photos',        'duree_heures' => 1, 'ordre' => 3],
                ['type' => 'ingenieur',  'libelle' => 'Dépouillement + rapport',        'duree_heures' => 2, 'ordre' => 4],
            ],
            'GEO_CHIMIE' => [
                ['type' => 'labo',       'libelle' => 'Préparation chimique',           'duree_heures' => 1, 'ordre' => 1],
                ['type' => 'labo',       'libelle' => 'Dosage / titrage',               'duree_heures' => 1, 'ordre' => 2],
                ['type' => 'ingenieur',  'libelle' => 'Validation chimiste',            'duree_heures' => 1, 'ordre' => 3],
            ],
        ];

        foreach ($articles as $art) {
            $famCode = $art->famille?->code;
            $actions = $actionsByFamilleCode[$famCode] ?? null;
            if (!$actions) {
                continue;
            }
            foreach ($actions as $a) {
                ArticleAction::query()->firstOrCreate(
                    [
                        'ref_article_id' => $art->id,
                        'type'           => $a['type'],
                        'libelle'        => $a['libelle'],
                    ],
                    [
                        'duree_heures' => $a['duree_heures'],
                        'ordre'        => $a['ordre'],
                    ]
                );
            }
        }
    }
}
