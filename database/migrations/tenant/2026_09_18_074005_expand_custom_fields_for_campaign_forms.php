<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            $table->string('entity', 50)->default('campaign_form')->after('id');
            $table->string('key', 100)->after('entity');
            $table->string('label', 150)->after('key');
            $table->string('type', 50)->default('text')->after('label');
            $table->boolean('required')->default(false)->after('type');
            $table->boolean('enabled')->default(true)->after('required');
            $table->string('placeholder', 255)->nullable()->after('enabled');
            $table->unsignedInteger('priority')->default(0)->after('placeholder');
            $table->boolean('is_system')->default(false)->after('priority');

            $table->unique(['entity', 'key']);
            $table->index(['entity', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::table('custom_fields', function (Blueprint $table) {
            $table->dropUnique(['entity', 'key']);
            $table->dropIndex(['entity', 'priority']);
            $table->dropColumn([
                'entity',
                'key',
                'label',
                'type',
                'required',
                'enabled',
                'placeholder',
                'priority',
                'is_system',
            ]);
        });
    }
};
