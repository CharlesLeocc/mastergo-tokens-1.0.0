import os
from pathlib import Path

from playwright.sync_api import sync_playwright


OUTPUT_DIR = Path(os.environ.get("UI_SMOKE_OUTPUT", "tests/artifacts"))
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HOST_MOCK = r"""
(() => {
    const nativePostMessage = window.postMessage.bind(window);
    const tokenGroup = (prefix) => ({
        colors: { "按钮/主要": { id: `${prefix}-color`, name: `${prefix}/按钮/主要` } },
        typography: { "正文": { id: `${prefix}-text`, name: `${prefix}/正文` } },
        effects: { "浮层": { id: `${prefix}-effect`, name: `${prefix}/浮层` } },
    });
    const tokens = {
        schemaVersion: 1,
        themes: { "浅色": tokenGroup("浅色"), "深色": tokenGroup("深色") },
        ungrouped: { colors: {}, typography: {}, effects: {} },
    };
    const variables = {
        schemaVersion: 1,
        collections: [{
            id: "theme",
            name: "Theme",
            isExternal: false,
            modes: [{ id: "light", name: "亮色" }, { id: "dark", name: "暗色" }],
            variables: [{
                id: "brand",
                name: "Color/Brand",
                description: "品牌色",
                alias: "brand-color",
                type: "COLOR",
                collectionId: "theme",
                isExternal: false,
                codeSyntax: { web: "--brand-color" },
                modes: {
                    light: [{ r: 0.09, g: 0.42, b: 0.36, a: 1 }],
                    dark: [{ r: 0.28, g: 0.8, b: 0.68, a: 1 }],
                },
            }],
        }],
    };
    const storage = new Map([
        ["themes", ["阶梯色", "状态色"]],
        ["applyScope", "页面"],
    ]);
    window.__pluginRequests = [];

    // 模拟 MasterGo 宿主，验证 UI 消息必须通过统一响应协议结束。
    window.postMessage = (message, targetOrigin) => {
        if (!message?.seq || "ok" in message) {
            nativePostMessage(message, targetOrigin);
            return;
        }
        window.__pluginRequests.push(message);
        let data;
        if (message.type === "STORAGE_GET") data = storage.get(message.data);
        if (message.type === "STORAGE_SET") {
            storage.set(message.data.key, message.data.value);
        }
        if (message.type === "GET_TOKENS") data = tokens;
        if (message.type === "GET_VARIABLES") data = variables;
        if (message.type === "APPLY_THEME") {
            data = {
                scannedNodes: 12,
                updatedProperties: 8,
                skippedProperties: 1,
                failedProperties: 0,
                issues: [{
                    nodeId: "node-1",
                    category: "typography",
                    level: "skipped",
                    reason: "节点包含多种文本样式，已保持原样",
                }],
            };
        }
        queueMicrotask(() => nativePostMessage({
            type: message.type,
            seq: message.seq,
            ok: true,
            data,
        }, "*"));
    };
})();
"""


def assert_no_horizontal_overflow(page):
    overflow = page.evaluate(
        "document.documentElement.scrollWidth > document.documentElement.clientWidth"
    )
    assert not overflow, "页面存在横向溢出"


with sync_playwright() as playwright:
    # 使用系统 Chrome，避免测试依赖额外下载的浏览器二进制。
    browser = playwright.chromium.launch(channel="chrome", headless=True)
    context = browser.new_context(
        viewport={"width": 360, "height": 560},
        accept_downloads=True,
        permissions=["clipboard-read", "clipboard-write"],
    )
    page = context.new_page()
    page.add_init_script(HOST_MOCK)
    page.goto("http://127.0.0.1:4173")
    page.wait_for_load_state("networkidle")

    initial_requests = page.evaluate(
        "window.__pluginRequests.map((request) => request.type)"
    )
    assert initial_requests.count("STORAGE_GET") == 1
    assert initial_requests.count("GET_VARIABLES") == 1

    page.get_by_role("button", name="更新主题").click()
    page.get_by_text("已切换 8 个变量集合，跳过 1 个，失败 0 个").wait_for()
    apply_request = page.evaluate(
        "window.__pluginRequests.filter((request) => request.type === 'APPLY_THEME').at(-1)"
    )
    assert apply_request["data"] == {"newTheme": "亮色", "applyScope": "页面"}
    assert_no_horizontal_overflow(page)

    page.get_by_role("tab", name="定义主题").click()
    page.get_by_text("暗色", exact=True).wait_for()
    assert page.get_by_text("阶梯色", exact=True).count() == 0
    page.screenshot(path=OUTPUT_DIR / "plugin-themes-mobile.png", full_page=True)
    page.get_by_text("亮色", exact=True).click()
    stored = page.evaluate(
        "window.__pluginRequests.some((request) => request.type === 'STORAGE_SET' && request.data.key === 'themes')"
    )
    assert stored, "主题切换没有发送存储请求"

    page.get_by_role("tab", name="导出").click()
    page.get_by_role("button", name="导出前端主题变量").click()
    page.get_by_text("1 Collection", exact=True).wait_for()
    page.get_by_text("--brand-color: #176b5c;", exact=False).wait_for()
    with page.expect_download() as download_info:
        page.get_by_role("button", name="下载 CSS").click()
    assert download_info.value.suggested_filename == "mastergo-theme-variables.css"
    page.get_by_role("button", name="DTCG").click()
    page.get_by_text('"$type": "color"', exact=False).wait_for()
    page.get_by_text('"colorSpace": "srgb"', exact=False).wait_for()
    assert_no_horizontal_overflow(page)
    page.screenshot(path=OUTPUT_DIR / "plugin-mobile.png", full_page=True)

    wide_page = context.new_page()
    wide_page.set_viewport_size({"width": 800, "height": 700})
    wide_page.add_init_script(HOST_MOCK)
    wide_page.goto("http://127.0.0.1:4173")
    wide_page.wait_for_load_state("networkidle")
    assert_no_horizontal_overflow(wide_page)
    wide_page.screenshot(path=OUTPUT_DIR / "plugin-desktop.png", full_page=True)

    context.close()
    browser.close()
