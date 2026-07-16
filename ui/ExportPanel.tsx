import React, { useState } from "react";
import { Button, Dialog } from "@mui/material";
import ExportDialog from "@ui/ExportDialog";

export default function ExportPanel() {
    const [openExportDialog, setOpenExportDialog] = useState(false);

    return (
        <div className="export-panel">
            <Button
                variant="contained"
                onClick={() => setOpenExportDialog(true)}
            >
                导出前端主题变量
            </Button>
            <Dialog
                open={openExportDialog}
                onClose={() => setOpenExportDialog(false)}
                fullWidth
                maxWidth="md"
            >
                <ExportDialog onClose={() => setOpenExportDialog(false)} />
            </Dialog>
        </div>
    );
}
