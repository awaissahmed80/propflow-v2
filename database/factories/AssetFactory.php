<?php

namespace Database\Factories;

use App\Models\Asset;
use App\Support\AssetManager;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<Asset>
 */
class AssetFactory extends Factory
{
    protected $model = Asset::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $filename = Str::uuid()->toString().'.jpg';

        return [
            'name' => fake()->words(2, true).'.jpg',
            'path' => 'media/'.$filename,
            'thumbnail' => 'media/'.$filename,
            'size' => fake()->numberBetween(10_000, 500_000),
            'type' => 'image/jpeg',
            'tag' => AssetManager::KIND_MEDIA,
        ];
    }

    public function media(): static
    {
        $filename = Str::uuid()->toString().'.jpg';

        return $this->state(fn (): array => [
            'tag' => AssetManager::KIND_MEDIA,
            'type' => 'image/jpeg',
            'path' => 'media/'.$filename,
            'thumbnail' => 'media/'.$filename,
        ]);
    }

    public function document(): static
    {
        $filename = Str::uuid()->toString().'.pdf';

        return $this->state(fn (): array => [
            'name' => fake()->words(2, true).'.pdf',
            'path' => 'documents/'.$filename,
            'thumbnail' => null,
            'type' => 'application/pdf',
            'tag' => AssetManager::KIND_DOCUMENT,
        ]);
    }
}
