<?php

use App\Support\DocumentStatusCatalog;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('document_status_definitions', function (Blueprint $table) {
            $table->id();
            $table->string('document_type', 64);
            $table->string('code', 64);
            $table->string('label');
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_initial')->default(false);
            $table->boolean('is_terminal')->default(false);
            $table->string('color_key', 32)->nullable();
            $table->boolean('active')->default(true);
            $table->timestamps();

            $table->unique(['document_type', 'code']);
            $table->index(['document_type', 'sort_order']);
        });

        $now = now();
        $rows = [];
        foreach (DocumentStatusCatalog::defaultStatuses() as $documentType => $statuses) {
            foreach ($statuses as $status) {
                $rows[] = [
                    'document_type' => $documentType,
                    'code' => $status['code'],
                    'label' => $status['label'],
                    'sort_order' => $status['sort_order'],
                    'is_initial' => $status['is_initial'],
                    'is_terminal' => $status['is_terminal'],
                    'color_key' => $status['color_key'],
                    'active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }
        }

        if ($rows !== []) {
            DB::table('document_status_definitions')->insert($rows);
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('document_status_definitions');
    }
};
