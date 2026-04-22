<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('client_contacts')) {
            Schema::create('client_contacts', function (Blueprint $table) {
                $table->id();
                $table->foreignId('client_id')->constrained('clients')->cascadeOnDelete();
                $table->string('prenom', 128);
                $table->string('nom', 128);
                $table->string('poste', 128)->nullable();
                $table->string('departement', 128)->nullable();
                $table->string('email', 255)->nullable();
                $table->string('telephone_direct', 64)->nullable();
                $table->string('telephone_mobile', 64)->nullable();
                $table->boolean('is_principal')->default(false);
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }

        if (! Schema::hasTable('document_status_histories')) {
            Schema::create('document_status_histories', function (Blueprint $table) {
                $table->id();
                $table->string('document_type', 255);
                $table->unsignedBigInteger('document_id');
                $table->string('etat_avant', 64)->nullable();
                $table->string('etat_apres', 64);
                $table->foreignId('user_id')->constrained('users')->restrictOnDelete();
                $table->string('source', 32)->default('manuel');
                $table->text('commentaire')->nullable();
                $table->timestamps();
                $table->index(['document_type', 'document_id']);
            });
        }

        if (! Schema::hasTable('document_sequences')) {
            Schema::create('document_sequences', function (Blueprint $table) {
                $table->id();
                $table->string('type', 32);
                $table->unsignedSmallInteger('year');
                $table->unsignedInteger('last_number')->default(0);
                $table->timestamps();
                $table->unique(['type', 'year']);
            });
        }

        if (Schema::hasTable('quote_lines') && ! Schema::hasColumn('quote_lines', 'type_ligne')) {
            Schema::table('quote_lines', function (Blueprint $table) {
                $table->string('type_ligne', 32)->default('libre');
                $table->string('line_code', 64)->nullable();
            });
        }

        if (Schema::hasTable('invoice_lines') && ! Schema::hasColumn('invoice_lines', 'type_ligne')) {
            Schema::table('invoice_lines', function (Blueprint $table) {
                $table->string('type_ligne', 32)->default('libre');
                $table->string('line_code', 64)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('invoice_lines') && Schema::hasColumn('invoice_lines', 'type_ligne')) {
            Schema::table('invoice_lines', function (Blueprint $table) {
                $table->dropColumn(['type_ligne', 'line_code']);
            });
        }
        if (Schema::hasTable('quote_lines') && Schema::hasColumn('quote_lines', 'type_ligne')) {
            Schema::table('quote_lines', function (Blueprint $table) {
                $table->dropColumn(['type_ligne', 'line_code']);
            });
        }
        Schema::dropIfExists('document_sequences');
        Schema::dropIfExists('document_status_histories');
        Schema::dropIfExists('client_contacts');
    }
};
