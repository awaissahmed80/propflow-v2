<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['title', 'code', 'description', 'color', 'user_id'])]
#[Connection('tenant')]
class Team extends Model
{
    use SoftDeletes;

    /**
     * Team lead — landlord user id.
     *
     * @return BelongsTo<User, $this>
     */
    public function leader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    /**
     * @return HasMany<TeamUser, $this>
     */
    public function teamUsers(): HasMany
    {
        return $this->hasMany(TeamUser::class);
    }
}
