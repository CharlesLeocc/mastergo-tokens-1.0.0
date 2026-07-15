import assert from "node:assert/strict";
import test from "node:test";
import { buildTokenCatalog, makeStyleIndexKey } from "../lib/tokenCatalog";

test("不同类型的同名样式分别保留", () => {
    const name = "浅色/按钮/主要";
    const color = { id: "color", name } as PaintStyle;
    const typography = { id: "text", name } as TextStyle;
    const effect = { id: "effect", name } as EffectStyle;

    const catalog = buildTokenCatalog({
        colors: [color],
        typography: [typography],
        effects: [effect],
    });

    assert.equal(
        catalog.exportData.themes["浅色"].colors["按钮/主要"].id,
        "color",
    );
    assert.equal(
        catalog.exportData.themes["浅色"].typography["按钮/主要"].id,
        "text",
    );
    assert.equal(
        catalog.exportData.themes["浅色"].effects["按钮/主要"].id,
        "effect",
    );
    assert.equal(
        catalog.styleIndex.get(makeStyleIndexKey("colors", name))?.id,
        "color",
    );
    assert.equal(
        catalog.styleIndex.get(makeStyleIndexKey("typography", name))?.id,
        "text",
    );
});

test("无主题样式进入 ungrouped，同类型同名时保持首个样式", () => {
    const local = { id: "local", name: "品牌色" } as PaintStyle;
    const team = { id: "team", name: "品牌色" } as PaintStyle;
    const catalog = buildTokenCatalog({
        colors: [local, team],
        typography: [],
        effects: [],
    });

    assert.equal(catalog.exportData.ungrouped.colors["品牌色"].id, "local");
    assert.equal(
        catalog.styleIndex.get(makeStyleIndexKey("colors", "品牌色"))?.id,
        "local",
    );
});
