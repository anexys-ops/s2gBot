<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class FormOptionList extends Model
{
    protected $fillable = ['name', 'options'];

    protected function casts(): array
    {
        return ['options' => 'array'];
    }
}
