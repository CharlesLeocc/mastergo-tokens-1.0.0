import {
    StyleCategory,
    Token,
    TokenExportData,
    TokenGroup,
} from "../typings/tokenCommonFields";
import { splitTokenTheme } from "@lib/helper";

export type TokensGroupedByType = {
    colors: Array<PaintStyle | TeamLibraryStyle>;
    typography: Array<TextStyle | TeamLibraryStyle>;
    effects: Array<EffectStyle | TeamLibraryStyle>;
};

export type TokenCatalog = {
    exportData: TokenExportData;
    styleIndex: Map<string, Token>;
};

const STYLE_CATEGORIES: StyleCategory[] = ["colors", "typography", "effects"];

function createEmptyTokenGroup(): TokenGroup {
    return {
        colors: {},
        typography: {},
        effects: {},
    };
}

export function makeStyleIndexKey(
    category: StyleCategory,
    name: string,
): string {
    return `${category}:${name}`;
}

function addTokenToGroup(
    group: TokenGroup,
    category: StyleCategory,
    tokenName: string,
    token: Token,
): void {
    if (category === "colors") {
        if (!group.colors[tokenName]) {
            group.colors[tokenName] = token;
        }
        return;
    }
    if (category === "typography") {
        if (!group.typography[tokenName]) {
            group.typography[tokenName] = token;
        }
        return;
    }
    if (!group.effects[tokenName]) {
        group.effects[tokenName] = token;
    }
}

export function buildTokenCatalog(
    groupedTokens: TokensGroupedByType,
): TokenCatalog {
    const exportData: TokenExportData = {
        schemaVersion: 1,
        themes: {},
        ungrouped: createEmptyTokenGroup(),
    };
    const styleIndex = new Map<string, Token>();

    for (const category of STYLE_CATEGORIES) {
        for (const token of groupedTokens[category]) {
            const indexKey = makeStyleIndexKey(category, token.name);
            // 输入顺序约定为本地在前、团队库在后，因此同名时保留本地样式。
            if (!styleIndex.has(indexKey)) {
                styleIndex.set(indexKey, token);
            }

            const tokenPath = splitTokenTheme(token.name);
            if (!tokenPath.themeName) {
                addTokenToGroup(
                    exportData.ungrouped,
                    category,
                    tokenPath.tokenName,
                    token,
                );
                continue;
            }

            const themeGroup =
                exportData.themes[tokenPath.themeName] ??
                (exportData.themes[tokenPath.themeName] =
                    createEmptyTokenGroup());
            addTokenToGroup(themeGroup, category, tokenPath.tokenName, token);
        }
    }

    return { exportData, styleIndex };
}
