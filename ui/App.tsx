import React, { useEffect, useMemo, useState } from "react";
import "./App.css";
import {
    Alert,
    Box,
    CircularProgress,
    createTheme,
    CssBaseline,
    Stack,
    Tab,
    Tabs,
    ThemeProvider,
} from "@mui/material";
import PluginCommunicator, {
    storageGet,
    storageSet,
} from "@ui/PluginCommunicator";
import { UIMessage } from "@messages/sender";
import TokenList from "@ui/TokenList";
import { ApplyTheme } from "@ui/components/ApplyTheme";
import ExportPanel from "@ui/ExportPanel";
import { LocalStorageKeys } from "../typings/tokenCommonFields";
import { VariableExportSnapshot } from "../typings/variableTokens";
import { buildVariableThemeOptions } from "@lib/variableThemes";

const EMPTY_VARIABLES: VariableExportSnapshot = {
    schemaVersion: 1,
    collections: [],
};

type InitialData = {
    storedThemes: string[] | null;
    variableData: VariableExportSnapshot;
};

let initialDataPromise: Promise<InitialData> | null = null;

function loadInitialData(): Promise<InitialData> {
    if (!initialDataPromise) {
        // React 18 StrictMode 会在开发环境重挂载组件，缓存请求可避免重复扫描样式。
        initialDataPromise = Promise.all([
            storageGet<string[]>(LocalStorageKeys.themes),
            PluginCommunicator.send(
                {
                    type: UIMessage.GET_VARIABLES,
                    data: { includeExternal: false },
                },
                60000,
            ),
        ])
            .then(([storedThemes, variableData]) => ({
                storedThemes,
                variableData,
            }))
            .catch((error) => {
                initialDataPromise = null;
                throw error;
            });
    }

    return initialDataPromise;
}

function App() {
    const [themes, setThemes] = useState<string[]>([]);
    const [variableData, setVariableData] =
        useState<VariableExportSnapshot>(EMPTY_VARIABLES);
    const [tab, setTab] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const theme = useMemo(
        () =>
            createTheme({
                palette: {
                    primary: { main: "#176B5B" },
                    secondary: { main: "#D97706" },
                    background: { default: "#F5F7F6", paper: "#FFFFFF" },
                },
                shape: { borderRadius: 6 },
                typography: {
                    fontFamily:
                        '"IBM Plex Sans", "Microsoft YaHei", sans-serif',
                    button: { textTransform: "none" },
                },
            }),
        [],
    );

    useEffect(() => {
        let active = true;

        async function initialize() {
            try {
                const { storedThemes, variableData: nextVariableData } =
                    await loadInitialData();
                if (!active) return;

                setVariableData(nextVariableData);
                const availableThemes = buildVariableThemeOptions(
                    nextVariableData,
                ).map((theme) => theme.name);
                const validStoredThemes = Array.isArray(storedThemes)
                    ? storedThemes.filter(
                          (value): value is string =>
                              typeof value === "string" &&
                              availableThemes.includes(value),
                      )
                    : [];
                const nextThemes =
                    storedThemes === null ||
                    (storedThemes.length > 0 && validStoredThemes.length === 0)
                        ? availableThemes
                        : validStoredThemes;
                setThemes(nextThemes);

                if (
                    Array.isArray(storedThemes) &&
                    (storedThemes.length !== nextThemes.length ||
                        storedThemes.some(
                            (theme, index) => theme !== nextThemes[index],
                        ))
                ) {
                    // 旧版本保存的是样式名前缀，迁移为当前文档的 Variables mode。
                    storageSet(LocalStorageKeys.themes, nextThemes).catch(
                        () => undefined,
                    );
                }
            } catch (reason) {
                if (active) {
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : "插件初始化失败",
                    );
                }
            } finally {
                if (active) setLoading(false);
            }
        }

        initialize();
        return () => {
            active = false;
        };
    }, []);

    const handleThemesChange = (nextThemes: string[]) => {
        setThemes(nextThemes);
        storageSet(LocalStorageKeys.themes, nextThemes).catch((reason) => {
            setError(reason instanceof Error ? reason.message : "主题保存失败");
        });
    };

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Stack className="app-shell">
                <Tabs
                    value={tab}
                    onChange={(_, nextTab) => setTab(nextTab)}
                    variant="fullWidth"
                    aria-label="插件功能"
                >
                    <Tab label="修改主题" />
                    <Tab label="定义主题" />
                    <Tab label="导出" />
                </Tabs>

                {error && (
                    <Alert
                        severity="error"
                        onClose={() => setError("")}
                        className="app-alert"
                    >
                        {error}
                    </Alert>
                )}

                <Box className="app-content">
                    {loading ? (
                        <Box className="loading-state">
                            <CircularProgress size={28} />
                        </Box>
                    ) : (
                        <>
                            {tab === 0 && <ApplyTheme themes={themes} />}
                            {tab === 1 && (
                                <TokenList
                                    snapshot={variableData}
                                    value={themes}
                                    onChange={handleThemesChange}
                                />
                            )}
                            {tab === 2 && <ExportPanel />}
                        </>
                    )}
                </Box>
            </Stack>
        </ThemeProvider>
    );
}

export default App;
