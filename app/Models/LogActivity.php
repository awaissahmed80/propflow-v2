<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

#[Fillable([
    'logable_type',
    'logable_id',
    'action',
    'changes',
    'previous',
    'user_id',
])]
#[Connection('tenant')]
class LogActivity extends Model
{
    //

    protected function casts(): array
    {
        return [
            'changes' => 'array',
            'previous' => 'array',
        ];
    }

    /**
     * @return MorphTo<Model, $this>
     */
    public function logable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
