<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('extrafield_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('entity_type', 32);
            $table->string('code', 64);
            $table->string('label');
            $table->string('field_type', 32);
            $table->json('select_options')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('required')->default(false);
            $table->timestamps();

            $table->unique(['entity_type', 'code']);
        });

        Schema::create('extrafield_values', function (Blueprint $table) {
            $table->id();
            $table->foreignId('extrafield_definition_id')->constrained('extrafield_definitions')->cascadeOnDelete();
            $table->unsignedBigInteger('entity_id');
            $table->text('value')->nullable();
            $table->timestamps();

            $table->unique(['extrafield_definition_id', 'entity_id']);
        });

        Schema::create('module_settings', function (Blueprint $table) {
            $table->id();
            $table->string('module_key', 64)->unique();
            $table->json('settings');
            $table->timestamps();
        });

        DB::table('module_settings')->insert([
            [
                'module_key' => 'invoices',
                'settings' => json_encode([
                    'tva_rate_options' => [20, 10, 5.5, 0],
                    'travel_tva_rate_options' => [20, 10, 5.5, 0],
                    'order_picker_statuses' => ['completed', 'in_progress'],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'module_key' => 'quotes',
                'settings' => json_encode([
                    'tva_rate_options' => [20, 10, 5.5, 0],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'module_key' => 'orders',
                'settings' => json_encode([
                    'default_priority_options' => ['normal', 'urgent', 'basse'],
                ]),
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('extrafield_values');
        Schema::dropIfExists('extrafield_definitions');
        Schema::dropIfExists('module_settings');
    }
};
