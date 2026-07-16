import {
    Alert,
    Button,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    SelectChangeEvent,
    Stack,
    Typography,
} from "@mui/material";
import React, { useState } from "react";
import PluginCommunicator from "@ui/PluginCommunicator";
import { UIMessage } from "@messages/sender";
import {
    ThemeApplyResult,
    ThemeApplyScope,
} from "../../typings/tokenCommonFields";

interface ApplyThemeProps {
    themes: string[];
}

export function ApplyTheme(props: ApplyThemeProps) {
    const [selectedTheme, setSelectedTheme] = useState("");
    const [applying, setApplying] = useState(false);
    const [result, setResult] = useState<ThemeApplyResult | null>(null);
    const [error, setError] = useState("");
    const effectiveTheme = props.themes.includes(selectedTheme)
        ? selectedTheme
        : (props.themes[0] ?? "");

    const handleChangeTheme = (event: SelectChangeEvent) => {
        setSelectedTheme(event.target.value);
        setResult(null);
    };

    const applyTheme = async () => {
        if (!effectiveTheme) return;

        setApplying(true);
        setError("");
        setResult(null);
        try {
            const applyResult = await PluginCommunicator.send(
                {
                    type: UIMessage.APPLY_THEME,
                    data: {
                        newTheme: effectiveTheme,
                        applyScope: ThemeApplyScope.page,
                    },
                },
                120000,
            );
            setResult(applyResult);
        } catch (reason) {
            setError(reason instanceof Error ? reason.message : "主题更新失败");
        } finally {
            setApplying(false);
        }
    };

    return (
        <Stack className="apply-theme" sx={{ gap: 2 }}>
            <FormControl size="small" fullWidth>
                <InputLabel id="select-theme-label">选择主题</InputLabel>
                <Select
                    labelId="select-theme-label"
                    label="选择主题"
                    value={effectiveTheme}
                    onChange={handleChangeTheme}
                >
                    {props.themes.map((theme) => (
                        <MenuItem key={theme} value={theme}>
                            {theme}
                        </MenuItem>
                    ))}
                </Select>
            </FormControl>

            <Button
                variant="contained"
                onClick={applyTheme}
                disabled={!effectiveTheme || applying}
                fullWidth
            >
                {applying ? (
                    <CircularProgress size={20} color="inherit" />
                ) : (
                    "更新主题"
                )}
            </Button>

            {props.themes.length === 0 && (
                <Typography variant="body2" color="text.secondary">
                    请先在“定义主题”中选择可应用的主题
                </Typography>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {result && (
                <Alert
                    severity={
                        result.failedProperties > 0 ? "warning" : "success"
                    }
                >
                    已切换 {result.updatedProperties} 个变量集合，跳过{" "}
                    {result.skippedProperties} 个，失败{" "}
                    {result.failedProperties} 个
                    {result.issues[0] && (
                        <Typography variant="caption" sx={{ display: "block" }}>
                            {result.issues[0].reason}
                        </Typography>
                    )}
                </Alert>
            )}
        </Stack>
    );
}
