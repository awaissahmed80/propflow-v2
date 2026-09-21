<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payment_plan_templates', function (Blueprint $table): void {
            $table->id();
            $table->string('title');
            $table->foreignId('project_id')->nullable()->constrained('projects')->nullOnDelete();
            $table->string('frequency', 32)->default('monthly');
            $table->unsignedSmallInteger('installment_count')->default(12);
            $table->unsignedSmallInteger('balloon_every')->nullable();
            $table->decimal('down_payment_percent', 5, 2)->default(0);
            $table->decimal('handover_percent', 5, 2)->default(0);
            $table->string('late_fee_basis', 16)->nullable();
            $table->decimal('late_fee_rate', 8, 4)->nullable();
            $table->boolean('is_system')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payment_plan_templates');
    }
};
