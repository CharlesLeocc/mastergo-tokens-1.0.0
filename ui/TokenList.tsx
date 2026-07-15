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
import { TokenExportData } from "../typings/tokenCommonFields";

interface TokenListProps {
    tokens: TokenExportData;
    value: string[];
    onChange: (themes: string[]) => void;
}

export default function TokenList(props: TokenListProps) {
    const themeNames = Object.keys(props.tokens.themes);

    const handleToggle = (value: string) => () => {
        const selected = props.value.includes(value);
        props.onChange(
            selected
                ? props.value.filter((theme) => theme !== value)
                : [...props.value, value],
        );
    };

    if (themeNames.length === 0) {
        return (
            <Box className="empty-state">
                <Typography color="text.secondary">
                    未发现包含主题前缀的样式
                </Typography>
            </Box>
        );
    }

    return (
        <List className="theme-list" disablePadding>
            {themeNames.map((themeName) => (
                <ListItemButton
                    key={themeName}
                    onClick={handleToggle(themeName)}
                    dense
                    divider
                >
                    <ListItemIcon>
                        <Checkbox
                            edge="start"
                            checked={props.value.includes(themeName)}
                            tabIndex={-1}
                            disableRipple
                            slotProps={{
                                input: { "aria-label": themeName },
                            }}
                        />
                    </ListItemIcon>
                    <ListItemText
                        primary={themeName}
                        secondary={`${
                            Object.keys(props.tokens.themes[themeName].colors)
                                .length
                        } 颜色 · ${
                            Object.keys(
                                props.tokens.themes[themeName].typography,
                            ).length
                        } 文本 · ${
                            Object.keys(props.tokens.themes[themeName].effects)
                                .length
                        } 效果`}
                    />
                </ListItemButton>
            ))}
        </List>
    );
}
