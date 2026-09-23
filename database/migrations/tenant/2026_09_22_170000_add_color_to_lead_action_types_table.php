<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * @var array<string, string>
     */
    private const DEFAULT_COLORS = [
        'call' => '#64B5F6',
        'meeting' => '#FFB74D',
        'site_visit' => '#9575CD',
        'email' => '#F06292',
        'message' => '#0284C7',
        'whatsapp_call' => '#16A34A',
        'whatsapp_message' => '#0D9488',
        'note' => '#64748B',
        'follow_up' => '#16A34A',
        'arrange_site_visit' => '#FF8A65',
        'arrange_meeting' => '#0284C7',
        'do_nothing' => '#FFB74D',
    ];

    public function up(): void
    {
        Schema::table('lead_action_types', function (Blueprint $table): void {
            $table->string('color', 32)->nullable()->after('icon');
        });

        foreach (self::DEFAULT_COLORS as $label => $color) {
            DB::table('lead_action_types')
                ->where('label', $label)
                ->whereNull('color')
                ->update(['color' => $color]);
        }

        DB::table('lead_action_types')
            ->whereNull('color')
            ->update(['color' => '#64B5F6']);
    }

    public function down(): void
    {
        Schema::table('lead_action_types', function (Blueprint $table): void {
            $table->dropColumn('color');
        });
    }
};
