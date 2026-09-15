<?php

namespace App\Models;

use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'code',
    'contact_id',
    'user_id',
    'project_id',
    'unit_id',
    'campaign_id',
    'assigned_to',
    'source',
    'score',
    'next_action',
    'due_date',
    'lead_stage_id',
    'tag',
    'budget',
    'contacted_at',
    'attributes',
    'notes',
    'group',
])]
#[Connection('tenant')]
class Lead extends Model
{
    //
    use HasFactory, LogUserActivity, SoftDeletes;

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'contact_id' => 'integer',
            'user_id' => 'integer',
            'project_id' => 'integer',
            'unit_id' => 'integer',
            'campaign_id' => 'integer',
            'assigned_to' => 'integer',
            'lead_stage_id' => 'integer',
            'attributes' => 'array',
            'budget' => 'decimal:2',
            'due_date' => 'datetime',
            'contacted_at' => 'datetime',
        ];
    }

    public static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            $lastId = static::max('id') ?? 0;
            $datePart = date('dm');
            $numberPart = str_pad($lastId + 1, 6, '0', STR_PAD_LEFT);
            $tenantId = optional(Tenant::current())->id
                ?? Tenant::latest()->first()?->id ?? 0;
            $model->code = 'l'.$tenantId.$datePart.$numberPart;
        });
    }

    public function stage()
    {
        return $this->belongsTo(LeadStage::class, 'lead_stage_id');
    }

    public function project()
    {
        return $this->belongsTo(Project::class);
    }

    public function unit()
    {
        return $this->belongsTo(Unit::class);
    }

    public function contact()
    {
        return $this->belongsTo(Contact::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class);
    }

    public function assignee()
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function tasks()
    {
        return $this->hasMany(Task::class);
    }

    public function campaign()
    {
        return $this->belongsTo(Campaign::class);
    }
}
