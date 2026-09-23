<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_statuses', function (Blueprint $table): void {
            $table->id();
            $table->string('label')->unique();
            $table->string('title')->nullable();
            $table->integer('priority')->default(0)->nullable();
            $table->string('color', 20)->nullable();
            $table->boolean('is_system')->default(true);
            $table->boolean('is_enabled')->default(true);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_statuses');
    }
};
