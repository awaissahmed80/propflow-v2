<?php

namespace App\Http\Controllers\Public;

use App\Http\Controllers\Controller;
use App\Http\Requests\Public\SubmitPublicFormRequest;
use App\Models\Campaign;
use App\Models\CampaignForm;
use App\Services\LeadIntakeService;
use App\Support\Domain;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Symfony\Component\HttpFoundation\Response as SymfonyResponse;

class PublicFormController extends Controller
{
    public function __construct(protected LeadIntakeService $intake) {}

    public function script(Request $request, string $identifier): Response
    {
        $formId = $request->query('id');

        if (! is_string($formId) || $formId === '') {
            abort(404);
        }

        $configUrl = Domain::app('/'.$identifier.'/forms/'.$formId);
        $submitUrl = Domain::app('/'.$identifier.'/forms/'.$formId.'/submit');

        return response($this->embedScript($configUrl, $submitUrl), 200, [
            'Content-Type' => 'application/javascript; charset=UTF-8',
            'Cache-Control' => 'public, max-age=300',
            'Access-Control-Allow-Origin' => '*',
        ]);
    }

    public function show(string $identifier, string $form): JsonResponse
    {
        $campaignForm = CampaignForm::query()
            ->where('public_id', $form)
            ->firstOrFail();

        if (! $campaignForm->isActive()) {
            abort(404);
        }

        return response()
            ->json($this->formPayload($campaignForm))
            ->header('Access-Control-Allow-Origin', '*')
            ->header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
            ->header('Access-Control-Allow-Headers', 'Content-Type, Accept, X-Requested-With');
    }

    public function options(string $identifier, string $form): SymfonyResponse
    {
        return response('', 204, [
            'Access-Control-Allow-Origin' => '*',
            'Access-Control-Allow-Methods' => 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers' => 'Content-Type, Accept, X-Requested-With',
            'Access-Control-Max-Age' => '86400',
        ]);
    }

    public function submit(SubmitPublicFormRequest $request, string $identifier, string $form): JsonResponse
    {
        $campaignForm = $request->campaignForm;
        abort_unless($campaignForm instanceof CampaignForm, 404);

        $validated = $request->validated();
        $campaign = null;
        $campaignPublicId = $validated['campaign_public_id'] ?? null;

        if (is_string($campaignPublicId) && $campaignPublicId !== '') {
            $campaign = Campaign::query()
                ->where('public_id', $campaignPublicId)
                ->where('status', Campaign::STATUS_ACTIVE)
                ->first();
        }

        $result = $this->intake->submitForm(
            $campaignForm,
            [
                'first_name' => $validated['first_name'] ?? null,
                'last_name' => $validated['last_name'] ?? null,
                'phone_number' => $validated['phone_number'] ?? null,
                'email_address' => $validated['email_address'] ?? null,
                'budget' => $validated['budget'] ?? null,
                'notes' => $validated['notes'] ?? null,
                'preferred_contact_time' => $validated['preferred_contact_time'] ?? null,
            ],
            $campaign,
            [
                'channel' => $validated['channel'] ?? 'embed',
                'page_url' => $validated['page_url'] ?? null,
                'referrer' => $validated['referrer'] ?? null,
                'utm' => $validated['utm'] ?? [],
                'user_agent' => $request->userAgent(),
                'ip' => $request->ip(),
            ],
        );

        $settings = array_merge(CampaignForm::defaultSettings(), $campaignForm->settings ?? []);
        $landingThanks = data_get($campaign?->landing, 'thank_you_message');
        $landingRedirect = data_get($campaign?->landing, 'redirect_url');

        return response()
            ->json([
                'message' => $landingThanks
                    ?: ($settings['thank_you_message'] ?? 'Thanks — we will be in touch shortly.'),
                'redirect_url' => $landingRedirect ?: ($settings['redirect_url'] ?? null),
                'lead_id' => $result['lead']->id,
                'contact_reused' => $result['contact_reused'],
            ], 201)
            ->header('Access-Control-Allow-Origin', '*');
    }

    /**
     * @return array<string, mixed>
     */
    public function formPayload(CampaignForm $form): array
    {
        $settings = array_merge(CampaignForm::defaultSettings(), $form->settings ?? []);

        return [
            'id' => $form->public_id,
            'name' => $form->name,
            'fields' => $form->enabledFields(),
            'settings' => [
                'thank_you_message' => $settings['thank_you_message'] ?? null,
                'redirect_url' => $settings['redirect_url'] ?? null,
                'honeypot_field' => $settings['honeypot_field'] ?? 'company_website',
                'button_label' => data_get($form->branding, 'button_label', 'Submit'),
            ],
            'branding' => $form->branding ?? [],
        ];
    }

    protected function embedScript(string $configUrl, string $submitUrl): string
    {
        $configJson = json_encode($configUrl, JSON_UNESCAPED_SLASHES);
        $submitJson = json_encode($submitUrl, JSON_UNESCAPED_SLASHES);

        return <<<JS
(function () {
  var CONFIG_URL = {$configJson};
  var SUBMIT_URL = {$submitJson};
  var current = document.currentScript;
  var mount = current && current.parentElement ? current.parentElement : null;
  if (!mount) { return; }

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        if (key === "style" && typeof attrs[key] === "object") {
          Object.assign(node.style, attrs[key]);
          return;
        }
        if (key === "text") { node.textContent = attrs[key]; return; }
        node.setAttribute(key, attrs[key]);
      });
    }
    (children || []).forEach(function (child) {
      if (child) { node.appendChild(child); }
    });
    return node;
  }

  var root = el("div", { "data-propflow-form": "1", style: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    maxWidth: "28rem",
    color: "#0f172a"
  }});
  var status = el("div", { style: { marginTop: "0.75rem", fontSize: "0.875rem" } });
  mount.appendChild(root);
  mount.appendChild(status);

  fetch(CONFIG_URL, { headers: { Accept: "application/json" }, credentials: "omit" })
    .then(function (res) {
      if (!res.ok) { throw new Error("Form unavailable"); }
      return res.json();
    })
    .then(function (config) {
      var form = el("form", { novalidate: "novalidate" });
      var fields = config.fields || [];
      var honeypot = (config.settings && config.settings.honeypot_field) || "company_website";

      fields.forEach(function (field) {
        var wrap = el("div", { style: { marginBottom: "0.75rem" } });
        wrap.appendChild(el("label", {
          text: field.label + (field.required ? " *" : ""),
          style: { display: "block", fontSize: "0.8125rem", fontWeight: "600", marginBottom: "0.25rem" }
        }));
        var input = field.type === "textarea"
          ? el("textarea", { name: field.key, rows: "3", placeholder: field.placeholder || "" })
          : el("input", { name: field.key, type: field.type || "text", placeholder: field.placeholder || "" });
        Object.assign(input.style, {
          width: "100%", boxSizing: "border-box", border: "1px solid #cbd5e1",
          borderRadius: "0.375rem", padding: "0.5rem 0.75rem", fontSize: "0.875rem"
        });
        wrap.appendChild(input);
        form.appendChild(wrap);
      });

      var hp = el("input", {
        name: honeypot, type: "text", tabindex: "-1", autocomplete: "off",
        style: { position: "absolute", left: "-10000px", top: "auto", width: "1px", height: "1px", overflow: "hidden" }
      });
      form.appendChild(hp);

      var button = el("button", {
        type: "submit",
        text: (config.settings && config.settings.button_label) || "Submit",
        style: {
          background: "#0f172a", color: "#fff", border: "0", borderRadius: "0.375rem",
          padding: "0.625rem 1rem", fontSize: "0.875rem", fontWeight: "600", cursor: "pointer", width: "100%"
        }
      });
      form.appendChild(button);

      form.addEventListener("submit", function (event) {
        event.preventDefault();
        status.textContent = "";
        status.style.color = "#475569";
        button.disabled = true;

        var body = {
          channel: "embed",
          page_url: window.location.href,
          referrer: document.referrer || null,
          utm: {}
        };
        try {
          var params = new URLSearchParams(window.location.search);
          ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach(function (key) {
            if (params.get(key)) { body.utm[key] = params.get(key); }
          });
        } catch (e) {}

        fields.forEach(function (field) {
          var node = form.elements.namedItem(field.key);
          body[field.key] = node ? node.value : null;
        });
        body[honeypot] = form.elements.namedItem(honeypot) ? form.elements.namedItem(honeypot).value : "";

        fetch(SUBMIT_URL, {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          credentials: "omit",
          body: JSON.stringify(body)
        }).then(function (res) {
          return res.json().then(function (data) {
            if (!res.ok) {
              var message = data.message || "Unable to submit";
              if (data.errors) {
                var first = Object.keys(data.errors)[0];
                if (first && data.errors[first] && data.errors[first][0]) {
                  message = data.errors[first][0];
                }
              }
              throw new Error(message);
            }
            return data;
          });
        }).then(function (data) {
          form.style.display = "none";
          status.style.color = "#166534";
          status.textContent = data.message || "Thanks — we will be in touch shortly.";
          if (data.redirect_url) {
            window.location.assign(data.redirect_url);
          }
        }).catch(function (error) {
          status.style.color = "#b91c1c";
          status.textContent = error.message || "Unable to submit";
          button.disabled = false;
        });
      });

      root.appendChild(form);
    })
    .catch(function () {
      status.style.color = "#b91c1c";
      status.textContent = "This form is unavailable.";
    });
})();
JS;
    }
}
