<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE tenant_invitations MODIFY first_name VARCHAR(100) NULL');
        DB::statement('ALTER TABLE tenant_invitations MODIFY last_name VARCHAR(100) NULL');
        DB::statement('ALTER TABLE tenant_invitations MODIFY phone_number VARCHAR(30) NULL');
    }

    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();

        if ($driver === 'sqlite') {
            return;
        }

        DB::statement('ALTER TABLE tenant_invitations MODIFY first_name VARCHAR(100) NOT NULL');
        DB::statement('ALTER TABLE tenant_invitations MODIFY last_name VARCHAR(100) NOT NULL');
    }
};
