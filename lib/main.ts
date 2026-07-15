import {
    MessageRequest,
    sendErrorToUI,
    sendSuccessToUI,
    UIMessage,
    isMessageRequest,
} from "@messages/sender";
import {
    LocalStorageKeys,
    StyleCategory,
    ThemeApplyData,
    ThemeApplyIssue,
    ThemeApplyResult,
    ThemeApplyScope,
    Token,
} from "../typings/tokenCommonFields";
import {
    collectSceneNodes,
    convertTokenNameToTheme,
    mapWithConcurrency,
} from "@lib/helper";
import {
    buildTokenCatalog,
    makeStyleIndexKey,
    TokenCatalog,
    TokensGroupedByType,
} from "@lib/tokenCatalog";

mg.showUI(__html__);

type StyledSceneNode = SceneNode & {
    fillStyleId?: string;
    strokeStyleId?: string;
    effectStyleId?: string;
};

type StyleReference = {
    nodeId: string;
    category: StyleCategory;
    oldStyleId: string;
    apply: (newStyleId: string) => void;
};

type StyleResolution =
    | { status: "resolved"; newStyleId: string; styleName: string }
    | {
          status: "skipped" | "failed";
          styleName?: string;
          reason: string;
      };

function serializeStyle<T extends Token>(style: T): T {
    return JSON.parse(JSON.stringify(style)) as T;
}

async function getTokensGroupedByType(): Promise<TokensGroupedByType> {
    const localTokens: TokensGroupedByType = {
        colors: mg.getLocalPaintStyles(),
        typography: mg.getLocalTextStyles(),
        effects: mg.getLocalEffectStyles(),
    };
    const teamLibrary = await mg.getTeamLibraryAsync();

    const teamTokens: TokensGroupedByType = {
        colors: [],
        typography: [],
        effects: [],
    };
    for (const { style } of teamLibrary) {
        teamTokens.colors.push(...style.paints);
        teamTokens.typography.push(...style.texts);
        teamTokens.effects.push(...style.effects);
    }

    return {
        // 本地样式优先，遇到团队库同类型同名样式时保持本地映射。
        colors: [...localTokens.colors, ...teamTokens.colors].map(
            serializeStyle,
        ),
        typography: [...localTokens.typography, ...teamTokens.typography].map(
            serializeStyle,
        ),
        effects: [...localTokens.effects, ...teamTokens.effects].map(
            serializeStyle,
        ),
    };
}

async function getTokenCatalog(): Promise<TokenCatalog> {
    return buildTokenCatalog(await getTokensGroupedByType());
}

function collectStyleReferences(
    nodes: SceneNode[],
    result: ThemeApplyResult,
): StyleReference[] {
    const references: StyleReference[] = [];

    for (const node of nodes) {
        if (node.type === "TEXT") {
            if (node.textStyles.length > 1) {
                result.skippedProperties++;
                result.issues.push({
                    nodeId: node.id,
                    category: "typography",
                    level: "skipped",
                    reason: "节点包含多种文本样式，已保持原样",
                });
            } else {
                const textStyleId = node.textStyles[0]?.textStyleId;
                if (typeof textStyleId === "string" && textStyleId) {
                    references.push({
                        nodeId: node.id,
                        category: "typography",
                        oldStyleId: textStyleId,
                        apply: (newStyleId) => {
                            node.setRangeTextStyleId(
                                0,
                                node.characters.length,
                                newStyleId,
                            );
                        },
                    });
                }
            }
        }

        const styledNode = node as StyledSceneNode;
        const styleProperties: Array<{
            property: "fillStyleId" | "strokeStyleId" | "effectStyleId";
            category: StyleCategory;
        }> = [
            { property: "fillStyleId", category: "colors" },
            { property: "strokeStyleId", category: "colors" },
            { property: "effectStyleId", category: "effects" },
        ];

        for (const { property, category } of styleProperties) {
            const oldStyleId = styledNode[property];
            if (typeof oldStyleId !== "string" || !oldStyleId) continue;

            references.push({
                nodeId: node.id,
                category,
                oldStyleId,
                apply: (newStyleId) => {
                    styledNode[property] = newStyleId;
                },
            });
        }
    }

    return references;
}

async function applyTheme(data: ThemeApplyData): Promise<ThemeApplyResult> {
    const currentPage = mg.document.currentPage;
    const roots =
        data.applyScope === ThemeApplyScope.selection
            ? currentPage.selection
            : currentPage.children;
    const nodes = collectSceneNodes(roots);
    const result: ThemeApplyResult = {
        scannedNodes: nodes.length,
        updatedProperties: 0,
        skippedProperties: 0,
        failedProperties: 0,
        issues: [],
    };
    const references = collectStyleReferences(nodes, result);
    const { styleIndex } = await getTokenCatalog();
    const resolutionCache = new Map<string, Promise<StyleResolution>>();

    const resolveStyle = (
        reference: Pick<StyleReference, "category" | "oldStyleId">,
    ): Promise<StyleResolution> => {
        const cacheKey = `${reference.category}:${reference.oldStyleId}`;
        const cached = resolutionCache.get(cacheKey);
        if (cached) return cached;

        const resolution = (async (): Promise<StyleResolution> => {
            const oldToken = mg.getStyleById(reference.oldStyleId);
            if (!oldToken) {
                return {
                    status: "skipped",
                    reason: "找不到节点当前使用的样式",
                };
            }

            const newTokenName = convertTokenNameToTheme(
                oldToken.name,
                data.newTheme,
            );
            if (!newTokenName) {
                return {
                    status: "skipped",
                    styleName: oldToken.name,
                    reason: "当前样式名称不包含可替换的主题前缀",
                };
            }

            const newToken = styleIndex.get(
                makeStyleIndexKey(reference.category, newTokenName),
            );
            if (!newToken) {
                return {
                    status: "skipped",
                    styleName: newTokenName,
                    reason: "目标主题中不存在同类型样式",
                };
            }

            if (mg.getStyleById(newToken.id)) {
                return {
                    status: "resolved",
                    newStyleId: newToken.id,
                    styleName: newToken.name,
                };
            }

            if (!newToken.ukey) {
                return {
                    status: "failed",
                    styleName: newToken.name,
                    reason: "团队样式缺少可导入的 ukey",
                };
            }

            try {
                const importedStyle = await mg.importStyleByKeyAsync(
                    newToken.ukey,
                );
                return {
                    status: "resolved",
                    newStyleId: importedStyle.id,
                    styleName: newToken.name,
                };
            } catch {
                return {
                    status: "failed",
                    styleName: newToken.name,
                    reason: "团队样式导入失败",
                };
            }
        })();

        resolutionCache.set(cacheKey, resolution);
        return resolution;
    };

    const uniqueReferences = Array.from(
        new Map(
            references.map((reference) => [
                `${reference.category}:${reference.oldStyleId}`,
                reference,
            ]),
        ).values(),
    );
    await mapWithConcurrency(uniqueReferences, 4, resolveStyle);

    for (const reference of references) {
        const resolution = await resolveStyle(reference);
        if (resolution.status !== "resolved") {
            const issue: ThemeApplyIssue = {
                nodeId: reference.nodeId,
                category: reference.category,
                styleName: resolution.styleName,
                level: resolution.status,
                reason: resolution.reason,
            };
            result.issues.push(issue);
            if (resolution.status === "skipped") {
                result.skippedProperties++;
            } else {
                result.failedProperties++;
            }
            continue;
        }

        try {
            reference.apply(resolution.newStyleId);
            result.updatedProperties++;
        } catch {
            result.failedProperties++;
            result.issues.push({
                nodeId: reference.nodeId,
                category: reference.category,
                styleName: resolution.styleName,
                level: "failed",
                reason: "样式写入节点失败",
            });
        }
    }

    return result;
}

function assertThemeApplyData(data: unknown): asserts data is ThemeApplyData {
    if (!data || typeof data !== "object") {
        throw new Error("主题应用参数无效");
    }
    const candidate = data as Partial<ThemeApplyData>;
    if (
        typeof candidate.newTheme !== "string" ||
        !candidate.newTheme.trim() ||
        !Object.values(ThemeApplyScope).includes(
            candidate.applyScope as ThemeApplyScope,
        )
    ) {
        throw new Error("主题名称或应用范围无效");
    }
}

function assertStorageKey(data: unknown): asserts data is LocalStorageKeys {
    if (!Object.values(LocalStorageKeys).includes(data as LocalStorageKeys)) {
        throw new Error("存储键无效");
    }
}

async function handleMessage(message: MessageRequest): Promise<unknown> {
    switch (message.type) {
        case UIMessage.STORAGE_GET:
            assertStorageKey(message.data);
            return mg.clientStorage.getAsync(message.data);
        case UIMessage.STORAGE_SET:
            assertStorageKey(message.data.key);
            await mg.clientStorage.setAsync(
                message.data.key,
                message.data.value,
            );
            return undefined;
        case UIMessage.GET_TOKENS:
            return (await getTokenCatalog()).exportData;
        case UIMessage.APPLY_THEME:
            assertThemeApplyData(message.data);
            return applyTheme(message.data);
    }
}

mg.ui.onmessage = async (rawMessage: unknown) => {
    if (!isMessageRequest(rawMessage)) {
        console.error("收到无效的 UI 消息", rawMessage);
        return;
    }

    console.info("收到 UI 消息", rawMessage.type);
    try {
        const data = await handleMessage(rawMessage);
        sendSuccessToUI(rawMessage.type, rawMessage.seq, data);
    } catch (error) {
        console.error("UI 消息处理失败", rawMessage.type, error);
        sendErrorToUI(
            rawMessage.type,
            rawMessage.seq,
            "REQUEST_FAILED",
            error instanceof Error ? error.message : "请求处理失败",
        );
    }
};
