<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentSequence extends Model
{
    public const TYPE_DOSSIER = 'dossier';

    public const TYPE_DEVIS = 'devis';

    public const TYPE_BON_COMMANDE = 'bon_commande';

    public const TYPE_BON_LIVRAISON = 'bon_livraison';

    public const TYPE_FACTURE = 'facture';

    public const TYPE_ORDRE_MISSION = 'ordre_mission';

    protected $fillable = [
        'type',
        'year',
        'last_number',
    ];
}
