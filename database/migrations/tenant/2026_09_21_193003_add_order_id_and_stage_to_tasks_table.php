<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table): void {
            $table->foreignId('order_id')->nullable()->after('lead_id')->constrained('orders')->nullOnDelete();
            $table->string('stage')->nullable()->after('order_id');
            $table->string('stage_label')->nullable()->after('stage');
            $table->index(['order_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table): void {
            $table->dropConstrainedForeignId('order_id');
            $table->dropColumn(['stage', 'stage_label']);
        });
    }
};
