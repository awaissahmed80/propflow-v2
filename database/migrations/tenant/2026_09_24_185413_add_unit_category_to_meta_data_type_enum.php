<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE meta_data MODIFY COLUMN type ENUM('CITY', 'PROJECT', 'UNIT', 'AREA', 'LINK', 'DEPARTMENT', 'COUNTRY', 'PAYMENT_METHOD', 'UNIT_CATEGORY') NULL");
        }

        // SQLite / others: Laravel enum columns are stored as check constraints
        // on create; fresh installs pick up UNIT_CATEGORY from the create migration.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE meta_data MODIFY COLUMN type ENUM('CITY', 'PROJECT', 'UNIT', 'AREA', 'LINK', 'DEPARTMENT', 'COUNTRY', 'PAYMENT_METHOD') NULL");
        }
    }
};
