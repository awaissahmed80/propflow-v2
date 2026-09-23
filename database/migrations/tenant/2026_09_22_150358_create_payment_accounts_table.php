<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_accounts', function (Blueprint $table): void {
            $table->id();
            $table->string('type'); // bank | cash
            $table->string('name');
            $table->string('bank_name')->nullable();
            $table->string('account_title')->nullable();
            $table->string('account_number')->nullable();
            $table->string('iban')->nullable();
            $table->string('swift')->nullable();
            $table->string('branch')->nullable();
            $table->boolean('is_default')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();

            $table->index(['type', 'is_default']);
        });

        // Migrate legacy General settings bank block into a default bank account.
        if (Schema::hasTable('settings')) {
            $row = DB::table('settings')->where('name', 'general')->first();

            if ($row && filled($row->data ?? null)) {
                $payload = is_string($row->data)
                    ? json_decode((string) $row->data, true)
                    : null;

                if (is_array($payload) && filled($payload['bank_name'] ?? null)) {
                    DB::table('payment_accounts')->insert([
                        'type' => 'bank',
                        'name' => 'Main Bank',
                        'bank_name' => $payload['bank_name'] ?? null,
                        'account_title' => $payload['account_title'] ?? null,
                        'account_number' => $payload['account_number'] ?? null,
                        'iban' => $payload['iban'] ?? null,
                        'swift' => $payload['swift'] ?? null,
                        'branch' => $payload['branch'] ?? null,
                        'is_default' => true,
                        'is_enabled' => true,
                        'created_at' => now(),
                        'updated_at' => now(),
                    ]);

                    foreach (['bank_name', 'account_title', 'account_number', 'iban', 'swift', 'branch'] as $key) {
                        unset($payload[$key]);
                    }

                    DB::table('settings')->where('id', $row->id)->update([
                        'data' => json_encode($payload),
                        'updated_at' => now(),
                    ]);
                }
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_accounts');
    }
};
