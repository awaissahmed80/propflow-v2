<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['label', 'title', 'priority', 'color'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class LeadStage extends Model
{
    use HasFactory, LogUserActivity;

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }
}
