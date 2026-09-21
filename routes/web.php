<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Portal\ActivityLogController;
use App\Http\Controllers\Portal\AllocationController;
use App\Http\Controllers\Portal\AssistantController;
use App\Http\Controllers\Portal\CalendarController;
use App\Http\Controllers\Portal\CampaignController;
use App\Http\Controllers\Portal\CampaignFormController;
use App\Http\Controllers\Portal\CampaignFormFieldController;
use App\Http\Controllers\Portal\CampaignGoalTypeController;
use App\Http\Controllers\Portal\ContactController;
use App\Http\Controllers\Portal\DashboardController;
use App\Http\Controllers\Portal\DealController;
use App\Http\Controllers\Portal\DocumentController;
use App\Http\Controllers\Portal\DocumentFolderController;
use App\Http\Controllers\Portal\DocumentLabelController;
use App\Http\Controllers\Portal\InventoryController;
use App\Http\Controllers\Portal\LeadActionTypeController;
use App\Http\Controllers\Portal\LeadController;
use App\Http\Controllers\Portal\LeadStageController;
use App\Http\Controllers\Portal\LeadTaskController;
use App\Http\Controllers\Portal\LeadWebhookController;
use App\Http\Controllers\Portal\MediaController;
use App\Http\Controllers\Portal\MetaDataController;
use App\Http\Controllers\Portal\MetaIntegrationController;
use App\Http\Controllers\Portal\NotificationController;
use App\Http\Controllers\Portal\OperationsController;
use App\Http\Controllers\Portal\OrderController;
use App\Http\Controllers\Portal\OrderStageController;
use App\Http\Controllers\Portal\PaymentInstallmentController;
use App\Http\Controllers\Portal\PaymentPlanController;
use App\Http\Controllers\Portal\PaymentPlanTemplateController;
use App\Http\Controllers\Portal\ProjectBlockController;
use App\Http\Controllers\Portal\ProjectController;
use App\Http\Controllers\Portal\ProjectProgressController;
use App\Http\Controllers\Portal\RoleController;
use App\Http\Controllers\Portal\SalesController;
use App\Http\Controllers\Portal\SettingsController;
use App\Http\Controllers\Portal\TeamController;
use App\Http\Controllers\Portal\TodoListController;
use App\Http\Controllers\Portal\UnitController;
use App\Http\Controllers\Portal\UserController;
use App\Http\Controllers\Portal\WhatsAppIntegrationController;
use App\Http\Controllers\Public\CampaignLandingController;
use App\Http\Controllers\Public\LeadWebhookController as PublicLeadWebhookController;
use App\Http\Controllers\Public\MetaWebhookController;
use App\Http\Controllers\Public\PublicFormController;
use App\Http\Controllers\Public\WhatsAppWebhookController;
use App\Http\Middleware\ResolveTenantByIdentifier;
use Illuminate\Support\Facades\Broadcast;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

$baseDomain = config('app.base_domain');

Route::middleware(['web', 'public'])->group(function () use ($baseDomain) {
    Route::domain($baseDomain)->group(function () {
        Route::inertia('/', 'welcome')->name('home');
    });
});

Route::middleware(['api'])
    ->domain('campaign.'.$baseDomain)
    ->group(function () {
        Route::get('/webhooks/meta/{identifier}', [MetaWebhookController::class, 'verify'])
            ->name('webhooks.meta.verify');
        Route::post('/webhooks/meta/{identifier}', [MetaWebhookController::class, 'receive'])
            ->middleware('throttle:60,1')
            ->name('webhooks.meta.receive');
        Route::get('/webhooks/whatsapp/{identifier}', [WhatsAppWebhookController::class, 'verify'])
            ->name('webhooks.whatsapp.verify');
        Route::post('/webhooks/whatsapp/{identifier}', [WhatsAppWebhookController::class, 'receive'])
            ->middleware('throttle:60,1')
            ->name('webhooks.whatsapp.receive');
        Route::post('/webhooks/leads/{identifier}', [PublicLeadWebhookController::class, 'receive'])
            ->middleware('throttle:60,1')
            ->name('webhooks.leads.receive');
    });

Route::middleware(['api', ResolveTenantByIdentifier::class])
    ->domain('campaign.'.$baseDomain)
    ->group(function () {
        Route::get('/{identifier}/form.js', [PublicFormController::class, 'script'])
            ->name('public.forms.script');
        Route::options('/{identifier}/forms/{form}', [PublicFormController::class, 'options']);
        Route::get('/{identifier}/forms/{form}', [PublicFormController::class, 'show'])
            ->name('public.forms.show');
        Route::post('/{identifier}/forms/{form}/submit', [PublicFormController::class, 'submit'])
            ->middleware('throttle:form-submit')
            ->name('public.forms.submit');
    });

Route::middleware(['web', 'public', ResolveTenantByIdentifier::class])
    ->domain('campaign.'.$baseDomain)
    ->group(function () {
        Route::get('/{identifier}/c/{campaign}', [CampaignLandingController::class, 'show'])
            ->name('public.campaigns.landing');
    });

Route::middleware(['web', 'portal'])->group(function () use ($baseDomain) {
    Route::domain('auth.'.$baseDomain)->group(function () {
        Route::middleware('guest')->group(function () {
            Route::inertia('/', 'auth/login')->name('auth.login');
            Route::post('/login', [AuthenticatedSessionController::class, 'store'])
                ->middleware('throttle:login')
                ->name('auth.login.store');
            Route::inertia('/forgot-password', 'auth/forgot-password')->name('auth.forgot-password');
        });

        Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
            ->middleware('auth')
            ->name('auth.logout');
    });

    Route::domain('portal.'.$baseDomain)->middleware(['auth', 'tenant'])->group(function () {
        Broadcast::routes(['middleware' => ['web', 'auth', 'tenant']]);

        Route::get('/', [DashboardController::class, 'index'])->name('portal.home');
        Route::get('/dashboard', [DashboardController::class, 'index'])->name('portal.dashboard');
        Route::get('/todos', [TodoListController::class, 'index'])->name('portal.todos.index');
        Route::get('/activity', [ActivityLogController::class, 'index'])->name('portal.activity.index');
        Route::get('/notifications', [NotificationController::class, 'index'])->name('portal.notifications.index');
        Route::post('/notifications/read', [NotificationController::class, 'readAll'])->name('portal.notifications.read-all');
        Route::post('/notifications/{notification}/read', [NotificationController::class, 'read'])->name('portal.notifications.read');
        Route::get('/assistant/brief', [AssistantController::class, 'brief'])->name('portal.assistant.brief');
        Route::post('/assistant/interpret', [AssistantController::class, 'interpret'])->name('portal.assistant.interpret');
        Route::get('/calendar', [CalendarController::class, 'index'])->name('portal.calendar');
        Route::get('/sales', [SalesController::class, 'overview'])->name('portal.sales.overview');
        Route::get('/leads', [LeadController::class, 'index'])->name('portal.leads.index');
        Route::get('/leads/board/{stage}', [LeadController::class, 'boardColumn'])->name('portal.leads.board-column');
        Route::post('/leads', [LeadController::class, 'store'])->name('portal.leads.store');
        Route::post('/leads/{lead}/tasks', [LeadTaskController::class, 'store'])->name('portal.leads.tasks.store');
        Route::post('/leads/bulk', [LeadController::class, 'bulk'])->name('portal.leads.bulk');
        Route::match(['put', 'patch'], '/leads/{lead}', [LeadController::class, 'update'])->name('portal.leads.update');
        Route::post('/leads/{lead}/archive', [LeadController::class, 'archive'])->name('portal.leads.archive');
        Route::post('/leads/{lead}/restore', [LeadController::class, 'restore'])->name('portal.leads.restore');
        Route::post('/leads/{lead}/convert', [LeadController::class, 'convert'])->name('portal.leads.convert');
        Route::delete('/leads/{lead}', [LeadController::class, 'destroy'])->name('portal.leads.destroy');
        Route::get('/operations', [OperationsController::class, 'overview'])->name('portal.operations.overview');
        Route::redirect('/orders', '/bookings');
        Route::get('/orders/{order}', fn (string $order) => redirect('/bookings/'.$order));
        Route::redirect('/bookings/applications', '/bookings');
        Route::get('/bookings/allotment', [AllocationController::class, 'index'])->name('portal.bookings.allotment');
        Route::get('/bookings', [OrderController::class, 'index'])->name('portal.orders.index');
        Route::get('/bookings/{order}', [OrderController::class, 'show'])->name('portal.orders.show');
        Route::get('/bookings/{order}/booking-form', [DealController::class, 'showBookingForm'])->name('portal.orders.show-booking-form');
        Route::post('/bookings/{order}/booking', [DealController::class, 'storeBooking'])->name('portal.orders.booking');
        Route::post('/bookings/{order}/plan', [DealController::class, 'plan'])->name('portal.orders.plan');
        Route::post('/bookings/{order}/payments', [DealController::class, 'payment'])->name('portal.orders.payments.store');
        Route::post('/bookings/{order}/ballot', [DealController::class, 'ballot'])->name('portal.orders.ballot');
        Route::post('/bookings/{order}/transfer', [DealController::class, 'transfer'])->name('portal.orders.transfer');
        Route::post('/bookings/{order}/handover', [DealController::class, 'handover'])->name('portal.orders.handover');
        Route::post('/bookings/{order}/deliver', [DealController::class, 'deliver'])->name('portal.orders.deliver');
        Route::post('/bookings/{order}/cancel', [OrderController::class, 'cancel'])->name('portal.orders.cancel');
        Route::post('/bookings/{order}/allocate', [OrderController::class, 'allocate'])->name('portal.orders.allocate');
        Route::post('/bookings/{order}/installments/{sequence}/pay', [PaymentInstallmentController::class, 'pay'])->name('portal.payment-installments.pay');
        Route::redirect('/payment-plans', '/receivables/installments');
        Route::get('/plan-templates', [PaymentPlanTemplateController::class, 'index'])->name('portal.plan-templates.index');
        Route::post('/plan-templates', [PaymentPlanTemplateController::class, 'store'])->name('portal.plan-templates.store');
        Route::match(['put', 'patch'], '/plan-templates/{template}', [PaymentPlanTemplateController::class, 'update'])->name('portal.plan-templates.update');
        Route::delete('/plan-templates/{template}', [PaymentPlanTemplateController::class, 'destroy'])->name('portal.plan-templates.destroy');
        Route::redirect('/receivables', '/receivables/installments');
        Route::get('/receivables/installments', [PaymentPlanController::class, 'index'])->name('portal.payment-plans.index');
        Route::get('/receivables/vouchers', [OperationsController::class, 'comingSoon'])
            ->defaults('section', 'vouchers')
            ->name('portal.receivables.vouchers');
        Route::get('/receivables/verification', [OperationsController::class, 'comingSoon'])
            ->defaults('section', 'verification')
            ->name('portal.receivables.verification');
        Route::get('/receivables/statements', [OperationsController::class, 'comingSoon'])
            ->defaults('section', 'statements')
            ->name('portal.receivables.statements');
        Route::redirect('/allocation', '/bookings/allotment');
        Route::redirect('/commissions', '/commissions/agents');
        Route::get('/commissions/agents', [OperationsController::class, 'comingSoon'])
            ->defaults('section', 'agents')
            ->name('portal.commissions.agents');
        Route::get('/commissions/dealers', [OperationsController::class, 'comingSoon'])
            ->defaults('section', 'dealers')
            ->name('portal.commissions.dealers');
        Route::get('/contacts', [ContactController::class, 'index'])->name('portal.contacts.index');
        Route::post('/contacts', [ContactController::class, 'store'])->name('portal.contacts.store');
        Route::match(['put', 'patch'], '/contacts/{contact}', [ContactController::class, 'update'])->name('portal.contacts.update');
        Route::delete('/contacts/{contact}', [ContactController::class, 'destroy'])->name('portal.contacts.destroy');
        Route::get('/campaigns', [CampaignController::class, 'index'])->name('portal.campaigns.index');
        Route::post('/campaigns', [CampaignController::class, 'store'])->name('portal.campaigns.store');
        Route::get('/campaigns/{campaign}', [CampaignController::class, 'show'])->name('portal.campaigns.show');
        Route::match(['put', 'patch'], '/campaigns/{campaign}', [CampaignController::class, 'update'])->name('portal.campaigns.update');
        Route::delete('/campaigns/{campaign}', [CampaignController::class, 'destroy'])->name('portal.campaigns.destroy');
        Route::post('/campaign-forms', [CampaignFormController::class, 'store'])->name('portal.campaign-forms.store');
        Route::match(['put', 'patch'], '/campaign-forms/{form}', [CampaignFormController::class, 'update'])->name('portal.campaign-forms.update');
        Route::delete('/campaign-forms/{form}', [CampaignFormController::class, 'destroy'])->name('portal.campaign-forms.destroy');
        Route::inertia('/file-manager', 'file-manager/index')->name('portal.file-manager');
        Route::get('/inventory', [InventoryController::class, 'index'])->name('portal.inventory.index');
        Route::post('/units', [UnitController::class, 'store'])->name('portal.units.store');
        Route::match(['put', 'patch'], '/units/{unit}', [UnitController::class, 'update'])->name('portal.units.update');
        Route::delete('/units/{unit}', [UnitController::class, 'destroy'])->name('portal.units.destroy');
        Route::get('/project-blocks', [ProjectBlockController::class, 'index'])->name('portal.project-blocks.index');
        Route::post('/project-blocks', [ProjectBlockController::class, 'store'])->name('portal.project-blocks.store');
        Route::match(['put', 'patch'], '/project-blocks/{block}', [ProjectBlockController::class, 'update'])->name('portal.project-blocks.update');
        Route::delete('/project-blocks/{block}', [ProjectBlockController::class, 'destroy'])->name('portal.project-blocks.destroy');
        Route::get('/users', [UserController::class, 'index'])->name('portal.users.index');
        Route::post('/users', [UserController::class, 'store'])->name('portal.users.store');
        Route::put('/users/{user}', [UserController::class, 'update'])->name('portal.users.update');
        Route::delete('/users/{user}', [UserController::class, 'destroy'])->name('portal.users.destroy');
        Route::get('/meta-data', [MetaDataController::class, 'index'])->name('portal.meta-data.index');
        Route::post('/meta-data', [MetaDataController::class, 'store'])->name('portal.meta-data.store');
        Route::match(['put', 'patch'], '/meta-data/{metaData}', [MetaDataController::class, 'update'])->name('portal.meta-data.update');
        Route::delete('/meta-data/{metaData}', [MetaDataController::class, 'destroy'])->name('portal.meta-data.destroy');
        Route::get('/settings/{section?}', [SettingsController::class, 'index'])->name('portal.settings.index');
        Route::post('/settings/general', [SettingsController::class, 'updateGeneral'])->name('portal.settings.general');
        Route::put('/settings/configuration', [SettingsController::class, 'updateConfiguration'])->name('portal.settings.configuration');
        Route::put('/settings/pipeline-rules', [SettingsController::class, 'updatePipelineRules'])->name('portal.settings.pipeline-rules');
        Route::put('/settings/notifications', [SettingsController::class, 'updateNotifications'])->name('portal.settings.notifications');
        Route::put('/settings/lead-webhook', [LeadWebhookController::class, 'update'])->name('portal.settings.lead-webhook.update');
        Route::post('/settings/lead-webhook/rotate', [LeadWebhookController::class, 'rotate'])->name('portal.settings.lead-webhook.rotate');
        Route::post('/settings/stages', [LeadStageController::class, 'store'])->name('portal.settings.stages.store');
        Route::put('/settings/stages/reorder', [LeadStageController::class, 'reorder'])->name('portal.settings.stages.reorder');
        Route::put('/settings/stages/{stage}', [LeadStageController::class, 'update'])->name('portal.settings.stages.update');
        Route::delete('/settings/stages/{stage}', [LeadStageController::class, 'destroy'])->name('portal.settings.stages.destroy');
        Route::post('/settings/order-stages', [OrderStageController::class, 'store'])->name('portal.settings.order-stages.store');
        Route::put('/settings/order-stages/reorder', [OrderStageController::class, 'reorder'])->name('portal.settings.order-stages.reorder');
        Route::put('/settings/order-stages/{stage}', [OrderStageController::class, 'update'])->name('portal.settings.order-stages.update');
        Route::delete('/settings/order-stages/{stage}', [OrderStageController::class, 'destroy'])->name('portal.settings.order-stages.destroy');
        Route::post('/settings/lead-actions', [LeadActionTypeController::class, 'store'])->name('portal.settings.lead-actions.store');
        Route::put('/settings/lead-actions/reorder', [LeadActionTypeController::class, 'reorder'])->name('portal.settings.lead-actions.reorder');
        Route::put('/settings/lead-actions/{actionType}', [LeadActionTypeController::class, 'update'])->name('portal.settings.lead-actions.update');
        Route::delete('/settings/lead-actions/{actionType}', [LeadActionTypeController::class, 'destroy'])->name('portal.settings.lead-actions.destroy');
        Route::post('/settings/campaign-goals', [CampaignGoalTypeController::class, 'store'])->name('portal.settings.campaign-goals.store');
        Route::put('/settings/campaign-goals/reorder', [CampaignGoalTypeController::class, 'reorder'])->name('portal.settings.campaign-goals.reorder');
        Route::put('/settings/campaign-goals/{goalType}', [CampaignGoalTypeController::class, 'update'])->name('portal.settings.campaign-goals.update');
        Route::delete('/settings/campaign-goals/{goalType}', [CampaignGoalTypeController::class, 'destroy'])->name('portal.settings.campaign-goals.destroy');
        Route::post('/settings/campaign-form-fields', [CampaignFormFieldController::class, 'store'])->name('portal.settings.campaign-form-fields.store');
        Route::put('/settings/campaign-form-fields/reorder', [CampaignFormFieldController::class, 'reorder'])->name('portal.settings.campaign-form-fields.reorder');
        Route::put('/settings/campaign-form-fields/{field}', [CampaignFormFieldController::class, 'update'])->name('portal.settings.campaign-form-fields.update');
        Route::delete('/settings/campaign-form-fields/{field}', [CampaignFormFieldController::class, 'destroy'])->name('portal.settings.campaign-form-fields.destroy');
        Route::get('/settings/integrations/meta/connect', [MetaIntegrationController::class, 'redirect'])->name('portal.settings.integrations.meta.connect');
        Route::get('/settings/integrations/meta/callback', [MetaIntegrationController::class, 'callback'])->name('portal.settings.integrations.meta.callback');
        Route::get('/settings/integrations/meta/forms', [MetaIntegrationController::class, 'forms'])->name('portal.settings.integrations.meta.forms');
        Route::put('/settings/integrations/meta', [MetaIntegrationController::class, 'update'])->name('portal.settings.integrations.meta.update');
        Route::delete('/settings/integrations/meta', [MetaIntegrationController::class, 'disconnect'])->name('portal.settings.integrations.meta.disconnect');
        Route::get('/settings/integrations/whatsapp/connect', [WhatsAppIntegrationController::class, 'redirect'])->name('portal.settings.integrations.whatsapp.connect');
        Route::get('/settings/integrations/whatsapp/callback', [WhatsAppIntegrationController::class, 'callback'])->name('portal.settings.integrations.whatsapp.callback');
        Route::put('/settings/integrations/whatsapp', [WhatsAppIntegrationController::class, 'update'])->name('portal.settings.integrations.whatsapp.update');
        Route::delete('/settings/integrations/whatsapp', [WhatsAppIntegrationController::class, 'disconnect'])->name('portal.settings.integrations.whatsapp.disconnect');
        Route::get('/media', [MediaController::class, 'index'])->name('portal.media.index');
        Route::post('/media', [MediaController::class, 'store'])->name('portal.media.store');
        Route::post('/media/sync', [MediaController::class, 'sync'])->name('portal.media.sync');
        Route::delete('/media/{media}', [MediaController::class, 'destroy'])->name('portal.media.destroy');
        Route::get('/documents', [DocumentController::class, 'index'])->name('portal.documents.index');
        Route::post('/documents', [DocumentController::class, 'store'])->name('portal.documents.store');
        Route::post('/documents/sync', [DocumentController::class, 'sync'])->name('portal.documents.sync');
        Route::delete('/documents/{document}', [DocumentController::class, 'destroy'])->name('portal.documents.destroy');
        Route::get('/documents/folders', [DocumentFolderController::class, 'index'])->name('portal.documents.folders.index');
        Route::post('/documents/folders', [DocumentFolderController::class, 'store'])->name('portal.documents.folders.store');
        Route::post('/documents/folders/move', [DocumentFolderController::class, 'move'])->name('portal.documents.folders.move');
        Route::match(['put', 'patch'], '/documents/folders/{folder}', [DocumentFolderController::class, 'update'])->name('portal.documents.folders.update');
        Route::delete('/documents/folders/{folder}', [DocumentFolderController::class, 'destroy'])->name('portal.documents.folders.destroy');
        Route::get('/documents/labels', [DocumentLabelController::class, 'index'])->name('portal.documents.labels.index');
        Route::post('/documents/labels', [DocumentLabelController::class, 'store'])->name('portal.documents.labels.store');
        Route::delete('/documents/labels/{label}', [DocumentLabelController::class, 'destroy'])->name('portal.documents.labels.destroy');
        Route::post('/documents/{document}/labels', [DocumentLabelController::class, 'sync'])->name('portal.documents.labels.sync');
        Route::get('/projects', [ProjectController::class, 'index'])->name('portal.projects.index');
        Route::post('/projects', [ProjectController::class, 'store'])->name('portal.projects.store');
        Route::get('/projects/{project}', [ProjectController::class, 'show'])->name('portal.projects.show');
        Route::match(['put', 'patch'], '/projects/{project}', [ProjectController::class, 'update'])->name('portal.projects.update');
        Route::delete('/projects/{project}', [ProjectController::class, 'destroy'])->name('portal.projects.destroy');
        Route::post('/projects/{project}/progress', [ProjectProgressController::class, 'store'])->name('portal.projects.progress.store');
        Route::match(['put', 'patch'], '/projects/{project}/progress/{progress}', [ProjectProgressController::class, 'update'])->name('portal.projects.progress.update');
        Route::delete('/projects/{project}/progress/{progress}', [ProjectProgressController::class, 'destroy'])->name('portal.projects.progress.destroy');
        Route::get('/teams', [TeamController::class, 'index'])->name('portal.teams.index');
        Route::post('/teams', [TeamController::class, 'store'])->name('portal.teams.store');
        Route::put('/teams/{team}', [TeamController::class, 'update'])->name('portal.teams.update');
        Route::delete('/teams/{team}', [TeamController::class, 'destroy'])->name('portal.teams.destroy');
        Route::get('/user-roles', [RoleController::class, 'index'])->name('portal.roles.index');
        Route::post('/user-roles', [RoleController::class, 'store'])->name('portal.roles.store');
        Route::put('/user-roles/{role}', [RoleController::class, 'update'])->name('portal.roles.update');
        Route::delete('/user-roles/{role}', [RoleController::class, 'destroy'])->name('portal.roles.destroy');
        Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
            ->name('portal.logout');
    });
});

Route::fallback(function () {
    throw new NotFoundHttpException;
});
