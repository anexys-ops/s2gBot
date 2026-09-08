<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SampleReceptionCancellation extends Model
{
    protected $fillable = [
        'bon_commande_ligne_id',
        'reception_index',
        'reception_batch_total',
        'cancelled_by',
        'reason',
    ];

    public function bonCommandeLigne(): BelongsTo
    {
        return $this->belongsTo(BonCommandeLigne::class, 'bon_commande_ligne_id');
    }

    public function cancelledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'cancelled_by');
    }
}
