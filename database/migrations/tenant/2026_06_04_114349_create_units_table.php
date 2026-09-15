<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('units', function (Blueprint $table) {
            $table->id();
            $table->string('name', 150)->nullable();
            $table->string('code', 100)->nullable();
            $table->string('description')->nullable();
            $table->string('type', 100)->nullable();
            $table->string('sector', 100)->nullable();
            $table->decimal('price', 20, 2)->nullable()->default(0.00);
            $table->decimal('size', 14, 2)->nullable();
            $table->string('area_type', 10)->nullable();
            $table->json('features')->nullable();
            $table->json('pricing')->nullable();
            $table->integer('quantity')->nullable();
            $table->enum('status', ['AVAILABLE', 'SOLD', 'RESERVED', 'TOKEN', 'HOLD', 'INACTIVE'])->nullable()->default('AVAILABLE');
            $table->foreignId('project_id')->nullable()->constrained('projects')->cascadeOnDelete();
            $table->foreignId('project_block_id')->nullable()->constrained('project_blocks')->cascadeOnDelete();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('units');
    }
};
