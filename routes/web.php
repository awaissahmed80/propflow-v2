<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
use App\Http\Controllers\Portal\DocumentController;
use App\Http\Controllers\Portal\DocumentFolderController;
use App\Http\Controllers\Portal\DocumentLabelController;
use App\Http\Controllers\Portal\InventoryController;
use App\Http\Controllers\Portal\LeadController;
use App\Http\Controllers\Portal\MediaController;
use App\Http\Controllers\Portal\MetaDataController;
use App\Http\Controllers\Portal\ProjectBlockController;
use App\Http\Controllers\Portal\ProjectController;
use App\Http\Controllers\Portal\ProjectProgressController;
use App\Http\Controllers\Portal\RoleController;
use App\Http\Controllers\Portal\TeamController;
use App\Http\Controllers\Portal\UnitController;
use App\Http\Controllers\Portal\UserController;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

$baseDomain = config('app.base_domain');

Route::middleware(['web', 'public'])->group(function () use ($baseDomain) {
    Route::domain($baseDomain)->group(function () {
        Route::inertia('/', 'welcome')->name('home');
    });
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
        Route::inertia('/', 'welcome')->name('portal.home');
        Route::get('/leads', [LeadController::class, 'index'])->name('portal.leads.index');
        Route::post('/leads', [LeadController::class, 'store'])->name('portal.leads.store');
        Route::match(['put', 'patch'], '/leads/{lead}', [LeadController::class, 'update'])->name('portal.leads.update');
        Route::delete('/leads/{lead}', [LeadController::class, 'destroy'])->name('portal.leads.destroy');
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
