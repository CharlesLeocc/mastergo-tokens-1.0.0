import assert from "node:assert/strict";
import test from "node:test";
import { buildFrontendVariableExport } from "../lib/variableExport";
import { VariableExportSnapshot } from "../typings/variableTokens";

const snapshot: VariableExportSnapshot = {
    schemaVersion: 1,
    collections: [
        {
            id: "collection-theme",
            name: "Theme",
            isExternal: false,
            modes: [
                { id: "light", name: "Light" },
                { id: "dark", name: "Dark" },
            ],
            variables: [
                {
                    id: "brand",
                    name: "Color/Brand",
                    description: "品牌主色",
                    alias: "brand-color",
                    type: "COLOR",
                    collectionId: "collection-theme",
                    isExternal: false,
                    codeSyntax: { web: "--brand-color" },
                    modes: {
                        light: [{ r: 1, g: 0.2, b: 0, a: 1 }],
                        dark: [{ r: 0.2, g: 0.4, b: 1, a: 0.8 }],
                    },
                },
                {
                    id: "surface",
                    name: "Color/Surface",
                    description: "页面背景色",
                    alias: "surface-color",
                    type: "PAINT",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: {
                        light: [
                            {
                                modeId: "light",
                                paintData: [
                                    { type: 5, isVisible: false },
                                    {
                                        type: 0,
                                        color: {
                                            red: "0.96",
                                            green: "0.98",
                                            blue: "1",
                                            alpha: "1",
                                        },
                                        alpha: "1",
                                        isVisible: true,
                                    },
                                ],
                            },
                        ],
                        dark: [
                            {
                                modeId: "dark",
                                paintData: [
                                    {
                                        type: 0,
                                        value: { color: "0F172A" },
                                        alpha: 1,
                                        isVisible: true,
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    id: "xxs",
                    name: "Spacing/XXS",
                    description: "极小间距",
                    alias: "spacing-xxs",
                    type: "NUMBER",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: {
                        light: [{ modeId: "light", floatData: [4] }],
                        dark: [{ modeId: "dark", floatData: [6] }],
                    },
                },
                {
                    id: "brand-reference",
                    name: "Color/Link",
                    description: "链接颜色",
                    alias: "link-color",
                    type: "COLOR",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: {
                        light: [{ type: "VARIABLE_ALIAS", id: "brand" }],
                        dark: [{ type: "VARIABLE_ALIAS", id: "brand" }],
                    },
                },
                {
                    id: "spacing",
                    name: "Spacing/Base",
                    description: "基础间距",
                    alias: "space-base",
                    type: "SPACING",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: { light: [8], dark: [12] },
                },
                {
                    id: "body",
                    name: "Typography/Body",
                    description: "正文",
                    alias: "text-body",
                    type: "TEXT",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: {
                        light: [
                            {
                                fontFamily: "Inter",
                                fontStyle:
                                    '{"fontStyle":"Medium","opsz":"auto"}',
                                fontSize: 14,
                                height: "22.000000",
                                letterSpacing: 0,
                            },
                        ],
                        dark: [
                            {
                                fontName: { family: "Inter", style: "Regular" },
                                fontSize: 14,
                                lineHeight: { value: 22, unit: "PIXELS" },
                            },
                        ],
                    },
                },
                {
                    id: "padding",
                    name: "Spacing/CardPadding",
                    description: "卡片内边距",
                    alias: "card-padding",
                    type: "PADDING",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: {
                        light: [[12, 16, 12, 16]],
                        dark: [[12, 16, 12, 16]],
                    },
                },
                {
                    id: "card-shadow",
                    name: "Effect/Card",
                    description: "卡片阴影",
                    alias: "shadow-card",
                    type: "EFFECT",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: {
                        light: [
                            {
                                modeId: "light",
                                effectData: [
                                    {
                                        type: 1,
                                        x: 0,
                                        y: 8,
                                        radius: 20,
                                        spread: 0,
                                        color: {
                                            red: 0,
                                            green: 0,
                                            blue: 0,
                                            alpha: 0.2,
                                        },
                                        isVisible: true,
                                    },
                                ],
                            },
                        ],
                        dark: [
                            {
                                modeId: "dark",
                                effectData: [
                                    {
                                        type: 0,
                                        x: 0,
                                        y: 2,
                                        radius: 8,
                                        spread: 0,
                                        color: "rgba(255, 255, 255, 0.12)",
                                        isVisible: true,
                                    },
                                ],
                            },
                        ],
                    },
                },
                {
                    id: "round-radius",
                    name: "Radius/Round",
                    description: "全圆角",
                    alias: "radius-round",
                    type: "RADIUS",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: {
                        light: [[14, 14, 14, 14]],
                        dark: [20],
                    },
                },
                {
                    id: "grid",
                    name: "Grid/Main",
                    description: "栅格",
                    alias: "grid-main",
                    type: "GRID",
                    collectionId: "collection-theme",
                    isExternal: false,
                    modes: { light: [{}], dark: [{}] },
                },
            ],
        },
    ],
};

test("按 Collection Mode 生成前端 CSS 主题变量", () => {
    const result = buildFrontendVariableExport(snapshot);

    assert.match(result.css, /:root \{/);
    assert.match(result.css, /--brand-color: #ff3300;/);
    assert.match(result.css, /--surface-color: #f5faff;/);
    assert.match(result.css, /\[data-theme="dark"\] \{/);
    assert.match(result.css, /--surface-color: #0f172a;/);
    assert.match(result.css, /--brand-color: rgba\(51, 102, 255, 0\.8\);/);
    assert.match(result.css, /--space-base: 8px;/);
    assert.match(result.css, /--spacing-xxs: 4;/);
    assert.match(result.css, /--link-color: var\(--brand-color\);/);
    assert.match(result.css, /--text-body-font-family: "Inter";/);
    assert.match(result.css, /--text-body-line-height: 22px;/);
    assert.match(result.css, /--text-body-letter-spacing: 0px;/);
    assert.match(result.css, /--text-body-font-weight: 500;/);
    assert.match(result.css, /--card-padding: 12px 16px 12px 16px;/);
    assert.match(
        result.css,
        /--shadow-card: 0px 8px 20px 0px rgba\(0, 0, 0, 0\.2\);/,
    );
    assert.equal(result.stats.collections, 1);
    assert.equal(result.stats.modes, 2);
    assert.equal(result.stats.variables, 10);
    assert.equal(result.stats.skipped, 2);
});

test("生成符合 DTCG 2025.10 的标准值结构", () => {
    const result = buildFrontendVariableExport(snapshot);
    const dtcg = result.dtcg as {
        theme: {
            light: {
                color: {
                    brand: {
                        $type: string;
                        $value: {
                            colorSpace: string;
                            components: number[];
                            alpha: number;
                            hex: string;
                        };
                    };
                    link: { $value: string };
                };
                spacing: {
                    cardpadding: Record<
                        "top" | "right" | "bottom" | "left",
                        {
                            $type: string;
                            $value: { value: number; unit: string };
                        }
                    >;
                };
                typography: {
                    body: {
                        $value: {
                            fontFamily: string;
                            fontSize: { value: number; unit: string };
                            fontWeight: number;
                            letterSpacing: { value: number; unit: string };
                            lineHeight: number;
                        };
                    };
                };
                effect: {
                    card: {
                        $value: {
                            color: { alpha: number };
                            offsetX: { value: number; unit: string };
                            offsetY: { value: number; unit: string };
                            blur: { value: number; unit: string };
                            spread: { value: number; unit: string };
                        };
                    };
                };
                radius: {
                    round: Record<
                        | "top-left"
                        | "top-right"
                        | "bottom-right"
                        | "bottom-left",
                        { $value: { value: number; unit: string } }
                    >;
                };
            };
            dark: {
                radius: {
                    round: Record<
                        | "top-left"
                        | "top-right"
                        | "bottom-right"
                        | "bottom-left",
                        { $value: { value: number; unit: string } }
                    >;
                };
            };
        };
    };

    assert.equal(dtcg.theme.light.color.brand.$type, "color");
    assert.deepEqual(dtcg.theme.light.color.brand.$value, {
        colorSpace: "srgb",
        components: [1, 0.2, 0],
        alpha: 1,
        hex: "#ff3300",
    });
    assert.equal(
        dtcg.theme.light.color.link.$value,
        "{theme.light.color.brand}",
    );
    assert.deepEqual(dtcg.theme.light.spacing.cardpadding.top.$value, {
        value: 12,
        unit: "px",
    });
    assert.deepEqual(dtcg.theme.light.spacing.cardpadding.right.$value, {
        value: 16,
        unit: "px",
    });
    assert.deepEqual(dtcg.theme.light.typography.body.$value, {
        fontFamily: "Inter",
        fontSize: { value: 14, unit: "px" },
        fontWeight: 500,
        letterSpacing: { value: 0, unit: "px" },
        lineHeight: 1.571429,
    });
    assert.equal(dtcg.theme.light.effect.card.$value.color.alpha, 0.2);
    assert.deepEqual(dtcg.theme.light.effect.card.$value.offsetY, {
        value: 8,
        unit: "px",
    });
    assert.equal(dtcg.theme.light.radius.round["top-left"].$value.value, 14);
    assert.equal(dtcg.theme.dark.radius.round["top-left"].$value.value, 20);
    assert.equal(dtcg.theme.dark.radius.round["bottom-left"].$value.value, 20);
});

test("DTCG 标准类型不包含 MasterGo 私有值结构", () => {
    const { dtcg } = buildFrontendVariableExport(snapshot);
    const tokens: Array<{ $type: string; $value: unknown }> = [];

    const visit = (value: unknown): void => {
        if (!value || typeof value !== "object") return;
        const record = value as Record<string, unknown>;
        if (typeof record.$type === "string" && "$value" in record) {
            tokens.push(record as { $type: string; $value: unknown });
            return;
        }
        for (const [key, child] of Object.entries(record)) {
            if (key !== "$extensions") visit(child);
        }
    };
    visit(dtcg);

    for (const token of tokens) {
        if (
            typeof token.$value === "string" &&
            /^\{[^{}]+\}$/.test(token.$value)
        ) {
            continue;
        }
        const value = token.$value as Record<string, unknown>;
        if (token.$type === "color") {
            assert.equal(value.colorSpace, "srgb");
            assert.ok(Array.isArray(value.components));
        }
        if (token.$type === "dimension") {
            assert.ok(!Array.isArray(token.$value));
            assert.equal(value.unit, "px");
        }
        if (token.$type === "typography") {
            assert.ok(!("modeId" in value));
            assert.equal(typeof value.lineHeight, "number");
        }
        if (token.$type === "shadow") {
            const shadows = Array.isArray(token.$value)
                ? token.$value
                : [token.$value];
            for (const shadow of shadows as Array<Record<string, unknown>>) {
                assert.ok("offsetX" in shadow);
                assert.ok(!("x" in shadow));
            }
        }
    }
});
