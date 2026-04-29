<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Dossier;
use App\Models\ExpenseReport;
use App\Models\Invoice;
use App\Models\MissionTask;
use App\Models\OrdreMission;
use App\Models\Quote;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlobalSearchController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $q = trim((string) $request->query('q', ''));
        if (strlen($q) < 2) {
            return response()->json(['results' => []]);
        }

        $results = [];
        $like = '%' . $q . '%';

        // ── Clients ────────────────────────────────────────────────────────
        $clients = Client::where('name', 'like', $like)
            ->orWhere('ice', 'like', $like)
            ->orWhere('email', 'like', $like)
            ->limit(5)->get(['id', 'name', 'city', 'email']);
        foreach ($clients as $c) {
            $results[] = ['type' => 'client', 'id' => $c->id, 'label' => $c->name, 'sub' => $c->city ?? $c->email ?? '', 'url' => "/clients/{$c->id}/fiche"];
        }

        // ── Contacts ───────────────────────────────────────────────────────
        try {
            $contacts = \App\Models\ClientContact::where('nom', 'like', $like)
                ->orWhere('prenom', 'like', $like)
                ->orWhere('email', 'like', $like)
                ->with('client:id,name')
                ->limit(5)->get();
            foreach ($contacts as $ct) {
                $results[] = ['type' => 'contact', 'id' => $ct->id, 'label' => trim("{$ct->prenom} {$ct->nom}"), 'sub' => $ct->client?->name ?? '', 'url' => "/clients/{$ct->client_id}/contacts"];
            }
        } catch (\Exception $e) {}

        // ── Dossiers ───────────────────────────────────────────────────────
        try {
            $dossiers = Dossier::where('reference', 'like', $like)
                ->orWhere('titre', 'like', $like)
                ->with('client:id,name')
                ->limit(5)->get(['id', 'reference', 'titre', 'client_id']);
            foreach ($dossiers as $d) {
                $results[] = ['type' => 'dossier', 'id' => $d->id, 'label' => $d->reference ?? $d->titre ?? "Dossier #{$d->id}", 'sub' => $d->client?->name ?? '', 'url' => "/dossiers/{$d->id}"];
            }
        } catch (\Exception $e) {}

        // ── Ordres de mission ──────────────────────────────────────────────
        try {
            $oms = OrdreMission::where('numero', 'like', $like)
                ->orWhere('unique_number', 'like', $like)
                ->orWhere('notes', 'like', $like)
                ->with('dossier:id,reference', 'client:id,name')
                ->limit(5)->get(['id', 'numero', 'unique_number', 'type', 'statut', 'dossier_id', 'client_id']);
            foreach ($oms as $om) {
                $label = $om->unique_number ?? $om->numero ?? "OM#{$om->id}";
                $results[] = ['type' => 'ordre_mission', 'id' => $om->id, 'label' => $label, 'sub' => $om->client?->name ?? $om->dossier?->reference ?? '', 'url' => "/ordres-mission/{$om->id}"];
            }
        } catch (\Exception $e) {}

        // ── Tâches de mission ──────────────────────────────────────────────
        try {
            $tasks = MissionTask::where('unique_number', 'like', $like)
                ->orWhere('notes', 'like', $like)
                ->with('ordreMissionLigne.ordreMission:id,unique_number,numero')
                ->limit(5)->get(['id', 'unique_number', 'statut', 'ordre_mission_ligne_id']);
            foreach ($tasks as $t) {
                $label = $t->unique_number ?? "TSK#{$t->id}";
                $omRef = $t->ordreMissionLigne?->ordreMission?->unique_number ?? '';
                $results[] = ['type' => 'task', 'id' => $t->id, 'label' => $label, 'sub' => $omRef, 'url' => "/labo/taches"];
            }
        } catch (\Exception $e) {}

        // ── Notes de frais ─────────────────────────────────────────────────
        try {
            $ndfs = ExpenseReport::where('unique_number', 'like', $like)
                ->orWhere('notes', 'like', $like)
                ->with('ordreMission:id,unique_number')
                ->limit(5)->get(['id', 'unique_number', 'statut', 'ordre_mission_id']);
            foreach ($ndfs as $n) {
                $results[] = ['type' => 'ndf', 'id' => $n->id, 'label' => $n->unique_number ?? "NDF#{$n->id}", 'sub' => $n->ordreMission?->unique_number ?? '', 'url' => "/notes-de-frais/{$n->id}"];
            }
        } catch (\Exception $e) {}

        // ── Devis ──────────────────────────────────────────────────────────
        try {
            $quotes = Quote::where('number', 'like', $like)
                ->orWhereHas('client', fn ($cq) => $cq->where('name', 'like', $like))
                ->with('client:id,name')
                ->limit(5)->get(['id', 'number', 'client_id', 'status']);
            foreach ($quotes as $qt) {
                $results[] = ['type' => 'devis', 'id' => $qt->id, 'label' => $qt->number, 'sub' => $qt->client?->name ?? '', 'url' => "/devis/{$qt->id}"];
            }
        } catch (\Exception $e) {}

        // ── Factures ───────────────────────────────────────────────────────
        try {
            $invoices = Invoice::where('number', 'like', $like)
                ->orWhereHas('client', fn ($iq) => $iq->where('name', 'like', $like))
                ->with('client:id,name')
                ->limit(5)->get(['id', 'number', 'client_id']);
            foreach ($invoices as $inv) {
                $results[] = ['type' => 'facture', 'id' => $inv->id, 'label' => $inv->number, 'sub' => $inv->client?->name ?? '', 'url' => "/invoices/{$inv->id}"];
            }
        } catch (\Exception $e) {}

        // ── Articles catalogue ─────────────────────────────────────────────
        try {
            $articles = \App\Models\RefArticle::where('designation', 'like', $like)
                ->orWhere('code', 'like', $like)
                ->limit(5)->get(['id', 'designation', 'code']);
            foreach ($articles as $art) {
                $results[] = ['type' => 'article', 'id' => $art->id, 'label' => $art->designation, 'sub' => $art->code ?? '', 'url' => "/catalogue/articles/{$art->id}"];
            }
        } catch (\Exception $e) {}

        return response()->json(['results' => array_slice($results, 0, 25)]);
    }
}
