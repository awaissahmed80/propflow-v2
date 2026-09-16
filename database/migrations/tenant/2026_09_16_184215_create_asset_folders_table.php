<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('asset_folders', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('kind', 20)->default('document');
            $table->foreignId('parent_id')->nullable()->constrained('asset_folders')->nullOnDelete();
            $table->unsignedInteger('order')->default(1);
            $table->timestamps();

            $table->index(['kind', 'parent_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('asset_folders');
    }
};
