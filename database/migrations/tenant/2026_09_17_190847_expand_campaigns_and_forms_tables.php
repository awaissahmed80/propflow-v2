<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('campaign_forms', function (Blueprint $table): void {
            $table->uuid('public_id')->unique()->after('id');
            $table->string('name');
            $table->string('status', 32)->default('draft')->index();
            $table->json('fields')->nullable();
            $table->json('settings')->nullable();
            $table->json('branding')->nullable();
        });

        Schema::table('campaigns', function (Blueprint $table): void {
            $table->uuid('public_id')->unique()->after('id');
            $table->string('slug')->nullable()->index();
            $table->string('title');
            $table->string('status', 32)->default('draft')->index();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('campaign_form_id')->nullable()->constrained('campaign_forms')->nullOnDelete();
            $table->json('landing')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('campaigns', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('campaign_form_id');
            $table->dropConstrainedForeignId('project_id');
            $table->dropColumn([
                'public_id',
                'slug',
                'title',
                'status',
                'landing',
                'starts_at',
                'ends_at',
            ]);
        });

        Schema::table('campaign_forms', function (Blueprint $table): void {
            $table->dropColumn([
                'public_id',
                'name',
                'status',
                'fields',
                'settings',
                'branding',
            ]);
        });
    }
};
