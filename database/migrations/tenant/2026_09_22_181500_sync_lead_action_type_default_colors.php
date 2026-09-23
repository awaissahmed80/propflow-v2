<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Canonical lead action / next-action colors for every tenant.
     *
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
        foreach (self::DEFAULT_COLORS as $label => $color) {
            DB::table('lead_action_types')
                ->where('label', $label)
                ->where('is_system', true)
                ->update(['color' => $color]);
        }
    }

    public function down(): void
    {
        //
    }
};
