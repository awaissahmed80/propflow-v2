<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

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
}
