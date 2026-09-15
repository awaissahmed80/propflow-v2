<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     *
     * user_id references landlord users.id (no cross-database FK).
     */
    public function up(): void
    {
        Schema::create('tasks', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable()->index();
            $table->foreignId('lead_id')->nullable()->constrained('leads')->cascadeOnDelete();
            $table->string('action', 150)->nullable();
            $table->longText('comments')->nullable();
            $table->enum('status', ['IN-PROGRESS', 'PENDING', 'COMPLETED', 'CANCELLED'])->nullable()->default('PENDING');
            $table->enum('type', ['ACTION', 'LOG', 'ATTACHMENT'])->nullable()->default('ACTION');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tasks');
    }
};
