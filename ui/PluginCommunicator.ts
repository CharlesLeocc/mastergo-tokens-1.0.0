import {
    isMessageResponse,
    ResponseDataMap,
    UIMessage,
    UIRequestWithoutSeq,
} from "@messages/sender";
import { LocalStorageKeys } from "../typings/tokenCommonFields";

type PendingRequest = {
    type: UIMessage;
    resolve: (value: unknown) => void;
    reject: (reason: Error) => void;
    timer: ReturnType<typeof setTimeout>;
};

export class PluginMessageError extends Error {
    constructor(
        public readonly code: string,
        message: string,
    ) {
        super(message);
        this.name = "PluginMessageError";
    }
}

export default class PluginCommunicator {
    static _messageResolvers = new Map<string, PendingRequest>();
    static _seq = 0;
    static _initialized = false;

    static init(): void {
        if (this._initialized) return;
        this._initialized = true;

        window.addEventListener("message", (event: MessageEvent<unknown>) => {
            if (event.source !== parent || !isMessageResponse(event.data)) {
                return;
            }

            const response = event.data;
            const pending = this._messageResolvers.get(response.seq);
            if (!pending) return;

            // 无论成功、失败还是类型异常，都必须先释放 resolver 和定时器。
            this._messageResolvers.delete(response.seq);
            clearTimeout(pending.timer);

            if (pending.type !== response.type) {
                pending.reject(
                    new PluginMessageError(
                        "RESPONSE_TYPE_MISMATCH",
                        "主线程响应类型与请求不一致",
                    ),
                );
                return;
            }

            if (response.ok) {
                pending.resolve(response.data);
            } else {
                pending.reject(
                    new PluginMessageError(
                        response.error.code,
                        response.error.message,
                    ),
                );
            }
        });
    }

    static send<K extends UIMessage>(
        request: UIRequestWithoutSeq<K>,
        timeoutMs = 10000,
    ): Promise<ResponseDataMap[K]> {
        return new Promise((resolve, reject) => {
            const seq = `ui_${this._seq++}`;
            const timer = setTimeout(() => {
                this._messageResolvers.delete(seq);
                reject(
                    new PluginMessageError(
                        "REQUEST_TIMEOUT",
                        "插件请求超时，请稍后重试",
                    ),
                );
            }, timeoutMs);

            this._messageResolvers.set(seq, {
                type: request.type,
                resolve: (value) => resolve(value as ResponseDataMap[K]),
                reject,
                timer,
            });
            parent.postMessage({ ...request, seq }, "*");
        });
    }
}

export async function storageGet<T>(key: LocalStorageKeys): Promise<T | null> {
    const value = await PluginCommunicator.send({
        type: UIMessage.STORAGE_GET,
        data: key,
    });
    return (value ?? null) as T | null;
}

export async function storageSet(
    key: LocalStorageKeys,
    value: unknown,
): Promise<void> {
    await PluginCommunicator.send({
        type: UIMessage.STORAGE_SET,
        data: { key, value },
    });
}
