<?php

use App\Models\LeadActionType;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lead_action_types', function (Blueprint $table): void {
            if (! Schema::hasColumn('lead_action_types', 'is_enabled')) {
                $table->boolean('is_enabled')->default(true)->after('is_system');
            }
        });

        $defaultLabels = collect([
            ...LeadActionType::defaultDefinitions(LeadActionType::KIND_ACTIVITY),
            ...LeadActionType::defaultDefinitions(LeadActionType::KIND_NEXT_ACTION),
        ])->pluck('label')->filter()->all();

        if ($defaultLabels !== []) {
            DB::table('lead_action_types')
                ->whereIn('label', $defaultLabels)
                ->update([
                    'is_system' => true,
                    'is_enabled' => true,
                ]);
        }
    }

    public function down(): void
    {
        Schema::table('lead_action_types', function (Blueprint $table): void {
            if (Schema::hasColumn('lead_action_types', 'is_enabled')) {
                $table->dropColumn('is_enabled');
            }
        });
    }
};
