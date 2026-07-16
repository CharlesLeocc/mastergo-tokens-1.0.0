import {
    LocalStorageKeys,
    ThemeApplyData,
    ThemeApplyResult,
    TokenExportData,
} from "../typings/tokenCommonFields";
import { VariableExportSnapshot } from "../typings/variableTokens";

export enum UIMessage {
    STORAGE_SET = "STORAGE_SET",
    STORAGE_GET = "STORAGE_GET",
    GET_TOKENS = "GET_TOKENS",
    GET_VARIABLES = "GET_VARIABLES",
    APPLY_THEME = "APPLY_THEME",
}

export type RequestDataMap = {
    [UIMessage.STORAGE_SET]: {
        key: LocalStorageKeys;
        value: unknown;
    };
    [UIMessage.STORAGE_GET]: LocalStorageKeys;
    [UIMessage.GET_TOKENS]: undefined;
    [UIMessage.GET_VARIABLES]: { includeExternal: boolean };
    [UIMessage.APPLY_THEME]: ThemeApplyData;
};

export type ResponseDataMap = {
    [UIMessage.STORAGE_SET]: undefined;
    [UIMessage.STORAGE_GET]: unknown;
    [UIMessage.GET_TOKENS]: TokenExportData;
    [UIMessage.GET_VARIABLES]: VariableExportSnapshot;
    [UIMessage.APPLY_THEME]: ThemeApplyResult;
};

export type UIRequest<K extends UIMessage = UIMessage> = {
    type: K;
    seq: string;
    data: RequestDataMap[K];
};

export type MessageRequest = {
    [K in UIMessage]: UIRequest<K>;
}[UIMessage];

export type UIRequestWithoutSeq<K extends UIMessage> = Omit<
    UIRequest<K>,
    "seq"
>;

export type MessageResponse<T = unknown> =
    | {
          type: UIMessage;
          seq: string;
          ok: true;
          data: T;
      }
    | {
          type: UIMessage;
          seq: string;
          ok: false;
          error: {
              code: string;
              message: string;
          };
      };

export function isMessageRequest(value: unknown): value is MessageRequest {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<MessageRequest>;
    return (
        typeof candidate.seq === "string" &&
        Object.values(UIMessage).includes(candidate.type as UIMessage) &&
        "data" in candidate
    );
}

export function isMessageResponse(value: unknown): value is MessageResponse {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Partial<MessageResponse>;
    if (
        typeof candidate.seq !== "string" ||
        typeof candidate.ok !== "boolean" ||
        !Object.values(UIMessage).includes(candidate.type as UIMessage)
    ) {
        return false;
    }

    if (candidate.ok) return "data" in candidate;
    return (
        "error" in candidate &&
        typeof candidate.error?.code === "string" &&
        typeof candidate.error?.message === "string"
    );
}

export function sendSuccessToUI(
    type: UIMessage,
    seq: string,
    data: unknown,
): void {
    mg.ui.postMessage({ type, seq, ok: true, data }, "*");
}

export function sendErrorToUI(
    type: UIMessage,
    seq: string,
    code: string,
    message: string,
): void {
    mg.ui.postMessage(
        {
            type,
            seq,
            ok: false,
            error: { code, message },
        },
        "*",
    );
}
