<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_webhooks', function (Blueprint $table) {
            $table->id();
            $table->boolean('enabled')->default(false);
            $table->text('signing_secret')->nullable();
            $table->string('default_source', 150)->nullable();
            $table->foreignId('default_campaign_id')->nullable()->constrained('campaigns')->nullOnDelete();
            $table->foreignId('default_lead_stage_id')->nullable()->constrained('lead_stages')->nullOnDelete();
            $table->unsignedBigInteger('default_assignee_id')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_webhooks');
    }
};
