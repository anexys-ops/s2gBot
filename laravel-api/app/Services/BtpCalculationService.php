<?php

namespace App\Services;

/**
 * Exemples de calculs BTP pour le LIMS — formules courantes, aller vite sans se tromper.
 * Référentiels : NF EN, DTU, normes courantes.
 */
class BtpCalculationService
{
    /**
     * Résistance caractéristique à la compression (béton) — NF EN 12390-3.
     * fck = moyenne - k * écart-type (k selon nombre d'éprouvettes, souvent 1.48 pour n=15).
     * Version simplifiée : si n < 3, on utilise la valeur minimale ; sinon formule.
     */
    public static function resistanceCaracteristiqueBeton(array $resistancesMPa, float $k = 1.48): ?float
    {
        $n = count($resistancesMPa);
        if ($n === 0) {
            return null;
        }
        if ($n < 3) {
            return (float) min($resistancesMPa);
        }
        $moy = array_sum($resistancesMPa) / $n;
        $variance = 0;
        foreach ($resistancesMPa as $r) {
            $variance += ($r - $moy) ** 2;
        }
        $ecartType = sqrt($variance / ($n - 1));
        $fck = $moy - $k * $ecartType;
        return round(max(0, $fck), 2);
    }

    /**
     * Module de finesse (granulats) — NF EN 933-1.
     * MF = (refus cumulés 0.063 + 0.125 + 0.25 + 0.5 + 1 + 2 + 4 + 8 + 16) / 100
     * Entrée : tableau des refus cumulés en % [0.063, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16] (ordre des tamis).
     */
    public static function moduleFinesse(array $refusCumulesPourCent): ?float
    {
        if (count($refusCumulesPourCent) < 9) {
            return null;
        }
        $somme = array_sum(array_slice($refusCumulesPourCent, 0, 9));
        return round($somme / 100, 2);
    }

    /**
     * Equivalent de sable — NF EN 933-8.
     * SE = (h2 / h1) * 100 (hauteur sable / hauteur total en mm).
     */
    public static function equivalentSable(float $hauteurSableMm, float $hauteurTotalMm): ?float
    {
        if ($hauteurTotalMm <= 0) {
            return null;
        }
        return round(($hauteurSableMm / $hauteurTotalMm) * 100, 1);
    }

    /**
     * Indice CBR (California Bearing Ratio) — NF EN 13286-47.
     * CBR = (P / P0) * 100 avec P = pression à 2.5 ou 5 mm, P0 = pression référence (7 ou 10.5 MPa).
     * Entrée : force en kN, section éprouvette en mm² ; sortie CBR en %.
     */
    public static function cbr(float $forceKN, float $sectionMm2 = 1963.5, float $penetrationMm = 2.5): ?float
    {
        if ($sectionMm2 <= 0) {
            return null;
        }
        $pressionRef = $penetrationMm === 2.5 ? 7.0 : 10.5; // MPa
        $pressionMPa = ($forceKN * 1000) / $sectionMm2; // N/mm² = MPa
        return round(($pressionMPa / $pressionRef) * 100, 1);
    }

    /**
     * Masse volumique apparente (granulats) — NF EN 1097-3.
     * ρ = m / V (kg/m³) avec m en kg, V en m³.
     */
    public static function masseVolumiqueApparente(float $masseKg, float $volumeM3): ?float
    {
        if ($volumeM3 <= 0) {
            return null;
        }
        return round($masseKg / $volumeM3, 0);
    }

    /**
     * Teneur en eau W (%) — sols / béton.
     * W = ((m_humide - m_sec) / m_sec) * 100
     */
    public static function teneurEau(float $masseHumide, float $masseSeche): ?float
    {
        if ($masseSeche <= 0) {
            return null;
        }
        return round((($masseHumide - $masseSeche) / $masseSeche) * 100, 2);
    }

    /**
     * Limites d'Atterberg — indice de plasticité IP = WL - WP (NF EN ISO 17892-12).
     */
    public static function indicePlasticite(float $limiteLiquiditeWL, float $limitePlasticiteWP): ?float
    {
        return round($limiteLiquiditeWL - $limitePlasticiteWP, 1);
    }

    /**
     * Retourne la liste des exemples de calculs avec formules et entrées/sorties pour la doc back-office.
     */
    public static function getExemplesCalculs(): array
    {
        return [
            [
                'id' => 'resistance_caracteristique_beton',
                'titre' => 'Résistance caractéristique béton (fck)',
                'norme' => 'NF EN 12390-3',
                'formule' => 'fck = moyenne - k × σ (k ≈ 1.48 pour n=15)',
                'description' => 'À partir des résistances à la compression de N éprouvettes (MPa).',
                'exemple_entree' => [28.2, 30.1, 29.5, 27.8, 31.0],
                'exemple_sortie' => self::resistanceCaracteristiqueBeton([28.2, 30.1, 29.5, 27.8, 31.0]),
                'unite' => 'MPa',
            ],
            [
                'id' => 'module_finesse',
                'titre' => 'Module de finesse (granulats)',
                'norme' => 'NF EN 933-1',
                'formule' => 'MF = Σ(refus cumulés 0.063 à 16 mm) / 100',
                'description' => 'Refus cumulés en % pour les tamis 0.063, 0.125, 0.25, 0.5, 1, 2, 4, 8, 16 mm.',
                'exemple_entree' => [2, 5, 12, 25, 42, 58, 72, 85, 98],
                'exemple_sortie' => self::moduleFinesse([2, 5, 12, 25, 42, 58, 72, 85, 98]),
                'unite' => '-',
            ],
            [
                'id' => 'equivalent_sable',
                'titre' => 'Equivalent de sable (SE)',
                'norme' => 'NF EN 933-8',
                'formule' => 'SE = (h₂ / h₁) × 100',
                'description' => 'h₂ = hauteur de sable (mm), h₁ = hauteur totale (mm).',
                'exemple_entree' => ['h_sable' => 82, 'h_total' => 115],
                'exemple_sortie' => self::equivalentSable(82, 115),
                'unite' => '%',
            ],
            [
                'id' => 'cbr',
                'titre' => 'Indice CBR (California Bearing Ratio)',
                'norme' => 'NF EN 13286-47',
                'formule' => 'CBR = (P / P₀) × 100 — P à 2.5 ou 5 mm',
                'description' => 'Force (kN), section éprouvette (mm²). P₀ = 7 MPa (2.5 mm) ou 10.5 MPa (5 mm).',
                'exemple_entree' => ['force_kN' => 1.85, 'section_mm2' => 1963.5],
                'exemple_sortie' => self::cbr(1.85, 1963.5, 2.5),
                'unite' => '%',
            ],
            [
                'id' => 'masse_volumique_apparente',
                'titre' => 'Masse volumique apparente (granulats)',
                'norme' => 'NF EN 1097-3',
                'formule' => 'ρ = m / V',
                'description' => 'm = masse (kg), V = volume (m³). Résultat en kg/m³.',
                'exemple_entree' => ['m_kg' => 12.5, 'V_m3' => 0.005],
                'exemple_sortie' => self::masseVolumiqueApparente(12.5, 0.005),
                'unite' => 'kg/m³',
            ],
            [
                'id' => 'teneur_eau',
                'titre' => 'Teneur en eau W',
                'norme' => 'NF EN ISO 17892-1',
                'formule' => 'W = ((m_humide - m_sec) / m_sec) × 100',
                'description' => 'Masses en g ou kg (même unité).',
                'exemple_entree' => ['m_humide' => 1520, 'm_sec' => 1380],
                'exemple_sortie' => self::teneurEau(1520, 1380),
                'unite' => '%',
            ],
            [
                'id' => 'indice_plasticite',
                'titre' => 'Indice de plasticité (IP)',
                'norme' => 'NF EN ISO 17892-12',
                'formule' => 'IP = WL - WP',
                'description' => 'WL = limite de liquidité, WP = limite de plasticité.',
                'exemple_entree' => ['WL' => 45, 'WP' => 22],
                'exemple_sortie' => self::indicePlasticite(45, 22),
                'unite' => '-',
            ],
        ];
    }

    /**
     * Exécute un calcul par son identifiant et les valeurs fournies.
     */
    public static function calculer(string $id, array $valeurs): ?float
    {
        return match ($id) {
            'resistance_caracteristique_beton' => self::resistanceCaracteristiqueBeton(
                $valeurs['resistances_MPa'] ?? [],
                (float) ($valeurs['k'] ?? 1.48)
            ),
            'module_finesse' => self::moduleFinesse($valeurs['refus_cumules'] ?? []),
            'equivalent_sable' => self::equivalentSable(
                (float) ($valeurs['h_sable'] ?? 0),
                (float) ($valeurs['h_total'] ?? 0)
            ),
            'cbr' => self::cbr(
                (float) ($valeurs['force_kN'] ?? 0),
                (float) ($valeurs['section_mm2'] ?? 1963.5),
                (float) ($valeurs['penetration_mm'] ?? 2.5)
            ),
            'masse_volumique_apparente' => self::masseVolumiqueApparente(
                (float) ($valeurs['m_kg'] ?? 0),
                (float) ($valeurs['V_m3'] ?? 0)
            ),
            'teneur_eau' => self::teneurEau(
                (float) ($valeurs['m_humide'] ?? 0),
                (float) ($valeurs['m_sec'] ?? 0)
            ),
            'indice_plasticite' => self::indicePlasticite(
                (float) ($valeurs['WL'] ?? 0),
                (float) ($valeurs['WP'] ?? 0)
            ),
            default => null,
        };
    }

    /**
     * Courbe granulométrique — % passants cumulés vs ouverture de tamis (mm).
     * D10, D30, D60 par interpolation linéaire sur log10(d) (NF EN ISO 17892-4, pratique courante).
     * Cu = D60/D10, Cc = D30²/(D60×D10).
     *
     * @param  array<int, array{opening_mm: float, passing_percent: float}>  $points
     * @return array{d10: ?float, d30: ?float, d60: ?float, cu: ?float, cc: ?float}|null
     */
    public static function granulometryIndicators(array $points): ?array
    {
        $clean = [];
        foreach ($points as $row) {
            $d = (float) ($row['opening_mm'] ?? 0);
            $p = (float) ($row['passing_percent'] ?? 0);
            if ($d > 0 && $p >= 0 && $p <= 100) {
                $clean[] = ['opening_mm' => $d, 'passing_percent' => $p];
            }
        }
        if (count($clean) < 2) {
            return null;
        }
        usort($clean, fn ($a, $b) => $a['opening_mm'] <=> $b['opening_mm']);

        $d10 = self::interpolateOpeningForPassingPercent($clean, 10.0);
        $d30 = self::interpolateOpeningForPassingPercent($clean, 30.0);
        $d60 = self::interpolateOpeningForPassingPercent($clean, 60.0);

        $cu = ($d10 !== null && $d10 > 0 && $d60 !== null) ? round($d60 / $d10, 3) : null;
        $cc = ($d10 !== null && $d10 > 0 && $d30 !== null && $d60 !== null)
            ? round(($d30 * $d30) / ($d60 * $d10), 3)
            : null;

        return [
            'd10' => $d10,
            'd30' => $d30,
            'd60' => $d60,
            'cu' => $cu,
            'cc' => $cc,
        ];
    }

    /**
     * @param  array<int, array{opening_mm: float, passing_percent: float}>  $sortedByOpeningAsc
     */
    private static function interpolateOpeningForPassingPercent(array $sortedByOpeningAsc, float $passTarget): ?float
    {
        $n = count($sortedByOpeningAsc);
        for ($i = 0; $i < $n - 1; $i++) {
            $p0 = $sortedByOpeningAsc[$i]['passing_percent'];
            $p1 = $sortedByOpeningAsc[$i + 1]['passing_percent'];
            $d0 = $sortedByOpeningAsc[$i]['opening_mm'];
            $d1 = $sortedByOpeningAsc[$i + 1]['opening_mm'];
            if ($d0 <= 0 || $d1 <= 0) {
                continue;
            }
            $minP = min($p0, $p1);
            $maxP = max($p0, $p1);
            if ($passTarget + 1e-9 < $minP || $passTarget - 1e-9 > $maxP) {
                continue;
            }
            if (abs($p1 - $p0) < 1e-9) {
                continue;
            }
            $t = ($passTarget - $p0) / ($p1 - $p0);
            $t = max(0.0, min(1.0, $t));
            $logd0 = log10($d0);
            $logd1 = log10($d1);
            $logd = $logd0 + $t * ($logd1 - $logd0);

            return round(pow(10, $logd), 6);
        }

        return null;
    }
}
