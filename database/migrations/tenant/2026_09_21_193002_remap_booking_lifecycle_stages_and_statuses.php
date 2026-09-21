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
            ['label' => 'token', 'title' => 'Token', 'priority' => 1, 'color' => '#3B82F6', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'booking_kyc', 'title' => 'Booking & KYC', 'priority' => 2, 'color' => '#8B5CF6', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'active', 'title' => 'Active', 'priority' => 3, 'color' => '#06B6D4', 'is_system' => true, 'is_enabled' => true],
            ['label' => 'closed', 'title' => 'Closed', 'priority' => 4, 'color' => '#059669', 'is_system' => true, 'is_enabled' => true],
        ];

        foreach ($stages as $stage) {
            DB::table('order_stages')->insert($stage);
        }

        if (! Schema::hasTable('order_statuses')) {
            return;
        }

        DB::table('order_statuses')->delete();

        $statuses = [
            ['stage_label' => 'token', 'label' => 'hold', 'title' => 'Hold', 'priority' => 1, 'color' => '#94A3B8', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'token', 'label' => 'verified', 'title' => 'Verified', 'priority' => 2, 'color' => '#3B82F6', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'booking_kyc', 'label' => 'in_progress', 'title' => 'In progress', 'priority' => 1, 'color' => '#8B5CF6', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'active', 'label' => 'current', 'title' => 'Current', 'priority' => 1, 'color' => '#06B6D4', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'active', 'label' => 'overdue', 'title' => 'Overdue', 'priority' => 2, 'color' => '#F59E0B', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'active', 'label' => 'defaulter', 'title' => 'Defaulter', 'priority' => 3, 'color' => '#EF4444', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'active', 'label' => 'litigation', 'title' => 'Litigation', 'priority' => 4, 'color' => '#DC2626', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'closed', 'label' => 'completed', 'title' => 'Completed', 'priority' => 1, 'color' => '#059669', 'is_system' => true, 'is_enabled' => true],
            ['stage_label' => 'closed', 'label' => 'cancelled', 'title' => 'Cancelled', 'priority' => 2, 'color' => '#64748B', 'is_system' => true, 'is_enabled' => true],
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
            return ['active', 'current'];
        }

        return match ($stage) {
            'booking' => $verified
                ? ['booking_kyc', 'in_progress']
                : ['token', 'hold'],
            'plan' => ['booking_kyc', 'in_progress'],
            'tracking', 'transfer', 'handover' => ['active', 'current'],
            'token' => [$verified ? 'token' : 'token', $verified ? 'verified' : 'hold'],
            'booking_kyc' => ['booking_kyc', 'in_progress'],
            'active' => ['active', in_array($status, ['current', 'overdue', 'defaulter', 'litigation'], true) ? $status : 'current'],
            'closed' => ['closed', in_array($status, ['completed', 'cancelled'], true) ? $status : 'completed'],
            default => ['token', 'hold'],
        };
    }
};
