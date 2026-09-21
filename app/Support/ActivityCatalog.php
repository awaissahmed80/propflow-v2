<?php

namespace App\Support;

use App\Models\Asset;
use App\Models\AssetFolder;
use App\Models\AssetLabel;
use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\CampaignGoalType;
use App\Models\Contact;
use App\Models\CustomField;
use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\MetaData;
use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\ProjectProgress;
use App\Models\Setting;
use App\Models\Task;
use App\Models\Team;
use App\Models\Unit;
use App\Models\User;

class ActivityCatalog
{
    /**
     * @var array<string, array{label: string, types: list<class-string>}>
     */
    public const SECTIONS = [
        'users' => [
            'label' => 'Users',
            'types' => [User::class],
        ],
        'leads' => [
            'label' => 'Leads',
            'types' => [Lead::class, Task::class],
        ],
        'campaigns' => [
            'label' => 'Campaigns',
            'types' => [Campaign::class, CampaignForm::class],
        ],
        'contacts' => [
            'label' => 'Contacts',
            'types' => [Contact::class],
        ],
        'projects' => [
            'label' => 'Projects',
            'types' => [Project::class, ProjectProgress::class],
        ],
        'inventory' => [
            'label' => 'Inventory',
            'types' => [Unit::class, ProjectBlock::class],
        ],
        'teams' => [
            'label' => 'Teams',
            'types' => [Team::class],
        ],
        'settings' => [
            'label' => 'Settings',
            'types' => [LeadStage::class, LeadActionType::class, CampaignGoalType::class, CustomField::class, MetaData::class, Setting::class],
        ],
        'files' => [
            'label' => 'Files',
            'types' => [Asset::class, AssetFolder::class, AssetLabel::class],
        ],
    ];

    /**
     * @return list<array{id: string, label: string}>
     */
    public static function sections(): array
    {
        $sections = [
            ['id' => 'all', 'label' => 'All'],
        ];

        foreach (self::SECTIONS as $id => $section) {
            $sections[] = [
                'id' => $id,
                'label' => $section['label'],
            ];
        }

        return $sections;
    }

    public static function has(string $section): bool
    {
        return $section === 'all' || isset(self::SECTIONS[$section]);
    }

    /**
     * @return list<class-string>
     */
    public static function types(string $section): array
    {
        if ($section === 'all' || ! isset(self::SECTIONS[$section])) {
            return [];
        }

        return self::SECTIONS[$section]['types'];
    }

    public static function labelFor(string $type): string
    {
        foreach (self::SECTIONS as $section) {
            if (in_array($type, $section['types'], true)) {
                return $section['label'];
            }
        }

        return 'Other';
    }

    public static function idFor(string $type): string
    {
        foreach (self::SECTIONS as $id => $section) {
            if (in_array($type, $section['types'], true)) {
                return $id;
            }
        }

        return 'other';
    }
}
