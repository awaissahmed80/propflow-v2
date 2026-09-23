<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\PaymentAccountFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

#[Fillable([
    'type',
    'name',
    'bank_name',
    'account_title',
    'account_number',
    'iban',
    'swift',
    'branch',
    'is_default',
    'is_enabled',
])]
#[Connection('tenant')]
class PaymentAccount extends Model
{
    /** @use HasFactory<PaymentAccountFactory> */
    use HasFactory, LogUserActivity;

    public const TYPE_BANK = 'bank';

    public const TYPE_CASH = 'cash';

    /**
     * @return list<string>
     */
    public static function types(): array
    {
        return [self::TYPE_BANK, self::TYPE_CASH];
    }

    public static function ensureDefaults(): void
    {
        if (! static::query()->where('type', self::TYPE_BANK)->exists()) {
            static::query()->create([
                'type' => self::TYPE_BANK,
                'name' => 'Main Bank',
                'is_default' => true,
                'is_enabled' => true,
            ]);
        }

        if (! static::query()->where('type', self::TYPE_CASH)->exists()) {
            static::query()->create([
                'type' => self::TYPE_CASH,
                'name' => 'Petty Cash',
                'is_default' => true,
                'is_enabled' => true,
            ]);
        }
    }

    public static function defaultFor(string $type): ?self
    {
        static::ensureDefaults();

        return static::query()
            ->where('type', $type)
            ->where('is_enabled', true)
            ->orderByDesc('is_default')
            ->orderBy('id')
            ->first();
    }

    /**
     * @return list<array{id: int, type: string, name: string, bank_name: ?string, account_title: ?string, account_number: ?string, iban: ?string, swift: ?string, branch: ?string, is_default: bool, is_enabled: bool}>
     */
    public static function catalog(): array
    {
        static::ensureDefaults();

        return static::query()
            ->orderBy('type')
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get()
            ->map(fn (self $account): array => $account->toPayload())
            ->values()
            ->all();
    }

    /**
     * @return array{id: int, type: string, name: string, bank_name: ?string, account_title: ?string, account_number: ?string, iban: ?string, swift: ?string, branch: ?string, is_default: bool, is_enabled: bool}
     */
    public function toPayload(): array
    {
        return [
            'id' => $this->id,
            'type' => (string) $this->type,
            'name' => (string) $this->name,
            'bank_name' => $this->bank_name,
            'account_title' => $this->account_title,
            'account_number' => $this->account_number,
            'iban' => $this->iban,
            'swift' => $this->swift,
            'branch' => $this->branch,
            'is_default' => (bool) $this->is_default,
            'is_enabled' => (bool) $this->is_enabled,
        ];
    }

    public function makeDefault(): void
    {
        DB::connection('tenant')->transaction(function (): void {
            static::query()
                ->where('type', $this->type)
                ->whereKeyNot($this->id)
                ->update(['is_default' => false]);

            $this->forceFill(['is_default' => true, 'is_enabled' => true])->save();
        });
    }

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'is_enabled' => 'boolean',
        ];
    }
}
