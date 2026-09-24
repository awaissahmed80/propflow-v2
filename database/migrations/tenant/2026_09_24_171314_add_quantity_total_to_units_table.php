<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('units', 'quantity_total')) {
            return;
        }

        Schema::table('units', function (Blueprint $table): void {
            $table->unsignedInteger('quantity_total')->nullable()->after('quantity');
        });

        DB::table('units')->orderBy('id')->chunkById(200, function ($rows): void {
            foreach ($rows as $row) {
                $total = max(0, (int) ($row->quantity ?? 1));

                DB::table('units')
                    ->where('id', $row->id)
                    ->update(['quantity_total' => $total > 0 ? $total : 1]);
            }
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('units', 'quantity_total')) {
            return;
        }

        Schema::table('units', function (Blueprint $table): void {
            $table->dropColumn('quantity_total');
        });
    }
};
