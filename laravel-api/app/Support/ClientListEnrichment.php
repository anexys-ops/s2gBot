<?php

namespace App\Support;

use App\Models\Client;
use App\Models\Invoice;
use App\Models\Quote;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

final class ClientListEnrichment
{
    /**
     * @param  EloquentCollection<int, Client>  $clients
     */
    public static function enrich(EloquentCollection $clients): void
    {
        $ids = $clients->pluck('id')->filter()->values();
        if ($ids->isEmpty()) {
            return;
        }

        $dueByClient = Invoice::query()
            ->whereIn('client_id', $ids)
            ->whereNotIn('status', [Invoice::STATUS_PAID, Invoice::STATUS_DRAFT])
            ->selectRaw('client_id, SUM(amount_ttc) as amount_due')
            ->groupBy('client_id')
            ->pluck('amount_due', 'client_id');

        $overdueByClient = Invoice::query()
            ->whereIn('client_id', $ids)
            ->whereNotIn('status', [Invoice::STATUS_PAID, Invoice::STATUS_DRAFT])
            ->whereNotNull('due_date')
            ->where('due_date', '<', now()->toDateString())
            ->selectRaw('client_id, COUNT(*) as c')
            ->groupBy('client_id')
            ->pluck('c', 'client_id');

        $paidCountByClient = Invoice::query()
            ->whereIn('client_id', $ids)
            ->where('status', Invoice::STATUS_PAID)
            ->selectRaw('client_id, COUNT(*) as c')
            ->groupBy('client_id')
            ->pluck('c', 'client_id');

        $invoiceCountByClient = Invoice::query()
            ->whereIn('client_id', $ids)
            ->selectRaw('client_id, COUNT(*) as c')
            ->groupBy('client_id')
            ->pluck('c', 'client_id');

        $openQuotesByClient = Quote::query()
            ->whereIn('client_id', $ids)
            ->whereNotIn('status', [Quote::STATUS_INVOICED, Quote::STATUS_LOST, Quote::STATUS_REJECTED])
            ->selectRaw('client_id, COUNT(*) as c')
            ->groupBy('client_id')
            ->pluck('c', 'client_id');

        $tagsByClient = self::tagsForClients($ids);

        foreach ($clients as $client) {
            $id = (int) $client->id;
            $client->setAttribute('list_signals', [
                'amount_due_ttc' => round((float) ($dueByClient[$id] ?? 0), 2),
                'overdue_invoices_count' => (int) ($overdueByClient[$id] ?? 0),
                'paid_invoices_count' => (int) ($paidCountByClient[$id] ?? 0),
                'invoices_count' => (int) ($invoiceCountByClient[$id] ?? 0),
                'open_quotes_count' => (int) ($openQuotesByClient[$id] ?? 0),
            ]);
            $client->setAttribute('tags', $tagsByClient->get($id, collect())->values()->all());
        }
    }

    /**
     * @param  Collection<int, int>  $clientIds
     * @return Collection<int, Collection<int, array{id: int, name: string, color: string|null}>>
     */
    private static function tagsForClients(Collection $clientIds): Collection
    {
        $rows = DB::table('taggables')
            ->join('tags', 'tags.id', '=', 'taggables.tag_id')
            ->where('taggables.taggable_type', Client::class)
            ->whereIn('taggables.taggable_id', $clientIds)
            ->select('taggables.taggable_id', 'tags.id', 'tags.name', 'tags.color')
            ->orderBy('tags.name')
            ->get();

        return $rows->groupBy('taggable_id')->map(function ($group) {
            return collect($group)->map(fn ($row) => [
                'id' => (int) $row->id,
                'name' => (string) $row->name,
                'color' => $row->color ? (string) $row->color : null,
            ]);
        });
    }
}
