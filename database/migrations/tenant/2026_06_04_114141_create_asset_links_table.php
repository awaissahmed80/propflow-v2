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
        Schema::create('asset_links', function (Blueprint $table) {
            $table->id();
            $table->bigInteger('assetable_id')->nullable();
            $table->string('assetable_type', 120)->nullable();
            $table->foreignId('asset_id')->nullable()->constrained('assets')->cascadeOnDelete();
            $table->string('linkage', 50)->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('asset_links');
    }
};
