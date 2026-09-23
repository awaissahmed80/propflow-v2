export function statusTone(status) {
    switch (status) {
        case "active":
            return "bg-sky-500/15 text-sky-600 dark:text-sky-400";
        case "completed":
            return "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400";
        case "on_hold":
            return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
        case "archived":
            return "bg-muted text-muted-foreground";
        default:
            return "bg-primary/10 text-primary";
    }
}

export function typeTone(type) {
    switch (type) {
        case "residential":
            return "bg-amber-700/20 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200";
        case "commercial":
            return "bg-violet-500/15 text-violet-700 dark:text-violet-300";
        case "mixed":
            return "bg-teal-500/15 text-teal-700 dark:text-teal-300";
        default:
            return "bg-muted text-muted-foreground";
    }
}

export function projectLocation(project) {
    return String(project.location || "").trim();
}

export function projectCityCountry(project) {
    return [project.city, project.country].filter(Boolean).join(", ");
}

export function formatArea(value, unit = "Sq. Feet") {
    const area = Number(value) || 0;
    const label = unit || "Sq. Feet";

    return `${area.toLocaleString()} ${label}`;
}

export function phaseStatusTone(status) {
    switch (status) {
        case "completed":
            return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
        case "in_progress":
            return "bg-sky-500/15 text-sky-700 dark:text-sky-400";
        case "delayed":
            return "bg-amber-500/15 text-amber-800 dark:text-amber-400";
        default:
            return "bg-muted text-muted-foreground";
    }
}

export function formatPhaseDate(value) {
    if (!value) {
        return null;
    }

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}

export function phaseDateRange(phase) {
    const start = formatPhaseDate(phase.start_date);
    const end = formatPhaseDate(phase.end_date);

    if (start && end) {
        return `${start} – ${end}`;
    }

    return start || end || null;
}

export { unitStatusTone } from "../../components/unit-card";

