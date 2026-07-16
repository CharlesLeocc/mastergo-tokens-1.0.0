import assert from "node:assert/strict";
import test from "node:test";
import { buildVariableThemeOptions } from "../lib/variableThemes";
import { VariableExportSnapshot } from "../typings/variableTokens";

test("按 Variables mode 名聚合真正的主题", () => {
    const snapshot: VariableExportSnapshot = {
        schemaVersion: 1,
        collections: [
            {
                id: "theme",
                name: "主题变量",
                isExternal: false,
                modes: [
                    { id: "light", name: "亮色" },
                    { id: "dark", name: "暗色" },
                ],
                variables: [
                    {
                        id: "brand",
                        name: "状态色/首选",
                        description: "",
                        alias: "brand",
                        type: "PAINT",
                        collectionId: "theme",
                        isExternal: false,
                        modes: { light: [{}], dark: [{}] },
                    },
                ],
            },
            {
                id: "component",
                name: "组件变量",
                isExternal: false,
                modes: [
                    { id: "component-light", name: "亮色" },
                    { id: "component-dark", name: "暗色" },
                ],
                variables: [
                    {
                        id: "spacing",
                        name: "间距/xxs",
                        description: "",
                        alias: "spacing-xxs",
                        type: "NUMBER",
                        collectionId: "component",
                        isExternal: false,
                        modes: {
                            "component-light": [4],
                            "component-dark": [4],
                        },
                    },
                ],
            },
        ],
    };

    const options = buildVariableThemeOptions(snapshot);

    assert.deepEqual(
        options.map((option) => option.name),
        ["亮色", "暗色"],
    );
    assert.equal(options[0].collections.length, 2);
    assert.equal(options[0].variableCount, 2);
});
