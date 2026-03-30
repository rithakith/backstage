import React, { useState, useEffect } from 'react';
import {
    WarningPanel,
} from '@backstage/core-components';
import { useTheme } from '@material-ui/core/styles';
import { useApi } from '@backstage/core-plugin-api';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogTitle from '@material-ui/core/DialogTitle';
import DialogContent from '@material-ui/core/DialogContent';
import DialogActions from '@material-ui/core/DialogActions';
import TextField from '@material-ui/core/TextField';
import MenuItem from '@material-ui/core/MenuItem';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import Box from '@material-ui/core/Box';
import CircularProgress from '@material-ui/core/CircularProgress';
import FormHelperText from '@material-ui/core/FormHelperText';
import Radio from '@material-ui/core/Radio';
import RadioGroup from '@material-ui/core/RadioGroup';
import FormControlLabel from '@material-ui/core/FormControlLabel';
import FormLabel from '@material-ui/core/FormLabel';

import HelpOutlineIcon from '@material-ui/icons/HelpOutline';
import CodeIcon from '@material-ui/icons/Code';
import ForumIcon from '@material-ui/icons/Forum';
import VideoLabelIcon from '@material-ui/icons/VideoLabel';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import InsertDriveFileIcon from '@material-ui/icons/InsertDriveFile';

import { wso2ApiManagerApiRef, wso2AuthApiRef, Wso2ApiDocumentCreate } from '../../api';

export interface AddDocumentDialogProps {
    open: boolean;
    onClose: () => void;
    apiId: string;
    onSuccess: () => void;
}

export const AddDocumentDialog = (props: AddDocumentDialogProps) => {
    const { open, onClose, apiId, onSuccess } = props;
    const theme = useTheme();
    const apiClient = useApi(wso2ApiManagerApiRef);
    const authApi = useApi(wso2AuthApiRef);

    const [activeStep, setActiveStep] = useState(0);
    const [isSubmitting, setSubmitting] = useState(false);
    const [nameError, setNameError] = useState<string | null>(null);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [isValidating, setValidating] = useState(false);

    const [formData, setFormData] = useState<Wso2ApiDocumentCreate & { file?: File | null }>({
        name: '',
        type: 'HOWTO',
        summary: '',
        sourceType: 'INLINE',
        sourceUrl: '',
        inlineContent: '',
        otherTypeName: '',
        visibility: 'API_LEVEL',
        file: null,
    });

    // Reset step when dialog opens
    useEffect(() => {
        if (open) {
            setActiveStep(0);
            setSubmitError(null);
        }
    }, [open]);

    // Debounced name validation
    useEffect(() => {
        let ignore = false;

        if (!formData.name || !apiId || !open || activeStep !== 0) {
            setNameError(null);
            return undefined;
        }

        const timer = setTimeout(async () => {
            if (ignore) return;
            setValidating(true);
            try {
                const token = await authApi.getAccessToken(['apim:api_view', 'apim:api_create', 'apim:api_publish']);
                const isValid = await apiClient.validateDocumentName(apiId, formData.name, token);
                
                if (!ignore) {
                    console.log(`🔍 [WSO2-AddDoc] Validation for "${formData.name}": ${isValid}`);
                    setNameError(isValid ? null : 'Duplicate document name');
                }
            } catch (e: any) {
                if (!ignore) {
                    console.error('Validation failed', e);
                    setNameError(`Validation failed: ${e.message || 'Check logs'}`);
                }
            } finally {
                if (!ignore) setValidating(false);
            }
        }, 500);

        return () => {
            ignore = true;
            clearTimeout(timer);
        };
    }, [formData.name, apiId, apiClient, authApi, open, activeStep]);
    
    // Clear validation error immediately when typing
    useEffect(() => {
        if (formData.name) {
            setNameError(null);
        }
    }, [formData.name]);

    const handleFormChange = (e: React.ChangeEvent<any>) => {
        const { name, value } = e.target;
        setFormData(prev => {
            const newData = { ...prev, [name as string]: value };
            // If type is a forum, force sourceType to URL as requested
            if (name === 'type' && (value === 'PUBLIC_FORUM' || value === 'SUPPORT_FORUM')) {
                newData.sourceType = 'URL';
            }
            return newData;
        });
        
        if (name === 'summary' && value.trim() !== '') {
            setSummaryError(null);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            setFormData(prev => ({ ...prev, file: selectedFile }));
        }
    };

    const handleNext = () => {
        if (!formData.summary) {
            setSummaryError('Summary is required');
            return;
        }
        if (nameError || isValidating) return;

        if (formData.sourceType === 'INLINE' || formData.sourceType === 'MARKDOWN') {
            setActiveStep(1);
        } else {
            handleSubmit();
        }
    };

    const handleSubmit = async () => {
        if (!apiId || nameError || isValidating) return;

        setSubmitting(true);
        setSubmitError(null);

        try {
            const token = await authApi.getAccessToken(['apim:api_view', 'apim:api_create', 'apim:api_publish']);
            
            // 1. Create metadata
            const docToCreate: Wso2ApiDocumentCreate = {
                name: formData.name,
                type: formData.type,
                summary: formData.summary,
                sourceType: formData.sourceType,
                sourceUrl: formData.sourceUrl,
                visibility: formData.visibility,
                otherTypeName: formData.type === 'OTHER' ? formData.otherTypeName : undefined,
            };

            const newDoc = await apiClient.addDocument(apiId, docToCreate, token);

            // 2. Upload content if needed
            if (formData.sourceType === 'INLINE' || formData.sourceType === 'MARKDOWN') {
                await apiClient.addDocumentContent(apiId, newDoc.id!, formData.inlineContent || '', undefined, token);
            } else if (formData.sourceType === 'FILE' && formData.file) {
                await apiClient.addDocumentContent(apiId, newDoc.id!, formData.file, formData.file.name, token);
            }

            onSuccess();
        } catch (e: any) {
            setSubmitError(e.message || 'Failed to add document');
            if (activeStep === 1) setActiveStep(1); // Stay on step 2 if submission from there fails
        } finally {
            setSubmitting(false);
        }
    };

    const TypeOption = ({ value, label, icon: IconComp }: { value: string, label: string, icon: any }) => {
        const isSelected = formData.type === value;
        return (
            <FormControlLabel
                value={value}
                control={<Radio color="primary" style={{ display: 'none' }} />}
                label={
                    <Box display="flex" flexDirection="column" alignItems="center" p={2} minWidth={120}>
                        <IconComp 
                            fontSize="large" 
                            style={{ color: isSelected ? theme.palette.primary.main : theme.palette.action.active }} 
                        />
                        <Box mt={1} fontWeight={isSelected ? 'bold' : 'normal'} color={isSelected ? 'primary.main' : 'text.primary'}>
                            {label}
                        </Box>
                    </Box>
                }
                style={{ 
                    border: `2px solid ${isSelected ? theme.palette.primary.main : theme.palette.divider}`,
                    borderRadius: 12,
                    margin: 8,
                    padding: 0,
                    backgroundColor: isSelected ? theme.palette.action.selected : 'transparent',
                    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: isSelected ? theme.shadows[2] : 'none',
                    cursor: 'pointer',
                    flex: '1 1 auto'
                }}
            />
        );
    };

    const renderStep0 = () => (
        <Box display="flex" flexDirection="column" gridGap={24}>
            <TextField
                label="Name"
                name="name"
                variant="outlined"
                fullWidth
                required
                value={formData.name}
                onChange={handleFormChange}
                error={Boolean(nameError)}
                helperText={nameError || (isValidating ? 'Validating...' : (formData.name ? 'Name is available' : 'Provide the name for the document'))}
                FormHelperTextProps={{
                    style: { color: nameError ? theme.palette.error.main : (isValidating ? theme.palette.text.secondary : theme.palette.success.main) }
                }}
                InputProps={{
                    endAdornment: isValidating ? <CircularProgress size={20} /> : null,
                }}
            />

            <TextField
                label="Summary"
                name="summary"
                variant="outlined"
                fullWidth
                multiline
                rows={3}
                required
                value={formData.summary}
                onChange={handleFormChange}
                error={Boolean(summaryError)}
                helperText={summaryError || 'Provide a brief description for the document'}
            />

            <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend" style={{ marginBottom: 8 }}>Type</FormLabel>
                <RadioGroup
                    name="type"
                    value={formData.type}
                    onChange={handleFormChange}
                    style={{ flexDirection: 'row', justifyContent: 'flex-start', flexWrap: 'wrap' }}
                >
                    <TypeOption value="HOWTO" label="How To" icon={HelpOutlineIcon} />
                    <TypeOption value="SAMPLES" label="Sample and SDK" icon={CodeIcon} />
                    <TypeOption value="PUBLIC_FORUM" label="Public Forum" icon={ForumIcon} />
                    <TypeOption value="SUPPORT_FORUM" label="Support Forum" icon={ForumIcon} />
                    <TypeOption value="OTHER" label="Other" icon={VideoLabelIcon} />
                </RadioGroup>
            </FormControl>

            {formData.type === 'OTHER' && (
                <TextField
                    label="Other Document Type"
                    name="otherTypeName"
                    variant="outlined"
                    fullWidth
                    required
                    value={formData.otherTypeName}
                    onChange={handleFormChange}
                    helperText="Provide the document type"
                />
            )}

            <FormControl component="fieldset" fullWidth>
                <FormLabel component="legend" style={{ marginBottom: 8 }}>
                    Source { (formData.type === 'PUBLIC_FORUM' || formData.type === 'SUPPORT_FORUM') && '(Restricted to URL for Forum types)' }
                </FormLabel>
                <RadioGroup
                    name="sourceType"
                    value={formData.sourceType}
                    onChange={handleFormChange}
                    style={{ flexDirection: 'row' }}
                >
                    <FormControlLabel 
                        value="INLINE" 
                        disabled={formData.type === 'PUBLIC_FORUM' || formData.type === 'SUPPORT_FORUM'} 
                        control={<Radio color="primary" />} 
                        label="Inline" 
                    />
                    <FormControlLabel 
                        value="MARKDOWN" 
                        disabled={formData.type === 'PUBLIC_FORUM' || formData.type === 'SUPPORT_FORUM'} 
                        control={<Radio color="primary" />} 
                        label="Markdown" 
                    />
                    <FormControlLabel value="URL" control={<Radio color="primary" />} label="URL" />
                    <FormControlLabel 
                        value="FILE" 
                        disabled={formData.type === 'PUBLIC_FORUM' || formData.type === 'SUPPORT_FORUM'} 
                        control={<Radio color="primary" />} 
                        label="File" 
                    />
                </RadioGroup>
            </FormControl>

            {formData.sourceType === 'URL' && (
                <TextField
                    label="URL"
                    name="sourceUrl"
                    variant="outlined"
                    fullWidth
                    required
                    value={formData.sourceUrl}
                    onChange={handleFormChange}
                    helperText="Provide the URL to the source"
                />
            )}

            {(formData.sourceType === 'INLINE' || formData.sourceType === 'MARKDOWN') && (
                <Box 
                    bgcolor={theme.palette.info.main + '20'} 
                    p={2} 
                    borderRadius={8} 
                    border={`1px solid ${theme.palette.info.main}`}
                    display="flex"
                    alignItems="flex-start"
                >
                    <Box mr={2} mt={0.5} color={theme.palette.info.main}>
                        <HelpOutlineIcon />
                    </Box>
                    <Box color={theme.palette.info.contrastText || 'inherit'}>
                        <Box fontWeight="bold" fontSize="1rem" mb={0.5}>Content update info</Box>
                        <Box fontSize="0.9rem">
                            Please proceed to the next step. The document content can be edited there.
                        </Box>
                    </Box>
                </Box>
            )}

            {formData.sourceType === 'FILE' && (
                <Box>
                    <input
                        accept="*/*"
                        style={{ display: 'none' }}
                        id="document-file-upload"
                        type="file"
                        onChange={handleFileChange}
                    />
                    <label htmlFor="document-file-upload" style={{ width: '100%', cursor: 'pointer' }}>
                        <Box 
                            border={`2px dashed ${theme.palette.primary.main}`}
                            borderRadius={12} 
                            p={4} 
                            display="flex" 
                            flexDirection="column" 
                            alignItems="center"
                            bgcolor={theme.palette.action.hover}
                            style={{ transition: 'background-color 0.2s' }}
                            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = theme.palette.action.selected; }}
                            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = theme.palette.action.hover; }}
                        >
                            {!formData.file ? (
                                <>
                                    <CloudUploadIcon style={{ fontSize: 56, color: theme.palette.primary.main }} />
                                    <Box mt={2}>Drag and drop a file here, or click to select a file to upload</Box>
                                </>
                            ) : (
                                <>
                                    <InsertDriveFileIcon style={{ fontSize: 56, color: theme.palette.primary.main }} />
                                    <Box mt={2} fontWeight="bold">{formData.file.name}</Box>
                                    <Box mt={1} fontSize="caption.fontSize" color="text.secondary">
                                        Click to change file
                                    </Box>
                                </>
                            )}
                        </Box>
                    </label>
                    {!formData.file && (
                        <FormHelperText error>Please select a file to upload</FormHelperText>
                    )}
                </Box>
            )}
        </Box>
    );

    const renderStep1 = () => (
        <Box display="flex" flexDirection="column" gridGap={16}>
            <Box px={1} py={1} bgcolor={theme.palette.background.default} borderRadius={4}>
                <Box fontSize="caption.fontSize" color="textSecondary">Document Name</Box>
                <Box fontWeight="bold">{formData.name}</Box>
            </Box>
            <TextField
                label={`Edit ${formData.sourceType === 'MARKDOWN' ? 'Markdown' : 'Inline'} Content`}
                name="inlineContent"
                variant="outlined"
                fullWidth
                multiline
                rows={15}
                required
                value={formData.inlineContent}
                onChange={handleFormChange}
                placeholder="Enter document content here..."
                autoFocus
            />
        </Box>
    );

    return (
        <Dialog open={open} onClose={() => !isSubmitting && onClose()} maxWidth="md" fullWidth>
            <DialogTitle>
                {activeStep === 0 ? 'Add New Document' : 'Edit Content'}
            </DialogTitle>
            <DialogContent dividers>
                {submitError && (
                    <Box mb={2}>
                        <WarningPanel severity="error" message={submitError} />
                    </Box>
                )}
                {activeStep === 0 ? renderStep0() : renderStep1()}
            </DialogContent>
            <DialogActions>
                <Button 
                    onClick={() => activeStep === 1 ? setActiveStep(0) : onClose()} 
                    disabled={isSubmitting}
                >
                    {activeStep === 1 ? 'Back' : 'Cancel'}
                </Button>
                <Button 
                    onClick={activeStep === 0 ? handleNext : handleSubmit} 
                    color="primary" 
                    variant="contained" 
                    disabled={isSubmitting || Boolean(nameError) || isValidating || (formData.sourceType === 'FILE' && !formData.file) || !formData.summary}
                >
                    {isSubmitting ? (
                        <CircularProgress size={24} color="inherit" />
                    ) : (
                        (activeStep === 0 && (formData.sourceType === 'INLINE' || formData.sourceType === 'MARKDOWN')) ? 'Next' : 'Add'
                    )}
                </Button>
            </DialogActions>
        </Dialog>
    );
};
