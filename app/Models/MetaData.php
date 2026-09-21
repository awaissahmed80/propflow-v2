<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

#[Fillable(['value', 'type'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class MetaData extends Model
{
    use LogUserActivity;

    public const TYPE_CITY = 'CITY';

    public const TYPE_COUNTRY = 'COUNTRY';

    public const TYPE_PROJECT = 'PROJECT';

    public const TYPE_UNIT = 'UNIT';

    public const TYPE_AREA = 'AREA';

    public const TYPE_LINK = 'LINK';

    public const TYPE_DEPARTMENT = 'DEPARTMENT';

    public const TYPE_PAYMENT_METHOD = 'PAYMENT_METHOD';

    /**
     * @return list<string>
     */
    public static function types(): array
    {
        return [
            self::TYPE_CITY,
            self::TYPE_COUNTRY,
            self::TYPE_PROJECT,
            self::TYPE_UNIT,
            self::TYPE_AREA,
            self::TYPE_LINK,
            self::TYPE_DEPARTMENT,
            self::TYPE_PAYMENT_METHOD,
        ];
    }

    /**
     * @param  Builder<static>  $query
     * @return Builder<static>
     */
    public function scopeOfType(Builder $query, string $type): Builder
    {
        return $query->where('type', strtoupper($type));
    }

    /**
     * @return Collection<int, string>
     */
    public static function valuesFor(string $type): Collection
    {
        return static::query()
            ->ofType($type)
            ->whereNotNull('value')
            ->where('value', '!=', '')
            ->orderBy('value')
            ->pluck('value')
            ->unique(fn (string $value): string => mb_strtolower($value))
            ->values();
    }

    /**
     * Seed defaults for payment methods used on booking receipts.
     *
     * @return list<string>
     */
    public static function defaultPaymentMethods(): array
    {
        return [
            'Cash',
            'Pay order',
            'Cheque',
            'Bank transfer',
        ];
    }

    public static function ensurePaymentMethods(): void
    {
        foreach (static::defaultPaymentMethods() as $method) {
            static::remember(self::TYPE_PAYMENT_METHOD, $method);
        }
    }

    public static function remember(string $type, string $value): static
    {
        $type = strtoupper($type);
        $value = trim($value);

        $existing = static::query()
            ->ofType($type)
            ->whereRaw('LOWER(value) = ?', [mb_strtolower($value)])
            ->first();

        if ($existing) {
            return $existing;
        }

        return static::query()->create([
            'type' => $type,
            'value' => $value,
        ]);
    }
}
