<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('order_stages')) {
            foreach ([
                'token' => '#2563EB',
                'booking_kyc' => '#7C3AED',
                'active' => '#0D9488',
                'closed' => '#475569',
            ] as $label => $color) {
                DB::table('order_stages')->where('label', $label)->update(['color' => $color]);
            }
        }

        if (Schema::hasTable('order_statuses')) {
            foreach ([
                'hold' => '#94A3B8',
                'in_progress' => '#EA580C',
                'overdue' => '#D97706',
                'defaulter' => '#E11D48',
                'litigation' => '#BE123C',
                'completed' => '#16A34A',
                'cancelled' => '#6B7280',
            ] as $label => $color) {
                DB::table('order_statuses')->where('label', $label)->update(['color' => $color]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('order_stages')) {
            foreach ([
                'token' => '#3B82F6',
                'booking_kyc' => '#8B5CF6',
                'active' => '#06B6D4',
                'closed' => '#059669',
            ] as $label => $color) {
                DB::table('order_stages')->where('label', $label)->update(['color' => $color]);
            }
        }

        if (Schema::hasTable('order_statuses')) {
            foreach ([
                'hold' => '#94A3B8',
                'in_progress' => '#8B5CF6',
                'overdue' => '#F59E0B',
                'defaulter' => '#EF4444',
                'litigation' => '#DC2626',
                'completed' => '#059669',
                'cancelled' => '#64748B',
            ] as $label => $color) {
                DB::table('order_statuses')->where('label', $label)->update(['color' => $color]);
            }
        }
    }
};
