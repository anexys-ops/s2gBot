<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Dossier;
use App\Models\Site;
use App\Support\AgencyAccess;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class DossierController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Dossier::query()->with(['client', 'site', 'createur', 'mission']);
        AgencyAccess::applyDossierScope($q, $request->user());

        if ($request->filled('client_id')) {
            $q->where('client_id', (int) $request->query('client_id'));
        }
        if ($request->filled('statut')) {
            $q->where('statut', (string) $request->query('statut'));
        }
        if ($request->filled('site_id')) {
            $q->where('site_id', (int) $request->query('site_id'));
        }
        if ($request->filled('date_debut_from')) {
            $q->whereDate('date_debut', '>=', (string) $request->query('date_debut_from'));
        }
        if ($request->filled('date_debut_to')) {
            $q->whereDate('date_debut', '<=', (string) $request->query('date_debut_to'));
        }

        return response()->json($q->ordonne()->get());
    }

    public function show(Request $request, Dossier $dossier): JsonResponse
    {
        if (! AgencyAccess::userMayAccessDossier($request->user(), $dossier)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $dossier->load([
            'client',
            'site',
            'createur',
            'mission',
            'contacts',
            'missions',
            'quotes' => fn ($q) => $q->orderByDesc('quote_date')->orderByDesc('id'),
            'attachments.uploader',
        ]);

        return response()->json($dossier);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $this->validated($request);
        $this->assertSiteBelongsToClient($data['site_id'], $data['client_id']);
        if (! empty($data['mission_id'])) {
            $this->assertMissionMatches($data['mission_id'], $data['site_id'], $data['client_id']);
        }

        $contactRows = $data['contacts'] ?? [];
        unset($data['contacts']);

        $dossier = Dossier::query()->create(array_merge($data, [
            'created_by' => $request->user()->id,
        ]));

        if ($contactRows !== []) {
            $this->syncContacts($dossier, $contactRows, replaceAll: true);
        }

        return response()->json($dossier->load(['client', 'site', 'createur', 'mission', 'contacts']), 201);
    }

    public function update(Request $request, Dossier $dossier): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $data = $this->validated($request, $dossier, partial: true);
        if (isset($data['client_id'], $data['site_id'])) {
            $this->assertSiteBelongsToClient($data['site_id'], $data['client_id']);
        } elseif (isset($data['site_id'])) {
            $this->assertSiteBelongsToClient($data['site_id'], $dossier->client_id);
        } elseif (isset($data['client_id'])) {
            $this->assertSiteBelongsToClient($dossier->site_id, $data['client_id']);
        }
        if (array_key_exists('mission_id', $data)) {
            $clientId = $data['client_id'] ?? $dossier->client_id;
            $siteId = $data['site_id'] ?? $dossier->site_id;
            if (! empty($data['mission_id'])) {
                $this->assertMissionMatches($data['mission_id'], $siteId, $clientId);
            }
        }

        $contacts = $data['contacts'] ?? null;
        unset($data['contacts']);
        if ($data !== []) {
            $dossier->update($data);
        }
        if (array_key_exists('contacts', $request->all()) && is_array($contacts)) {
            $this->syncContacts($dossier->fresh(), $contacts, replaceAll: true);
        }

        return response()->json(
            $dossier->fresh()->load([
                'client',
                'site',
                'createur',
                'mission',
                'contacts',
                'missions',
                'quotes',
                'attachments.uploader',
            ])
        );
    }

    public function destroy(Request $request, Dossier $dossier): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        $dossier->delete();

        return response()->json(null, 204);
    }

    public function devis(Request $request, Dossier $dossier): JsonResponse
    {
        if (! AgencyAccess::userMayAccessDossier($request->user(), $dossier)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $quotes = $dossier->quotes()
            ->with(['client', 'site', 'agency'])
            ->orderByDesc('quote_date')
            ->orderByDesc('id')
            ->get();

        return response()->json($quotes);
    }

    public function bons(Request $request, Dossier $dossier): JsonResponse
    {
        if (! AgencyAccess::userMayAccessDossier($request->user(), $dossier)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $bc = $dossier->bonsCommande()
            ->with(['lignes'])
            ->orderByDesc('date_commande')
            ->orderByDesc('id')
            ->get();
        $bl = $dossier->bonsLivraison()
            ->with(['lignes'])
            ->orderByDesc('date_livraison')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'bons_commande' => $bc,
            'bons_livraison' => $bl,
        ]);
    }

    public function addContact(Request $request, Dossier $dossier): JsonResponse
    {
        if (! $request->user()->isLab()) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }
        if (! AgencyAccess::userMayAccessDossier($request->user(), $dossier)) {
            return response()->json(['message' => 'Non autorisé'], 403);
        }

        $row = $request->validate([
            'nom' => 'required|string|max:255',
            'prenom' => 'nullable|string|max:255',
            'email' => 'nullable|email|max:255',
            'telephone' => 'nullable|string|max:50',
            'role' => 'nullable|string|max:64',
        ]);

        $contact = $dossier->contacts()->create($row);

        return response()->json($contact, 201);
    }

    /**
     * @return array<string, mixed>
     */
    private function validated(Request $request, ?Dossier $forUpdate = null, bool $partial = false): array
    {
        $statutRule = Rule::in(Dossier::statuts());

        $refRule = 'nullable|string|max:32|unique:dossiers,reference';
        if ($forUpdate) {
            $refRule = ['sometimes', 'string', 'max:32', Rule::unique('dossiers', 'reference')->ignore($forUpdate->id)];
        }

        $base = [
            'titre' => $partial ? 'sometimes|string|max:255' : 'required|string|max:255',
            'client_id' => $partial ? 'sometimes|integer|exists:clients,id' : 'required|integer|exists:clients,id',
            'site_id' => $partial ? 'sometimes|integer|exists:sites,id' : 'required|integer|exists:sites,id',
            'mission_id' => 'nullable|integer|exists:missions,id',
            'statut' => $partial ? ['sometimes', 'string', $statutRule] : ['required', 'string', $statutRule],
            'date_debut' => $partial ? 'sometimes|date' : 'required|date',
            'date_fin_prevue' => 'nullable|date',
            'maitre_ouvrage' => 'nullable|string|max:255',
            'entreprise_chantier' => 'nullable|string|max:255',
            'notes' => 'nullable|string',
            'reference' => $forUpdate ? $refRule : 'nullable|string|max:32|unique:dossiers,reference',
            'contacts' => 'nullable|array',
            'contacts.*.id' => 'nullable|integer|exists:dossier_contacts,id',
            'contacts.*.nom' => 'required_with:contacts|string|max:255',
            'contacts.*.prenom' => 'nullable|string|max:255',
            'contacts.*.email' => 'nullable|email|max:255',
            'contacts.*.telephone' => 'nullable|string|max:50',
            'contacts.*.role' => 'nullable|string|max:64',
        ];

        return $request->validate($base);
    }

    private function assertSiteBelongsToClient(int $siteId, int $clientId): void
    {
        if (! Site::query()->whereKey($siteId)->where('client_id', $clientId)->exists()) {
            throw new HttpResponseException(
                response()->json(['message' => 'Le chantier ne correspond pas à ce client.'], 422)
            );
        }
    }

    private function assertMissionMatches(int $missionId, int $siteId, int $clientId): void
    {
        $site = Site::query()->whereKey($siteId)->where('client_id', $clientId)->first();
        if (! $site) {
            throw new HttpResponseException(
                response()->json(['message' => 'Le chantier ne correspond pas à ce client.'], 422)
            );
        }
        if (! $site->missions()->whereKey($missionId)->exists()) {
            throw new HttpResponseException(
                response()->json(['message' => 'La mission n’appartient pas à ce chantier.'], 422)
            );
        }
    }

    /**
     * @param  array<int, array<string, mixed>>  $rows
     */
    private function syncContacts(Dossier $dossier, array $rows, bool $replaceAll): void
    {
        if ($replaceAll && $rows === []) {
            $dossier->contacts()->delete();

            return;
        }

        $kept = [];
        foreach ($rows as $row) {
            if (! empty($row['id'])) {
                $c = $dossier->contacts()->whereKey($row['id'])->first();
                if ($c) {
                    $c->update([
                        'nom' => $row['nom'],
                        'prenom' => $row['prenom'] ?? null,
                        'email' => $row['email'] ?? null,
                        'telephone' => $row['telephone'] ?? null,
                        'role' => $row['role'] ?? null,
                    ]);
                    $kept[] = $c->id;
                }
            } else {
                $c = $dossier->contacts()->create([
                    'nom' => $row['nom'],
                    'prenom' => $row['prenom'] ?? null,
                    'email' => $row['email'] ?? null,
                    'telephone' => $row['telephone'] ?? null,
                    'role' => $row['role'] ?? null,
                ]);
                $kept[] = $c->id;
            }
        }
        $dossier->contacts()->whereNotIn('id', $kept)->delete();
    }
}
