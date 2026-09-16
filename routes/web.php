<?php

use App\Http\Controllers\Auth\AuthenticatedSessionController;
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
        Route::inertia('/leads', 'leads/index')->name('portal.leads');
        Route::post('/logout', [AuthenticatedSessionController::class, 'destroy'])
            ->name('portal.logout');
    });
});

Route::fallback(function () {
    throw new NotFoundHttpException;
});
