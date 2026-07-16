import { VariableExportSnapshot } from "../typings/variableTokens";

export interface VariableThemeCollection {
    collectionId: string;
    collectionName: string;
    modeId: string;
    variableCount: number;
}

export interface VariableThemeOption {
    name: string;
    collections: VariableThemeCollection[];
    variableCount: number;
}

export function buildVariableThemeOptions(
    snapshot: VariableExportSnapshot,
): VariableThemeOption[] {
    const options = new Map<string, VariableThemeOption>();

    for (const collection of snapshot.collections) {
        for (const mode of collection.modes) {
            const variableCount = collection.variables.filter(
                (variable) => (variable.modes[mode.id]?.length ?? 0) > 0,
            ).length;
            const option = options.get(mode.name) ?? {
                name: mode.name,
                collections: [],
                variableCount: 0,
            };
            option.collections.push({
                collectionId: collection.id,
                collectionName: collection.name,
                modeId: mode.id,
                variableCount,
            });
            option.variableCount += variableCount;
            options.set(mode.name, option);
        }
    }

    return [...options.values()];
}
