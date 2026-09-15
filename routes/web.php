<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

// use Log;
Route::middleware(['web', 'public'])->group(function () {
    Route::domain(env('APP_BASE_DOMAIN'))->group(function () {
        // Log::debug('home', [env('APP_BASE_DOMAIN')]);
        Route::inertia('/', 'welcome')->name('home');
    });
});

Route::middleware(['web', 'portal'])->group(function () {
    Route::domain('auth.'.env('APP_BASE_DOMAIN'))->group(function () {
        Route::inertia('/', 'auth/login')->name('auth');
        Route::inertia('/forgot-password', 'auth/forgot-password')->name('auth.forgot-password');
    });
    Route::domain('portal.'.env('APP_BASE_DOMAIN'))->group(function () {
        Route::inertia('/', 'welcome')->name('home');
        Route::inertia('/leads', 'leads/index')->name('leads');
    });
});

Route::fallback(function () {
    throw new NotFoundHttpException;
});

// Route::fallback(function (Request $request) {
//     // No need to manually set root view - it will use whatever root view
//     // the middleware determines based on the request URL
//     Inertia::setRootView('public');
//     return Inertia::render('errors/not-found')->toResponse($request)->setStatusCode(404);
// });
