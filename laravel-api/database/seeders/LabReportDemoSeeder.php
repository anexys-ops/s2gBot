<?php

namespace Database\Seeders;

use App\Models\Agency;
use App\Models\Catalogue\Article;
use App\Models\LabReport;
use App\Models\LabReportSection;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * LabReportDemoSeeder — 1 rapport de démonstration avec 10 sections.
 *
 * Idempotent : firstOrCreate sur `number` avec préfixe MHD-RPT-DEMO-.
 * Requiert : AgenciesSeeder + LabEssaisSeeder déjà exécutés.
 */
class LabReportDemoSeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasTable('lab_reports')) {
            $this->command?->warn('LabReportDemoSeeder : table lab_reports absente — abandon.');
            return;
        }

        $agency = Agency::where('code', 'MHD')->first();

        $report = LabReport::firstOrCreate(
            ['number' => 'MHD-RPT-DEMO-001'],
            [
                'title'          => "Rapport d'étude géotechnique — Démo",
                'status'         => 'brouillon',
                'agency_id'      => $agency?->id,
                'conclusion'     => "Rapport de démonstration généré automatiquement. Les résultats sont fictifs à des fins d'illustration.",
                'notes_internes' => 'Seeder LabReportDemoSeeder — v1.2.0',
            ]
        );

        if ($report->sections()->count() > 0) {
            $this->command?->info('LabReportDemoSeeder : rapport MHD-RPT-DEMO-001 déjà complet — rien à faire.');
            return;
        }

        $sections = $this->buildSections();

        foreach ($sections as $i => $section) {
            $essaiCode   = $section['essai_code'];
            $essaiArticle = Article::where('code', $essaiCode)->first();

            LabReportSection::create([
                'report_id'       => $report->id,
                'essai_article_id'=> $essaiArticle?->id,
                'ordre'           => $i + 1,
                'performed_at'    => now()->subDays(10 - $i)->toDateString(),
                'temperature_c'   => 20.5,
                'humidity_pct'    => 55.0,
                'data'            => $section['data'],
                'conformity'      => $section['conformity'],
                'conclusion'      => $section['conclusion'],
            ]);
        }

        $this->command?->info(sprintf(
            'LabReportDemoSeeder OK : rapport %s créé avec %d sections.',
            $report->number,
            $report->sections()->count()
        ));
    }

    /**
     * Retourne les 10 sections avec leurs données JSON réalistes.
     *
     * @return array<int, array{essai_code:string, data:array<string,mixed>, conformity:string, conclusion:string}>
     */
    private function buildSections(): array
    {
        return [
            // ── 1. Granulométrie par tamisage (ESS-SOL-001) ──────────────────
            [
                'essai_code' => 'ESS-SOL-001',
                'data'       => [
                    'tamis_mm'   => [50, 20, 10, 5, 2, 1, 0.5, 0.25, 0.125, 0.063],
                    'passants_pct' => [100, 98.2, 91.4, 72.6, 54.3, 40.1, 28.7, 18.4, 10.2, 6.8],
                    'd10'        => 0.09,
                    'd30'        => 0.32,
                    'd60'        => 1.85,
                    'cu'         => 20.6,
                    'cc'         => 0.61,
                    'classification' => 'Grave sableuse peu argileuse (GRH)',
                    'refus_0_063_pct' => 93.2,
                ],
                'conformity' => 'conforme',
                'conclusion' => 'Sol à granulométrie étalée. Fraction fine inférieure à 10 %. Convient pour remblai routier.',
            ],

            // ── 2. Limites d'Atterberg (ESS-SOL-003 + ESS-SOL-004) ───────────
            [
                'essai_code' => 'ESS-SOL-003',
                'data'       => [
                    'wl'          => 38.5,
                    'wp'          => 19.2,
                    'ip'          => 19.3,
                    'teneur_eau_naturelle' => 22.1,
                    'ic'          => 0.85,
                    'classification_ip' => 'Sol moyennement plastique',
                    'nb_coups_casagrande' => [30, 25, 18, 14],
                    'teneurs_eau_casagrande' => [35.2, 37.1, 39.8, 42.3],
                ],
                'conformity' => 'conforme',
                'conclusion' => 'Argile limoneuse moyennement plastique (Ip = 19.3). Indice de consistance satisfaisant (Ic = 0.85).',
            ],

            // ── 3. Teneur en eau naturelle (ESS-SOL-005) ─────────────────────
            [
                'essai_code' => 'ESS-SOL-005',
                'data'       => [
                    'mesures' => [
                        ['capsule' => 'C1', 'tare_g' => 10.42, 'sol_humide_g' => 52.18, 'sol_sec_g' => 44.63, 'w_pct' => 22.4],
                        ['capsule' => 'C2', 'tare_g' => 10.38, 'sol_humide_g' => 48.92, 'sol_sec_g' => 41.87, 'w_pct' => 22.8],
                        ['capsule' => 'C3', 'tare_g' => 10.55, 'sol_humide_g' => 55.34, 'sol_sec_g' => 47.31, 'w_pct' => 21.6],
                    ],
                    'w_moyen_pct' => 22.3,
                    'ecart_type'  => 0.61,
                ],
                'conformity' => 'en_attente',
                'conclusion' => 'Teneur en eau naturelle moyenne de 22.3 %. Sol en état légèrement humide.',
            ],

            // ── 4. Proctor Modifié (ESS-SOL-009) ─────────────────────────────
            [
                'essai_code' => 'ESS-SOL-009',
                'data'       => [
                    'points' => [
                        ['w_pct' => 8.2,  'gamma_d' => 1.812],
                        ['w_pct' => 10.5, 'gamma_d' => 1.894],
                        ['w_pct' => 12.8, 'gamma_d' => 1.948],
                        ['w_pct' => 14.3, 'gamma_d' => 1.971],
                        ['w_pct' => 16.1, 'gamma_d' => 1.942],
                        ['w_pct' => 18.0, 'gamma_d' => 1.896],
                    ],
                    'opm_w_pct'           => 14.3,
                    'opm_gamma_d_t_m3'    => 1.971,
                    'courbe'              => 'parabolique',
                    'energie_compactage'  => 'Proctor Modifié (2700 kJ/m³)',
                ],
                'conformity' => 'conforme',
                'conclusion' => 'OPM obtenu à wOPM = 14.3 % et γd,max = 1.971 t/m³. Résultats cohérents avec la granulométrie.',
            ],

            // ── 5. CBR après immersion 4j (ESS-SOL-011) ──────────────────────
            [
                'essai_code' => 'ESS-SOL-011',
                'data'       => [
                    'compactage_pct_opm' => 95,
                    'duree_immersion_j'  => 4,
                    'gonflement_pct'     => 0.38,
                    'points_penetration' => [
                        ['penetration_mm' => 0.0,  'force_kn' => 0.00],
                        ['penetration_mm' => 0.5,  'force_kn' => 0.82],
                        ['penetration_mm' => 1.0,  'force_kn' => 1.54],
                        ['penetration_mm' => 1.5,  'force_kn' => 2.21],
                        ['penetration_mm' => 2.0,  'force_kn' => 2.89],
                        ['penetration_mm' => 2.5,  'force_kn' => 3.45],
                        ['penetration_mm' => 3.0,  'force_kn' => 3.95],
                        ['penetration_mm' => 4.0,  'force_kn' => 4.75],
                        ['penetration_mm' => 5.0,  'force_kn' => 5.42],
                    ],
                    'cbr_2_5'  => 25.9,
                    'cbr_5_0'  => 24.5,
                    'cbr_retenu' => 25.9,
                    'classe_portance' => 'AR4',
                ],
                'conformity' => 'conforme',
                'conclusion' => 'CBR(2.5mm) = 25.9 %. Sol classé AR4. Convient comme couche de forme avec traitement.',
            ],

            // ── 6. Compression béton 28j (ESS-BET-002) ───────────────────────
            [
                'essai_code' => 'ESS-BET-002',
                'data'       => [
                    'age_jours'    => 28,
                    'eprouvettes'  => [
                        ['id' => 'EP-01', 'diametre_mm' => 113.0, 'hauteur_mm' => 226.0, 'masse_g' => 4820, 'force_kn' => 296.4, 'rc_mpa' => 29.6],
                        ['id' => 'EP-02', 'diametre_mm' => 113.0, 'hauteur_mm' => 226.0, 'masse_g' => 4835, 'force_kn' => 305.2, 'rc_mpa' => 30.5],
                        ['id' => 'EP-03', 'diametre_mm' => 113.0, 'hauteur_mm' => 226.0, 'masse_g' => 4808, 'force_kn' => 298.7, 'rc_mpa' => 29.9],
                    ],
                    'rc_moyen_mpa'  => 30.0,
                    'ecart_type'    => 0.46,
                    'cv_pct'        => 1.5,
                    'classe_beton'  => 'C25/30',
                    'type_rupture'  => 'Conique (type 1)',
                ],
                'conformity' => 'conforme',
                'conclusion' => 'Résistance caractéristique Rc28 = 30.0 MPa. Classe C25/30 satisfaite. CV = 1.5 % (très homogène).',
            ],

            // ── 7. Slump test (ESS-BET-004) ───────────────────────────────────
            [
                'essai_code' => 'ESS-BET-004',
                'data'       => [
                    'mesures' => [
                        ['essai_n' => 1, 'affaissement_mm' => 148],
                        ['essai_n' => 2, 'affaissement_mm' => 152],
                        ['essai_n' => 3, 'affaissement_mm' => 149],
                    ],
                    'affaissement_moyen_mm' => 150,
                    'classe_consistance'    => 'S3',
                    'plage_s3_mm'           => '100–150',
                    'temperature_beton_c'   => 24.0,
                ],
                'conformity' => 'conforme',
                'conclusion' => 'Affaissement de 150 mm — limite haute classe S3. Consistance conforme à la formulation prescrite.',
            ],

            // ── 8. Pressiomètre Ménard (ESS-INS-004) ─────────────────────────
            [
                'essai_code' => 'ESS-INS-004',
                'data'       => [
                    'profondeur_m' => 4.5,
                    'sondage'      => 'SC-03',
                    'courbe' => [
                        ['pression_kpa' => 0,    'volume_cm3' => 535],
                        ['pression_kpa' => 100,  'volume_cm3' => 545],
                        ['pression_kpa' => 200,  'volume_cm3' => 562],
                        ['pression_kpa' => 400,  'volume_cm3' => 598],
                        ['pression_kpa' => 600,  'volume_cm3' => 648],
                        ['pression_kpa' => 800,  'volume_cm3' => 730],
                        ['pression_kpa' => 1000, 'volume_cm3' => 896],
                    ],
                    'volume_initial_v0_cm3' => 535,
                    'pression_limite_pl_kpa'   => 980,
                    'module_menard_em_mpa'     => 8.4,
                    'rapport_em_pl'            => 8.6,
                    'categorie_sol'            => 'Argile surconsolidée',
                ],
                'conformity' => 'conforme',
                'conclusion' => 'Em = 8.4 MPa, Pl = 980 kPa. Ratio Em/Pl = 8.6 caractéristique d\'une argile surconsolidée.',
            ],

            // ── 9. PANDA (ESS-INS-001) ────────────────────────────────────────
            [
                'essai_code' => 'ESS-INS-001',
                'data'       => [
                    'point_sondage' => 'PT-07',
                    'date_essai'    => now()->subDays(12)->toDateString(),
                    'profils' => [
                        ['profondeur_m' => 0.20, 'qd_mpa' => 1.2],
                        ['profondeur_m' => 0.40, 'qd_mpa' => 2.8],
                        ['profondeur_m' => 0.60, 'qd_mpa' => 4.5],
                        ['profondeur_m' => 0.80, 'qd_mpa' => 6.1],
                        ['profondeur_m' => 1.00, 'qd_mpa' => 7.4],
                        ['profondeur_m' => 1.20, 'qd_mpa' => 8.9],
                        ['profondeur_m' => 1.40, 'qd_mpa' => 11.2],
                        ['profondeur_m' => 1.60, 'qd_mpa' => 14.8],
                        ['profondeur_m' => 1.80, 'qd_mpa' => 18.3],
                    ],
                    'qd_refus_mpa'          => null,
                    'profondeur_refus_m'    => null,
                    'profondeur_finale_m'   => 1.80,
                    'qd_moyen_surface_mpa'  => 3.5,
                    'qd_moyen_profond_mpa'  => 13.4,
                    'interpretation'        => 'Couche de remblai meuble sur 0.8 m, puis sol naturel compact.',
                ],
                'conformity' => 'en_attente',
                'conclusion' => 'Couche compressible 0–0.8 m (qd < 5 MPa). Sol portant détecté à partir de 1.2 m (qd > 10 MPa).',
            ],

            // ── 10. Valeur au Bleu de Méthylène (ESS-SOL-013) ────────────────
            [
                'essai_code' => 'ESS-SOL-013',
                'data'       => [
                    'masse_echantillon_g'   => 200.0,
                    'fraction_analysee'     => '0/5 mm',
                    'volume_bleu_ml'        => 24.5,
                    'vbs'                   => 1.22,
                    'interpretations' => [
                        'classification_vbs' => 'Sol argilo-limoneux (0.8 ≤ VBS ≤ 1.5)',
                        'risque_gonflement'  => 'Moyen',
                        'classe_gtrf'        => 'A2t',
                    ],
                    'taches_reference' => [
                        ['injection_ml' => 5,   'couronne' => false],
                        ['injection_ml' => 10,  'couronne' => false],
                        ['injection_ml' => 15,  'couronne' => false],
                        ['injection_ml' => 20,  'couronne' => false],
                        ['injection_ml' => 24.5,'couronne' => true],
                    ],
                ],
                'conformity' => 'conforme',
                'conclusion' => 'VBS = 1.22 — sol argilo-limoneux classe A2t (GTR). Risque de sensibilité à l\'eau modéré. Prévoir traitement à la chaux si remblai.',
            ],
        ];
    }
}
