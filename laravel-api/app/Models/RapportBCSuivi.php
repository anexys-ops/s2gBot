<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RapportBCSuivi extends Model
{
    public $timestamps = false;
    protected $table = 'rapport_bc_suivis';

    protected $fillable = ['rapport_bc_id', 'user_id', 'type', 'message', 'statut_from', 'statut_to'];
    protected $casts = ['created_at' => 'datetime'];

    public function rapportBC(): BelongsTo { return $this->belongsTo(RapportBC::class, 'rapport_bc_id'); }
    public function user(): BelongsTo { return $this->belongsTo(User::class); }
}
