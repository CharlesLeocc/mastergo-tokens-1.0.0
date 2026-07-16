import * as React from "react";
import List from "@mui/material/List";
import ListItemText from "@mui/material/ListItemText";
import {
    Box,
    Checkbox,
    ListItemButton,
    ListItemIcon,
    Typography,
} from "@mui/material";
import { buildVariableThemeOptions } from "@lib/variableThemes";
import { VariableExportSnapshot } from "../typings/variableTokens";

interface TokenListProps {
    snapshot: VariableExportSnapshot;
    value: string[];
    onChange: (themes: string[]) => void;
}

export default function TokenList(props: TokenListProps) {
    const themeOptions = buildVariableThemeOptions(props.snapshot);

    const handleToggle = (value: string) => () => {
        const selected = props.value.includes(value);
        props.onChange(
            selected
                ? props.value.filter((theme) => theme !== value)
                : [...props.value, value],
        );
    };

    if (themeOptions.length === 0) {
        return (
            <Box className="empty-state">
                <Typography color="text.secondary">
                    当前文档没有 Variables 主题模式
                </Typography>
            </Box>
        );
    }

    return (
        <List className="theme-list" disablePadding>
            {themeOptions.map((theme) => (
                <ListItemButton
                    key={theme.name}
                    onClick={handleToggle(theme.name)}
                    dense
                    divider
                >
                    <ListItemIcon>
                        <Checkbox
                            edge="start"
                            checked={props.value.includes(theme.name)}
                            tabIndex={-1}
                            disableRipple
                            slotProps={{
                                input: { "aria-label": theme.name },
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={theme.name}
                        secondary={`${theme.collections.length} 个变量集合 · ${theme.variableCount} 个变量`}
                    />
                </ListItemButton>
            ))}
        </List>
    );
}
