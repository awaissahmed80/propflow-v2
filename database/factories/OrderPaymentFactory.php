<?php

namespace Database\Factories;

use App\Models\Order;
use App\Models\OrderPayment;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderPayment>
 */
class OrderPaymentFactory extends Factory
{
    protected $model = OrderPayment::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'payment_installment_id' => null,
            'amount' => 100000,
            'method' => OrderPayment::METHOD_TRANSFER,
            'reference' => fake()->optional()->bothify('PO-####'),
            'paid_on' => now()->toDateString(),
            'notes' => null,
            'receipt_asset_id' => null,
        ];
    }
}
