<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentStatusHistory extends Model
{
    protected $table = 'document_status_histories';

    public const SOURCE_MANUEL = 'manuel';

    public const SOURCE_WORKFLOW = 'workflow';

    public const SOURCE_API = 'api';

    public const SOURCE_SYSTEME = 'systeme';

    protected $fillable = [
        'document_type',
        'document_id',
        'etat_avant',
        'etat_apres',
        'user_id',
        'source',
        'commentaire',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
