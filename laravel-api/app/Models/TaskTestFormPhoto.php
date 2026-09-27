<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TaskTestFormPhoto extends Model
{
    protected $fillable = ['task_test_form_id', 'field_key', 'path', 'original_name', 'mime_type', 'uploaded_by'];

    public function form(): BelongsTo { return $this->belongsTo(TaskTestForm::class, 'task_test_form_id'); }
}
