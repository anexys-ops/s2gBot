<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DossierContact extends Model
{
    protected $fillable = [
        'dossier_id',
        'nom',
        'prenom',
        'email',
        'telephone',
        'role',
    ];

    public function dossier(): BelongsTo
    {
        return $this->belongsTo(Dossier::class);
    }
}
