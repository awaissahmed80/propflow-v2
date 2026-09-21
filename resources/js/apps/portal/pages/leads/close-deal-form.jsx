import { useEffect, useMemo, useState } from "react";
import { router, usePage } from "@inertiajs/react";
import { toast } from "sonner";
import { convert } from "@/actions/App/Http/Controllers/Portal/LeadController";
import { show as showOrder } from "@/actions/App/Http/Controllers/Portal/OrderController";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { SelectBox } from "@/components/ui/select";

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

function monthFromNow() {
    const date = new Date();
    date.setMonth(date.getMonth() + 1);
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${date.getFullYear()}-${month}-${day}`;
}

function unitLabel(unit) {
    return unit.code || unit.name || `Unit #${unit.id}`;
}

export default function CloseDealForm({ lead, projects = [], units = [], onLost }) {
    const { errors = {} } = usePage().props;
    const [processing, setProcessing] = useState(false);
    const [projectId, setProjectId] = useState(lead?.project_id ? String(lead.project_id) : "");
    const [unitId, setUnitId] = useState(lead?.unit_id ? String(lead.unit_id) : "");
    const [bookingKind, setBookingKind] = useState("token");
    const [agreedPrice, setAgreedPrice] = useState(
        lead?.unit?.price != null ? String(lead.unit.price) : lead?.budget != null ? String(lead.budget) : "",
    );
    const [tokenAmount, setTokenAmount] = useState("");
    const [installmentCount, setInstallmentCount] = useState("12");
    const [firstDueOn, setFirstDueOn] = useState(monthFromNow);

    useEffect(() => {
        setProjectId(lead?.project_id ? String(lead.project_id) : "");
        setUnitId(lead?.unit_id ? String(lead.unit_id) : "");
        setAgreedPrice(
            lead?.unit?.price != null ? String(lead.unit.price) : lead?.budget != null ? String(lead.budget) : "",
        );
    }, [lead?.id, lead?.project_id, lead?.unit_id, lead?.unit?.price, lead?.budget]);

    const projectOptions = useMemo(
        () =>
            projects.map((project) => ({
                value: String(project.id),
                label: project.title,
            })),
        [projects],
    );

    const unitOptions = useMemo(() => {
        return units
            .filter((unit) => {
                const bookable = unit.status === "AVAILABLE" || unit.status === "HOLD";

                if (!bookable) {
                    return false;
                }

                if (projectId && String(unit.project_id) !== projectId) {
                    return false;
                }

                return true;
            })
            .map((unit) => ({
                value: String(unit.id),
                label: unit.price != null ? `${unitLabel(unit)} · ${unit.price}` : unitLabel(unit),
            }));
    }, [units, projectId]);

    if (lead?.active_order) {
        return (
            <div className="space-y-3 rounded-md border border-border bg-muted/20 px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                    This lead is booked on order {lead.active_order.code}.
                </p>
                <Button
                    type="button"
                    onClick={() => router.visit(pathFrom(showOrder.url(lead.active_order.code)))}
                >
                    Open order
                </Button>
            </div>
        );
    }

    const submit = (event) => {
        event.preventDefault();
        setProcessing(true);

        router.post(
            pathFrom(convert.url(lead.code)),
            {
                unit_id: unitId ? Number(unitId) : null,
                booking_kind: bookingKind,
                agreed_price: agreedPrice === "" ? null : Number(agreedPrice),
                token_amount: bookingKind === "token" && tokenAmount !== "" ? Number(tokenAmount) : null,
                installment_count: installmentCount === "" ? null : Number(installmentCount),
                first_due_on: firstDueOn,
            },
            {
                preserveScroll: true,
                onError: (formErrors) => {
                    toast.error(Object.values(formErrors)[0] || "Unable to book this lead");
                },
                onFinish: () => setProcessing(false),
            },
        );
    };

    return (
        <form className="space-y-4" onSubmit={submit}>
            <p className="text-sm text-muted-foreground">
                Book a unit for {lead?.contact?.display_name || "this contact"}. Close as lost does not create an order.
            </p>
            <SelectBox
                label="Project"
                clearable
                value={projectId}
                options={projectOptions}
                placeholder="Any project"
                onValueChange={(value) => {
                    setProjectId(value || "");
                    setUnitId("");
                }}
            />
            <SelectBox
                label="Unit"
                required
                value={unitId}
                options={unitOptions}
                placeholder="Choose a unit"
                error={errors.unit_id}
                onValueChange={(value) => {
                    const next = value || "";
                    setUnitId(next);
                    const unit = units.find((item) => String(item.id) === next);

                    if (unit?.price != null) {
                        setAgreedPrice(String(unit.price));
                    }

                    if (unit?.project_id) {
                        setProjectId(String(unit.project_id));
                    }
                }}
            />
            <SelectBox
                label="Booking"
                value={bookingKind}
                options={[
                    { value: "token", label: "Token" },
                    { value: "reserve", label: "Reserve" },
                ]}
                error={errors.booking_kind}
                onValueChange={(value) => setBookingKind(value || "token")}
            />
            <Input
                label="Agreed price"
                required
                type="number"
                min="0"
                step="0.01"
                value={agreedPrice}
                error={errors.agreed_price}
                onChange={(event) => setAgreedPrice(event.target.value)}
            />
            {bookingKind === "token" ? (
                <Input
                    label="Token amount"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={tokenAmount}
                    error={errors.token_amount}
                    onChange={(event) => setTokenAmount(event.target.value)}
                />
            ) : null}
            <Input
                label="Installments"
                required
                type="number"
                min="1"
                max="60"
                value={installmentCount}
                error={errors.installment_count}
                onChange={(event) => setInstallmentCount(event.target.value)}
            />
            <DatePicker
                label="First due date"
                required
                value={firstDueOn}
                error={errors.first_due_on}
                onChange={setFirstDueOn}
            />
            {errors.lead ? <p className="text-xs text-destructive">{errors.lead}</p> : null}
            <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={processing || !unitId}>
                    Close as won
                </Button>
                <Button type="button" variant="outline" disabled={processing} onClick={onLost}>
                    Close as lost
                </Button>
            </div>
        </form>
    );
}
