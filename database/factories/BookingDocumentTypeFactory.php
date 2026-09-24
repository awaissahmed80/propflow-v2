<?php

namespace Database\Factories;

use App\Models\BookingDocumentType;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<BookingDocumentType>
 */
class BookingDocumentTypeFactory extends Factory
{
    protected $model = BookingDocumentType::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $title = fake()->unique()->words(3, true);

        return [
            'label' => Str::slug($title, '_'),
            'title' => ucwords($title),
            'description' => fake()->optional()->sentence(),
            'is_required' => true,
            'priority' => fake()->numberBetween(1, 20),
        ];
    }

    public function optional(): static
    {
        return $this->state(fn (): array => [
            'is_required' => false,
        ]);
    }
}
