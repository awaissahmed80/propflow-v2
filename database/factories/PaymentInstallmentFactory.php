<?php

namespace Database\Factories;

use App\Models\PaymentInstallment;
use App\Models\PaymentPlan;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentInstallment>
 */
class PaymentInstallmentFactory extends Factory
{
    protected $model = PaymentInstallment::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'payment_plan_id' => PaymentPlan::factory(),
            'sequence' => 1,
            'label' => 'Installment 1',
            'amount' => 100000,
            'due_on' => now()->toDateString(),
            'status' => PaymentInstallment::STATUS_PENDING,
            'paid_at' => null,
        ];
    }
}
