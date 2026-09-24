/**
 * @param {string | null | undefined} label
 * @returns {"won" | "lost" | null}
 */
export function closeOutcomeFromStageLabel(label) {
    if (label === "closed_won") {
        return "won";
    }

    if (label === "closed_lost") {
        return "lost";
    }

    return null;
}
