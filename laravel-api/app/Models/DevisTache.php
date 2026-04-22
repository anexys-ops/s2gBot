<?php

namespace App\Models;

use App\Models\Catalogue\Tache;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class DevisTache extends Model
{
    use SoftDeletes;

    public const STATUT_A_FAIRE = 'a_faire';

    public const STATUT_EN_COURS = 'en_cours';

    public const STATUT_TERMINE = 'termine';

    public const STATUT_ANNULE = 'annule';

    /**
     * @return list<string>
     */
    public static function statuts(): array
    {
        return [
            self::STATUT_A_FAIRE,
            self::STATUT_EN_COURS,
            self::STATUT_TERMINE,
            self::STATUT_ANNULE,
        ];
    }

    protected $table = 'devis_taches';

    protected $fillable = [
        'quote_id',
        'ref_tache_id',
        'libelle',
        'quantite',
        'prix_unitaire_ht',
        'statut',
        'ordre',
    ];

    protected function casts(): array
    {
        return [
            'quantite' => 'integer',
            'prix_unitaire_ht' => 'decimal:2',
            'ordre' => 'integer',
        ];
    }

    public function quote(): BelongsTo
    {
        return $this->belongsTo(Quote::class, 'quote_id');
    }

    public function refTache(): BelongsTo
    {
        return $this->belongsTo(Tache::class, 'ref_tache_id');
    }
}
