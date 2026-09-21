<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('payment_installment_id')->nullable()->constrained('payment_installments')->nullOnDelete();
            $table->decimal('amount', 20, 2);
            $table->string('method', 30);
            $table->string('reference')->nullable();
            $table->date('paid_on');
            $table->text('notes')->nullable();
            $table->unsignedBigInteger('receipt_asset_id')->nullable();
            $table->timestamps();

            $table->index(['order_id', 'paid_on']);
        });

        Schema::create('order_transfers', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained('orders')->cascadeOnDelete();
            $table->foreignId('from_contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->foreignId('to_contact_id')->nullable()->constrained('contacts')->nullOnDelete();
            $table->decimal('outstanding', 20, 2)->default(0);
            $table->boolean('ndc_cleared')->default(false);
            $table->text('notes')->nullable();
            $table->timestamp('transferred_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_transfers');
        Schema::dropIfExists('order_payments');
    }
};
