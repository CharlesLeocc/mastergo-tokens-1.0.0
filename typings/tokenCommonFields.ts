export type Token = TextStyle | PaintStyle | EffectStyle | TeamLibraryStyle;

export type StyleCategory = "colors" | "typography" | "effects";

export type TokenGroup = {
    colors: Record<string, Token>;
    typography: Record<string, Token>;
    effects: Record<string, Token>;
};

export interface TokenExportData {
    schemaVersion: 1;
    themes: Record<string, TokenGroup>;
    ungrouped: TokenGroup;
}

export interface ThemeApplyData {
    newTheme: string;
    applyScope: ThemeApplyScope;
}

export interface ThemeApplyIssue {
    nodeId: string;
    category: StyleCategory | "variables";
    styleName?: string;
    level: "skipped" | "failed";
    reason: string;
}

export interface ThemeApplyResult {
    scannedNodes: number;
    updatedProperties: number;
    skippedProperties: number;
    failedProperties: number;
    issues: ThemeApplyIssue[];
}

export enum ThemeApplyScope {
    page = "页面",
    // document = "文档",
    selection = "当前选择",
}

export enum LocalStorageKeys {
    themes = "themes",
    applyScope = "applyScope",
}
