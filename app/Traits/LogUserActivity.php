<?php

namespace App\Traits;

use App\Services\ActivityLogger;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

trait LogUserActivity
{
    public function activitySubject(): string
    {
        $candidates = [
            $this->getAttribute('display_name'),
            $this->getAttribute('title'),
            $this->getAttribute('name'),
            trim((string) $this->getAttribute('first_name').' '.(string) $this->getAttribute('last_name')),
            $this->getAttribute('code'),
            $this->getAttribute('label'),
            $this->getAttribute('value'),
            $this->getAttribute('action'),
        ];

        foreach ($candidates as $value) {
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return class_basename(static::class).' #'.$this->getKey();
    }

    protected static function bootLogUserActivity(): void
    {
        static::created(function (Model $model): void {
            app(ActivityLogger::class)->record($model, 'created');
        });

        static::updated(function (Model $model): void {
            app(ActivityLogger::class)->record($model, 'updated');
        });

        static::deleted(function (Model $model): void {
            app(ActivityLogger::class)->record($model, 'deleted');
        });

        if (in_array(SoftDeletes::class, class_uses_recursive(static::class), true)) {
            static::restored(function (Model $model): void {
                app(ActivityLogger::class)->record($model, 'restored');
            });
        }
    }
}
