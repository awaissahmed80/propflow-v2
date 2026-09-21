import { useState } from "react";
import { Head } from "@inertiajs/react";

export default function CampaignLanding({
    campaign,
    project = null,
    form,
    submitUrl,
    tenantIdentifier,
    isPreview = false,
}) {
    const [values, setValues] = useState(() => {
        const initial = {};
        (form.fields || []).forEach((field) => {
            initial[field.key] = "";
        });
        initial[form.settings?.honeypot_field || "company_website"] = "";
        return initial;
    });
    const [status, setStatus] = useState({ type: "", message: "" });
    const [submitting, setSubmitting] = useState(false);
    const [done, setDone] = useState(false);

    const landing = campaign.landing || {};
    const highlights = landing.highlights || [];

    const setField = (key, value) => {
        setValues((current) => ({ ...current, [key]: value }));
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSubmitting(true);
        setStatus({ type: "", message: "" });

        try {
            const response = await fetch(submitUrl, {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Content-Type": "application/json",
                },
                credentials: "omit",
                body: JSON.stringify({
                    ...values,
                    channel: "landing",
                    campaign_public_id: campaign.public_id,
                    page_url: window.location.href,
                    referrer: document.referrer || null,
                }),
            });

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const firstErrorKey = data.errors ? Object.keys(data.errors)[0] : null;
                throw new Error(
                    (firstErrorKey && data.errors[firstErrorKey]?.[0]) ||
                        data.message ||
                        "Unable to submit"
                );
            }

            setDone(true);
            setStatus({
                type: "success",
                message:
                    data.message ||
                    landing.thank_you_message ||
                    "Thanks — we will be in touch shortly.",
            });

            if (data.redirect_url) {
                window.location.assign(data.redirect_url);
            }
        } catch (error) {
            setStatus({
                type: "error",
                message: error.message || "Unable to submit",
            });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <>
            <Head title={landing.headline || campaign.title} />
            <div className="min-h-dvh bg-slate-950 text-slate-50">
                {isPreview ? (
                    <div className="border-b border-amber-400/30 bg-amber-400/15 px-4 py-2.5 text-center text-sm text-amber-100">
                        Preview mode — this campaign is not live yet. Set status to{" "}
                        <span className="font-semibold">Active</span> to publish.
                    </div>
                ) : null}
                <div
                    className="relative overflow-hidden border-b border-white/10"
                    style={{
                        backgroundImage: landing.hero_image
                            ? `linear-gradient(180deg, rgba(2,6,23,0.35), rgba(2,6,23,0.92)), url(${landing.hero_image})`
                            : "linear-gradient(135deg, #0f172a, #1e293b 45%, #0ea5e9)",
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                    }}
                >
                    <div className="mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-end px-6 py-16 md:px-10">
                        <p className="mb-3 text-sm font-medium tracking-[0.18em] text-sky-200/90 uppercase">
                            {tenantIdentifier}
                        </p>
                        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-white md:text-6xl">
                            {landing.headline || campaign.title}
                        </h1>
                        {landing.subheadline ? (
                            <p className="mt-4 max-w-2xl text-lg text-slate-200 md:text-xl">
                                {landing.subheadline}
                            </p>
                        ) : null}
                        <div className="mt-8">
                            <a
                                href="#register"
                                className="inline-flex rounded-md bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
                            >
                                {landing.cta_label || "Register interest"}
                            </a>
                        </div>
                    </div>
                </div>

                <div className="mx-auto grid max-w-6xl gap-10 px-6 py-14 md:grid-cols-[1.1fr_0.9fr] md:px-10">
                    <section className="space-y-6">
                        {project ? (
                            <div>
                                <p className="text-sm font-medium tracking-wide text-sky-300 uppercase">
                                    Project
                                </p>
                                <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                                    {project.title}
                                </h2>
                                {(project.city || project.location) && (
                                    <p className="mt-2 text-slate-300">
                                        {[project.city, project.location]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                )}
                                {project.description ? (
                                    <p className="mt-4 max-w-2xl whitespace-pre-line text-slate-300">
                                        {project.description}
                                    </p>
                                ) : null}
                            </div>
                        ) : null}

                        {landing.body ? (
                            <p className="max-w-2xl whitespace-pre-line text-slate-300">
                                {landing.body}
                            </p>
                        ) : null}

                        {highlights.length > 0 ? (
                            <ul className="grid gap-3 sm:grid-cols-2">
                                {highlights.map((item) => (
                                    <li
                                        key={item}
                                        className="rounded-md border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-100"
                                    >
                                        {item}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                    </section>

                    <section
                        id="register"
                        className="rounded-xl border border-white/10 bg-white p-6 text-slate-900 shadow-xl"
                    >
                        <h2 className="text-xl font-semibold tracking-tight">
                            {landing.cta_label || "Register interest"}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                            Leave your details and our team will follow up.
                        </p>

                        {done ? (
                            <p className="mt-6 text-sm font-medium text-emerald-700">
                                {status.message}
                            </p>
                        ) : (
                            <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
                                {(form.fields || []).map((field) => (
                                    <div key={field.key} className="space-y-1.5">
                                        <label className="block text-sm font-medium text-slate-700">
                                            {field.label}
                                            {field.required ? " *" : ""}
                                        </label>
                                        {field.type === "textarea" ? (
                                            <textarea
                                                rows={3}
                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                                                placeholder={field.placeholder || ""}
                                                value={values[field.key] || ""}
                                                onChange={(event) =>
                                                    setField(field.key, event.target.value)
                                                }
                                            />
                                        ) : (
                                            <input
                                                type={field.type || "text"}
                                                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
                                                placeholder={field.placeholder || ""}
                                                value={values[field.key] || ""}
                                                onChange={(event) =>
                                                    setField(field.key, event.target.value)
                                                }
                                            />
                                        )}
                                    </div>
                                ))}

                                <input
                                    type="text"
                                    tabIndex={-1}
                                    autoComplete="off"
                                    aria-hidden
                                    className="absolute left-[-10000px] h-px w-px overflow-hidden"
                                    value={
                                        values[form.settings?.honeypot_field || "company_website"] ||
                                        ""
                                    }
                                    onChange={(event) =>
                                        setField(
                                            form.settings?.honeypot_field || "company_website",
                                            event.target.value
                                        )
                                    }
                                />

                                {status.type === "error" ? (
                                    <p className="text-sm text-red-600">{status.message}</p>
                                ) : null}

                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-60"
                                >
                                    {submitting
                                        ? "Submitting…"
                                        : form.settings?.button_label || "Submit"}
                                </button>
                            </form>
                        )}
                    </section>
                </div>
            </div>
        </>
    );
}
