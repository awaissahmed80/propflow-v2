<?php

namespace Database\Factories;

use App\Models\Contact;
use App\Models\Order;
use App\Models\OrderTransfer;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<OrderTransfer>
 */
class OrderTransferFactory extends Factory
{
    protected $model = OrderTransfer::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'order_id' => Order::factory(),
            'from_contact_id' => Contact::factory(),
            'to_contact_id' => Contact::factory(),
            'outstanding' => 0,
            'ndc_cleared' => true,
            'notes' => null,
            'transferred_at' => now(),
        ];
    }
}
