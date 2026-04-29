<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class Sequence extends Model
{
    protected $fillable = ['type', 'last_value'];

    protected $casts = ['last_value' => 'integer'];

    /**
     * Génère le prochain numéro unique pour un type donné.
     * Utilise un lock pessimiste pour garantir l'unicité sous concurrence.
     *
     * @param string $type  'OM' | 'NDF' | 'MAT' | 'TSK'
     * @return string       ex: 'OM-10000001'
     */
    public static function next(string $type): string
    {
        return DB::transaction(function () use ($type) {
            $seq = static::where('type', $type)->lockForUpdate()->first();

            if (!$seq) {
                $seq = static::create(['type' => $type, 'last_value' => 10000000]);
            }

            $seq->last_value += 1;
            $seq->save();

            return strtoupper($type) . '-' . $seq->last_value;
        });
    }
}
