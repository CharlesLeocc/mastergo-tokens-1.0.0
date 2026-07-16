import {
    Alert,
    Box,
    Button,
    CircularProgress,
    DialogActions,
    DialogContent,
    DialogTitle,
    FormControlLabel,
    Stack,
    Switch,
    ToggleButton,
    ToggleButtonGroup,
    Typography,
} from "@mui/material";
import React, { useEffect, useMemo, useState } from "react";
import JsonHighlight from "@ui/components/JsonHighlight";
import PluginCommunicator from "@ui/PluginCommunicator";
import { UIMessage } from "@messages/sender";
import { buildFrontendVariableExport } from "@lib/variableExport";
import { VariableExportSnapshot } from "../typings/variableTokens";

interface ExportDialogProps {
    onClose: VoidFunction;
}

type ExportFormat = "css" | "dtcg";

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
    const [format, setFormat] = useState<ExportFormat>("css");
    const [includeExternal, setIncludeExternal] = useState(false);
    const [snapshot, setSnapshot] = useState<VariableExportSnapshot | null>(
        null,
    );
    const [loading, setLoading] = useState(true);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");

    useEffect(() => {
        let active = true;

        PluginCommunicator.send(
            {
                type: UIMessage.GET_VARIABLES,
                data: { includeExternal },
            },
            60000,
        )
            .then((data) => {
                if (active) setSnapshot(data);
            })
            .catch((reason) => {
                if (active) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "Variables 读取失败",
                    );
                    setSnapshot(null);
                }
            })
            .finally(() => {
                if (active) setLoading(false);
            });

        return () => {
            active = false;
        };
    }, [includeExternal]);

    const generated = useMemo(
        () => (snapshot ? buildFrontendVariableExport(snapshot) : null),
        [snapshot],
    );
    const content = useMemo(() => {
        if (!generated) return "";
        return format === "css"
            ? generated.css
            : JSON.stringify(generated.dtcg, null, 4);
    }, [format, generated]);
    const canExport = Boolean(generated && generated.stats.declarations > 0);

    const handleCopy = async () => {
        if (!content || !canExport) return;
        setError("");
        try {
            await copyText(content);
            setNotice("已复制到剪贴板");
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "复制失败");
        }
    };

    const handleDownload = () => {
        if (!content || !canExport) return;
        const isCss = format === "css";
        const blob = new Blob([content], {
            type: isCss
                ? "text/css;charset=utf-8"
                : "application/json;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = isCss
            ? "mastergo-theme-variables.css"
            : "mastergo-tokens.dtcg.json";
        link.click();
        URL.revokeObjectURL(url);
        setNotice("导出文件已生成");
        setError("");
    };

    const handleExternalChange = (checked: boolean) => {
        setLoading(true);
        setError("");
        setSnapshot(null);
        setIncludeExternal(checked);
    };

    return (
        <>
            <DialogTitle>导出前端主题变量</DialogTitle>
            <DialogContent dividers className="export-dialog-content">
                <Stack sx={{ gap: 1.5 }}>
                    <Box className="export-toolbar">
                        <ToggleButtonGroup
                            exclusive
                            size="small"
                            value={format}
                            onChange={(_, value: ExportFormat | null) => {
                                if (value) setFormat(value);
                            }}
                            aria-label="导出格式"
                        >
                            <ToggleButton value="css">CSS</ToggleButton>
                            <ToggleButton value="dtcg">DTCG</ToggleButton>
                        </ToggleButtonGroup>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={includeExternal}
                                    onChange={(event) =>
                                        handleExternalChange(
                                            event.target.checked,
                                        )
                                    }
                                />
                            }
                            label="包含团队库"
                        />
                    </Box>

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
                    {loading && (
                        <Box className="loading-state export-loading">
                            <CircularProgress size={28} />
                        </Box>
                    )}
                    {!loading && generated && (
                        <>
                            <Box className="export-summary">
                                <Typography variant="body2">
                                    {generated.stats.collections} Collection
                                </Typography>
                                <Typography variant="body2">
                                    {generated.stats.modes} Mode
                                </Typography>
                                <Typography variant="body2">
                                    {generated.stats.variables} Variable
                                </Typography>
                                <Typography variant="body2">
                                    {generated.stats.declarations} 条声明
                                </Typography>
                                <Typography
                                    variant="body2"
                                    color={
                                        generated.stats.skipped > 0
                                            ? "warning.main"
                                            : "success.main"
                                    }
                                >
                                    跳过 {generated.stats.skipped}
                                </Typography>
                            </Box>
                            {generated.stats.variables === 0 ? (
                                <Alert severity="info">
                                    当前文档没有可导出的 Variables
                                </Alert>
                            ) : (
                                <JsonHighlight
                                    language={format === "css" ? "css" : "json"}
                                >
                                    {content}
                                </JsonHighlight>
                            )}
                            {generated.issues[0] && (
                                <Alert severity="warning">
                                    {generated.issues[0].variableName}：
                                    {generated.issues[0].reason}
                                </Alert>
                            )}
                        </>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={props.onClose}>关闭</Button>
                <Button onClick={handleCopy} disabled={!canExport || loading}>
                    复制
                </Button>
                <Button
                    variant="contained"
                    onClick={handleDownload}
                    disabled={!canExport || loading}
                >
                    下载 {format === "css" ? "CSS" : "DTCG"}
                </Button>
            </DialogActions>
        </>
    );
}
