<?php

namespace Database\Factories;

use App\Models\AssetFolder;
use App\Support\AssetManager;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AssetFolder>
 */
class AssetFolderFactory extends Factory
{
    protected $model = AssetFolder::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->unique()->words(2, true),
            'kind' => AssetManager::KIND_DOCUMENT,
            'parent_id' => null,
            'order' => 1,
        ];
    }

    public function childOf(AssetFolder $parent): static
    {
        return $this->state(fn (): array => [
            'parent_id' => $parent->id,
        ]);
    }
}
