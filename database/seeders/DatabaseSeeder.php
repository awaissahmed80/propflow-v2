<?php

namespace Database\Seeders;

use App\Enums\UserStatus;
use App\Enums\UserType;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolesAndPermissionsSeeder::class);

        $admin = User::query()->firstOrCreate(
            ['email_address' => 'admin@propflow.test'],
            [
                'display_name' => 'Platform Admin',
                'first_name' => 'Platform',
                'last_name' => 'Admin',
                'password' => Hash::make('password'),
                'type' => UserType::Platform,
                'status' => UserStatus::Active,
            ]
        );

        $admin->syncRoles(['platform-admin']);
    }
}
