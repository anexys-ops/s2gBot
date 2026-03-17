<?php

namespace Database\Seeders;

use App\Models\MailTemplate;
use Illuminate\Database\Seeder;

class MailTemplateSeeder extends Seeder
{
    public function run(): void
    {
        $templates = [
            [
                'name' => 'devis_envoye',
                'subject' => 'Votre devis {{quote_number}}',
                'body' => "Bonjour,\n\nVeuillez trouver ci-joint notre devis n° {{quote_number}}.\n\nCordialement,\nL'équipe Lab BTP",
                'description' => 'Envoi d\'un devis au client',
            ],
            [
                'name' => 'facture_envoyee',
                'subject' => 'Facture {{invoice_number}}',
                'body' => "Bonjour,\n\nVeuillez trouver ci-joint notre facture n° {{invoice_number}}.\n\nCordialement,\nL'équipe Lab BTP",
                'description' => 'Envoi d\'une facture au client',
            ],
            [
                'name' => 'rapport_pret',
                'subject' => 'Rapport d\'essais - Commande {{order_reference}}',
                'body' => "Bonjour,\n\nLe rapport d'essais pour la commande {{order_reference}} est disponible.\n\nCordialement,\nL'équipe Lab BTP",
                'description' => 'Notification rapport disponible',
            ],
        ];

        foreach ($templates as $t) {
            MailTemplate::updateOrCreate(
                ['name' => $t['name']],
                $t
            );
        }
    }
}
