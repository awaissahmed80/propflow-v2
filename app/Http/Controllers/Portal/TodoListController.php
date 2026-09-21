<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use Inertia\Inertia;
use Inertia\Response;

class TodoListController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('todos/index', [
            'title' => 'Todo List',
            'description' => 'Track personal and shared follow-ups across sales and operations.',
            'breadcrumbs' => [
                ['label' => 'Todo List'],
            ],
        ]);
    }
}
