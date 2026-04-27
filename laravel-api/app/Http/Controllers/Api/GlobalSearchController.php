<?php
namespace App\Http\Controllers\Api;
use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Quote;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GlobalSearchController extends Controller {
    public function search(Request $request): JsonResponse {
        $q = trim((string) $request->query('q', ''));
        if (strlen($q) < 2) return response()->json(['results' => []]);
        
        $results = [];
        $like = '%' . $q . '%';
        
        // Clients
        $clients = Client::where('name', 'like', $like)
            ->orWhere('ice', 'like', $like)
            ->orWhere('email', 'like', $like)
            ->limit(5)->get(['id','name','city','email']);
        foreach ($clients as $c) {
            $results[] = ['type'=>'client','id'=>$c->id,'label'=>$c->name,'sub'=>$c->city ?? $c->email ?? '','url'=>"/clients/{$c->id}/fiche"];
        }
        
        // Contacts
        try {
            $contacts = \App\Models\ClientContact::where('nom', 'like', $like)
                ->orWhere('prenom', 'like', $like)
                ->orWhere('email', 'like', $like)
                ->with('client:id,name')
                ->limit(5)->get();
            foreach ($contacts as $ct) {
                $results[] = ['type'=>'contact','id'=>$ct->id,'label'=>trim("{$ct->prenom} {$ct->nom}"),'sub'=>$ct->client?->name ?? '','url'=>"/clients/{$ct->client_id}/contacts"];
            }
        } catch (\Exception $e) {}
        
        // Devis
        try {
            $quotes = Quote::where('number', 'like', $like)
                ->orWhereHas('client', fn($cq) => $cq->where('name', 'like', $like))
                ->with('client:id,name')
                ->limit(5)->get(['id','number','client_id','status']);
            foreach ($quotes as $qt) {
                $results[] = ['type'=>'devis','id'=>$qt->id,'label'=>$qt->number,'sub'=>$qt->client?->name ?? '','url'=>"/devis/{$qt->id}"];
            }
        } catch (\Exception $e) {}
        
        // Factures
        try {
            $invoices = Invoice::where('number', 'like', $like)
                ->orWhereHas('client', fn($iq) => $iq->where('name', 'like', $like))
                ->with('client:id,name')
                ->limit(5)->get(['id','number','client_id']);
            foreach ($invoices as $inv) {
                $results[] = ['type'=>'facture','id'=>$inv->id,'label'=>$inv->number,'sub'=>$inv->client?->name ?? '','url'=>"/invoices/{$inv->id}"];
            }
        } catch (\Exception $e) {}
        
        // Articles catalogue
        try {
            $articles = \App\Models\RefArticle::where('designation', 'like', $like)
                ->orWhere('code', 'like', $like)
                ->limit(5)->get(['id','designation','code']);
            foreach ($articles as $art) {
                $results[] = ['type'=>'article','id'=>$art->id,'label'=>$art->designation,'sub'=>$art->code ?? '','url'=>"/catalogue/articles/{$art->id}"];
            }
        } catch (\Exception $e) {}
        
        return response()->json(['results' => array_slice($results, 0, 20)]);
    }
}
