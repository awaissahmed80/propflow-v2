import { useEffect, useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { destroy, update } from "@/actions/App/Http/Controllers/Portal/ContactController";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Icon } from "@/components/ui/icon";
import { IconButton } from "@/components/ui/icon-button";
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

const TABS = [
    { id: "details", label: "Details" },
    { id: "activity", label: "Activity" },
    { id: "tasks", label: "Tasks" },
    { id: "notes", label: "Notes" },
];

function titleCaseLabel(value) {
    return String(value || "")
        .toLowerCase()
        .split(" ")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function phoneDigits(phone) {
    return String(phone || "").replace(/\D+/g, "");
}

function whatsappUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `https://wa.me/${digits}` : null;
}

function telUrl(phone) {
    const digits = phoneDigits(phone);

    return digits ? `tel:+${digits}` : null;
}

function mailtoUrl(email) {
    return email ? `mailto:${email}` : null;
}

function joinName(contact) {
    return [contact?.first_name, contact?.last_name].filter(Boolean).join(" ");
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

function ActionIcon({ href, icon, label, disabled = false }) {
    const className = cn(
        "inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors",
        disabled
            ? "pointer-events-none opacity-40"
            : "hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
    );

    if (href && !disabled) {
        return (
            <a
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel={href.startsWith("http") ? "noreferrer" : undefined}
                className={className}
                aria-label={label}
            >
                <Icon name={icon} className="text-lg" />
            </a>
        );
    }

    return (
        <button type="button" className={className} aria-label={label} disabled>
            <Icon name={icon} className="text-lg" />
        </button>
    );
}

export default function ContactDetailPanel({
    contact,
    open,
    onClose,
    types = [],
    tags = [],
    incomeLevels = [],
    affordabilityLevels = [],
    capabilityLevels = [],
    onSaved,
}) {
    const [tab, setTab] = useState("details");
    const [processing, setProcessing] = useState(false);
    const [serverErrors, setServerErrors] = useState({});
    const { symbol: currencySymbol } = useCurrency();

    const typeOptions = useMemo(
        () =>
            (types.length > 0 ? types : ["LEAD", "CLIENT"]).map((value) => ({
                value,
                label: titleCaseLabel(value),
            })),
        [types]
    );

    const tagOptions = useMemo(
        () =>
            (tags.length > 0 ? tags : ["GENERAL"]).map((value) => ({
                value,
                label: titleCaseLabel(value),
            })),
        [tags]
    );

    const incomeOptions = useMemo(
        () =>
            (incomeLevels.length > 0 ? incomeLevels : ["MIDDLE"]).map((value) => ({
                value,
                label: titleCaseLabel(value),
            })),
        [incomeLevels]
    );

    const affordabilityOptions = useMemo(
        () =>
            (affordabilityLevels.length > 0
                ? affordabilityLevels
                : ["MODERATE"]
            ).map((value) => ({
                value,
                label: titleCaseLabel(value),
            })),
        [affordabilityLevels]
    );

    const capabilityOptions = useMemo(
        () =>
            (capabilityLevels.length > 0
                ? capabilityLevels
                : ["MODERATE"]
            ).map((value) => ({
                value,
                label: titleCaseLabel(value),
            })),
        [capabilityLevels]
    );

    const {
        register,
        control,
        handleSubmit,
        reset,
        watch,
        formState: { errors, isDirty },
    } = useForm({
        defaultValues: {
            contact_name: "",
            reference: "",
            phone_number: "",
            phone_number_alt: "",
            email_address: "",
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
        },
    });

    useEffect(() => {
        if (!open || !contact) {
            return;
        }

        setTab("details");
        setServerErrors({});
        reset({
            contact_name: joinName(contact),
            reference: contact.reference || "",
            phone_number: contact.phone_number || "",
            phone_number_alt: contact.phone_number_alt || "",
            email_address: contact.email_address || "",
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
        });
    }, [open, contact, reset]);

    const watchedName = watch("contact_name");
    const watchedPhone = watch("phone_number");
    const watchedEmail = watch("email_address");
    const watchedType = watch("type");
    const watchedTag = watch("tag");

    const wa = useMemo(() => whatsappUrl(watchedPhone), [watchedPhone]);
    const call = useMemo(() => telUrl(watchedPhone), [watchedPhone]);
    const mail = useMemo(() => mailtoUrl(watchedEmail), [watchedEmail]);

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
        if (!contact) {
            return;
        }

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

        router.patch(
            update.url(contact.id),
            {
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
            },
            {
                preserveScroll: true,
                onSuccess: () => {
                    toast.success("Contact updated");
                    onSaved?.({
                        ...contact,
                        first_name,
                        last_name,
                        display_name:
                            [first_name, last_name].filter(Boolean).join(" ") ||
                            contact.display_name,
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
                    });
                    reset(values);
                    onClose();
                },
                onError: (formErrors) => {
                    setServerErrors(formErrors || {});
                    toast.error("Please fix the highlighted fields");
                },
                onFinish: () => setProcessing(false),
            }
        );
    };

    const handleDelete = () => {
        if (!contact) {
            return;
        }

        toast.promise(
            new Promise((resolve, reject) => {
                router.delete(destroy.url(contact.id), {
                    preserveScroll: true,
                    onSuccess: () => {
                        onClose();
                        resolve();
                    },
                    onError: () => reject(new Error("Unable to delete contact")),
                });
            }),
            {
                loading: "Deleting contact...",
                success: "Contact deleted",
                error: "Unable to delete contact",
            }
        );
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && handleClose()}>
            <DialogContent
                showCloseButton={false}
                className="flex max-h-[min(92vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl"
            >
                <DialogHeader className="sr-only">
                    <DialogTitle>Contact details</DialogTitle>
                    <DialogDescription>View and edit contact profile.</DialogDescription>
                </DialogHeader>

                {contact ? (
                    <div className="grid min-h-0 flex-1 grid-rows-[auto_auto_minmax(0,1fr)_auto] overflow-hidden">
                        <div className="space-y-4 border-b border-border px-6 py-5">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
                                        {watchedName?.trim() ||
                                            contact.display_name ||
                                            "Contact"}
                                    </h2>
                                    <p className="mt-0.5 font-mono text-xs text-muted-foreground">
                                        {contact.uuid
                                            ? `CT-${String(contact.uuid)
                                                  .slice(0, 8)
                                                  .toUpperCase()}`
                                            : `CT-${contact.id}`}
                                    </p>
                                </div>
                                <IconButton
                                    type="button"
                                    size="sm"
                                    className="rounded-lg"
                                    icon="close-line"
                                    aria-label="Close"
                                    onClick={handleClose}
                                />
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <span className="inline-flex items-center rounded-full bg-sky-500/15 px-2.5 py-0.5 text-xs font-medium text-sky-700 dark:text-sky-300">
                                    {titleCaseLabel(watchedType)}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                                    {titleCaseLabel(watchedTag)}
                                </span>
                                <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                                    {contact.leads_count ?? 0} leads
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                <ActionIcon
                                    href={call}
                                    icon="phone-line"
                                    label="Call"
                                    disabled={!call}
                                />
                                <ActionIcon
                                    href={wa}
                                    icon="whatsapp-line"
                                    label="WhatsApp"
                                    disabled={!wa}
                                />
                                <ActionIcon
                                    href={mail}
                                    icon="mail-line"
                                    label="Email"
                                    disabled={!mail}
                                />
                                <DropdownMenu>
                                    <DropdownMenuTrigger
                                        render={
                                            <button
                                                type="button"
                                                className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-foreground"
                                                aria-label="More actions"
                                            >
                                                <Icon
                                                    name="more-2-fill"
                                                    className="text-lg"
                                                />
                                            </button>
                                        }
                                    />
                                    <DropdownMenuContent align="start" className="min-w-40">
                                        <DropdownMenuItem
                                            variant="destructive"
                                            className="gap-2"
                                            onClick={handleDelete}
                                        >
                                            <Icon
                                                name="delete-bin-line"
                                                className="text-base"
                                            />
                                            Delete contact
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                        </div>

                        <div className="border-b border-border px-6">
                            <div className="flex gap-5">
                                {TABS.map((item) => {
                                    const active = tab === item.id;

                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setTab(item.id)}
                                            className={cn(
                                                "-mb-px border-b-2 px-0.5 py-2.5 text-sm font-medium transition-colors",
                                                active
                                                    ? "border-primary text-primary"
                                                    : "border-transparent text-muted-foreground hover:text-foreground"
                                            )}
                                        >
                                            {item.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div className="min-h-0 overflow-y-auto">
                            <div className="px-6 py-5">
                                {tab === "details" ? (
                                    <form
                                        id="contact-edit-form"
                                        className="space-y-5"
                                        onSubmit={handleSubmit(onSubmit)}
                                    >
                                        <h3 className="text-base font-semibold tracking-tight text-foreground">
                                            Profile
                                        </h3>

                                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                            <Input
                                                label="Name"
                                                required
                                                error={
                                                    fieldError("contact_name") ||
                                                    fieldError("first_name")
                                                }
                                                {...register("contact_name", {
                                                    required: "Name is required.",
                                                })}
                                            />
                                            <Input
                                                label="Company"
                                                error={fieldError("reference")}
                                                {...register("reference")}
                                            />
                                            <Input
                                                label="Phone"
                                                required
                                                error={fieldError("phone_number")}
                                                {...register("phone_number")}
                                            />
                                            <Input
                                                label="Email"
                                                required
                                                type="email"
                                                error={fieldError("email_address")}
                                                {...register("email_address")}
                                            />
                                            <Input
                                                label="Alt phone"
                                                error={fieldError("phone_number_alt")}
                                                {...register("phone_number_alt")}
                                            />
                                            <Controller
                                                name="type"
                                                control={control}
                                                render={({ field }) => (
                                                    <SelectBox
                                                        label="Type"
                                                        options={typeOptions}
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        error={fieldError("type")}
                                                    />
                                                )}
                                            />
                                            <Controller
                                                name="tag"
                                                control={control}
                                                render={({ field }) => (
                                                    <SelectBox
                                                        label="Tag"
                                                        options={tagOptions}
                                                        value={field.value}
                                                        onValueChange={field.onChange}
                                                        error={fieldError("tag")}
                                                    />
                                                )}
                                            />
                                            <Input
                                                label="Contact preference"
                                                error={fieldError("contact_preference")}
                                                {...register("contact_preference")}
                                            />
                                        </div>

                                        <div className="space-y-4 border-t border-border pt-5">
                                            <h3 className="text-base font-semibold tracking-tight text-foreground">
                                                Demographics
                                            </h3>

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <Input
                                                    label="City"
                                                    error={fieldError("city")}
                                                    {...register("city")}
                                                />
                                                <Input
                                                    label="Country"
                                                    error={fieldError("country")}
                                                    {...register("country")}
                                                />
                                            </div>

                                            <Input
                                                label="Address"
                                                error={fieldError("address")}
                                                {...register("address")}
                                            />

                                            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                                <Input
                                                    label="CNIC"
                                                    error={fieldError("cnic")}
                                                    {...register("cnic")}
                                                />
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
                                                rows={4}
                                                placeholder="Notes about this contact..."
                                                aria-invalid={
                                                    Boolean(fieldError("goal")) ||
                                                    undefined
                                                }
                                                {...register("goal")}
                                            />
                                            {fieldError("goal") ? (
                                                <p className="text-sm text-destructive">
                                                    {fieldError("goal")}
                                                </p>
                                            ) : null}
                                        </div>
                                    </form>
                                ) : null}

                                {tab === "activity" ? (
                                    <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                        Activity timeline coming soon
                                    </div>
                                ) : null}

                                {tab === "tasks" ? (
                                    <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                        No tasks yet
                                    </div>
                                ) : null}

                                {tab === "notes" ? (
                                    <div className="flex min-h-40 items-center justify-center rounded-md border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">
                                        Notes coming soon
                                    </div>
                                ) : null}
                            </div>
                        </div>

                        <div className="flex justify-end gap-2 border-t border-border bg-popover px-6 py-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleClose}
                            >
                                Cancel
                            </Button>
                            {tab === "details" ? (
                                <Button
                                    type="submit"
                                    form="contact-edit-form"
                                    loading={processing}
                                    disabled={!isDirty}
                                >
                                    Save changes
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
