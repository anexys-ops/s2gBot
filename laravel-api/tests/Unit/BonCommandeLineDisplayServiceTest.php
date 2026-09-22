<?php

namespace Tests\Unit;

use App\Models\BonCommandeLigne;
use App\Services\BonCommandeLineDisplayService;
use Illuminate\Support\Collection;
use PHPUnit\Framework\TestCase;

class BonCommandeLineDisplayServiceTest extends TestCase
{
    public function test_it_places_the_forfait_jalon_before_its_detail_lines(): void
    {
        $lignes = new Collection([
            $this->line(1, 101, 'Déplacement', 0),
            $this->line(2, 102, 'Essai béton', 1),
            $this->line(3, null, 'Prestation forfaitaire — Contrôle béton', 2),
            $this->line(4, 999, 'Produit seul', 3),
        ]);
        $meta = [
            'devis_jalons' => [[
                'id' => 'cb',
                'libelle' => 'Contrôle béton',
                's2g_code' => 'CB',
                'mode' => 'forfait',
                'product_ref_article_ids' => [101, 102],
            ]],
            'devis_parcours' => [
                ['kind' => 'jalon', 'id' => 'cb'],
                ['kind' => 'ligne', 'id' => 'standalone'],
            ],
        ];

        $rows = (new BonCommandeLineDisplayService)->build($lignes, $meta);

        $this->assertSame(['jalon_header', 'product', 'product', 'product'], array_column($rows, 'type'));
        $this->assertSame(3, $rows[0]['forfait_ligne']->id);
        $this->assertSame('CB', $rows[0]['code']);
        $this->assertSame([1, 2, 4], array_map(
            fn (array $row) => $row['ligne']->id,
            array_slice($rows, 1),
        ));
        $this->assertTrue($rows[1]['nested']);
        $this->assertTrue($rows[2]['nested']);
        $this->assertFalse($rows[3]['nested']);
    }

    private function line(int $id, ?int $refId, string $label, int $order): BonCommandeLigne
    {
        $line = new BonCommandeLigne;
        $line->forceFill([
            'id' => $id,
            'ref_article_id' => $refId,
            'libelle' => $label,
            'ordre' => $order,
            'quantite' => 1,
            'prix_unitaire_ht' => 100,
            'montant_ht' => 100,
        ]);

        return $line;
    }
}
