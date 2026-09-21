<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('stage', 20)->default('booking')->after('status');
            $table->string('identity_kind', 20)->nullable()->after('stage');
            $table->string('identity_number', 40)->nullable()->after('identity_kind');
            $table->boolean('overseas')->default(false)->after('identity_number');
            $table->string('local_phone', 40)->nullable()->after('overseas');
            $table->string('nominee_name')->nullable()->after('local_phone');
            $table->string('nominee_relation', 40)->nullable()->after('nominee_name');
            $table->string('nominee_cnic', 40)->nullable()->after('nominee_relation');
            $table->string('nominee_phone', 40)->nullable()->after('nominee_cnic');
            $table->string('phase')->nullable()->after('nominee_phone');
            $table->string('sector')->nullable()->after('phase');
            $table->string('plot_or_file')->nullable()->after('sector');
            $table->string('category', 40)->nullable()->after('plot_or_file');
            $table->decimal('premium', 20, 2)->default(0)->after('category');
            $table->decimal('discount', 20, 2)->default(0)->after('premium');
            $table->timestamp('booking_verified_at')->nullable()->after('discount');
            $table->string('inventory_kind', 20)->default('file')->after('booking_verified_at');
            $table->string('dimensions')->nullable()->after('inventory_kind');
            $table->timestamp('balloted_at')->nullable()->after('dimensions');
            $table->json('handover_checklist')->nullable()->after('balloted_at');
            $table->timestamp('handover_ready_at')->nullable()->after('handover_checklist');
            $table->timestamp('delivered_at')->nullable()->after('handover_ready_at');
            $table->index('stage');
        });

        Schema::table('payment_plans', function (Blueprint $table) {
            $table->string('template', 40)->nullable()->after('agreed_price');
            $table->decimal('down_payment', 20, 2)->default(0)->after('template');
            $table->decimal('handover_percent', 8, 2)->default(0)->after('down_payment');
            $table->string('frequency', 20)->default('monthly')->after('handover_percent');
            $table->unsignedSmallInteger('installment_count')->default(1)->after('frequency');
            $table->string('late_fee_basis', 20)->nullable()->after('installment_count');
            $table->decimal('late_fee_rate', 8, 4)->default(0)->after('late_fee_basis');
        });

        Schema::table('payment_installments', function (Blueprint $table) {
            $table->string('kind', 20)->default('installment')->after('sequence');
            $table->decimal('paid_amount', 20, 2)->default(0)->after('amount');
            $table->timestamp('reminded_at')->nullable()->after('paid_at');
        });

        if (Schema::hasTable('orders')) {
            DB::table('orders')->where('status', 'allocated')->update(['stage' => 'handover']);
        }
    }

    public function down(): void
    {
        Schema::table('payment_installments', function (Blueprint $table) {
            $table->dropColumn(['kind', 'paid_amount', 'reminded_at']);
        });

        Schema::table('payment_plans', function (Blueprint $table) {
            $table->dropColumn([
                'template',
                'down_payment',
                'handover_percent',
                'frequency',
                'installment_count',
                'late_fee_basis',
                'late_fee_rate',
            ]);
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['stage']);
            $table->dropColumn([
                'stage',
                'identity_kind',
                'identity_number',
                'overseas',
                'local_phone',
                'nominee_name',
                'nominee_relation',
                'nominee_cnic',
                'nominee_phone',
                'phase',
                'sector',
                'plot_or_file',
                'category',
                'premium',
                'discount',
                'booking_verified_at',
                'inventory_kind',
                'dimensions',
                'balloted_at',
                'handover_checklist',
                'handover_ready_at',
                'delivered_at',
            ]);
        });
    }
};
