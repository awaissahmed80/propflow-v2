<?php

namespace Database\Factories;

use App\Models\AssetLabel;
use App\Support\AssetManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetLabel>
 */
class AssetLabelFactory extends Factory
{
    protected $model = AssetLabel::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->word(),
            'color' => fake()->optional()->hexColor(),
            'kind' => AssetManager::KIND_DOCUMENT,
        ];
    }
}
