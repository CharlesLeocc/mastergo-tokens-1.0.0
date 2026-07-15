import {
    Alert,
    Button,
    DialogActions,
    DialogContent,
    DialogTitle,
    Stack,
} from "@mui/material";
import React, { useMemo, useState } from "react";
import JsonHighlight from "@ui/components/JsonHighlight";
import { TokenExportData } from "../typings/tokenCommonFields";

interface ExportDialogProps {
    tokens: TokenExportData;
    onClose: VoidFunction;
}

async function copyText(value: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return;
    }

    // 兼容不支持 Clipboard API 的插件 iframe 环境。
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("复制失败");
}

export default function ExportDialog(props: ExportDialogProps) {
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const json = useMemo(
        () => JSON.stringify(props.tokens, null, 4),
        [props.tokens],
    );

    const handleCopy = async () => {
        setError("");
        try {
            await copyText(json);
            setNotice("已复制到剪贴板");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "复制失败");
        }
    };

    const handleDownload = () => {
        const blob = new Blob([json], {
            type: "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `mastergo-styles-v${props.tokens.schemaVersion}.json`;
        link.click();
        URL.revokeObjectURL(url);
        setNotice("导出文件已生成");
        setError("");
    };

    return (
        <>
            <DialogTitle>导出样式</DialogTitle>
            <DialogContent dividers className="export-dialog-content">
                <Stack sx={{ gap: 1.5 }}>
                    {notice && (
                        <Alert severity="success" onClose={() => setNotice("")}>
                            {notice}
                        </Alert>
                    )}
                    {error && (
                        <Alert severity="error" onClose={() => setError("")}>
                            {error}
                        </Alert>
                    )}
                    <JsonHighlight>{json}</JsonHighlight>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onClose}>关闭</Button>
                <Button onClick={handleCopy}>复制</Button>
                <Button variant="contained" onClick={handleDownload}>
                    下载 JSON
                </Button>
            </DialogActions>
        </>
    );
}
