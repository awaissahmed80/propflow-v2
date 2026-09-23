import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import {
    store,
    update,
} from "@/actions/App/Http/Controllers/Portal/ContactController";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupNumberInput,
} from "@/components/ui/input-group";
import { Label } from "@/components/ui/label";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useCurrency } from "@/hooks/use-currency";
import { cn } from "@/lib/utils";
import { invalidateContactCardCache } from "../../components/contact-card";

const emptyValues = {
    contact_name: "",
    phone_number: "",
    phone_number_alt: "",
    email_address: "",
    reference: "",
    city: "",
    country: "",
    address: "",
    cnic: "",
    contact_preference: "",
    type: "LEAD",
    tag: "GENERAL",
    income_level: "MIDDLE",
    affordability: "MODERATE",
    capability: "MODERATE",
    net_worth: null,
    goal: "",
};

function titleCaseLabel(value) {
    return String(value || "")
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function splitName(fullName) {
    const parts = String(fullName || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    if (parts.length === 0) {
        return { first_name: null, last_name: null };
    }

    if (parts.length === 1) {
        return { first_name: parts[0], last_name: null };
    }

    return {
        first_name: parts[0],
        last_name: parts.slice(1).join(" "),
    };
}

function joinName(contact) {
    return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
}

function toOptions(values, fallback) {
    const list = values.length > 0 ? values : fallback;

    return list.map((value) => ({
        value,
        label: titleCaseLabel(value),
    }));
}

function ChipGroup({ label, error, options, value, onChange }) {
    return (
        <div className="space-y-1.5">
            <Label className="mb-1 text-label font-medium text-muted-foreground">
                {label}
            </Label>
            <div className="flex flex-wrap gap-2">
                {options.map((option) => {
                    const selected = value === option.value;

                    return (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => onChange(option.value)}
                            className={cn(
                                "inline-flex items-center rounded-md border px-2.5 py-1.5 text-sm transition-colors",
                                selected
                                    ? "border-primary/50 bg-primary/10 font-medium text-primary ring-1 ring-primary/30"
                                    : "border-border bg-muted/30 text-foreground hover:bg-muted/60"
                            )}
                        >
                            {option.label}
                        </button>
                    );
                })}
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
    );
}

function valuesFromContact(contact) {
    if (!contact) {
        return emptyValues;
    }

    return {
        contact_name: joinName(contact),
        phone_number: contact.phone_number || "",
        phone_number_alt: contact.phone_number_alt || "",
        email_address: contact.email_address || "",
        reference: contact.reference || "",
        city: contact.city || "",
        country: contact.country || "",
        address: contact.address || "",
        cnic: contact.cnic || "",
        contact_preference: contact.contact_preference || "",
        type: contact.type || "LEAD",
        tag: contact.tag || "GENERAL",
        income_level: contact.income_level || "MIDDLE",
        affordability: contact.affordability || "MODERATE",
        capability: contact.capability || "MODERATE",
        net_worth: contact.net_worth ?? null,
        goal: contact.goal || "",
    };
}

export default function ContactForm({
    isOpen,
    onClose,
    data = null,
    tags = [],
    types = [],
    incomeLevels = [],
    affordabilityLevels = [],
    capabilityLevels = [],
    onSaved,
}) {
    const isEditing = Boolean(data?.uuid);
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const { symbol: currencySymbol } = useCurrency();

    const {
        register,
        control,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm({
        defaultValues: emptyValues,
        mode: "onSubmit",
        reValidateMode: "onChange",
    });

    const typeOptions = useMemo(() => toOptions(types, ["LEAD", "CLIENT"]), [types]);
    const tagOptions = useMemo(() => toOptions(tags, ["GENERAL"]), [tags]);
    const incomeOptions = useMemo(
        () => toOptions(incomeLevels, ["MIDDLE"]),
        [incomeLevels]
    );
    const affordabilityOptions = useMemo(
        () => toOptions(affordabilityLevels, ["MODERATE"]),
        [affordabilityLevels]
    );
    const capabilityOptions = useMemo(
        () => toOptions(capabilityLevels, ["MODERATE"]),
        [capabilityLevels]
    );

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        setServerErrors({});
        reset(valuesFromContact(data));
    }, [isOpen, data, reset]);

    const fieldError = (name) => {
        if (serverErrors[name]) {
            return Array.isArray(serverErrors[name])
                ? serverErrors[name][0]
                : serverErrors[name];
        }

        return errors[name]?.message;
    };

    const handleClose = () => {
        if (processing) {
            return;
        }

        onClose();
    };

    const onSubmit = (values) => {
        const phone = String(values.phone_number || "").trim();
        const email = String(values.email_address || "").trim();

        if (!phone && !email) {
            setServerErrors({
                phone_number: "Phone or email is required.",
                email_address: "Phone or email is required.",
            });
            toast.error("Please fix the highlighted fields");
            return;
        }

        setProcessing(true);
        setServerErrors({});

        const { first_name, last_name } = splitName(values.contact_name);

        const payload = {
            first_name,
            last_name,
            phone_number: phone || null,
            phone_number_alt:
                String(values.phone_number_alt || "").trim() || null,
            email_address: email || null,
            reference: String(values.reference || "").trim() || null,
            city: String(values.city || "").trim() || null,
            country: String(values.country || "").trim() || null,
            address: String(values.address || "").trim() || null,
            cnic: String(values.cnic || "").trim() || null,
            contact_preference:
                String(values.contact_preference || "").trim() || null,
            type: values.type || "LEAD",
            tag: values.tag || "GENERAL",
            income_level: values.income_level || "MIDDLE",
            affordability: values.affordability || "MODERATE",
            capability: values.capability || "MODERATE",
            net_worth: values.net_worth ?? 0,
            goal: String(values.goal || "").trim() || null,
        };

        const visit = {
            preserveScroll: true,
            onSuccess: () => {
                if (isEditing) {
                    invalidateContactCardCache(data.uuid);
                }
                toast.success(isEditing ? "Contact updated" : "Contact created");
                onSaved?.(
                    isEditing
                        ? {
                              ...data,
                              ...payload,
                              display_name: joinName({ first_name, last_name }),
                          }
                        : null
                );
                onClose();
            },
            onError: (formErrors) => {
                setServerErrors(formErrors || {});
                toast.error("Please fix the highlighted fields");
            },
            onFinish: () => setProcessing(false),
        };

        if (isEditing) {
            router.patch(update.url(data.uuid), payload, visit);
            return;
        }

        router.post(store.url(), payload, visit);
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="grid max-h-[min(92vh,48rem)] grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden p-0 sm:max-w-xl">
                <DialogHeader className="border-b border-border px-6 py-4">
                    <DialogTitle className="flex items-center gap-2">
                        <Icon name="folder-user-line" className="text-xl" />
                        {isEditing ? "Edit contact" : "New contact"}
                    </DialogTitle>
                    <DialogDescription>
                        {isEditing
                            ? "Update contact details. Matching leads will use this record."
                            : "Add a contact with phone or email. Leads can reuse matching contacts later."}
                    </DialogDescription>
                </DialogHeader>

                <form
                    id="contact-form"
                    className="min-h-0 overflow-y-auto px-6 py-5"
                    onSubmit={handleSubmit(onSubmit)}
                >
                    <div className="space-y-5">
                        <div className="space-y-4">
                            <Input
                                label="Name"
                                required
                                placeholder="Sonia Koll"
                                error={
                                    fieldError("contact_name") ||
                                    fieldError("first_name")
                                }
                                {...register("contact_name", {
                                    required: "Name is required.",
                                })}
                            />

                            <div className="space-y-1.5">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <Input
                                        label="Phone"
                                        required
                                        placeholder="+92 300 1234567"
                                        error={fieldError("phone_number")}
                                        {...register("phone_number")}
                                    />
                                    <Input
                                        label="Email"
                                        required
                                        type="email"
                                        placeholder="sonia@example.com"
                                        error={fieldError("email_address")}
                                        {...register("email_address")}
                                    />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    At least one of phone or email is required.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="Alt phone"
                                    placeholder="+92 301 7654321"
                                    error={fieldError("phone_number_alt")}
                                    {...register("phone_number_alt")}
                                />
                                <Input
                                    label="Company / reference"
                                    placeholder="Acme Corp"
                                    error={fieldError("reference")}
                                    {...register("reference")}
                                />
                            </div>

                            <Controller
                                name="type"
                                control={control}
                                render={({ field }) => (
                                    <ChipGroup
                                        label="Type"
                                        options={typeOptions}
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={fieldError("type")}
                                    />
                                )}
                            />

                            <Controller
                                name="tag"
                                control={control}
                                render={({ field }) => (
                                    <ChipGroup
                                        label="Tag"
                                        options={tagOptions}
                                        value={field.value}
                                        onChange={field.onChange}
                                        error={fieldError("tag")}
                                    />
                                )}
                            />
                        </div>

                        <div className="space-y-4 border-t border-border pt-5">
                            <h3 className="text-base font-bold tracking-tight text-foreground">
                                Demographics
                            </h3>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="City"
                                    placeholder="Karachi"
                                    error={fieldError("city")}
                                    {...register("city")}
                                />
                                <Input
                                    label="Country"
                                    placeholder="Pakistan"
                                    error={fieldError("country")}
                                    {...register("country")}
                                />
                            </div>

                            <Input
                                label="Address"
                                placeholder="Street address"
                                error={fieldError("address")}
                                {...register("address")}
                            />

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Input
                                    label="CNIC"
                                    placeholder="42101-1234567-1"
                                    error={fieldError("cnic")}
                                    {...register("cnic")}
                                />
                                <Input
                                    label="Contact preference"
                                    placeholder="WhatsApp"
                                    error={fieldError("contact_preference")}
                                    {...register("contact_preference")}
                                />
                            </div>

                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                <Controller
                                    name="income_level"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Income level"
                                            options={incomeOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            error={fieldError("income_level")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="affordability"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Affordability"
                                            options={affordabilityOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            error={fieldError("affordability")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="capability"
                                    control={control}
                                    render={({ field }) => (
                                        <SelectBox
                                            label="Capability"
                                            options={capabilityOptions}
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            error={fieldError("capability")}
                                        />
                                    )}
                                />
                                <Controller
                                    name="net_worth"
                                    control={control}
                                    render={({ field }) => (
                                        <div className="space-y-0.5">
                                            <Label className="mb-1 text-label font-medium text-muted-foreground">
                                                Net worth
                                            </Label>
                                            <InputGroup
                                                className={cn(
                                                    fieldError("net_worth") &&
                                                        "border-destructive"
                                                )}
                                            >
                                                <InputGroupAddon>
                                                    {currencySymbol}
                                                </InputGroupAddon>
                                                <InputGroupNumberInput
                                                    value={field.value}
                                                    onChange={field.onChange}
                                                    allowDecimal
                                                    min={0}
                                                    placeholder="0"
                                                />
                                            </InputGroup>
                                            {fieldError("net_worth") ? (
                                                <p className="text-sm text-destructive">
                                                    {fieldError("net_worth")}
                                                </p>
                                            ) : null}
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                        <div className="space-y-0.5 border-t border-border pt-5">
                            <Label className="mb-1 text-label font-medium text-muted-foreground">
                                Goal / note
                            </Label>
                            <Textarea
                                rows={3}
                                placeholder="Looking for a 2-bed investment unit..."
                                aria-invalid={
                                    Boolean(fieldError("goal")) || undefined
                                }
                                {...register("goal")}
                            />
                            {fieldError("goal") ? (
                                <p className="text-sm text-destructive">
                                    {fieldError("goal")}
                                </p>
                            ) : null}
                        </div>
                    </div>
                </form>

                <DialogFooter className="border-t border-border bg-popover px-6 py-4 sm:justify-end">
                    <Button type="button" variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button type="submit" form="contact-form" loading={processing}>
                        {isEditing ? "Save changes" : "Create contact"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
