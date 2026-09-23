<?php

namespace Database\Factories;

use App\Models\PaymentAccount;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PaymentAccount>
 */
class PaymentAccountFactory extends Factory
{
    protected $model = PaymentAccount::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'type' => PaymentAccount::TYPE_BANK,
            'name' => fake()->company().' Account',
            'bank_name' => fake()->company(),
            'account_title' => fake()->name(),
            'account_number' => (string) fake()->numerify('##########'),
            'iban' => null,
            'swift' => null,
            'branch' => fake()->city(),
            'is_default' => false,
            'is_enabled' => true,
        ];
    }

    public function bank(): static
    {
        return $this->state(fn (): array => ['type' => PaymentAccount::TYPE_BANK]);
    }

    public function cash(): static
    {
        return $this->state(fn (): array => [
            'type' => PaymentAccount::TYPE_CASH,
            'bank_name' => null,
            'account_number' => null,
            'iban' => null,
            'swift' => null,
            'branch' => null,
        ]);
    }

    public function defaultAccount(): static
    {
        return $this->state(fn (): array => ['is_default' => true]);
    }
}
