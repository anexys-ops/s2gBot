<?php

namespace Database\Seeders;

use App\Models\Catalogue\Article;
use App\Models\Catalogue\FamilleArticle;
use App\Models\Catalogue\Resultat;
use Illuminate\Database\Seeder;

/**
 * Catalogue PROLAB — BDC-109 : 14 familles, ~60 articles d’essais.
 */
class CatalogueProLabSeeder extends Seeder
{
    public function run(): void
    {
        $familles = [
            ['code' => 'BETON', 'libelle' => 'Béton', 'ordre' => 1],
            ['code' => 'COMPACTAGE', 'libelle' => 'Compactage', 'ordre' => 2],
            ['code' => 'PROCTOR', 'libelle' => 'Proctor', 'ordre' => 3],
            ['code' => 'BORDURE', 'libelle' => 'Bordure', 'ordre' => 4],
            ['code' => 'CARREAUX', 'libelle' => 'Carreaux', 'ordre' => 5],
            ['code' => 'ENTREVOUS', 'libelle' => 'Entrevous', 'ordre' => 6],
            ['code' => 'MACONNERIE', 'libelle' => 'Maçonnerie', 'ordre' => 7],
            ['code' => 'PAVES', 'libelle' => 'Pavés', 'ordre' => 8],
            ['code' => 'MORTIER', 'libelle' => 'Mortier', 'ordre' => 9],
            ['code' => 'IDR', 'libelle' => 'IDR', 'ordre' => 10],
            ['code' => 'IP', 'libelle' => 'IP', 'ordre' => 11],
            ['code' => 'RFF', 'libelle' => 'RFF', 'ordre' => 12],
            ['code' => 'VBS', 'libelle' => 'VBS', 'ordre' => 13],
            ['code' => 'AG', 'libelle' => 'AG (agrégats / graves)', 'ordre' => 14],
        ];

        $byCode = [];
        foreach ($familles as $f) {
            $byCode[$f['code']] = FamilleArticle::query()->updateOrCreate(
                ['code' => $f['code']],
                [
                    'libelle' => $f['libelle'],
                    'ordre' => $f['ordre'],
                    'actif' => true,
                ]
            );
        }

        $defs = [
            'BETON' => [
                ['BETON-FC28', 'Résistance compression 28j', 'NF EN 12390-3', 30],
                ['BETON-FC7', 'Résistance compression 7j', 'NF EN 12390-3', 30],
                ['BETON-AFFAIS', 'Affaissement (Slump)', 'NF EN 12350-2', 20],
                ['BETON-POROSITE', 'Porosité / masse volumique', 'NF EN 12390-7', 25],
                ['BETON-ARME', 'Béton armé / EN 206', 'NF EN 206', 40],
                ['BETON-AIR', "Air occlus (équivalent d'air)", 'NF EN 12350-7', 20],
                ['BETON-MAN', "Manipulation d'éprouvettes", '—', 10],
            ],
            'COMPACTAGE' => [
                ['COMP-DENSITE', 'Densité en place', 'NF P 94-061', 45],
                ['COMP-TENEUR', 'Teneur en eau', 'NF P 94-050', 45],
                ['COMP-OPD', "Optimum Proctor dalle (OPD) — dalle d'écrasement CBR", 'NF P 94-115', 60],
                ['COMP-SEDIM', 'Analyse sédimentaire', 'XP P 18-540', 90],
            ],
            'PROCTOR' => [
                ['PROC-NORMAL', 'Proctor normal', 'NF P 94-093', 60],
                ['PROC-MOD', 'Proctor modifié', 'NF P 94-093', 60],
                ['PROC-ISOEN', 'Proctor (EN 13286-2)', 'EN 13286-2', 60],
                ['PROC-OPT', "Optimum Proctor OPM — bille d'acier 50 mm", '—', 60],
            ],
            'BORDURE' => [
                ['BORD-RESIST', 'Résistance bordure béton', 'NF EN 1340', 45],
                ['BORD-PIERRE', 'Bordure pierre / naturelle', '—', 30],
                ['BORD-TYPE', 'Bordure type (contrôle dimensionnel)', '—', 30],
                ['BORD-ADH', 'Adhérence bordure / lit de pose', '—', 40],
            ],
            'CARREAUX' => [
                ['CARR-ABS', "Absorption d'eau (carreaux céramiques)", 'NF EN 10545-3', 40],
                ['CARR-RESF', 'Résistance à la flexion', 'NF EN 10545-4', 50],
                ['CARR-GLI', 'Coefficient de glissance', 'NF EN 10545-17', 30],
                ['CARR-EP', 'Épaisseurs et cotes', '—', 20],
            ],
            'ENTREVOUS' => [
                ['ENT-BETON', 'Entrevous béton (contrôle charges)', '—', 45],
                ['ENT-DEF', "Déformation / flèche", '—', 50],
                ['ENT-DIM', 'Cotes et exécution', '—', 25],
                ['ENT-POUT', "Poutrelles — flexion", '—', 55],
            ],
            'MACONNERIE' => [
                ['MAC-RES', 'Résistance mortier de montage / joint', '—', 40],
                ['MAC-POU', "Essai de pousée d'arc (maquette)", '—', 60],
                ['MAC-ADH', "Adhérence mortier", '—', 35],
            ],
            'PAVES' => [
                ['PAV-ABR', "Résistance à l'abrasion (pavés béton)", 'NF EN 1338', 45],
                ['PAV-GLI', 'Glissance', 'EN 1341 / EN 1339', 30],
                ['PAV-DIM', 'Cotes et usinage', '—', 20],
                ['PAV-ESS', "Essai de flexion pavé", '—', 40],
            ],
            'MORTIER' => [
                ['MOR-CT', 'Résistance à la compression 28j (éprouvettes prisme)', 'NF EN 196-1 / EN 1015-11', 45],
                ['MOR-RET', "Retrait", '—', 40],
                ['MOR-POI', "Teneur en eau (mortier frais)", '—', 20],
            ],
            'IDR' => [
                ['IDR-DENS', "Identification + densité sèche", '—', 30],
                ['IDR-GRA', "Identification grave", '—', 25],
            ],
            'IP' => [
                ['IP-SOL', "Identification lithologique terrain / IP", '—', 20],
                ['IP-EAU', "Niveau piézométrique (repère)", '—', 15],
            ],
            'RFF' => [
                ['RFF-RECEP', "Réception de fond de fouille", '—', 60],
                ['RFF-RESS', "Relevé ressuage", '—', 30],
            ],
            'VBS' => [
                ['VBS-SOL', 'Identification sol / VBS', '—', 20],
                ['VBS-PROF', "Relevé de profil", '—', 30],
            ],
            'AG' => [
                ['AG-POIDS', "Poids spécifiques des grains", 'NF P 18-555', 40],
                ['AG-GRA', "Essais d'équivalents sable / duffau", 'NF P 18-555', 60],
                ['AG-SEC', "Module de finition (essai gouttière)", '—', 45],
            ],
        ];

        foreach ($defs as $codeFam => $list) {
            $fam = $byCode[$codeFam] ?? null;
            if (! $fam) {
                continue;
            }
            foreach ($list as $row) {
                [$c, $lib, $norm, $dur] = $row;
                $a = Article::query()->updateOrCreate(
                    ['code' => $c],
                    [
                        'ref_famille_article_id' => $fam->id,
                        'libelle' => $lib,
                        'unite' => 'U',
                        'prix_unitaire_ht' => 0,
                        'tva_rate' => 20,
                        'duree_estimee' => $dur,
                        'normes' => $norm,
                        'actif' => true,
                    ]
                );
                Resultat::query()->updateOrCreate(
                    [
                        'ref_article_id' => $a->id,
                        'code' => 'R-'.$c,
                    ],
                    [
                        'libelle' => 'Indicateur — '.$lib,
                        'norme' => $norm,
                        'valeur_seuil' => null,
                    ]
                );
            }
        }
    }
}
