<?php

use App\Models\LeadStage;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_stages', function (Blueprint $table): void {
            if (! Schema::hasColumn('lead_stages', 'is_system')) {
                $table->boolean('is_system')->default(false)->after('color');
            }

            if (! Schema::hasColumn('lead_stages', 'is_enabled')) {
                $table->boolean('is_enabled')->default(true)->after('is_system');
            }
        });

        $defaultLabels = collect(LeadStage::defaultDefinitions())
            ->pluck('label')
            ->filter()
            ->all();

        if ($defaultLabels !== []) {
            DB::table('lead_stages')
                ->whereIn('label', $defaultLabels)
                ->update([
                    'is_system' => true,
                    'is_enabled' => true,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('lead_stages', function (Blueprint $table): void {
            if (Schema::hasColumn('lead_stages', 'is_enabled')) {
                $table->dropColumn('is_enabled');
            }

            if (Schema::hasColumn('lead_stages', 'is_system')) {
                $table->dropColumn('is_system');
            }
        });
    }
};
