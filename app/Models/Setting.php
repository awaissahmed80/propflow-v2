<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name', 'label', 'value', 'data'])]
#[Connection('tenant')]
class Setting extends Model
{
    use LogUserActivity;

    public const GROUP_GENERAL = 'general';

    public const GROUP_CONFIGURATION = 'configuration';

    public const GROUP_PIPELINE_RULES = 'pipeline_rules';

    public const GROUP_NOTIFICATIONS = 'notifications';

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'data' => 'array',
        ];
    }

    /**
     * @param  array<string, mixed>  $defaults
     * @return array<string, mixed>
     */
    public static function group(string $name, array $defaults = []): array
    {
        $setting = static::query()->where('name', $name)->first();

        return array_merge($defaults, is_array($setting?->data) ? $setting->data : []);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public static function putGroup(string $name, string $label, array $data): static
    {
        $setting = static::query()->firstOrNew(['name' => $name]);
        $setting->label = $label;
        $setting->value = null;
        $setting->data = $data;
        $setting->save();

        return $setting;
    }
}
