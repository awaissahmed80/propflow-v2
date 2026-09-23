<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('orders')) {
            DB::table('orders')
                ->whereIn('status', ['verified', 'current'])
                ->update(['status' => 'in_progress']);
        }

        if (Schema::hasTable('order_statuses')) {
            DB::table('order_statuses')
                ->whereIn('label', ['verified', 'current'])
                ->delete();

            $order = ['hold', 'in_progress', 'overdue', 'defaulter', 'litigation', 'completed', 'cancelled'];

            foreach ($order as $index => $label) {
                DB::table('order_statuses')->where('label', $label)->update(['priority' => $index + 1]);
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('order_statuses')) {
            return;
        }

        $defaults = [
            ['label' => 'verified', 'title' => 'Verified', 'priority' => 2, 'color' => '#3B82F6', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'current', 'title' => 'Current', 'priority' => 4, 'color' => '#06B6D4', 'is_system' => true, 'is_enabled' => true],
        ];

        foreach ($defaults as $row) {
            $exists = DB::table('order_statuses')->where('label', $row['label'])->exists();

            if (! $exists) {
                DB::table('order_statuses')->insert($row);
            }
        }
    }
};
