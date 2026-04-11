<?php

namespace Database\Seeders;

use App\Models\Client;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Sample;
use App\Models\TestResult;
use App\Models\TestType;
use App\Models\User;
use Illuminate\Database\Seeder;

/**
 * Données de démonstration pour alimenter les graphiques (séries de résultats numériques).
 */
class DemoEssaisGraphiquesSeeder extends Seeder
{
    public function run(): void
    {
        if (Order::where('reference', 'CMD-DEMO-GRAPH')->exists()) {
            return;
        }

        $admin = User::where('role', User::ROLE_LAB_ADMIN)->first();
        $client = Client::first();
        if (! $client || ! $admin) {
            return;
        }

        $tBeton = TestType::where('name', 'like', '%compression%')->first();
        $tGranul = TestType::where('name', 'like', '%granulom%')->first();
        if (! $tBeton) {
            return;
        }

        $paramResistance = $tBeton->params()->where('name', 'like', '%Résistance%')->first();
        if (! $paramResistance) {
            return;
        }

        $order = Order::create([
            'reference' => 'CMD-DEMO-GRAPH',
            'client_id' => $client->id,
            'user_id' => $admin->id,
            'status' => Order::STATUS_COMPLETED,
            'order_date' => now()->subMonths(2),
            'notes' => 'Commande de démonstration — graphiques essais',
        ]);

        $n = 18;
        $item = OrderItem::create([
            'order_id' => $order->id,
            'test_type_id' => $tBeton->id,
            'quantity' => $n,
        ]);

        for ($i = 0; $i < $n; $i++) {
            $sample = Sample::create([
                'order_item_id' => $item->id,
                'reference' => $order->reference.'-DEMO-'.($i + 1),
                'status' => 'tested',
                'received_at' => now()->subDays($n - $i),
            ]);
            $sigma = 28 + $i * 0.55 + sin($i * 0.4) * 1.2;
            TestResult::create([
                'sample_id' => $sample->id,
                'test_type_param_id' => $paramResistance->id,
                'value' => (string) round($sigma, 2),
            ]);
        }

        if ($tGranul) {
            $paramRefus = $tGranul->params()->where('name', 'like', '%Refus%')->first();
            if ($paramRefus) {
                $item2 = OrderItem::create([
                    'order_id' => $order->id,
                    'test_type_id' => $tGranul->id,
                    'quantity' => 10,
                ]);
                $refusSerie = [2, 5, 12, 22, 35, 48, 58, 68, 78, 88];
                foreach ($refusSerie as $idx => $val) {
                    $sample = Sample::create([
                        'order_item_id' => $item2->id,
                        'reference' => $order->reference.'-GR-'.($idx + 1),
                        'status' => 'tested',
                    ]);
                    TestResult::create([
                        'sample_id' => $sample->id,
                        'test_type_param_id' => $paramRefus->id,
                        'value' => (string) $val,
                    ]);
                }
            }
        }

        // Évolution sur plusieurs mois : commandes factices supplémentaires
        foreach ([3, 2, 1, 0] as $m) {
            $ref = 'CMD-DEMO-MOIS-'.(now()->subMonths($m)->format('Ym'));
            if (Order::where('reference', $ref)->exists()) {
                continue;
            }
            Order::create([
                'reference' => $ref,
                'client_id' => $client->id,
                'user_id' => $admin->id,
                'status' => Order::STATUS_COMPLETED,
                'order_date' => now()->subMonths($m)->startOfMonth()->addDays(5),
                'notes' => 'Démo évolution mensuelle',
            ]);
        }
    }
}
