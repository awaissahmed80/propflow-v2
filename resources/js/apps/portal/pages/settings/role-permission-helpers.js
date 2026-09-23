/**
 * Flatten catalog permissions from grouped form props.
 *
 * @param {Array<{ permissions?: Array<Record<string, unknown>> }>} permissionGroups
 * @returns {Array<Record<string, unknown>>}
 */
export function flattenPermissionCatalog(permissionGroups = []) {
    return permissionGroups.flatMap((group) => group.permissions ?? []);
}

/**
 * Names that should be hidden because a selected permission lists them in `disables`.
 *
 * @param {string[]} selection
 * @param {Array<{ permissions?: Array<{ name: string, disables?: string[] }> }>} permissionGroups
 * @returns {Set<string>}
 */
export function hiddenPermissionNames(selection = [], permissionGroups = []) {
    const byName = Object.fromEntries(
        flattenPermissionCatalog(permissionGroups).map((permission) => [permission.name, permission])
    );
    const hidden = new Set();

    for (const name of selection) {
        const permission = byName[name];

        if (!permission?.disables?.length) {
            continue;
        }

        for (const relatedName of permission.disables) {
            hidden.add(relatedName);
        }
    }

    return hidden;
}

/**
 * Drop any selected names that are currently hidden by a master/`disables` rule.
 *
 * @param {string[]} selection
 * @param {Array} permissionGroups
 * @returns {string[]}
 */
export function pruneHiddenPermissions(selection = [], permissionGroups = []) {
    const hidden = hiddenPermissionNames(selection, permissionGroups);

    if (hidden.size === 0) {
        return selection;
    }

    return selection.filter((name) => !hidden.has(name));
}

/**
 * Visible permissions for a group after applying hidden/`disables` rules.
 *
 * @param {{ permissions?: Array<{ name: string }> }} group
 * @param {Set<string>} hiddenNames
 * @returns {Array<{ name: string, master?: boolean }>}
 */
export function visibleGroupPermissions(group, hiddenNames = new Set()) {
    return (group?.permissions ?? []).filter((permission) => !hiddenNames.has(permission.name));
}

/**
 * Compact accordion header summary for a permission group.
 *
 * @param {{ permissions?: Array<{ name: string, master?: boolean }> }} group
 * @param {string[]} selection
 * @param {Set<string>} hiddenNames
 * @returns {string}
 */
export function permissionGroupSummary(group, selection = [], hiddenNames = new Set()) {
    const visible = visibleGroupPermissions(group, hiddenNames);
    const selected = visible.filter((permission) => selection.includes(permission.name));

    if (selected.some((permission) => permission.master)) {
        return "Full access";
    }

    if (selected.length === 0) {
        return "None selected";
    }

    return `${selected.length} selected`;
}

/**
 * Accordion values to open initially — first group with a selection, else the first visible group.
 *
 * @param {Array<{ group: string, permissions?: Array<{ name: string }> }>} permissionGroups
 * @param {string[]} selection
 * @param {Set<string>} hiddenNames
 * @returns {string[]}
 */
export function initialOpenPermissionGroups(permissionGroups = [], selection = [], hiddenNames = new Set()) {
    const firstWithSelection = permissionGroups.find((group) =>
        visibleGroupPermissions(group, hiddenNames).some((permission) =>
            selection.includes(permission.name)
        )
    );

    if (firstWithSelection) {
        return [firstWithSelection.group];
    }

    const firstVisible = permissionGroups.find(
        (group) => visibleGroupPermissions(group, hiddenNames).length > 0
    );

    return firstVisible ? [firstVisible.group] : [];
}

/**
 * Apply a permission toggle, including exclusive sets and `disables` pruning.
 *
 * @param {object} options
 * @param {string[]} options.selection
 * @param {string} options.permissionName
 * @param {boolean} options.checked
 * @param {string} [options.groupType]
 * @param {number} [options.groupIndex]
 * @param {Array} options.permissionGroups
 * @returns {string[]}
 */
export function nextPermissionSelection({
    selection,
    permissionName,
    checked,
    groupType = "checkbox",
    groupIndex = 0,
    permissionGroups = [],
}) {
    const catalog = flattenPermissionCatalog(permissionGroups);
    const byName = Object.fromEntries(catalog.map((permission) => [permission.name, permission]));
    const permission = byName[permissionName];
    let nextSelection = [...selection];

    if (!checked) {
        nextSelection = nextSelection.filter((name) => name !== permissionName);
    } else {
        if (permission?.exclusive_set) {
            const exclusiveNames = catalog
                .filter((item) => item.exclusive_set === permission.exclusive_set)
                .map((item) => item.name);

            nextSelection = nextSelection.filter((name) => !exclusiveNames.includes(name));
        } else if (groupType === "radio") {
            const groupPermissionNames =
                permissionGroups[groupIndex]?.permissions?.map((item) => item.name) ?? [];

            nextSelection = nextSelection.filter((name) => !groupPermissionNames.includes(name));
        }

        if (!nextSelection.includes(permissionName)) {
            nextSelection.push(permissionName);
        }

        if (permission?.disables?.length) {
            nextSelection = nextSelection.filter((name) => !permission.disables.includes(name));
        }
    }

    return pruneHiddenPermissions(nextSelection, permissionGroups);
}
