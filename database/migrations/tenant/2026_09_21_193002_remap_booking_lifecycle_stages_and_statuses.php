<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('orders') || ! Schema::hasTable('order_stages')) {
            return;
        }

        $orders = DB::table('orders')->select(['id', 'stage', 'status', 'booking_verified_at'])->get();

        foreach ($orders as $order) {
            [$stage, $status] = $this->remap((string) ($order->stage ?? ''), (string) ($order->status ?? ''), $order->booking_verified_at !== null);

            DB::table('orders')->where('id', $order->id)->update([
                'stage' => $stage,
                'status' => $status,
            ]);
        }

        DB::table('order_stages')->delete();

        $stages = [
            ['label' => 'token', 'title' => 'Token', 'priority' => 1, 'color' => '#2563EB', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'booking_kyc', 'title' => 'Booking & KYC', 'priority' => 2, 'color' => '#7C3AED', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'active', 'title' => 'Active', 'priority' => 3, 'color' => '#0D9488', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'closed', 'title' => 'Closed', 'priority' => 4, 'color' => '#475569', 'is_system' => true, 'is_enabled' => true],
        ];

        foreach ($stages as $stage) {
            DB::table('order_stages')->insert($stage);
        }

        if (! Schema::hasTable('order_statuses')) {
            return;
        }

        DB::table('order_statuses')->delete();

        $statuses = [
            ['label' => 'hold', 'title' => 'Hold', 'priority' => 1, 'color' => '#94A3B8', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'in_progress', 'title' => 'In progress', 'priority' => 2, 'color' => '#EA580C', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'overdue', 'title' => 'Overdue', 'priority' => 3, 'color' => '#D97706', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'defaulter', 'title' => 'Defaulter', 'priority' => 4, 'color' => '#E11D48', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'litigation', 'title' => 'Litigation', 'priority' => 5, 'color' => '#BE123C', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'completed', 'title' => 'Completed', 'priority' => 6, 'color' => '#16A34A', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'cancelled', 'title' => 'Cancelled', 'priority' => 7, 'color' => '#6B7280', 'is_system' => true, 'is_enabled' => true],
        ];

        foreach ($statuses as $status) {
            DB::table('order_statuses')->insert($status);
        }
    }

    public function down(): void
    {
        // Irreversible data remap — catalog can be re-seeded by application defaults if needed.
    }

    /**
     * @return array{0: string, 1: string}
     */
    protected function remap(string $stage, string $status, bool $verified): array
    {
        if ($status === 'cancelled') {
            return ['closed', 'cancelled'];
        }

        if ($status === 'delivered' || $stage === 'delivered') {
            return ['closed', 'completed'];
        }

        if ($status === 'allocated') {
            return ['active', 'in_progress'];
        }

        return match ($stage) {
            'booking' => $verified
                ? ['booking_kyc', 'in_progress']
                : ['token', 'hold'],
            'plan' => ['booking_kyc', 'in_progress'],
            'tracking', 'transfer', 'handover' => ['active', 'in_progress'],
            'token' => [$verified ? 'token' : 'token', $verified ? 'in_progress' : 'hold'],
            'booking_kyc' => ['booking_kyc', 'in_progress'],
            'active' => ['active', in_array($status, ['in_progress', 'current', 'overdue', 'defaulter', 'litigation'], true)
                ? ($status === 'current' ? 'in_progress' : $status)
                : 'in_progress'],
            'closed' => ['closed', in_array($status, ['completed', 'cancelled'], true) ? $status : 'completed'],
            default => ['token', 'hold'],
        };
    }
};
