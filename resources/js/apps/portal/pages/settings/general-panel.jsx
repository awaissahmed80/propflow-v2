import { useEffect, useState } from "react";
import { router } from "@inertiajs/react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import {
    configuration as updateConfiguration,
    general as updateGeneral,
} from "@/routes/portal/settings";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ImagePicker } from "@/components/ui/image-picker";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

function pathFrom(url) {
    const raw = String(url || "/");

    if (raw.startsWith("//") || raw.startsWith("http://") || raw.startsWith("https://")) {
        try {
            const pathname = new URL(raw.startsWith("//") ? `https:${raw}` : raw).pathname;

            return pathname === "" ? "/" : pathname;
        } catch {
            return "/";
        }
    }

    return raw.startsWith("/") ? raw : `/${raw}`;
}

const DATE_FORMAT_OPTIONS = [
    { value: "DD MMM YYYY", label: "17 Sep 2026" },
    { value: "YYYY-MM-DD", label: "2026-09-17" },
    { value: "MM/DD/YYYY", label: "09/17/2026" },
    { value: "DD/MM/YYYY", label: "17/09/2026" },
];

const TIME_FORMAT_OPTIONS = [
    { value: "HH:mm", label: "14:30 (24h)" },
    { value: "hh:mm A", label: "02:30 PM" },
];

const TIMEZONE_OPTIONS = [
    { value: "UTC", label: "UTC" },
    { value: "Asia/Karachi", label: "Asia/Karachi" },
    { value: "Asia/Dubai", label: "Asia/Dubai" },
    { value: "Asia/Riyadh", label: "Asia/Riyadh" },
    { value: "Europe/London", label: "Europe/London" },
    { value: "America/New_York", label: "America/New_York" },
];

function buildDefaults(general = {}, configuration = {}) {
    return {
        business_name: general.business_name ?? "",
        tagline: general.tagline ?? "",
        phone: general.phone ?? "",
        whatsapp: general.whatsapp ?? "",
        email: general.email ?? "",
        website: general.website ?? "",
        address: general.address ?? "",
        city: general.city ?? "",
        state: general.state ?? "",
        tax_id: general.tax_id ?? "",
        currency_code: configuration.currency_code ?? "USD",
        currency_symbol: configuration.currency_symbol ?? "$",
        country: configuration.country ?? "",
        timezone: configuration.timezone ?? "UTC",
        date_format: configuration.date_format ?? "DD MMM YYYY",
        time_format: configuration.time_format ?? "HH:mm",
    };
}

function FormRow({ label, required = false, children, className, align = "center" }) {
    return (
        <div
            className={cn(
                "grid gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)] sm:gap-4",
                align === "start" ? "sm:items-start" : "sm:items-center",
                className
            )}
        >
            <div
                className={cn(
                    "text-sm font-medium text-foreground",
                    align === "start" && "sm:pt-2"
                )}
            >
                {label}
                {required ? <span className="text-destructive"> *</span> : null}
            </div>
            <div className="min-w-0 space-y-1.5">{children}</div>
        </div>
    );
}

function FormSection({ children, className }) {
    return (
        <div
            className={cn(
                "grid gap-x-8 gap-y-4 py-4 lg:grid-cols-2",
                className
            )}
        >
            {children}
        </div>
    );
}

function FieldError({ message }) {
    if (!message) {
        return null;
    }

    return <p className="text-sm text-destructive">{message}</p>;
}

export default function GeneralPanel({
    section,
    general = {},
    configuration = {},
}) {
    const [logoFile, setLogoFile] = useState(null);
    const [removeLogo, setRemoveLogo] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});

    const {
        register,
        handleSubmit,
        reset,
        setValue,
        watch,
        formState: { errors },
    } = useForm({
        defaultValues: buildDefaults(general, configuration),
    });

    const phone = watch("phone");
    const whatsapp = watch("whatsapp");
    const businessName = watch("business_name");

    useEffect(() => {
        reset(buildDefaults(general, configuration));
        setLogoFile(null);
        setRemoveLogo(false);
        setServerErrors({});
    }, [general, configuration, reset]);

    const fieldError = (name) => serverErrors[name] || errors[name]?.message;

    const handleLogoChange = (file) => {
        if (file instanceof File) {
            setLogoFile(file);
            setRemoveLogo(false);
            return;
        }

        setLogoFile(null);
        setRemoveLogo(true);
    };

    const onSubmit = (values) => {
        setProcessing(true);
        setServerErrors({});

        const profilePayload = {
            business_name: values.business_name.trim(),
            tagline: values.tagline?.trim() || null,
            phone: values.phone?.trim() || null,
            whatsapp: values.whatsapp?.trim() || null,
            email: values.email?.trim() || null,
            website: values.website?.trim() || null,
            address: values.address?.trim() || null,
            city: values.city?.trim() || null,
            state: values.state?.trim() || null,
            tax_id: values.tax_id?.trim() || null,
            remove_logo: removeLogo,
        };

        if (logoFile instanceof File) {
            profilePayload.logo = logoFile;
        }

        const localePayload = {
            currency_code: values.currency_code.trim().toUpperCase(),
            currency_symbol: values.currency_symbol.trim(),
            country: values.country?.trim() || null,
            timezone: values.timezone,
            date_format: values.date_format,
            time_format: values.time_format,
        };

        router.post(pathFrom(updateGeneral.url()), profilePayload, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: "errors",
            onSuccess: () => {
                router.put(pathFrom(updateConfiguration.url()), localePayload, {
                    preserveScroll: true,
                    preserveState: "errors",
                    onSuccess: () => {
                        toast.success("Settings saved");
                        setLogoFile(null);
                        setRemoveLogo(false);
                    },
                    onError: (submitErrors) => {
                        setServerErrors(submitErrors);
                        toast.error(
                            submitErrors.currency_code ||
                                submitErrors.message ||
                                "Unable to save regional settings"
                        );
                    },
                    onFinish: () => setProcessing(false),
                });
            },
            onError: (submitErrors) => {
                setServerErrors(submitErrors);
                toast.error(submitErrors.business_name || submitErrors.message || "Unable to save");
                setProcessing(false);
            },
        });
    };

    return (
        <form className="space-y-2" onSubmit={handleSubmit(onSubmit)}>
            <div className="sticky top-0 z-10 -mx-6 border-b border-border/60 px-6 py-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background text-foreground shadow-xs ring-1 ring-border/70">
                            <Icon
                                name={section?.icon || "building-line"}
                                className="text-base"
                            />
                        </span>
                        <div className="min-w-0">
                            <h2 className="text-base font-semibold tracking-tight text-foreground">
                                {section?.label ?? "General"}
                            </h2>
                            <p className="truncate text-xs text-muted-foreground">
                                Business profile and regional preferences
                            </p>
                        </div>
                    </div>
                    <Button type="submit" disabled={processing} className="shrink-0">
                        {processing ? "Saving…" : "Save Changes"}
                    </Button>
                </div>
            </div>

            <div className="pt-2">
                <FormSection>
                    <FormRow label="Business name" required>
                        <Input
                            required
                            error={fieldError("business_name")}
                            {...register("business_name", {
                                required: "Business name is required",
                            })}
                        />
                    </FormRow>
                    <FormRow label="Tagline">
                        <Input
                            error={fieldError("tagline")}
                            placeholder="Short slogan for proposals and emails"
                            {...register("tagline")}
                        />
                    </FormRow>
                </FormSection>

                <FormSection>
                    <FormRow label="Address" align="start" className="lg:col-span-2">
                        <Textarea
                            rows={3}
                            className="min-h-20 resize-y"
                            aria-invalid={Boolean(fieldError("address"))}
                            {...register("address")}
                        />
                        <FieldError message={fieldError("address")} />
                    </FormRow>
                </FormSection>

                <FormSection>
                    <FormRow label="City">
                        <Input error={fieldError("city")} {...register("city")} />
                    </FormRow>
                    <FormRow label="State / Province">
                        <Input error={fieldError("state")} {...register("state")} />
                    </FormRow>
                </FormSection>

                <FormSection>
                    <FormRow label="Country">
                        <Input error={fieldError("country")} {...register("country")} />
                    </FormRow>
                    <FormRow label="Tax / VAT ID">
                        <Input
                            error={fieldError("tax_id")}
                            placeholder="NTN, VAT, or company tax ID"
                            {...register("tax_id")}
                        />
                    </FormRow>
                </FormSection>

                <FormSection>
                    <FormRow label="Phone number">
                        <PhoneInput
                            label={null}
                            value={phone ?? ""}
                            onChange={(value) => setValue("phone", value, { shouldDirty: true })}
                            error={fieldError("phone")}
                        />
                    </FormRow>
                    <FormRow label="WhatsApp">
                        <PhoneInput
                            label={null}
                            value={whatsapp ?? ""}
                            onChange={(value) => setValue("whatsapp", value, { shouldDirty: true })}
                            error={fieldError("whatsapp")}
                        />
                    </FormRow>
                </FormSection>

                <FormSection>
                    <FormRow label="Email address">
                        <Input
                            type="email"
                            error={fieldError("email")}
                            {...register("email")}
                        />
                    </FormRow>
                    <FormRow label="Website">
                        <Input
                            error={fieldError("website")}
                            placeholder="https://"
                            {...register("website")}
                        />
                    </FormRow>
                </FormSection>

                <FormSection>
                    <FormRow label="Logo" align="start">
                        <div className="w-[7rem]">
                            <ImagePicker
                                value={logoFile}
                                previewUrl={removeLogo ? null : general.logo_url}
                                name={businessName || "Business"}
                                onChange={handleLogoChange}
                                shape="tile"
                                className="w-full items-stretch"
                            />
                        </div>
                        <FieldError message={fieldError("logo")} />
                    </FormRow>
                    <FormRow label="Currency">
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Input
                                required
                                maxLength={3}
                                startElement="Code"
                                error={fieldError("currency_code")}
                                {...register("currency_code", {
                                    required: "Currency code is required",
                                    minLength: { value: 3, message: "Use a 3-letter code" },
                                    maxLength: { value: 3, message: "Use a 3-letter code" },
                                })}
                            />
                            <Input
                                required
                                startElement="Symbol"
                                error={fieldError("currency_symbol")}
                                {...register("currency_symbol", {
                                    required: "Currency symbol is required",
                                })}
                            />
                        </div>
                    </FormRow>
                </FormSection>

                <FormSection>
                    <FormRow label="Timezone">
                        <SelectBox
                            required
                            value={watch("timezone")}
                            onValueChange={(value) =>
                                setValue("timezone", value, { shouldDirty: true })
                            }
                            options={TIMEZONE_OPTIONS}
                            error={fieldError("timezone")}
                            triggerClassName="w-full"
                        />
                    </FormRow>
                    <FormRow label="Date format">
                        <SelectBox
                            required
                            value={watch("date_format")}
                            onValueChange={(value) =>
                                setValue("date_format", value, { shouldDirty: true })
                            }
                            options={DATE_FORMAT_OPTIONS}
                            error={fieldError("date_format")}
                            triggerClassName="w-full"
                        />
                    </FormRow>
                    <FormRow label="Time format">
                        <SelectBox
                            required
                            value={watch("time_format")}
                            onValueChange={(value) =>
                                setValue("time_format", value, { shouldDirty: true })
                            }
                            options={TIME_FORMAT_OPTIONS}
                            error={fieldError("time_format")}
                            triggerClassName="w-full"
                        />
                    </FormRow>
                </FormSection>
            </div>
        </form>
    );
}
