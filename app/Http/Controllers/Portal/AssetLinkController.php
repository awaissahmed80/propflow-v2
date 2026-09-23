<?php

namespace App\Http\Controllers\Portal;

use App\Http\Controllers\Controller;
use App\Http\Requests\Portal\UpdateAssetLinkRequest;
use App\Models\AssetLink;
use Illuminate\Http\RedirectResponse;

class AssetLinkController extends Controller
{
    public function update(UpdateAssetLinkRequest $request, AssetLink $link): RedirectResponse
    {
        $validated = $request->validated();

        $link->fill($validated)->save();

        return back();
    }
}
