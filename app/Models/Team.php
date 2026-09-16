<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\DB;

#[Fillable(['title', 'code', 'description', 'color', 'user_id'])]
#[Connection('tenant')]
class Team extends Model
{
    use SoftDeletes;

    protected static function booted(): void
    {
        static::creating(function (Team $team): void {
            if (filled($team->code)) {
                return;
            }

            $lastId = (int) DB::connection('tenant')->table('teams')->max('id');
            $team->code = 'T'.str_pad((string) ($lastId + 1), 5, '0', STR_PAD_LEFT);
        });
    }

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
