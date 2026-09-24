<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Database\Factories\BookingDocumentTypeFactory;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['label', 'title', 'description', 'is_required', 'priority'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class BookingDocumentType extends Model
{
    /** @use HasFactory<BookingDocumentTypeFactory> */
    use HasFactory, LogUserActivity;

    public const LABEL_PAY_ORDER = 'pay_order';

    public function getRouteKeyName(): string
    {
        return 'label';
    }

    /**
     * @return list<array{label: string, title: string, description: ?string, is_required: bool, priority: int}>
     */
    public static function defaultDefinitions(): array
    {
        return [
            [
                'label' => 'buyer_id',
                'title' => 'Buyer CNIC / NICOP / passport',
                'description' => 'Scan or photo of the buyer’s identity document',
                'is_required' => true,
                'priority' => 1,
            ],
            [
                'label' => 'nominee',
                'title' => 'Nominee details',
                'description' => 'Nominee ID copy when a nominee is named',
                'is_required' => false,
                'priority' => 2,
            ],
            [
                'label' => 'photos',
                'title' => 'Passport photographs',
                'description' => 'Recent passport-sized photos for the file',
                'is_required' => true,
                'priority' => 3,
            ],
            [
                'label' => self::LABEL_PAY_ORDER,
                'title' => 'Pay order / cheque copy',
                'description' => 'Proof of token or down-payment instrument',
                'is_required' => true,
                'priority' => 4,
            ],
        ];
    }

    public static function ensureDefaults(): void
    {
        if (static::query()->exists()) {
            return;
        }

        foreach (static::defaultDefinitions() as $definition) {
            static::query()->create($definition);
        }
    }

    /**
     * @return list<array{id: int, label: string, title: string, description: ?string, is_required: bool, priority: int}>
     */
    public static function catalog(): array
    {
        static::ensureDefaults();

        return static::query()
            ->orderBy('priority')
            ->get(['id', 'label', 'title', 'description', 'is_required', 'priority'])
            ->map(fn (self $row): array => [
                'id' => $row->id,
                'label' => $row->label,
                'title' => $row->title,
                'description' => $row->description,
                'is_required' => (bool) $row->is_required,
                'priority' => $row->priority,
            ])
            ->values()
            ->all();
    }

    protected function casts(): array
    {
        return [
            'is_required' => 'boolean',
            'priority' => 'integer',
        ];
    }
}
