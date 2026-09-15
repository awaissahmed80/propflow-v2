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
        Schema::create('contacts', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('first_name')->nullable();
            $table->string('last_name')->nullable();
            $table->string('email_address')->nullable();
            $table->string('phone_number')->nullable();
            $table->string('phone_number_alt', 150)->nullable();
            $table->json('profile')->nullable();
            $table->json('demographics')->nullable();
            $table->string('cnic', 50)->nullable();
            $table->string('address')->nullable();
            $table->string('city')->nullable();
            $table->string('country')->nullable();
            $table->string('contact_preference')->nullable();
            $table->enum('tag', ['INVESTOR', 'AFFILIATE', 'AGENT', 'GENERAL'])->nullable()->default('GENERAL');
            $table->enum('income_level', ['LOW', 'LOWER MIDDLE', 'MIDDLE', 'UPPER MIDDLE', 'HIGH', 'VERY HIGH'])->nullable()->default('MIDDLE');
            $table->enum('affordability', ['LUXURY', 'MODERATE', 'BUDGET'])->nullable()->default('MODERATE');
            $table->enum('capability', ['LOW', 'MODERATE', 'HIGH'])->nullable()->default('MODERATE');
            $table->string('goal')->nullable();
            $table->decimal('net_worth', 20, 2)->nullable()->default(0.00);
            $table->text('reference')->nullable();
            $table->enum('type', ['LEAD', 'CLIENT'])->nullable()->default('LEAD');
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('contacts');
    }
};
