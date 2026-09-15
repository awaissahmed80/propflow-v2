<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['project_id', 'title', 'description'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class ProjectBlock extends Model
{
    public function project()
    {
        return $this->belongsTo(Project::class);
    }
}
