export type ExportVariableType =
    | "STRING"
    | "BOOLEAN"
    | "COLOR"
    | "NUMBER"
    | "PAINT"
    | "TEXT"
    | "EFFECT"
    | "GRID"
    | "STROKE_WIDTH"
    | "RADIUS"
    | "CORNER_RADIUS"
    | "PADDING"
    | "SPACING";

export interface VariableModeSnapshot {
    id: string;
    name: string;
}

export interface VariableTokenSnapshot {
    id: string;
    name: string;
    description: string;
    alias: string;
    type: ExportVariableType;
    collectionId: string;
    isExternal: boolean;
    codeSyntax?: {
        web?: string;
        android?: string;
        ios?: string;
    };
    modes: Record<string, ReadonlyArray<unknown>>;
}

export interface VariableCollectionSnapshot {
    id: string;
    name: string;
    isExternal: boolean;
    modes: VariableModeSnapshot[];
    variables: VariableTokenSnapshot[];
}

export interface VariableExportSnapshot {
    schemaVersion: 1;
    collections: VariableCollectionSnapshot[];
}

export interface VariableExportIssue {
    collectionName: string;
    modeName: string;
    variableName: string;
    reason: string;
}

export interface VariableExportStats {
    collections: number;
    modes: number;
    variables: number;
    declarations: number;
    skipped: number;
}

export interface FrontendVariableExport {
    css: string;
    dtcg: Record<string, unknown>;
    stats: VariableExportStats;
    issues: VariableExportIssue[];
}
