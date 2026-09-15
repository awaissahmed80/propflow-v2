<?php

namespace App\Support;

class TenantPermissions
{
    /**
     * @return list<string>
     */
    public static function names(): array
    {
        return [
            'leads.view',
            'leads.create',
            'leads.update',
            'leads.delete',
            'projects.view',
            'projects.create',
            'projects.update',
            'projects.delete',
            'inventory.view',
            'inventory.create',
            'inventory.update',
            'contacts.view',
            'contacts.create',
            'contacts.update',
            'contacts.delete',
            'users.view',
            'users.create',
            'users.update',
            'roles.view',
            'roles.create',
            'roles.update',
            'campaigns.view',
            'campaigns.create',
            'campaigns.update',
            'teams.view',
            'teams.create',
            'teams.update',
            'settings.view',
            'settings.update',
            'reports.view',
        ];
    }
}
