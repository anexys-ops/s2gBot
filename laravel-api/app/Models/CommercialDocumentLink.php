<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CommercialDocumentLink extends Model
{
    public const RELATION_RELATED = 'related';

    public const RELATION_CONVERTED_TO = 'converted_to';

    public const RELATION_REPLACES = 'replaces';

    protected $fillable = [
        'source_type',
        'source_id',
        'target_type',
        'target_id',
        'relation',
    ];
}
