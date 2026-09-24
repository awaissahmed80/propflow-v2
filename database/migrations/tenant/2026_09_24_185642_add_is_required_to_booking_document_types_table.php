<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('booking_document_types', 'is_required')) {
            return;
        }

        Schema::table('booking_document_types', function (Blueprint $table): void {
            $table->boolean('is_required')->default(true)->after('description');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('booking_document_types', 'is_required')) {
            return;
        }

        Schema::table('booking_document_types', function (Blueprint $table): void {
            $table->dropColumn('is_required');
        });
    }
};
