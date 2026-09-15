<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

#[Fillable(['uuid', 'first_name', 'last_name', 'email_address', 'phone_number', 'phone_number_alt', 'profile', 'demographics', 'cnic', 'address', 'city', 'country', 'contact_preference', 'tag', 'income_level', 'affordability', 'capability', 'goal', 'net_worth', 'type', 'reference'])]
#[Connection('tenant')]
class Contact extends Model
{
    use HasFactory, LogUserActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'profile' => 'array',
            'demographics' => 'array',
            'net_worth' => 'decimal:2',
        ];
    }

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }
}
