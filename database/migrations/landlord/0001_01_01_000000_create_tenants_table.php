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
        Schema::create('tenants', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('code', 20)->nullable()->unique();
            $table->string('identifier')->unique();
            $table->string('database')->nullable()->unique();
            $table->string('status', 20)->default('ACTIVE');
            $table->string('secret_key')->nullable()->unique();
            $table->string('public_key')->nullable()->unique();
            $table->string('api_key')->nullable()->unique();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
