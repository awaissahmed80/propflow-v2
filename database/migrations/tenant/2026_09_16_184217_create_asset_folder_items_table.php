<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_folder_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('folder_id')->constrained('asset_folders')->cascadeOnDelete();
            $table->foreignId('asset_id')->constrained('assets')->cascadeOnDelete();
            $table->timestamps();

            $table->unique('asset_id');
            $table->index('folder_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_folder_items');
    }
};
