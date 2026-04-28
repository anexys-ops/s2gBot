<?php

namespace App\Models;

use App\Models\Catalogue\Article;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OrdreMissionLigne extends Model
{
    protected $table = 'ordre_mission_lignes';

    protected $fillable = [
        'ordre_mission_id',
        'bon_commande_ligne_id',
        'ref_article_id',
        'article_action_id',
        'libelle',
        'quantite',
        'statut',
        'assigned_user_id',
        'equipment_id',
        'date_prevue',
        'date_realisation',
        'duree_reelle_heures',
        'notes',
        'ordre',
    ];

    protected function casts(): array
    {
        return [
            'quantite'            => 'float',
            'date_prevue'         => 'datetime',
            'date_realisation'    => 'datetime',
            'duree_reelle_heures' => 'integer',
            'ordre'               => 'integer',
        ];
    }

    public function ordreMission(): BelongsTo
    {
        return $this->belongsTo(OrdreMission::class, 'ordre_mission_id');
    }

    public function bonCommandeLigne(): BelongsTo
    {
        return $this->belongsTo(BonCommandeLigne::class, 'bon_commande_ligne_id');
    }

    public function article(): BelongsTo
    {
        return $this->belongsTo(Article::class, 'ref_article_id');
    }

    public function articleAction(): BelongsTo
    {
        return $this->belongsTo(ArticleAction::class, 'article_action_id');
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function equipment(): BelongsTo
    {
        return $this->belongsTo(Equipment::class);
    }
}
