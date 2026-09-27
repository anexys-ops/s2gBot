<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('test_types', function (Blueprint $table) {
            $table->string('context', 20)->nullable()->after('form_fields');
        });
        Schema::create('form_option_lists', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->json('options');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('form_option_lists');
        Schema::table('test_types', fn (Blueprint $table) => $table->dropColumn('context'));
    }
};
