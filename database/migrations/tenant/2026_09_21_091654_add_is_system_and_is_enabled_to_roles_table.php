<?php

use App\Support\TenantPermissions;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $table = config('permission.table_names.roles', 'roles');

        Schema::table($table, function (Blueprint $blueprint) use ($table): void {
            if (! Schema::hasColumn($table, 'is_system')) {
                $blueprint->boolean('is_system')->default(false)->after('description');
            }

            if (! Schema::hasColumn($table, 'is_enabled')) {
                $blueprint->boolean('is_enabled')->default(true)->after('is_system');
            }
        });

        $defaultNames = collect(TenantPermissions::defaultRoles())
            ->pluck('name')
            ->filter()
            ->all();

        if ($defaultNames !== []) {
            DB::table($table)
                ->whereIn('name', $defaultNames)
                ->update([
                    'is_system' => true,
                    'is_enabled' => true,
                ]);
        }
    }

    public function down(): void
    {
        $table = config('permission.table_names.roles', 'roles');

        Schema::table($table, function (Blueprint $blueprint) use ($table): void {
            if (Schema::hasColumn($table, 'is_enabled')) {
                $blueprint->dropColumn('is_enabled');
            }

            if (Schema::hasColumn($table, 'is_system')) {
                $blueprint->dropColumn('is_system');
            }
        });
    }
};
