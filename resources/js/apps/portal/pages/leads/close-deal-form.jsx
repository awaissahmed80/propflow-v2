import { useEffect, useMemo, useState } from "react";
import { router, useForm } from "@inertiajs/react";
import { toast } from "sonner";
import {
    convert,
    lose,
    win,
} from "@/actions/App/Http/Controllers/Portal/LeadController";
import { show as showOrder } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Icon } from "@/components/ui/icon";
import { Label } from "@/components/ui/label";
import { NumberInput } from "@/components/ui/number-input";
import { SelectBox } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatMoney } from "@/lib/currency";
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

function todayIso() {
    const date = new Date();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
}

function monthFromNow() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
}

function unitLabel(unit) {
    return unit.name || "Unit";
}

function firstError(errors) {
    const value = Object.values(errors || {})[0];

    return typeof value === "string" ? value : null;
}

/**
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.description
 * @param {string} props.icon
 * @param {boolean} props.selected
 * @param {() => void} props.onSelect
 * @param {"won" | "lost"} props.tone
 */
function OutcomeCard({ title, description, icon, selected, onSelect, tone }) {
    return (
        <button
            type="button"
            onClick={onSelect}
            className={cn(
                "flex min-w-0 flex-1 flex-col items-start gap-3 rounded-md border px-4 py-4 text-left transition-colors",
                "hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
                selected
                    ? tone === "won"
                        ? "border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30"
                        : "border-rose-500/50 bg-rose-500/10 ring-1 ring-rose-500/30"
                    : "border-border bg-card"
            )}
        >
            <span
                className={cn(
                    "inline-flex size-9 items-center justify-center rounded-md",
                    tone === "won"
                        ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                        : "bg-rose-500/15 text-rose-700 dark:text-rose-300"
                )}
            >
                <Icon name={icon} className="text-lg" />
            </span>
            <div className="min-w-0 space-y-1">
                <div className="text-sm font-semibold text-foreground">{title}</div>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </button>
    );
}

function LockedDealSummary({ lead }) {
    const order = lead.active_order;

    return (
        <div className="space-y-4 rounded-md border border-border bg-muted/20 px-4 py-5">
            <div>
                <p className="text-sm font-medium text-foreground">
                    Deal closed — booking in progress
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                    Sales fields are read-only while this booking is active. Cancel the
                    booking to unlock this lead.
                </p>
            </div>
            <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                    <dt className="text-xs text-muted-foreground">Buyer</dt>
                    <dd className="text-sm font-medium">
                        {lead?.contact?.display_name || "—"}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-muted-foreground">Booking kind</dt>
                    <dd className="text-sm font-medium capitalize">
                        {order?.booking_kind || "—"}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-muted-foreground">Sale / agreed price</dt>
                    <dd className="text-sm font-semibold tabular-nums">
                        {order?.agreed_price != null
                            ? formatMoney(order.agreed_price)
                            : "—"}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs text-muted-foreground">Status</dt>
                    <dd className="text-sm font-medium capitalize">
                        {order?.status || "booked"}
                    </dd>
                </div>
            </dl>
            {order?.code ? (
                <Button
                    type="button"
                    onClick={() => router.visit(pathFrom(showOrder.url(order.code)))}
                >
                    Open booking
                </Button>
            ) : null}
        </div>
    );
}

/**
 * @param {object} props
 * @param {object} props.lead
 * @param {Array} [props.projects]
 * @param {Array} [props.units]
 * @param {"won" | "lost" | null} [props.initialPath]
 */
export default function CloseDealForm({
    lead,
    projects = [],
    units = [],
    initialPath = null,
}) {
    const alreadyWon =
        lead?.stage?.label === "closed_won" &&
        !lead?.active_order &&
        !lead?.deal_locked;

    const resolvePath = () => {
        if (initialPath === "won" || initialPath === "lost") {
            return initialPath;
        }

        return alreadyWon ? "won" : null;
    };

    const [path, setPath] = useState(resolvePath);

    const loseForm = useForm({
        reason: "",
    });

    const wonForm = useForm({
        project_id: lead?.project_id ? String(lead.project_id) : "",
        unit_id: "",
        booking_kind: "token",
        agreed_price:
            lead?.unit?.price != null
                ? String(lead.unit.price)
                : lead?.budget != null
                  ? String(lead.budget)
                  : "",
        token_amount: "",
        payment_mode: "installments",
        installment_count: "12",
        first_due_on: monthFromNow(),
    });

    const [winning, setWinning] = useState(false);
    const [winReason, setWinReason] = useState("");

    useEffect(() => {
        setPath(resolvePath());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lead?.id, alreadyWon, initialPath]);

    useEffect(() => {
        wonForm.setData({
            ...wonForm.data,
            project_id: lead?.project_id ? String(lead.project_id) : "",
            // Keep unit unset until the user picks one — Mark as won must stay available.
            unit_id: "",
            agreed_price:
                lead?.unit?.price != null
                    ? String(lead.unit.price)
                    : lead?.budget != null
                      ? String(lead.budget)
                      : "",
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when switching leads
    }, [lead?.id, lead?.project_id, lead?.unit?.price, lead?.budget]);

    const projectOptions = useMemo(
        () =>
            projects.map((project) => ({
                value: String(project.id),
                label: project.title,
                image: project.thumbnail || undefined,
                icon: project.thumbnail ? undefined : "community-line",
            })),
        [projects]
    );

    const unitOptions = useMemo(() => {
        return units
            .filter((unit) => {
                const bookable = unit.status === "AVAILABLE" || unit.status === "HOLD";

                if (!bookable) {
                    return false;
                }

                if (
                    wonForm.data.project_id &&
                    String(unit.project_id) !== wonForm.data.project_id
                ) {
                    return false;
                }

                return true;
            })
            .map((unit) => ({
                value: String(unit.id),
                label:
                    unit.price != null
                        ? `${unitLabel(unit)} · ${formatMoney(unit.price)}`
                        : unitLabel(unit),
            }));
    }, [units, wonForm.data.project_id]);

    if (lead?.active_order || lead?.deal_locked) {
        return <LockedDealSummary lead={lead} />;
    }

    const hasUnit = Boolean(wonForm.data.unit_id);
    const contactName = lead?.contact?.display_name || "this contact";

    const submitLose = (event) => {
        event.preventDefault();

        loseForm.post(pathFrom(lose.url(lead.code)), {
            preserveScroll: true,
            onSuccess: () => toast.success("Lead marked as lost"),
            onError: (errors) =>
                toast.error(firstError(errors) || "Unable to mark lead as lost"),
        });
    };

    const submitWinOnly = (event) => {
        event?.preventDefault?.();

        const reason = winReason.trim();

        if (!reason || winning) {
            return;
        }

        setWinning(true);

        router.post(
            pathFrom(win.url(lead.code)),
            { reason },
            {
                preserveScroll: true,
                onSuccess: () => toast.success("Lead marked as won"),
                onError: (errors) =>
                    toast.error(
                        firstError(errors) || "Unable to mark lead as won"
                    ),
                onFinish: () => setWinning(false),
            }
        );
    };

    const submitBooking = (event) => {
        event.preventDefault();

        const paymentMode = wonForm.data.payment_mode || "installments";
        const payload = {
            unit_id: Number(wonForm.data.unit_id),
            booking_kind: wonForm.data.booking_kind || "token",
            agreed_price:
                wonForm.data.agreed_price === ""
                    ? null
                    : Number(wonForm.data.agreed_price),
            token_amount:
                wonForm.data.booking_kind === "token" &&
                wonForm.data.token_amount !== ""
                    ? Number(wonForm.data.token_amount)
                    : null,
            payment_mode: paymentMode,
            installment_count:
                paymentMode === "one_payment"
                    ? 1
                    : wonForm.data.installment_count === ""
                      ? null
                      : Number(wonForm.data.installment_count),
            first_due_on:
                paymentMode === "one_payment"
                    ? wonForm.data.first_due_on || todayIso()
                    : wonForm.data.first_due_on || null,
        };

        wonForm.transform(() => payload);
        wonForm.post(pathFrom(convert.url(lead.code)), {
            preserveScroll: true,
            onError: (errors) =>
                toast.error(firstError(errors) || "Unable to book this lead"),
            onFinish: () => wonForm.transform((data) => data),
        });
    };

    if (!path) {
        return (
            <div className="space-y-4">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        Close this deal
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Choose how to close the opportunity for {contactName}.
                    </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                    <OutcomeCard
                        tone="won"
                        title="Won"
                        description="Move toward booking. You can attach a unit now or later."
                        icon="trophy-line"
                        selected={false}
                        onSelect={() => setPath("won")}
                    />
                    <OutcomeCard
                        tone="lost"
                        title="Lost"
                        description="Client is not proceeding. Capture a short reason for the log."
                        icon="close-circle-line"
                        selected={false}
                        onSelect={() => setPath("lost")}
                    />
                </div>
            </div>
        );
    }

    if (path === "lost") {
        return (
            <form
                className="space-y-5 rounded-md border border-border bg-card px-4 py-5"
                onSubmit={submitLose}
            >
                <div className="flex items-start justify-between gap-3">
                    <div>
                        <h3 className="text-base font-semibold text-foreground">
                            Close as lost
                        </h3>
                        <p className="mt-1 text-sm text-muted-foreground">
                            The reason is saved on the lead activity log.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            loseForm.reset();
                            setPath(null);
                        }}
                    >
                        Back
                    </Button>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="lost-reason">Reason</Label>
                    <Textarea
                        id="lost-reason"
                        rows={4}
                        placeholder="Budget, timing, chose another project…"
                        value={loseForm.data.reason}
                        onChange={(event) =>
                            loseForm.setData("reason", event.target.value)
                        }
                        aria-invalid={Boolean(loseForm.errors.reason) || undefined}
                    />
                    {loseForm.errors.reason ? (
                        <p className="text-sm text-destructive">
                            {loseForm.errors.reason}
                        </p>
                    ) : null}
                </div>

                {loseForm.errors.lead ? (
                    <p className="text-sm text-destructive">{loseForm.errors.lead}</p>
                ) : null}

                <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                            loseForm.reset();
                            setPath(null);
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        type="submit"
                        variant="destructive"
                        loading={loseForm.processing}
                        disabled={!loseForm.data.reason.trim()}
                    >
                        Confirm lost
                    </Button>
                </div>
            </form>
        );
    }

    return (
        <form
            className="space-y-5 rounded-md border border-border bg-card px-4 py-5"
            onSubmit={hasUnit ? submitBooking : submitWinOnly}
        >
            <div className="flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-base font-semibold text-foreground">
                        {alreadyWon ? "Complete the booking" : "Close as won"}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {hasUnit
                            ? `Create a booking for ${contactName}.`
                            : "Mark as won now, or pick a unit to create the booking."}
                    </p>
                </div>
                {!alreadyWon ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setPath(null)}
                    >
                        Back
                    </Button>
                ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                <SelectBox
                    label="Project"
                    clearable
                    value={wonForm.data.project_id}
                    options={projectOptions}
                    placeholder="Any project"
                    onValueChange={(value) => {
                        wonForm.setData({
                            ...wonForm.data,
                            project_id: value || "",
                            unit_id: "",
                        });
                    }}
                />
                <SelectBox
                    label="Unit"
                    clearable
                    value={wonForm.data.unit_id}
                    options={unitOptions}
                    placeholder="Optional — choose when ready"
                    error={wonForm.errors.unit_id}
                    onValueChange={(value) => {
                        const next = value || "";
                        const unit = units.find((item) => String(item.id) === next);

                        wonForm.setData({
                            ...wonForm.data,
                            unit_id: next,
                            project_id: unit?.project_id
                                ? String(unit.project_id)
                                : wonForm.data.project_id,
                            agreed_price:
                                unit?.price != null
                                    ? String(unit.price)
                                    : wonForm.data.agreed_price,
                        });
                    }}
                />
            </div>

            {!hasUnit ? (
                <div className="space-y-4">
                    <div className="rounded-md border border-dashed border-border bg-muted/20 px-3 py-3 text-sm text-muted-foreground">
                        No unit selected yet — negotiations can continue. You can attach a
                        unit later and create the booking from this tab.
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="won-reason">Note</Label>
                        <Textarea
                            id="won-reason"
                            rows={3}
                            placeholder="Deal terms agreed, awaiting unit selection…"
                            value={winReason}
                            onChange={(event) => setWinReason(event.target.value)}
                        />
                    </div>
                </div>
            ) : (
                <div className="space-y-4 border-t border-border pt-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <SelectBox
                            label="Booking"
                            value={wonForm.data.booking_kind}
                            options={[
                                { value: "token", label: "Token" },
                                { value: "reserve", label: "Reserve" },
                            ]}
                            error={wonForm.errors.booking_kind}
                            onValueChange={(value) =>
                                wonForm.setData("booking_kind", value || "token")
                            }
                        />
                        <NumberInput
                            label="Agreed price"
                            required
                            allowDecimal
                            min={0}
                            step={0.01}
                            value={wonForm.data.agreed_price}
                            error={wonForm.errors.agreed_price}
                            onChange={(value) =>
                                wonForm.setData("agreed_price", value ?? "")
                            }
                        />
                    </div>

                    {wonForm.data.booking_kind === "token" ? (
                        <NumberInput
                            label="Token amount"
                            allowDecimal
                            min={0}
                            step={0.01}
                            placeholder="Optional"
                            value={wonForm.data.token_amount}
                            error={wonForm.errors.token_amount}
                            onChange={(value) =>
                                wonForm.setData("token_amount", value ?? "")
                            }
                        />
                    ) : null}

                    <div className="space-y-2">
                        <Label>Payment schedule</Label>
                        <div className="grid grid-cols-2 gap-2">
                            {[
                                {
                                    value: "one_payment",
                                    label: "One payment",
                                    hint: "Full remaining balance in a single due",
                                },
                                {
                                    value: "installments",
                                    label: "Installments",
                                    hint: "Split the balance over months",
                                },
                            ].map((option) => {
                                const selected =
                                    wonForm.data.payment_mode === option.value;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => {
                                            const nextMode = option.value;

                                            wonForm.setData({
                                                ...wonForm.data,
                                                payment_mode: nextMode,
                                                installment_count:
                                                    nextMode === "one_payment"
                                                        ? "1"
                                                        : wonForm.data
                                                              .installment_count ||
                                                          "12",
                                                first_due_on:
                                                    nextMode === "one_payment"
                                                        ? todayIso()
                                                        : wonForm.data
                                                              .first_due_on ||
                                                          monthFromNow(),
                                            });
                                        }}
                                        className={cn(
                                            "rounded-md border px-3 py-2.5 text-left transition-colors",
                                            selected
                                                ? "border-primary/50 bg-primary/10 ring-1 ring-primary/30"
                                                : "border-border bg-background hover:bg-muted/40"
                                        )}
                                    >
                                        <div className="text-sm font-medium text-foreground">
                                            {option.label}
                                        </div>
                                        <div className="mt-0.5 text-xs text-muted-foreground">
                                            {option.hint}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {wonForm.data.payment_mode === "installments" ? (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <NumberInput
                                label="Installments"
                                min={1}
                                max={60}
                                placeholder="Optional (default 1)"
                                value={wonForm.data.installment_count}
                                error={wonForm.errors.installment_count}
                                onChange={(value) =>
                                    wonForm.setData(
                                        "installment_count",
                                        value ?? ""
                                    )
                                }
                            />
                            <DatePicker
                                label="First due date"
                                value={wonForm.data.first_due_on}
                                error={wonForm.errors.first_due_on}
                                onChange={(value) =>
                                    wonForm.setData("first_due_on", value || "")
                                }
                            />
                        </div>
                    ) : (
                        <DatePicker
                            label="Payment due date"
                            value={wonForm.data.first_due_on}
                            error={wonForm.errors.first_due_on}
                            onChange={(value) =>
                                wonForm.setData("first_due_on", value || "")
                            }
                        />
                    )}
                </div>
            )}

            {wonForm.errors.lead ? (
                <p className="text-sm text-destructive">{wonForm.errors.lead}</p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
                {!alreadyWon ? (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPath(null)}
                    >
                        Cancel
                    </Button>
                ) : null}
                {hasUnit ? (
                    <Button type="submit" loading={wonForm.processing}>
                        Create booking
                    </Button>
                ) : (
                    <Button
                        type="button"
                        loading={winning}
                        disabled={!winReason.trim()}
                        onClick={submitWinOnly}
                    >
                        Mark as won
                    </Button>
                )}
            </div>
        </form>
    );
}
