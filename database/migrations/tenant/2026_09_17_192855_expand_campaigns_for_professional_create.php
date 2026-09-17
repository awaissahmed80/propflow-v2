<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaigns', function (Blueprint $table): void {
            // landlord users.id — no cross-database FK
            $table->unsignedBigInteger('owner_id')->nullable()->index()->after('source_type');
            $table->string('channel', 64)->nullable()->index()->after('owner_id');
            $table->decimal('budget', 14, 2)->nullable()->after('channel');
            $table->decimal('target_cpl', 14, 2)->nullable()->after('budget');
            $table->json('tags')->nullable()->after('target_cpl');
            $table->json('utm')->nullable()->after('tags');
            $table->unsignedBigInteger('default_assignee_id')->nullable()->index()->after('utm');
            $table->foreignId('default_lead_stage_id')
                ->nullable()
                ->after('default_assignee_id')
                ->constrained('lead_stages')
                ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('default_lead_stage_id');
            $table->dropColumn([
                'owner_id',
                'channel',
                'budget',
                'target_cpl',
                'tags',
                'utm',
                'default_assignee_id',
            ]);
        });
    }
};
