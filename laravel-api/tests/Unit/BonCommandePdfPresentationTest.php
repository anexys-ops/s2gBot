<?php

namespace Tests\Unit;

use App\Models\BonCommande;
use App\Models\Client;
use App\Models\ClientContact;
use App\Models\Dossier;
use App\Models\DossierContact;
use App\Models\Site;
use App\Models\User;
use App\Services\BonCommandePdfPresentationService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class BonCommandePdfPresentationTest extends TestCase
{
    use RefreshDatabase;

    public function test_build_context_includes_client_dossier_and_site_details(): void
    {
        $user = User::factory()->create(['role' => User::ROLE_LAB_ADMIN, 'client_id' => null, 'site_id' => null]);
        $client = Client::query()->create([
            'name' => 'JET-CONTRACTORS',
            'address' => '12 rue Atlas',
            'city' => 'Casablanca',
            'ice' => '001234567890123',
            'email' => 'contact@jet.ma',
            'phone' => '0522000000',
        ]);
        $site = Site::query()->create([
            'client_id' => $client->id,
            'name' => 'Tour Marina',
            'address' => 'Boulevard de la Corniche',
            'reference' => 'CH-001',
        ]);
        $dossier = Dossier::query()->create([
            'reference' => 'DOS-2026-001',
            'titre' => 'Contrôle béton',
            'client_id' => $client->id,
            'site_id' => $site->id,
            'statut' => Dossier::STATUT_EN_COURS,
            'date_debut' => '2026-03-01',
            'date_fin_prevue' => '2026-06-30',
            'maitre_ouvrage' => 'Promoteur ABC',
            'entreprise_chantier' => 'Entreprise XYZ',
            'notes' => 'Accès chantier côté nord.',
            'created_by' => $user->id,
        ]);
        DossierContact::query()->create([
            'dossier_id' => $dossier->id,
            'nom' => 'Benali',
            'prenom' => 'Karim',
            'role' => 'Conducteur de travaux',
            'email' => 'k.benali@xyz.ma',
            'telephone' => '0661000000',
        ]);
        $contact = ClientContact::query()->create([
            'client_id' => $client->id,
            'nom' => 'Alaoui',
            'prenom' => 'Sara',
            'poste' => 'Acheteuse',
            'email' => 's.alaoui@jet.ma',
            'telephone_mobile' => '0662000000',
        ]);
        $bc = BonCommande::query()->create([
            'numero' => 'BC-2026-001',
            'dossier_id' => $dossier->id,
            'client_id' => $client->id,
            'contact_id' => $contact->id,
            'statut' => BonCommande::STATUT_CONFIRME,
            'date_commande' => '2026-03-15',
            'montant_ht' => 1000,
            'montant_ttc' => 1200,
            'created_by' => $user->id,
        ]);

        $bc->load(['client', 'clientContact', 'dossier.site', 'dossier.contacts']);

        $ctx = app(BonCommandePdfPresentationService::class)->buildContext($bc);

        $this->assertSame('Tour Marina — Contrôle béton', $ctx['affaire']);
        $this->assertSame('JET-CONTRACTORS', $ctx['client']['name']);
        $this->assertSame('001234567890123', $ctx['client']['ice']);
        $this->assertSame('Sara Alaoui', $ctx['client']['contact_name']);
        $this->assertSame('DOS-2026-001', $ctx['dossier']['reference']);
        $this->assertSame('En cours', $ctx['dossier']['statut_label']);
        $this->assertSame('Promoteur ABC', $ctx['dossier']['maitre_ouvrage']);
        $this->assertSame('Tour Marina', $ctx['site']['name']);
        $this->assertCount(1, $ctx['dossier_contacts']);
        $this->assertSame('Karim Benali', $ctx['dossier_contacts'][0]['name']);
        $this->assertSame('Confirmé', $ctx['bc_statut_label']);
    }
}
