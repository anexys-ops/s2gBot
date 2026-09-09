<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('activity_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('activity_logs', 'user_agent')) {
                $table->string('user_agent', 512)->nullable()->after('ip_address');
            }
        });

        Schema::create('system_error_logs', function (Blueprint $table) {
            $table->id();
            $table->unsignedSmallInteger('status_code');
            $table->string('method', 10);
            $table->string('url', 2048);
            $table->text('message')->nullable();
            $table->string('exception_class', 255)->nullable();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['status_code', 'created_at']);
        });

        Schema::create('security_logs', function (Blueprint $table) {
            $table->id();
            $table->string('event_type', 64);
            $table->string('email_attempted', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->json('properties')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['event_type', 'created_at']);
        });

        Schema::create('user_session_presence', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('token_id')->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 512)->nullable();
            $table->string('current_page', 512)->nullable();
            $table->timestamp('last_seen_at');
            $table->timestamp('created_at')->useCurrent();
            $table->index(['user_id', 'last_seen_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_session_presence');
        Schema::dropIfExists('security_logs');
        Schema::dropIfExists('system_error_logs');

        Schema::table('activity_logs', function (Blueprint $table) {
            if (Schema::hasColumn('activity_logs', 'user_agent')) {
                $table->dropColumn('user_agent');
            }
        });
    }
};
