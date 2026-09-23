import { useMemo, useState } from "react";
import { router } from "@inertiajs/react";
import { toast } from "sonner";
import {
    destroy as destroyAccount,
    store as storeAccount,
    update as updateAccount,
} from "@/actions/App/Http/Controllers/Portal/PaymentAccountController";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { SelectBox } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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

const EMPTY_FORM = {
    type: "bank",
    name: "",
    bank_name: "",
    account_title: "",
    account_number: "",
    iban: "",
    swift: "",
    branch: "",
    is_default: false,
    is_enabled: true,
};

function AccountForm({ initial = EMPTY_FORM, onSubmit, onCancel, processing, errors = {} }) {
    const [form, setForm] = useState(initial);
    const isBank = form.type === "bank";

    const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

    return (
        <form
            className="space-y-3 rounded-md border border-border bg-muted/30 p-4"
            onSubmit={(event) => {
                event.preventDefault();
                onSubmit(form);
            }}
        >
            <div className="grid gap-3 sm:grid-cols-2">
                {!initial.id ? (
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Type</label>
                        <SelectBox
                            value={form.type}
                            onChange={(value) => set("type", value)}
                            options={[
                                { value: "bank", label: "Bank" },
                                { value: "cash", label: "Cash" },
                            ]}
                        />
                    </div>
                ) : null}
                <div className="space-y-1.5">
                    <label className="text-sm font-medium">Name</label>
                    <Input
                        value={form.name}
                        onChange={(event) => set("name", event.target.value)}
                        error={errors.name}
                        required
                    />
                </div>
            </div>

            {isBank ? (
                <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Bank name</label>
                        <Input
                            value={form.bank_name}
                            onChange={(event) => set("bank_name", event.target.value)}
                            error={errors.bank_name}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Account title</label>
                        <Input
                            value={form.account_title}
                            onChange={(event) => set("account_title", event.target.value)}
                            error={errors.account_title}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Account number</label>
                        <Input
                            value={form.account_number}
                            onChange={(event) => set("account_number", event.target.value)}
                            error={errors.account_number}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">IBAN</label>
                        <Input
                            value={form.iban}
                            onChange={(event) => set("iban", event.target.value)}
                            error={errors.iban}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">SWIFT</label>
                        <Input
                            value={form.swift}
                            onChange={(event) => set("swift", event.target.value)}
                            error={errors.swift}
                        />
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium">Branch</label>
                        <Input
                            value={form.branch}
                            onChange={(event) => set("branch", event.target.value)}
                            error={errors.branch}
                        />
                    </div>
                </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                    <Switch
                        checked={Boolean(form.is_default)}
                        onCheckedChange={(checked) => set("is_default", checked)}
                    />
                    Default for this type
                </label>
                <label className="flex items-center gap-2 text-sm">
                    <Switch
                        checked={Boolean(form.is_enabled)}
                        onCheckedChange={(checked) => set("is_enabled", checked)}
                    />
                    Enabled
                </label>
            </div>

            <div className="flex gap-2">
                <Button type="submit" disabled={processing} size="sm">
                    {processing ? "Saving…" : initial.id ? "Update account" : "Add account"}
                </Button>
                {onCancel ? (
                    <Button type="button" variant="outline" size="sm" onClick={onCancel}>
                        Cancel
                    </Button>
                ) : null}
            </div>
        </form>
    );
}

export default function BankCashPanel({ paymentAccounts = [] }) {
    const [processing, setProcessing] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [errors, setErrors] = useState({});

    const banks = useMemo(
        () => (paymentAccounts || []).filter((row) => row.type === "bank"),
        [paymentAccounts],
    );
    const cash = useMemo(
        () => (paymentAccounts || []).filter((row) => row.type === "cash"),
        [paymentAccounts],
    );

    const saveCreate = (form) => {
        setProcessing(true);
        setErrors({});
        router.post(pathFrom(storeAccount.url()), form, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Account added");
                setCreating(false);
            },
            onError: (submitErrors) => {
                setErrors(submitErrors);
                toast.error(Object.values(submitErrors)[0] || "Unable to save");
            },
            onFinish: () => setProcessing(false),
        });
    };

    const saveUpdate = (account, form) => {
        setProcessing(true);
        setErrors({});
        router.put(pathFrom(updateAccount.url(account.id)), form, {
            preserveScroll: true,
            onSuccess: () => {
                toast.success("Account updated");
                setEditingId(null);
            },
            onError: (submitErrors) => {
                setErrors(submitErrors);
                toast.error(Object.values(submitErrors)[0] || "Unable to update");
            },
            onFinish: () => setProcessing(false),
        });
    };

    const remove = (account) => {
        setProcessing(true);
        router.delete(pathFrom(destroyAccount.url(account.id)), {
            preserveScroll: true,
            onSuccess: () => toast.success("Account removed"),
            onError: (submitErrors) =>
                toast.error(submitErrors.account || Object.values(submitErrors)[0] || "Unable to delete"),
            onFinish: () => setProcessing(false),
        });
    };

    const renderGroup = (title, rows) => (
        <div className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">{title}</h3>
            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">No accounts yet.</p>
            ) : (
                rows.map((account) => (
                    <div
                        key={account.id}
                        className={cn(
                            "rounded-md border border-border bg-card p-4",
                            account.is_default && "ring-1 ring-primary/30",
                        )}
                    >
                        {editingId === account.id ? (
                            <AccountForm
                                initial={account}
                                processing={processing}
                                errors={errors}
                                onCancel={() => setEditingId(null)}
                                onSubmit={(form) => saveUpdate(account, form)}
                            />
                        ) : (
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <p className="font-medium text-foreground">{account.name}</p>
                                        {account.is_default ? (
                                            <span className="text-[11px] font-medium uppercase tracking-wide text-primary">
                                                Default
                                            </span>
                                        ) : null}
                                        {!account.is_enabled ? (
                                            <span className="text-[11px] text-muted-foreground">Disabled</span>
                                        ) : null}
                                    </div>
                                    {account.type === "bank" ? (
                                        <p className="text-sm text-muted-foreground">
                                            {[account.bank_name, account.account_title, account.account_number]
                                                .filter(Boolean)
                                                .join(" · ") || "No remittance details yet"}
                                        </p>
                                    ) : (
                                        <p className="text-sm text-muted-foreground">Cash account</p>
                                    )}
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={processing}
                                        onClick={() => setEditingId(account.id)}
                                    >
                                        Edit
                                    </Button>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={processing}
                                        onClick={() => remove(account)}
                                    >
                                        Delete
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="text-base font-semibold text-foreground">Bank & Cash</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Remittance accounts for payment request vouchers. Each tenant starts with a
                        default bank and cash account.
                    </p>
                </div>
                <Button
                    type="button"
                    size="sm"
                    disabled={processing || creating}
                    onClick={() => {
                        setCreating(true);
                        setEditingId(null);
                    }}
                >
                    <Icon name="add-line" className="size-4" />
                    Add account
                </Button>
            </div>

            {creating ? (
                <AccountForm
                    processing={processing}
                    errors={errors}
                    onCancel={() => setCreating(false)}
                    onSubmit={saveCreate}
                />
            ) : null}

            {renderGroup("Bank accounts", banks)}
            {renderGroup("Cash accounts", cash)}
        </div>
    );
}
