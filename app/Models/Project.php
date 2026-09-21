<?php

namespace App\Models;

use App\Support\AssetManager;
use App\Traits\HasMeta;
use App\Traits\LogUserActivity;
use Illuminate\Database\Eloquent\Attributes\Connection;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable([
    'title',
    'code',
    'url_title',
    'description',
    'type',
    'purpose',
    'country',
    'city',
    'location',
    'start_date',
    'end_date',
    'details',
    'features',
    'pin_location',
    'links',
    'progress',
    'status',
    'balloting_enabled',
])]
#[Connection('tenant')]
class Project extends Model
{
    //
    use HasFactory, HasMeta, LogUserActivity, SoftDeletes;

    protected array $logIgnore = ['updated_at'];

    protected function casts(): array
    {
        return [
            'id' => 'integer',
            'details' => 'object',
            'features' => 'array',
            'links' => 'array',
            'progress' => 'integer',
            'balloting_enabled' => 'boolean',
        ];
    }

    public function metaData(): array
    {
        return [
            'COUNTRY' => $this->country,
            'CITY' => $this->city,
            'PROJECT' => $this->type,
            'AREA' => $this->details->area_type,
        ];
    }

    public function getRouteKeyName(): string
    {
        return 'code';
    }

    public static function boot()
    {
        parent::boot();

        static::creating(function ($model) {
            $lastId = static::max('id') ?? 0;
            $numberPart = str_pad($lastId + 1, 4, '0', STR_PAD_LEFT);
            $tenantId = optional(Tenant::current())->id
                ?? Tenant::latest()->first()?->id ?? 0;
            $model->code = 'p'.$tenantId.$numberPart;
            $model->url_title = 'p'.$tenantId.$numberPart;

        });
    }

    public function thumbnail(): MorphOne
    {
        return $this->morphOne(AssetLink::class, 'assetable')
            ->where('linkage', AssetManager::LINKAGE_THUMBNAIL);
    }

    public function gallery(): MorphMany
    {
        return $this->morphMany(AssetLink::class, 'assetable')
            ->where('linkage', AssetManager::LINKAGE_GALLERY);
    }

    public function documents(): MorphMany
    {
        return $this->morphMany(AssetLink::class, 'assetable')
            ->where('linkage', AssetManager::LINKAGE_DOCUMENT);
    }

    public function phases()
    {
        return $this->hasMany(ProjectProgress::class)
            ->orderBy('order')
            ->orderBy('start_date');
    }

    public function get_gallery()
    {
        return $this->gallery()->get()->map(function ($link) {
            return [
                'src' => url('assets/'.$link->asset->thumbnail),
                'large' => url('assets/'.$link->asset->path),
                'id' => $link->asset_id,
            ];
        });
    }

    public function get_documents()
    {
        return $this->documents()->get()->map(function ($link) {
            return [
                'src' => url('assets/'.$link->asset->path),
                'id' => $link->asset_id,
                'title' => $link->asset->name,
                'created_at' => $link->created_at,
                'type' => $link->asset->type,
            ];
        });
    }

    public function blocks()
    {
        return $this->hasMany(ProjectBlock::class);
    }

    public function leads()
    {
        return $this->hasMany(Lead::class);
    }

    public function units()
    {
        return $this->hasMany(Unit::class);
    }
}
