<?php

namespace App\Services;

use App\Models\LogActivity;
use App\Models\Tenant;
use BackedEnum;
use DateTimeInterface;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Arr;

class ActivityLogger
{
    private bool $recording = false;

    /**
     * @var list<string>
     */
    private const HIDDEN = [
        'password',
        'remember_token',
        'secret_key',
        'public_key',
        'api_key',
        'access_token',
        'refresh_token',
        'token',
        'app_secret',
        'client_secret',
        'verify_token',
        'webhook_verify_token',
        'signing_secret',
    ];

    public function record(Model $model, string $action): void
    {
        if ($this->recording || ! auth()->check() || Tenant::current() === null) {
            return;
        }

        if ($model instanceof LogActivity) {
            return;
        }

        $changes = null;
        $previous = null;

        if ($action === 'updated') {
            $dirty = Arr::except($model->getChanges(), ['created_at', 'updated_at']);
            $dirty = $this->redact($dirty);

            if ($dirty === []) {
                return;
            }

            $before = [];

            foreach (array_keys($dirty) as $key) {
                $before[$key] = $model->getOriginal($key);
            }

            $changes = $this->present($dirty);
            $previous = $this->present($this->redact($before));
        } elseif ($action === 'created') {
            $changes = $this->present($this->redact(Arr::except(
                $model->getAttributes(),
                ['id', 'created_at', 'updated_at', 'deleted_at'],
            )));
        } elseif ($action === 'deleted') {
            $previous = $this->present($this->redact(Arr::except(
                $model->getOriginal() ?: $model->getAttributes(),
                ['created_at', 'updated_at', 'deleted_at'],
            )));
        }

        $this->recording = true;

        try {
            LogActivity::query()->create([
                'logable_type' => $model::class,
                'logable_id' => $model->getKey(),
                'action' => $action,
                'changes' => $changes,
                'previous' => $previous,
                'user_id' => auth()->id(),
            ]);
        } finally {
            $this->recording = false;
        }
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function redact(array $values): array
    {
        $clean = [];

        foreach ($values as $key => $value) {
            if ($this->isHidden((string) $key)) {
                continue;
            }

            if (is_array($value)) {
                $clean[$key] = $this->redact($value);

                continue;
            }

            $clean[$key] = $value;
        }

        return $clean;
    }

    /**
     * @param  array<string, mixed>  $values
     * @return array<string, mixed>
     */
    private function present(array $values): array
    {
        $presented = [];

        foreach ($values as $key => $value) {
            $presented[$key] = $this->presentValue($value);
        }

        return $presented;
    }

    private function presentValue(mixed $value): mixed
    {
        if ($value instanceof BackedEnum) {
            return $value->value;
        }

        if ($value instanceof DateTimeInterface) {
            return $value->format(DateTimeInterface::ATOM);
        }

        if (is_array($value)) {
            return 'Updated';
        }

        if (is_bool($value)) {
            return $value ? 'Yes' : 'No';
        }

        if (is_string($value) && mb_strlen($value) > 240) {
            return mb_substr($value, 0, 237).'...';
        }

        return $value;
    }

    private function isHidden(string $key): bool
    {
        $normalized = mb_strtolower($key);

        foreach (self::HIDDEN as $hidden) {
            if ($normalized === $hidden || str_contains($normalized, $hidden)) {
                return true;
            }
        }

        return false;
    }
}
