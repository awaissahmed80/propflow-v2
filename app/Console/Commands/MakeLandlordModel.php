<?php

namespace App\Console\Commands;

use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\File;

#[Signature('make:landlord-model {name} {--m|migration}')]
#[Description('Create a new Eloquent model and landlord-specific migration')]
class MakeLandlordModel extends Command
{
    /**
     * Execute the console command.
     */
    public function handle()
    {
        //
        $name = $this->argument('name');
        $withMigration = $this->option('migration');

        // Step 1: Make the model with -m if requested
        $args = ['name' => $name];
        if ($withMigration) {
            $args['--migration'] = true;
        }

        Artisan::call('make:model', $args);
        $this->info(Artisan::output());

        if ($withMigration) {
            // Step 2: Find the migration file that was just created
            $migrations = File::files(database_path('migrations'));
            $latest = collect($migrations)->sortByDesc(fn ($file) => $file->getCTime())->first();

            if ($latest) {
                $newPath = database_path('migrations/landlord/'.$latest->getFilename());
                File::ensureDirectoryExists(database_path('migrations/landlord'));
                File::move($latest->getRealPath(), $newPath);
                $this->info('Moved migration to: database/migrations/landlord/');
            } else {
                $this->error('Migration not found.');
            }
        }
    }
}
