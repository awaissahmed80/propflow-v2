<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('order_statuses')) {
            return;
        }

        if (! Schema::hasColumn('order_statuses', 'stage_label')) {
            return;
        }

        $driver = Schema::getConnection()->getDriverName();

        // Keep one row per label (prefer lowest priority, then lowest id).
        $duplicates = DB::table('order_statuses')
            ->select('label')
            ->groupBy('label')
            ->havingRaw('count(*) > 1')
            ->pluck('label');

        foreach ($duplicates as $label) {
            $ids = DB::table('order_statuses')
                ->where('label', $label)
                ->orderBy('priority')
                ->orderBy('id')
                ->pluck('id');

            $ids->shift();

            if ($ids->isNotEmpty()) {
                DB::table('order_statuses')->whereIn('id', $ids->all())->delete();
            }
        }

        if ($driver === 'sqlite') {
            Schema::create('order_statuses_flat', function (Blueprint $table): void {
                $table->id();
                $table->string('label')->unique();
                $table->string('title')->nullable();
                $table->integer('priority')->default(0)->nullable();
                $table->string('color', 20)->nullable();
                $table->boolean('is_system')->default(true);
                $table->boolean('is_enabled')->default(true);
            });

            $rows = DB::table('order_statuses')->orderBy('id')->get();

            foreach ($rows as $row) {
                DB::table('order_statuses_flat')->insert([
                    'id' => $row->id,
                    'label' => $row->label,
                    'title' => $row->title,
                    'priority' => $row->priority,
                    'color' => $row->color,
                    'is_system' => $row->is_system,
                    'is_enabled' => $row->is_enabled,
                ]);
            }

            Schema::drop('order_statuses');
            Schema::rename('order_statuses_flat', 'order_statuses');
        } else {
            Schema::table('order_statuses', function (Blueprint $table): void {
                $table->dropUnique(['stage_label', 'label']);
                $table->dropIndex(['stage_label']);
                $table->dropColumn('stage_label');
            });

            Schema::table('order_statuses', function (Blueprint $table): void {
                $table->unique('label');
            });
        }

        $order = ['hold', 'in_progress', 'overdue', 'defaulter', 'litigation', 'completed', 'cancelled'];

        foreach ($order as $index => $label) {
            DB::table('order_statuses')->where('label', $label)->update(['priority' => $index + 1]);
        }
    }

    public function down(): void
    {
        // Irreversible flatten for SQLite/MySQL mixed environments.
    }
};
