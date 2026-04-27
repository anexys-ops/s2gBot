<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphToMany;

class Tag extends Model {
    protected $fillable = ['name', 'color'];
    
    public static function syncForModel(Model $model, array $names): void {
        $ids = collect($names)->filter()->map(function (string $name) {
            return static::firstOrCreate(['name' => trim($name)], ['color' => '#6366f1'])->id;
        });
        $model->tags()->sync($ids);
    }
}
