import React, { useState } from "react";
import { Button, Dialog } from "@mui/material";
import ExportDialog from "@ui/ExportDialog";
import { TokenExportData } from "../typings/tokenCommonFields";

interface ExportPanelProps {
    tokens: TokenExportData;
}

export default function ExportPanel(props: ExportPanelProps) {
    const [openExportDialog, setOpenExportDialog] = useState(false);

    return (
        <div className="export-panel">
            <Button
                variant="contained"
                onClick={() => setOpenExportDialog(true)}
            >
                查看导出内容
            </Button>
            <Dialog
                open={openExportDialog}
                onClose={() => setOpenExportDialog(false)}
                fullWidth
                maxWidth="md"
            >
                <ExportDialog
                    tokens={props.tokens}
                    onClose={() => setOpenExportDialog(false)}
                />
            </Dialog>
        </div>
    );
}
