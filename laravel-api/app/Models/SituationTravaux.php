<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SituationTravaux extends Model
{
    protected $table = 'situations_travaux';

    protected $fillable = [
        'numero',
        'dossier_id',
        'invoice_id',
        'label',
        'percent_complete',
        'amount_ht',
        'status',
        'created_by',
    ];

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class);
    }

    public function invoice(): BelongsTo
    {
        return $this->belongsTo(Invoice::class);
    }

    public function createur(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
