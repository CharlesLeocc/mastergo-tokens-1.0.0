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
import {
    LocalStorageKeys,
    ThemeApplyScope,
    TokenExportData,
} from "../typings/tokenCommonFields";

const EMPTY_TOKENS: TokenExportData = {
    schemaVersion: 1,
    themes: {},
    ungrouped: {
        colors: {},
        typography: {},
        effects: {},
    },
};

type InitialData = {
    storedThemes: string[] | null;
    storedScope: ThemeApplyScope | null;
    tokenData: TokenExportData;
};

let initialDataPromise: Promise<InitialData> | null = null;

function loadInitialData(): Promise<InitialData> {
    if (!initialDataPromise) {
        // React 18 StrictMode 会在开发环境重挂载组件，缓存请求可避免重复扫描样式。
        initialDataPromise = Promise.all([
            storageGet<string[]>(LocalStorageKeys.themes),
            storageGet<ThemeApplyScope>(LocalStorageKeys.applyScope),
            PluginCommunicator.send({
                type: UIMessage.GET_TOKENS,
                data: undefined,
            }),
        ])
            .then(([storedThemes, storedScope, tokenData]) => ({
                storedThemes,
                storedScope,
                tokenData,
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
    const [applyScope, setApplyScope] = useState(ThemeApplyScope.page);
    const [tokens, setTokens] = useState<TokenExportData>(EMPTY_TOKENS);
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
                const { storedThemes, storedScope, tokenData } =
                    await loadInitialData();
                if (!active) return;

                setTokens(tokenData);
                if (Array.isArray(storedThemes)) {
                    setThemes(
                        storedThemes.filter(
                            (value): value is string =>
                                typeof value === "string",
                        ),
                    );
                }
                if (
                    storedScope &&
                    Object.values(ThemeApplyScope).includes(storedScope)
                ) {
                    setApplyScope(storedScope);
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

    const handleApplyScopeChange = (nextScope: ThemeApplyScope) => {
        setApplyScope(nextScope);
        storageSet(LocalStorageKeys.applyScope, nextScope).catch((reason) => {
            setError(
                reason instanceof Error ? reason.message : "应用范围保存失败",
            );
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
                            {tab === 0 && (
                                <ApplyTheme
                                    themes={themes}
                                    applyScope={applyScope}
                                    onApplyScopeChange={handleApplyScopeChange}
                                />
                            )}
                            {tab === 1 && (
                                <TokenList
                                    tokens={tokens}
                                    value={themes}
                                    onChange={handleThemesChange}
                                />
                            )}
                            {tab === 2 && <ExportPanel tokens={tokens} />}
                        </>
                    )}
                </Box>
            </Stack>
        </ThemeProvider>
    );
}

export default App;
