/*
 * Copyright 2026 WSO2 LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    Button,
    Typography,
    Tooltip,
    CircularProgress,
    makeStyles,
    Box,
} from '@material-ui/core';
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import CancelIcon from '@material-ui/icons/Cancel';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
import GetAppIcon from '@material-ui/icons/GetApp';

const useStyles = makeStyles(theme => ({
    editorContainer: {
        position: 'relative',
        borderRadius: 6,
        overflow: 'hidden',
        border: '1px solid #3c3c3c',
        backgroundColor: '#1e1e1e',
    },
    editorHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '6px 12px',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #3c3c3c',
    },
    editorLang: {
        color: '#9d9d9d',
        fontSize: 11,
        fontFamily: '"Consolas", "SF Mono", "Menlo", monospace',
        letterSpacing: 1,
    },
    editorActions: {
        display: 'flex',
        gap: 8,
        alignItems: 'center',
    },
    monacoTextarea: {
        width: '100%',
        backgroundColor: '#1e1e1e',
        color: '#d4d4d4',
        fontFamily: '"Consolas", "SF Mono", "Menlo", "Courier New", monospace',
        fontSize: 13,
        lineHeight: 1.6,
        padding: '16px',
        border: 'none',
        outline: 'none',
        resize: 'vertical',
        boxSizing: 'border-box',
        tabSize: 2,
        overflow: 'hidden', // Disable internal scroll to let page handle it
        '&:read-only': {
            cursor: 'default',
            opacity: 0.85,
        },
    },
    editBtn: {
        backgroundColor: '#0e639c',
        color: '#fff',
        textTransform: 'none',
        fontWeight: 600,
        '&:hover': {
            backgroundColor: '#1177bb',
        },
    },
    saveBtn: {
        backgroundColor: '#28a745',
        color: '#fff',
        textTransform: 'none',
        fontWeight: 600,
        '&:hover': {
            backgroundColor: '#22863a',
        },
    },
    cancelBtn: {
        textTransform: 'none',
        color: '#9d9d9d',
        borderColor: '#555',
        '&:hover': {
            borderColor: '#888',
        },
    },
    badge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 3,
        fontSize: 11,
        fontFamily: 'monospace',
        fontWeight: 600,
        letterSpacing: 0.5,
    },
    readOnlyBadge: {
        backgroundColor: '#2a2a2a',
        color: '#858585',
        border: '1px solid #444',
    },
    editingBadge: {
        backgroundColor: '#0e639c22',
        color: '#4dc3f7',
        border: '1px solid #0e639c66',
    },
    savedBadge: {
        backgroundColor: '#28a74522',
        color: '#85e89d',
        border: '1px solid #28a74566',
    },
    errorAlert: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 12px',
        borderRadius: 4,
        backgroundColor: '#3a1a1a',
        border: '1px solid #e74c3c',
        color: '#f97171',
        marginBottom: theme.spacing(1),
        fontSize: 13,
    },
}));

export interface SwaggerEditorProps {
    value: string;
    readOnly: boolean;
    onChange?: (val: string) => void;
    isEditing?: boolean;
    isSaving?: boolean;
    saveSuccess?: boolean;
    saveError?: string;
    hasWritePermission?: boolean;
    onEdit?: () => void;
    onSave?: () => void;
    onCancel?: () => void;
}

export const SwaggerEditorPanel = ({
    value,
    readOnly,
    onChange,
    isEditing = false,
    isSaving = false,
    saveSuccess = false,
    saveError,
    hasWritePermission = false,
    onEdit = () => {},
    onSave = () => {},
    onCancel = () => {},
}: SwaggerEditorProps) => {
    const classes = useStyles();

    // Detect if content looks like YAML or JSON
    const lang = value.trimStart().startsWith('{') ? 'JSON' : 'YAML';

    // Status badge
    const badge = saveSuccess
        ? <span className={`${classes.badge} ${classes.savedBadge}`}>✓ Saved</span>
        : isEditing
            ? <span className={`${classes.badge} ${classes.editingBadge}`}>● EDITING</span>
            : null;

    const handleDownload = () => {
        const ext = lang.toLowerCase() === 'json' ? 'json' : 'yaml';
        const blob = new Blob([value], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `source-definition.${ext}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    return (
        <div className={classes.editorContainer}>
            {/* VS Code-style title bar */}
            <div className={classes.editorHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <Typography className={classes.editorLang}>
                        swagger.{lang.toLowerCase()}
                    </Typography>
                    {badge}
                </div>
                <div className={classes.editorActions}>
                    {/* Save success/error feedback */}
                    {saveSuccess && !isEditing && (
                        <span style={{ color: '#85e89d', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                            <CheckCircleOutlineIcon style={{ fontSize: 14 }} /> Definition updated
                        </span>
                    )}

                    {/* Download button */}
                    {!isEditing && (
                        <Tooltip title="Download definition">
                            <Button
                                id="swagger-download-btn"
                                size="small"
                                variant="outlined"
                                startIcon={<GetAppIcon />}
                                onClick={handleDownload}
                                style={{
                                    color: '#d4d4d4',
                                    borderColor: '#555',
                                    textTransform: 'none',
                                }}
                            >
                                Download
                            </Button>
                        </Tooltip>
                    )}

                    {/* Edit mode buttons */}
                    {isEditing && (
                        <>
                            <Button
                                id="swagger-cancel-btn"
                                size="small"
                                variant="outlined"
                                startIcon={<CancelIcon />}
                                onClick={onCancel}
                                className={classes.cancelBtn}
                                disabled={isSaving}
                            >
                                Cancel
                            </Button>
                            <Button
                                id="swagger-save-btn"
                                size="small"
                                variant="contained"
                                startIcon={isSaving ? <CircularProgress size={14} style={{ color: '#fff' }} /> : <SaveIcon />}
                                onClick={onSave}
                                className={classes.saveBtn}
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving…' : 'Save Changes'}
                            </Button>
                        </>
                    )}

                    {/* Edit button — only for write users in read-only mode */}
                    {!isEditing && hasWritePermission && (
                        <Tooltip title="Edit swagger definition and update in WSO2 Publisher">
                            <Button
                                id="swagger-edit-btn"
                                size="small"
                                variant="contained"
                                startIcon={<EditIcon />}
                                onClick={onEdit}
                                className={classes.editBtn}
                            >
                                Edit
                            </Button>
                        </Tooltip>
                    )}
                </div>
            </div>

            {/* Error alert below header */}
            {saveError && (
                <div className={classes.errorAlert}>
                    <span>⚠</span> {saveError}
                </div>
            )}

            {/* The editor itself */}
            <textarea
                id="swagger-editor-textarea"
                className={classes.monacoTextarea}
                value={value}
                readOnly={readOnly}
                onChange={e => onChange?.(e.target.value)}
                rows={Math.max(25, value.split('\n').length + 2)}
                spellCheck={false}
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                style={{
                    cursor: readOnly ? 'default' : 'text',
                    opacity: readOnly ? 0.85 : 1,
                }}
            />

            {/* Bottom status bar like VS Code */}
            <Box style={{
                backgroundColor: isEditing ? '#0e639c' : '#007acc',
                color: '#fff',
                display: 'flex',
                justifyContent: 'space-between',
                padding: '2px 12px',
                fontSize: 11,
                fontFamily: 'monospace',
            }}>
                <span>{lang} · OpenAPI · {value.split('\n').length} lines</span>
                <span>{isEditing ? 'Editing — changes not yet saved' : ''}</span>
            </Box>
        </div>
    );
};
