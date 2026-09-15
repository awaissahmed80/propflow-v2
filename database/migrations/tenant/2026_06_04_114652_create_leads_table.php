<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * user_id / assigned_to reference landlord users.id (no cross-database FK).
     */
    public function up(): void
    {
        Schema::create('leads', function (Blueprint $table) {
            $table->id();
            $table->string('code', 150)->nullable();
            $table->foreignId('contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->foreignId('unit_id')->nullable()->constrained('units')->nullOnDelete();
            $table->unsignedBigInteger('campaign_id')->nullable()->index();
            $table->unsignedBigInteger('assigned_to')->nullable()->index();
            $table->string('source', 150)->nullable();
            $table->integer('score')->nullable();
            $table->string('next_action', 150)->nullable();
            $table->timestamp('due_date')->nullable();
            $table->json('attributes')->nullable();
            $table->string('group', 150)->nullable();
            $table->foreignId('lead_stage_id')->nullable()->constrained('lead_stages')->nullOnDelete();
            $table->enum('tag', ['VERY HOT', 'HOT', 'MODERATE', 'COLD', 'VERY COLD'])->nullable()->default('MODERATE');
            $table->decimal('budget', 20, 2)->default(0.00);
            $table->mediumText('notes')->nullable();
            $table->timestamp('contacted_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('leads');
    }
};
