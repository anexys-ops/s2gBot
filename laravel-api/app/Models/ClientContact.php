<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientContact extends Model
{
    protected $fillable = [
        'client_id',
        'contact_type',
        'prenom',
        'nom',
        'poste',
        'departement',
        'email',
        'telephone_direct',
        'telephone_mobile',
        'is_principal',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'is_principal' => 'boolean',
        ];
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
