<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_label_asset', function (Blueprint $table) {
            $table->id();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->foreignId('asset_label_id')->constrained('asset_labels')->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['asset_id', 'asset_label_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_label_asset');
    }
};
