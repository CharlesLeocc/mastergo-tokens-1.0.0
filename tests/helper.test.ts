import assert from "node:assert/strict";
import test from "node:test";
import {
    collectSceneNodes,
    convertTokenNameToTheme,
    mapWithConcurrency,
    splitTokenTheme,
} from "../lib/helper";

test("主题名称转换支持中文、空格和连字符", () => {
    assert.equal(
        convertTokenNameToTheme("浅色 主题/按钮/主要", "dark-mode"),
        "dark-mode/按钮/主要",
    );
    assert.deepEqual(splitTokenTheme("中文主题/正文"), {
        themeName: "中文主题",
        tokenName: "正文",
    });
    assert.equal(convertTokenNameToTheme("无主题样式", "dark"), null);
});

test("节点遍历不会重复处理实例或重复根节点", () => {
    const child = { id: "child", type: "RECTANGLE" };
    const instance = {
        id: "instance",
        type: "INSTANCE",
        children: [child],
    };
    const nodes = collectSceneNodes([instance, instance] as SceneNode[]);

    assert.deepEqual(
        nodes.map((node) => node.id),
        ["instance", "child"],
    );
});

test("并发映射不会超过指定 worker 数量", async () => {
    let running = 0;
    let maximumRunning = 0;
    const results = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
        running++;
        maximumRunning = Math.max(maximumRunning, running);
        await new Promise((resolve) => setTimeout(resolve, 2));
        running--;
        return n * 2;
    });

    assert.deepEqual(results, [2, 4, 6, 8, 10]);
    assert.equal(maximumRunning, 2);
});
