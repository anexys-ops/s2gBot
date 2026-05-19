<?php

namespace Database\Seeders;

use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * LabEssaisSeeder — 60 essais de laboratoire géotechnique dans le catalogue.
 *
 * Familles : Béton (15), Sol (20), In Situ (15), Chimique (10).
 * Idempotent : firstOrCreate sur `code`.
 */
class LabEssaisSeeder extends Seeder
{
    public function run(): void
    {
        $hasTriggers = Schema::hasColumn('ref_articles', 'triggers_odm_labo');
        $hasTypeRes  = Schema::hasColumn('ref_articles', 'type_ressource');

        // ── Familles ─────────────────────────────────────────────────────────
        $familles = $this->ensureFamilles();

        // ── Essais ───────────────────────────────────────────────────────────
        $essais = $this->getEssais();

        $created = 0;
        foreach ($essais as $essai) {
            $familleId = $familles[$essai['famille']]->id;

            $base = [
                'ref_famille_article_id' => $familleId,
                'libelle'                => $essai['libelle'],
                'description'            => $essai['description'],
                'normes'                 => $essai['norme'],
                'unite'                  => 'essai',
                'prix_unitaire_ht'       => $essai['prix_ht'],
                'duree_estimee'          => $essai['duree_min'],
                'tva_rate'               => 20.00,
                'actif'                  => true,
            ];

            if ($hasTriggers) {
                $base['triggers_odm_labo'] = true;
            }
            if ($hasTypeRes) {
                $base['type_ressource'] = 'labo';
            }

            $article = Article::firstOrCreate(['code' => $essai['code']], $base);

            if ($article->wasRecentlyCreated) {
                $created++;
            }
        }

        $this->command?->info(sprintf(
            'LabEssaisSeeder OK : %d essais créés, %d déjà présents.',
            $created,
            count($essais) - $created
        ));
    }

    /**
     * Crée ou retrouve les 4 familles géotechniques.
     *
     * @return array<string, FamilleArticle>
     */
    private function ensureFamilles(): array
    {
        $defs = [
            'Béton'    => ['code' => 'GEO_BETON',   'color' => '#e67e22', 'ordre' => 10],
            'Sol'      => ['code' => 'GEO_SOL',     'color' => '#8e44ad', 'ordre' => 20],
            'In Situ'  => ['code' => 'GEO_IN_SITU', 'color' => '#27ae60', 'ordre' => 30],
            'Chimique' => ['code' => 'GEO_CHIMIE',  'color' => '#c0392b', 'ordre' => 40],
        ];

        $familles = [];
        foreach ($defs as $libelle => $attrs) {
            $familles[$libelle] = FamilleArticle::firstOrCreate(
                ['code' => $attrs['code']],
                [
                    'libelle'       => $libelle,
                    'description'   => "Famille d'essais géotechniques — {$libelle}",
                    'color'         => $attrs['color'],
                    'type_ressource'=> 'labo',
                    'ordre'         => $attrs['ordre'],
                    'actif'         => true,
                ]
            );
        }

        return $familles;
    }

    /**
     * Retourne la liste des 60 essais à créer.
     *
     * @return array<int, array{code:string, libelle:string, description:string, norme:string, prix_ht:float, duree_min:int, famille:string}>
     */
    private function getEssais(): array
    {
        return [
            // ── Béton (15) ──────────────────────────────────────────────────
            [
                'code'       => 'ESS-BET-001',
                'libelle'    => 'Résistance à la compression 7 jours',
                'description'=> 'Essai de résistance à la compression sur éprouvette béton à 7 jours de cure.',
                'norme'      => 'NF EN 12390-3',
                'prix_ht'    => 35.00,
                'duree_min'  => 60,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-002',
                'libelle'    => 'Résistance à la compression 28 jours',
                'description'=> 'Essai de résistance à la compression sur éprouvette béton à 28 jours de cure.',
                'norme'      => 'NF EN 12390-3',
                'prix_ht'    => 40.00,
                'duree_min'  => 60,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-003',
                'libelle'    => 'Résistance à la compression 90 jours',
                'description'=> 'Essai de résistance à la compression sur éprouvette béton à 90 jours de cure.',
                'norme'      => 'NF EN 12390-3',
                'prix_ht'    => 40.00,
                'duree_min'  => 60,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-004',
                'libelle'    => 'Essai d\'affaissement (Slump test)',
                'description'=> 'Mesure de la consistance du béton frais par affaissement au cône d\'Abrams.',
                'norme'      => 'NF EN 12350-2',
                'prix_ht'    => 25.00,
                'duree_min'  => 30,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-005',
                'libelle'    => 'Consistance au Vébé',
                'description'=> 'Mesure de la consistance du béton frais par la méthode Vébé.',
                'norme'      => 'NF EN 12350-3',
                'prix_ht'    => 30.00,
                'duree_min'  => 45,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-006',
                'libelle'    => 'Teneur en air occlus',
                'description'=> 'Mesure de la teneur en air occlus dans le béton frais par pressiomètre.',
                'norme'      => 'NF EN 12350-7',
                'prix_ht'    => 25.00,
                'duree_min'  => 30,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-007',
                'libelle'    => 'Masse volumique béton frais',
                'description'=> 'Détermination de la masse volumique du béton à l\'état frais.',
                'norme'      => 'NF EN 12350-6',
                'prix_ht'    => 20.00,
                'duree_min'  => 20,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-008',
                'libelle'    => 'Traction par fendage (Brésilien)',
                'description'=> 'Essai de traction indirecte par fendage sur éprouvette cylindrique béton.',
                'norme'      => 'NF EN 12390-6',
                'prix_ht'    => 45.00,
                'duree_min'  => 60,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-009',
                'libelle'    => 'Module d\'élasticité statique',
                'description'=> 'Détermination du module d\'élasticité en compression statique du béton durci.',
                'norme'      => 'NF EN 12390-13',
                'prix_ht'    => 80.00,
                'duree_min'  => 120,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-010',
                'libelle'    => 'Absorption d\'eau par immersion',
                'description'=> 'Détermination de l\'absorption d\'eau par immersion totale du béton durci.',
                'norme'      => 'NF EN 12390-8',
                'prix_ht'    => 50.00,
                'duree_min'  => 480,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-011',
                'libelle'    => 'Résistance à la carbonatation',
                'description'=> 'Essai de résistance à la carbonatation accélérée du béton.',
                'norme'      => 'XP P18-458',
                'prix_ht'    => 120.00,
                'duree_min'  => 720,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-012',
                'libelle'    => 'Résistance à la pénétration des chlorures',
                'description'=> 'Essai de résistance à la pénétration des ions chlorure dans le béton.',
                'norme'      => 'NF EN 12390-11',
                'prix_ht'    => 150.00,
                'duree_min'  => 960,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-013',
                'libelle'    => 'Retrait de dessiccation',
                'description'=> 'Mesure du retrait de dessiccation du béton durci sur éprouvettes prismatiques.',
                'norme'      => 'NF P15-433',
                'prix_ht'    => 90.00,
                'duree_min'  => 4320,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-014',
                'libelle'    => 'Granulométrie des granulats béton',
                'description'=> 'Analyse granulométrique par tamisage des granulats utilisés dans le béton.',
                'norme'      => 'NF EN 933-1',
                'prix_ht'    => 55.00,
                'duree_min'  => 120,
                'famille'    => 'Béton',
            ],
            [
                'code'       => 'ESS-BET-015',
                'libelle'    => 'Équivalent de sable',
                'description'=> 'Détermination de l\'équivalent de sable des granulats fins pour béton.',
                'norme'      => 'NF EN 933-8',
                'prix_ht'    => 35.00,
                'duree_min'  => 60,
                'famille'    => 'Béton',
            ],

            // ── Sol (20) ─────────────────────────────────────────────────────
            [
                'code'       => 'ESS-SOL-001',
                'libelle'    => 'Analyse granulométrique par tamisage',
                'description'=> 'Détermination de la distribution granulométrique d\'un sol par tamisage à sec ou humide.',
                'norme'      => 'NF EN ISO 17892-4',
                'prix_ht'    => 60.00,
                'duree_min'  => 180,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-002',
                'libelle'    => 'Analyse granulométrique par sédimentométrie',
                'description'=> 'Détermination des fractions fines d\'un sol par sédimentation (densimètre ou pipette).',
                'norme'      => 'NF EN ISO 17892-4',
                'prix_ht'    => 80.00,
                'duree_min'  => 1440,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-003',
                'libelle'    => 'Limite de liquidité (Casagrande)',
                'description'=> 'Détermination de la limite de liquidité d\'un sol fin à l\'appareil de Casagrande.',
                'norme'      => 'NF EN ISO 17892-12',
                'prix_ht'    => 45.00,
                'duree_min'  => 90,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-004',
                'libelle'    => 'Limite de plasticité',
                'description'=> 'Détermination de la limite de plasticité d\'un sol fin par roulage.',
                'norme'      => 'NF EN ISO 17892-12',
                'prix_ht'    => 45.00,
                'duree_min'  => 90,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-005',
                'libelle'    => 'Teneur en eau naturelle',
                'description'=> 'Détermination de la teneur en eau naturelle d\'un sol par étuvage à 105 °C.',
                'norme'      => 'NF EN ISO 17892-1',
                'prix_ht'    => 20.00,
                'duree_min'  => 60,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-006',
                'libelle'    => 'Masse volumique sèche',
                'description'=> 'Détermination de la masse volumique sèche d\'un échantillon de sol.',
                'norme'      => 'NF EN ISO 17892-2',
                'prix_ht'    => 30.00,
                'duree_min'  => 60,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-007',
                'libelle'    => 'Densité des grains (pycnomètre)',
                'description'=> 'Détermination de la densité des particules solides d\'un sol au pycnomètre.',
                'norme'      => 'NF EN ISO 17892-3',
                'prix_ht'    => 50.00,
                'duree_min'  => 120,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-008',
                'libelle'    => 'Essai Proctor Normal',
                'description'=> 'Détermination de la relation teneur en eau / masse volumique sèche — Proctor Normal.',
                'norme'      => 'NF EN 13286-2',
                'prix_ht'    => 110.00,
                'duree_min'  => 480,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-009',
                'libelle'    => 'Essai Proctor Modifié',
                'description'=> 'Détermination de la relation teneur en eau / masse volumique sèche — Proctor Modifié.',
                'norme'      => 'NF EN 13286-2',
                'prix_ht'    => 120.00,
                'duree_min'  => 480,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-010',
                'libelle'    => 'Portance CBR immédiat',
                'description'=> 'Détermination de l\'indice CBR immédiat sans immersion.',
                'norme'      => 'NF EN 13286-47',
                'prix_ht'    => 90.00,
                'duree_min'  => 240,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-011',
                'libelle'    => 'Portance CBR après immersion (4j)',
                'description'=> 'Détermination de l\'indice CBR après 4 jours d\'immersion dans l\'eau.',
                'norme'      => 'NF EN 13286-47',
                'prix_ht'    => 110.00,
                'duree_min'  => 5760,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-012',
                'libelle'    => 'Indice Portance Immédiat (IPI)',
                'description'=> 'Détermination de l\'indice de portance immédiat à l\'appareil de pénétration dynamique.',
                'norme'      => 'NF P94-078',
                'prix_ht'    => 50.00,
                'duree_min'  => 120,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-013',
                'libelle'    => 'Valeur au Bleu de Méthylène (VBS)',
                'description'=> 'Détermination de la valeur au bleu de méthylène d\'un sol ou d\'un granulat.',
                'norme'      => 'NF EN 933-9',
                'prix_ht'    => 60.00,
                'duree_min'  => 120,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-014',
                'libelle'    => 'Teneur en matières organiques',
                'description'=> 'Détermination de la teneur en matières organiques d\'un sol par calcination.',
                'norme'      => 'NF EN 1744-1',
                'prix_ht'    => 45.00,
                'duree_min'  => 240,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-015',
                'libelle'    => 'Teneur en sulfates',
                'description'=> 'Détermination de la teneur en sulfates solubles dans un sol.',
                'norme'      => 'NF EN 1744-1',
                'prix_ht'    => 55.00,
                'duree_min'  => 180,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-016',
                'libelle'    => 'Teneur en chlorures sol',
                'description'=> 'Détermination de la teneur en chlorures solubles dans un sol.',
                'norme'      => 'NF EN 1744-5',
                'prix_ht'    => 55.00,
                'duree_min'  => 180,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-017',
                'libelle'    => 'Résistance au cisaillement direct',
                'description'=> 'Détermination des paramètres de résistance au cisaillement direct d\'un sol.',
                'norme'      => 'NF EN ISO 17892-10',
                'prix_ht'    => 180.00,
                'duree_min'  => 1440,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-018',
                'libelle'    => 'Essai œdométrique',
                'description'=> 'Détermination de la compressibilité et de la consolidation d\'un sol à l\'œdomètre.',
                'norme'      => 'NF EN ISO 17892-5',
                'prix_ht'    => 220.00,
                'duree_min'  => 4320,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-019',
                'libelle'    => 'Triaxial non consolidé non drainé (UU)',
                'description'=> 'Essai triaxial UU pour détermination de la résistance non drainée immédiate.',
                'norme'      => 'NF EN ISO 17892-9',
                'prix_ht'    => 250.00,
                'duree_min'  => 2880,
                'famille'    => 'Sol',
            ],
            [
                'code'       => 'ESS-SOL-020',
                'libelle'    => 'Triaxial consolidé non drainé (CU)',
                'description'=> 'Essai triaxial CU avec mesure de pression interstitielle pour paramètres effectifs.',
                'norme'      => 'NF EN ISO 17892-9',
                'prix_ht'    => 350.00,
                'duree_min'  => 5760,
                'famille'    => 'Sol',
            ],

            // ── In Situ (15) ─────────────────────────────────────────────────
            [
                'code'       => 'ESS-INS-001',
                'libelle'    => 'Pénétrométrie dynamique légère PANDA',
                'description'=> 'Sondage de pénétrométrie dynamique légère à masse constante (PANDA) pour reconnaissance des sols.',
                'norme'      => 'NF P 94-105',
                'prix_ht'    => 80.00,
                'duree_min'  => 120,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-002',
                'libelle'    => 'Pénétrométrie dynamique super lourde DPSH',
                'description'=> 'Pénétrométrie dynamique super lourde pour reconnaissance profonde des sols.',
                'norme'      => 'NF EN ISO 22476-2',
                'prix_ht'    => 120.00,
                'duree_min'  => 180,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-003',
                'libelle'    => 'Pénétrométrie statique CPT',
                'description'=> 'Pénétrométrie statique au cône (CPT) avec mesure de résistance de pointe et frottement latéral.',
                'norme'      => 'NF EN ISO 22476-1',
                'prix_ht'    => 200.00,
                'duree_min'  => 240,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-004',
                'libelle'    => 'Essai pressiométrique Ménard (PMT)',
                'description'=> 'Essai pressiométrique Ménard pour détermination du module pressiométrique et de la pression limite.',
                'norme'      => 'NF EN ISO 22476-4',
                'prix_ht'    => 180.00,
                'duree_min'  => 180,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-005',
                'libelle'    => 'Standard Penetration Test (SPT)',
                'description'=> 'Essai de pénétration standard (SPT) pour évaluation de la compacité relative des sols.',
                'norme'      => 'NF EN ISO 22476-3',
                'prix_ht'    => 150.00,
                'duree_min'  => 180,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-006',
                'libelle'    => 'Essai Lefranc (perméabilité in situ)',
                'description'=> 'Essai de perméabilité Lefranc en forage pour détermination du coefficient de perméabilité in situ.',
                'norme'      => 'NF EN ISO 22476-12',
                'prix_ht'    => 200.00,
                'duree_min'  => 360,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-007',
                'libelle'    => 'Densité en place par membrane',
                'description'=> 'Détermination de la densité en place du sol par la méthode au ballonnet (membrane).',
                'norme'      => 'NF P 94-061-3',
                'prix_ht'    => 60.00,
                'duree_min'  => 60,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-008',
                'libelle'    => 'Densité en place gammadensimètre',
                'description'=> 'Mesure de la densité en place du sol par gammadensimétrie nucléaire.',
                'norme'      => 'NF P 94-061-1',
                'prix_ht'    => 45.00,
                'duree_min'  => 30,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-009',
                'libelle'    => 'Teneur en eau sonde neutronique',
                'description'=> 'Mesure de la teneur en eau du sol en place par sonde neutronique.',
                'norme'      => 'NF P 94-061-1',
                'prix_ht'    => 40.00,
                'duree_min'  => 30,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-010',
                'libelle'    => 'Essai à la plaque (module Westergaard)',
                'description'=> 'Essai de chargement à la plaque pour détermination du module de réaction de Westergaard.',
                'norme'      => 'NF P 94-117-1',
                'prix_ht'    => 250.00,
                'duree_min'  => 480,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-011',
                'libelle'    => 'Pénétromètre dynamique léger (PDL)',
                'description'=> 'Essai de pénétrométrie dynamique légère manuelle pour contrôle de compactage.',
                'norme'      => 'NF P 94-063',
                'prix_ht'    => 60.00,
                'duree_min'  => 90,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-012',
                'libelle'    => 'Scissomètre de chantier (Vane test)',
                'description'=> 'Mesure de la résistance au cisaillement non drainé d\'un sol cohérent au scissomètre.',
                'norme'      => 'NF EN ISO 22476-9',
                'prix_ht'    => 120.00,
                'duree_min'  => 120,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-013',
                'libelle'    => 'Mesure inclinométrique',
                'description'=> 'Mesure des déplacements horizontaux d\'un sol par inclinomètre en forage.',
                'norme'      => 'NF EN ISO 18674-3',
                'prix_ht'    => 300.00,
                'duree_min'  => 480,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-014',
                'libelle'    => 'Mesure piézométrique',
                'description'=> 'Mesure du niveau piézométrique de la nappe phréatique en forage.',
                'norme'      => 'NF EN ISO 22475-1',
                'prix_ht'    => 150.00,
                'duree_min'  => 240,
                'famille'    => 'In Situ',
            ],
            [
                'code'       => 'ESS-INS-015',
                'libelle'    => 'Perméabilité au perméamètre',
                'description'=> 'Détermination de la perméabilité d\'un sol en laboratoire à charge variable.',
                'norme'      => 'NF EN ISO 17892-11',
                'prix_ht'    => 160.00,
                'duree_min'  => 2880,
                'famille'    => 'In Situ',
            ],

            // ── Chimique (10) ────────────────────────────────────────────────
            [
                'code'       => 'ESS-CHI-001',
                'libelle'    => 'pH du sol',
                'description'=> 'Mesure du pH d\'un sol en suspension aqueuse.',
                'norme'      => 'NF ISO 10390',
                'prix_ht'    => 25.00,
                'duree_min'  => 60,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-002',
                'libelle'    => 'Conductivité électrique',
                'description'=> 'Mesure de la conductivité électrique d\'un extrait de sol aqueux.',
                'norme'      => 'NF ISO 11265',
                'prix_ht'    => 30.00,
                'duree_min'  => 60,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-003',
                'libelle'    => 'Métaux lourds par ICP-MS',
                'description'=> 'Dosage des métaux lourds dans un sol par spectrométrie de masse à plasma induit (ICP-MS).',
                'norme'      => 'NF EN ISO 11885',
                'prix_ht'    => 280.00,
                'duree_min'  => 480,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-004',
                'libelle'    => 'Hydrocarbures aromatiques polycycliques (HAP)',
                'description'=> 'Dosage des hydrocarbures aromatiques polycycliques (HAP) dans un sol.',
                'norme'      => 'NF EN 15527',
                'prix_ht'    => 350.00,
                'duree_min'  => 720,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-005',
                'libelle'    => 'Hydrocarbures totaux (HCT)',
                'description'=> 'Dosage des hydrocarbures totaux (HCT) dans un sol par chromatographie en phase gazeuse.',
                'norme'      => 'NF EN ISO 9377-2',
                'prix_ht'    => 200.00,
                'duree_min'  => 480,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-006',
                'libelle'    => 'Polychlorobiphényles (PCB)',
                'description'=> 'Dosage des polychlorobiphényles (PCB) dans un sol par chromatographie en phase gazeuse.',
                'norme'      => 'NF EN 15308',
                'prix_ht'    => 320.00,
                'duree_min'  => 720,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-007',
                'libelle'    => 'Benzène, Toluène, Éthylbenzène, Xylène (BTEX)',
                'description'=> 'Dosage des composés BTEX dans un sol par analyse GC-MS après extraction.',
                'norme'      => 'NF EN ISO 15680',
                'prix_ht'    => 280.00,
                'duree_min'  => 480,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-008',
                'libelle'    => 'Teneur en amiante dans sol',
                'description'=> 'Recherche et quantification des fibres d\'amiante dans un sol par microscopie électronique.',
                'norme'      => 'NF X 43-269',
                'prix_ht'    => 400.00,
                'duree_min'  => 1440,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-009',
                'libelle'    => 'Analyse des eaux interstitielles',
                'description'=> 'Analyse physico-chimique des eaux interstitielles extraites d\'un échantillon de sol.',
                'norme'      => 'XP P 94-047',
                'prix_ht'    => 180.00,
                'duree_min'  => 360,
                'famille'    => 'Chimique',
            ],
            [
                'code'       => 'ESS-CHI-010',
                'libelle'    => 'Potentiel de gonflement',
                'description'=> 'Essai de mesure du potentiel de gonflement d\'un sol argileux.',
                'norme'      => 'XP P 94-091',
                'prix_ht'    => 150.00,
                'duree_min'  => 2880,
                'famille'    => 'Chimique',
            ],
        ];
    }
}
