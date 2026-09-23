<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Services\GlobalSearch;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SearchController extends Controller
{
    public function __construct(protected GlobalSearch $search) {}

    public function index(Request $request): JsonResponse
    {
        $query = $request->string('q')->trim()->toString();

        return response()->json([
            'query' => $query,
            'results' => $this->search->search($query),
        ]);
    }
}
