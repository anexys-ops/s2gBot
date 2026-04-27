<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void {
        if (!Schema::hasTable('tags')) {
            Schema::create('tags', function (Blueprint $table) {
                $table->id();
                $table->string('name', 100)->unique();
                $table->string('color', 20)->default('#6366f1'); // hex color
                $table->timestamps();
            });
        }
        if (!Schema::hasTable('taggables')) {
            Schema::create('taggables', function (Blueprint $table) {
                $table->id();
                $table->foreignId('tag_id')->constrained()->cascadeOnDelete();
                $table->morphs('taggable'); // taggable_type, taggable_id
                $table->unique(['tag_id', 'taggable_type', 'taggable_id']);
            });
        }
    }
    public function down(): void {
        Schema::dropIfExists('taggables');
        Schema::dropIfExists('tags');
    }
};
