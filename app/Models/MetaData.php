<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Table;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['value', 'type'])]
#[Connection('tenant')]
#[Table(timestamps: false)]
class MetaData extends Model
{
    //
}
