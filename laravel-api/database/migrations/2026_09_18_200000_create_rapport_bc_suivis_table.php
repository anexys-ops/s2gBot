<?php
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('rapport_bc_suivis', function (Blueprint $table) {
            $table->id();
            $table->foreignId('rapport_bc_id')->constrained('rapport_bcs')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('type', 30)->default('note'); // note, statut_change, upload, validation
            $table->text('message');
            $table->string('statut_from', 30)->nullable();
            $table->string('statut_to', 30)->nullable();
            $table->timestamp('created_at')->useCurrent();
        });
    }
    public function down(): void { Schema::dropIfExists('rapport_bc_suivis'); }
};
