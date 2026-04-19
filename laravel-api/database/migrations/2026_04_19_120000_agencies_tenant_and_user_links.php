<?php

use App\Models\Agency;
use App\Models\Client;
use App\Models\Order;
use App\Models\Site;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('agencies', function (Blueprint $table) {
            $table->id();
            $table->foreignId('client_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('code', 64)->nullable();
            $table->boolean('is_headquarters')->default(false);
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('postal_code', 32)->nullable();
            $table->timestamps();
            $table->unique(['client_id', 'code']);
        });

        Schema::create('agency_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('agency_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->timestamps();
            $table->unique(['agency_id', 'user_id']);
        });

        Schema::table('sites', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::table('invoices', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->constrained()->nullOnDelete();
        });

        Schema::table('quotes', function (Blueprint $table) {
            $table->foreignId('agency_id')->nullable()->constrained()->nullOnDelete();
        });

        $hqByClient = [];

        foreach (Client::query()->cursor() as $client) {
            $hq = Agency::query()->create([
                'client_id' => $client->id,
                'name' => $client->name.' — Siège',
                'code' => 'HQ',
                'is_headquarters' => true,
            ]);
            $hqByClient[(int) $client->id] = $hq->id;
        }

        foreach ($hqByClient as $clientId => $hqId) {
            DB::table('sites')->where('client_id', $clientId)->update(['agency_id' => $hqId]);
        }

        foreach (Order::query()->cursor() as $order) {
            $agencyId = null;
            if ($order->site_id) {
                $agencyId = (int) (DB::table('sites')->where('id', $order->site_id)->value('agency_id') ?? 0);
            }
            if (! $agencyId) {
                $agencyId = $hqByClient[(int) $order->client_id] ?? null;
            }
            if ($agencyId) {
                DB::table('orders')->where('id', $order->id)->update(['agency_id' => $agencyId]);
            }
        }

        foreach (DB::table('invoices')->cursor() as $inv) {
            $cid = (int) $inv->client_id;
            $hqId = $hqByClient[$cid] ?? null;
            if ($hqId) {
                DB::table('invoices')->where('id', $inv->id)->update(['agency_id' => $hqId]);
            }
        }

        foreach (DB::table('quotes')->cursor() as $quote) {
            $agencyId = null;
            if ($quote->site_id) {
                $agencyId = (int) (DB::table('sites')->where('id', $quote->site_id)->value('agency_id') ?? 0);
            }
            if (! $agencyId) {
                $agencyId = $hqByClient[(int) $quote->client_id] ?? null;
            }
            if ($agencyId) {
                DB::table('quotes')->where('id', $quote->id)->update(['agency_id' => $agencyId]);
            }
        }
    }

    public function down(): void
    {
        Schema::table('quotes', function (Blueprint $table) {
            $table->dropConstrainedForeignId('agency_id');
        });
        Schema::table('invoices', function (Blueprint $table) {
            $table->dropConstrainedForeignId('agency_id');
        });
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('agency_id');
        });
        Schema::table('sites', function (Blueprint $table) {
            $table->dropConstrainedForeignId('agency_id');
        });
        Schema::dropIfExists('agency_user');
        Schema::dropIfExists('agencies');
    }
};
