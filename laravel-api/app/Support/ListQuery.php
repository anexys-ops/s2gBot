<?php

namespace App\Support;

use App\Models\Client;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

/**
 * Tri et filtres communs à toutes les vues liste (paramètres identiques partout) :
 *  - sort=<clé>&direction=asc|desc — clés standard : created_at (défaut, plus récent d'abord),
 *    date (date du document), numero, client, nom, montant, statut ;
 *  - created_from / created_to (Y-m-d) — période sur la date de création ;
 *  - client_id.
 * Chaque endpoint déclare les clés qu'il supporte ; une clé inconnue retombe sur le défaut.
 */
final class ListQuery
{
    public const DEFAULT_SORT = 'created_at';

    /**
     * @param  array<string, string|callable(Builder, string): void>  $sortable  clé => colonne ou callback
     */
    public static function sort(Builder $query, Request $request, array $sortable, string $default = self::DEFAULT_SORT): Builder
    {
        $key = $request->query('sort');
        if (! is_string($key) || ! array_key_exists($key, $sortable)) {
            $key = array_key_exists($default, $sortable) ? $default : (string) array_key_first($sortable);
        }
        $direction = strtolower((string) $request->query('direction', ''));
        if (! in_array($direction, ['asc', 'desc'], true)) {
            // Dates et montants : du plus récent / plus grand ; textes : A → Z.
            $direction = in_array($key, ['created_at', 'date', 'montant'], true) ? 'desc' : 'asc';
        }

        $column = $sortable[$key];
        if (is_callable($column)) {
            $column($query, $direction);
        } else {
            $query->orderBy($column, $direction);
        }

        return $query->orderBy($query->getModel()->getQualifiedKeyName(), $direction);
    }

    /** Filtres communs : période de création et client. */
    public static function filter(Builder $query, Request $request, ?string $clientColumn = 'client_id'): Builder
    {
        $table = $query->getModel()->getTable();
        if ($from = self::date($request->query('created_from'))) {
            $query->whereDate($table.'.created_at', '>=', $from);
        }
        if ($to = self::date($request->query('created_to'))) {
            $query->whereDate($table.'.created_at', '<=', $to);
        }
        if ($clientColumn !== null && $request->filled('client_id')) {
            $query->where($table.'.'.$clientColumn, (int) $request->query('client_id'));
        }

        return $query;
    }

    /** Tri par nom du client (colonne client_id de la table de la liste). */
    public static function byClientName(string $table, string $column = 'client_id'): callable
    {
        return static function (Builder $query, string $direction) use ($table, $column): void {
            $query->orderBy(
                Client::query()->select('name')->whereColumn('clients.id', $table.'.'.$column)->limit(1),
                $direction,
            );
        };
    }

    private static function date(mixed $value): ?string
    {
        return is_string($value) && preg_match('/^\d{4}-\d{2}-\d{2}$/', $value) ? $value : null;
    }
}
