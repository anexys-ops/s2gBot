<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('equipments', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code')->unique();
            $table->string('type', 128)->nullable();
            $table->string('brand', 128)->nullable();
            $table->string('model', 128)->nullable();
            $table->string('serial_number', 128)->nullable();
            $table->string('location', 255)->nullable();
            $table->foreignId('agency_id')->nullable()->constrained()->nullOnDelete();
            $table->date('purchase_date')->nullable();
            $table->string('status', 32)->default('active');
            $table->json('meta')->nullable();
            $table->timestamps();
        });

        Schema::create('equipment_test_type', function (Blueprint $table) {
            $table->id();
            $table->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
            $table->foreignId('test_type_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['equipment_id', 'test_type_id']);
        });

        Schema::create('calibrations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('equipment_id')->constrained('equipments')->cascadeOnDelete();
            $table->date('calibration_date');
            $table->date('next_due_date')->nullable();
            $table->string('certificate_path', 512)->nullable();
            $table->string('provider', 255)->nullable();
            $table->string('result', 32)->default('ok');
            $table->text('notes')->nullable();
            $table->timestamps();
        });

        Schema::table('test_results', function (Blueprint $table) {
            $table->foreignId('equipment_id')->nullable()->after('test_type_param_id')->constrained('equipments')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('test_results', function (Blueprint $table) {
            $table->dropForeign(['equipment_id']);
            $table->dropColumn('equipment_id');
        });
        Schema::dropIfExists('calibrations');
        Schema::dropIfExists('equipment_test_type');
        Schema::dropIfExists('equipments');
    }
};
