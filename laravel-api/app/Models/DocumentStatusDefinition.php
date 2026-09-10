<?php

namespace App\Models;

use App\Support\DocumentStatusCatalog;
use Illuminate\Database\Eloquent\Model;

class DocumentStatusDefinition extends Model
{
    protected $fillable = [
        'document_type',
        'code',
        'label',
        'sort_order',
        'is_initial',
        'is_terminal',
        'color_key',
        'active',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'is_initial' => 'boolean',
            'is_terminal' => 'boolean',
            'active' => 'boolean',
        ];
    }

    /**
     * @return list<string>
     */
    public static function documentTypes(): array
    {
        return DocumentStatusCatalog::documentTypeKeys();
    }
}
