<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OdmJalonQuantityGenerated extends Model
{
    protected $table = 'odm_jalon_quantities_generated';

    protected $fillable = [
        'bon_commande_ligne_id',
        'quantite_generee',
    ];

    protected function casts(): array
    {
        return [
            'quantite_generee' => 'decimal:3',
        ];
    }

    public function bonCommandeLigne(): BelongsTo
    {
        return $this->belongsTo(BonCommandeLigne::class);
    }
}
