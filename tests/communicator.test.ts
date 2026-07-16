import assert from "node:assert/strict";
import test, { beforeEach } from "node:test";
import { UIMessage } from "../messages/sender";
import PluginCommunicator, {
    PluginMessageError,
} from "../ui/PluginCommunicator";

let messageListener: (event: { source: unknown; data: unknown }) => void;
let postedMessage: Record<string, unknown>;
const parentMock = {
    postMessage(message: Record<string, unknown>) {
        postedMessage = message;
    },
};

beforeEach(() => {
    PluginCommunicator._messageResolvers.clear();
    PluginCommunicator._seq = 0;
    PluginCommunicator._initialized = false;
    Object.assign(globalThis, {
        parent: parentMock,
        window: {
            addEventListener(type: string, listener: typeof messageListener) {
                if (type === "message") messageListener = listener;
            },
        },
    });
    PluginCommunicator.init();
});

test("成功响应后删除 resolver", async () => {
    const pending = PluginCommunicator.send({
        type: UIMessage.GET_TOKENS,
        data: undefined,
    });
    const seq = postedMessage.seq as string;

    messageListener({
        source: parentMock,
        data: {
            type: UIMessage.GET_TOKENS,
            seq,
            ok: true,
            data: { schemaVersion: 1, themes: {}, ungrouped: {} },
        },
    });

    await pending;
    assert.equal(PluginCommunicator._messageResolvers.size, 0);
});

test("接受 MasterGo 桥接中没有 parent source 的合法响应", async () => {
    const pending = PluginCommunicator.send({
        type: UIMessage.GET_TOKENS,
        data: undefined,
    });
    const seq = postedMessage.seq as string;

    messageListener({
        source: null,
        data: {
            type: UIMessage.GET_TOKENS,
            seq,
            ok: true,
            data: { schemaVersion: 1, themes: {}, ungrouped: {} },
        },
    });

    await pending;
    assert.equal(PluginCommunicator._messageResolvers.size, 0);
});

test("失败响应后拒绝 Promise 并删除 resolver", async () => {
    const pending = PluginCommunicator.send({
        type: UIMessage.STORAGE_SET,
        data: { key: "themes" as never, value: [] },
    });
    const seq = postedMessage.seq as string;

    messageListener({
        source: parentMock,
        data: {
            type: UIMessage.STORAGE_SET,
            seq,
            ok: false,
            error: { code: "WRITE_FAILED", message: "保存失败" },
        },
    });

    await assert.rejects(pending, (error: PluginMessageError) => {
        assert.equal(error.code, "WRITE_FAILED");
        return true;
    });
    assert.equal(PluginCommunicator._messageResolvers.size, 0);
});

test("超时后拒绝 Promise 并删除 resolver", async () => {
    const pending = PluginCommunicator.send(
        { type: UIMessage.GET_TOKENS, data: undefined },
        5,
    );

    await assert.rejects(pending, (error: PluginMessageError) => {
        assert.equal(error.code, "REQUEST_TIMEOUT");
        return true;
    });
    assert.equal(PluginCommunicator._messageResolvers.size, 0);
});
