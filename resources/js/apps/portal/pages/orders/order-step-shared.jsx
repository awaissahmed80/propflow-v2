import { formatMoney } from "@/lib/currency";
import { cn } from "@/lib/utils";

export function ScheduleTable({ rows }) {
    if (rows.length === 0) {
        return <p className="text-sm text-muted-foreground">No schedule yet.</p>;
    }

    return (
        <div className="overflow-hidden rounded-xl border border-border/80 bg-background">
            <table className="w-full text-left text-sm">
                <thead className="border-b border-border/70 bg-muted/30 text-xs text-muted-foreground">
                    <tr>
                        <th className="px-4 py-2.5 font-medium">Item</th>
                        <th className="px-4 py-2.5 font-medium">Due</th>
                        <th className="px-4 py-2.5 font-medium">Amount</th>
                        <th className="px-4 py-2.5 font-medium">Left</th>
                        <th className="px-4 py-2.5 font-medium">Status</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.id} className="border-b border-border/60 last:border-b-0">
                            <td className="px-4 py-3">{row.label}</td>
                            <td className="px-4 py-3 text-muted-foreground">{row.due_on}</td>
                            <td className="px-4 py-3">{formatMoney(row.amount)}</td>
                            <td className="px-4 py-3">{formatMoney(row.remaining)}</td>
                            <td className="px-4 py-3">
                                {row.status === "paid" ? "Paid" : row.overdue ? "Overdue" : "Pending"}
                                {row.late_fee ? <span className="ml-2 text-xs text-muted-foreground">fee {formatMoney(row.late_fee)}</span> : null}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function Stat({ label, value, late = false }) {
    return (
        <div>
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={cn("text-sm font-medium", late && "text-destructive")}>{value}</dd>
        </div>
    );
}
