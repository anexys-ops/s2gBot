<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lab_centre_groups', function (Blueprint $table) {
            $table->id();
            $table->string('code', 32)->unique();
            $table->string('name');
            $table->unsignedSmallInteger('sort_order')->default(0);
            $table->boolean('active')->default(true);
            $table->timestamps();
        });

        Schema::table('agencies', function (Blueprint $table) {
            $table->foreignId('lab_centre_group_id')->nullable()->after('client_id')
                ->constrained('lab_centre_groups')->nullOnDelete();
            $table->string('establishment_kind', 16)->nullable()->after('is_siege')
                ->comment('siege | agence | site');
        });

        Schema::create('lab_centre_group_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lab_centre_group_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'lab_centre_group_id']);
        });

        Schema::create('lab_agency_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['user_id', 'agency_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lab_agency_user');
        Schema::dropIfExists('lab_centre_group_user');
        Schema::table('agencies', function (Blueprint $table) {
            $table->dropConstrainedForeignId('lab_centre_group_id');
            $table->dropColumn('establishment_kind');
        });
        Schema::dropIfExists('lab_centre_groups');
    }
};
