<?php

namespace App\Providers;

use App\Models\Asset;
use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Models\CampaignGoalType;
use App\Models\Contact;
use App\Models\Lead;
use App\Models\LeadActionType;
use App\Models\LeadStage;
use App\Models\MetaData;
use App\Models\Order;
use App\Models\OrderPayment;
use App\Models\PaymentAccount;
use App\Models\PersonalReminder;
use App\Models\Project;
use App\Models\ProjectBlock;
use App\Models\ProjectProgress;
use App\Models\Task;
use App\Models\Team;
use App\Models\Unit;
use App\Observers\HardDeleteCleanupObserver;
use App\Observers\LeadNotificationObserver;
use App\Observers\TaskNotificationObserver;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Portal models that can be permanently removed and may leave morph orphans.
     *
     * @var list<class-string>
     */
    private const HARD_DELETE_MODELS = [
        Asset::class,
        Campaign::class,
        CampaignForm::class,
        CampaignGoalType::class,
        Contact::class,
        Lead::class,
        LeadActionType::class,
        LeadStage::class,
        MetaData::class,
        Order::class,
        OrderPayment::class,
        PaymentAccount::class,
        PersonalReminder::class,
        Project::class,
        ProjectBlock::class,
        ProjectProgress::class,
        Task::class,
        Team::class,
        Unit::class,
    ];

    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();

        Lead::observe(LeadNotificationObserver::class);
        Task::observe(TaskNotificationObserver::class);

        foreach (self::HARD_DELETE_MODELS as $model) {
            $model::observe(HardDeleteCleanupObserver::class);
        }
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
