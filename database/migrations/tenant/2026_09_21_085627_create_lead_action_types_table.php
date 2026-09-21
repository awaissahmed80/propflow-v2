<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('lead_action_types', function (Blueprint $table): void {
            $table->id();
            $table->string('kind', 32)->index();
            $table->string('label')->nullable();
            $table->string('title');
            $table->unsignedInteger('priority')->default(0)->index();
            $table->string('icon', 64)->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->unique(['kind', 'label']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lead_action_types');
    }
};
