import React, { useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    InfoCard,
    Table,
    EmptyState,
    Progress,
    WarningPanel,
    MarkdownContent,
} from '@backstage/core-components';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import {
    Link,
    Button,
    Box,
    Typography,
    Divider,
    IconButton,
    Chip,
    Paper,
} from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import GetAppIcon from '@material-ui/icons/GetApp';
import { useEffect } from 'react';

import { Wso2ApiDocument } from '../../api';

const WSO2_API_DOCS_ANNOTATION = 'wso2.com/api-documents';
const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const WSO2_ORGANIZATION_ID_ANNOTATION = 'wso2.com/organization-id';
const WSO2_API_DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';

export interface EntityWso2ApiDocumentsCardProps {
    title?: string;
    documents?: Wso2ApiDocument[];
    loading?: boolean;
    error?: Error;
    onRefresh?: () => void;
}

export const EntityWso2ApiDocumentsCard = (props: EntityWso2ApiDocumentsCardProps) => {
    const { title: propTitle, documents: propDocuments, loading: propLoading, error: propError } = props;
    const { entity } = useEntity();
    const config = useApi(configApiRef);
    const { fetch } = useApi(fetchApiRef);

    const [previewDoc, setPreviewDoc] = useState<Wso2ApiDocument | null>(null);
    const [previewContent, setPreviewContent] = useState<string | null>(null);
    const [loadingPreview, setLoadingPreview] = useState(false);
    const [fetchedDocuments, setFetchedDocuments] = useState<Wso2ApiDocument[] | null>(null);
    const [fetchingDocuments, setFetchingDocuments] = useState(false);
    const [fetchError, setFetchError] = useState<Error | null>(null);

    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
    const organizationId = entity.metadata.annotations?.[WSO2_ORGANIZATION_ID_ANNOTATION];
    const discoveryType = entity.metadata.annotations?.[WSO2_API_DISCOVERY_TYPE_ANNOTATION];
    const isSelfHostedGateway = discoveryType === 'self-hosted-gateway';
    const backendUrl = config.getString('backend.baseUrl');

    const handleDownload = async (rowData: Wso2ApiDocument) => {
        const docId = rowData.id || rowData.documentId;
        const { name, sourceType, sourceUrl } = rowData;

        if (sourceType === 'URL') {
            window.open(sourceUrl || '#', '_blank', 'noopener,noreferrer');
            return;
        }

        if (!docId) {
            console.error('Document ID is missing', rowData);
            alert('Cannot download document: Missing ID');
            return;
        }

        try {
            let url = `${backendUrl}/api/wso2-api-manager/apis/${apiId}/documents/${docId}/content`;
            
            if (isSelfHostedGateway && organizationId) {
                // For self-hosted gateway APIs, we fetch directly from Choreo
                url = `https://sts.choreo.dev/api/am/devportal/v2/apis/${apiId}/documents/${docId}/content?organizationId=${organizationId}`;
            }

            const response = await fetch(url, { method: 'GET' });

            if (!response.ok) {
                throw new Error(`Failed to download: ${response.statusText}`);
            }

            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;

            let filename = name;
            let extensionAdded = false;

            const disposition = response.headers.get('content-disposition');
            if (disposition && disposition.indexOf('attachment') !== -1) {
                const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
                const matches = filenameRegex.exec(disposition);
                if (matches != null && matches[1]) {
                    filename = matches[1].replace(/['"]/g, '');
                    extensionAdded = true;
                }
            }

            if (!extensionAdded) {
                if (sourceType === 'MARKDOWN') {
                    filename = `${name}.md`;
                } else if (sourceType === 'INLINE') {
                    filename = `${name}.txt`;
                }
            }

            link.setAttribute('download', filename);
            document.body.appendChild(link);
            link.click();
            link.parentNode?.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
        } catch (e) {
            console.error('Failed to download document content', e);
            alert('Failed to download document content. Check console for details.');
        }
    };

    const handlePreview = async (rowData: Wso2ApiDocument) => {
        const { sourceType } = rowData;
        const docId = rowData.id || rowData.documentId;

        if (sourceType === 'URL') {
            window.open(rowData.sourceUrl || '#', '_blank', 'noopener,noreferrer');
            return;
        }

        if (sourceType !== 'MARKDOWN' && sourceType !== 'INLINE') {
            handleDownload(rowData);
            return;
        }

        if (!docId) {
            console.error('Document ID is missing for preview', rowData);
            setPreviewContent('Failed to load content: Missing document ID.');
            return;
        }

        setPreviewDoc(rowData);
        setLoadingPreview(true);
        setPreviewContent(null);

        try {
            let url = `${backendUrl}/api/wso2-api-manager/apis/${apiId}/documents/${docId}/content`;
            
            if (isSelfHostedGateway && organizationId) {
                url = `https://sts.choreo.dev/api/am/devportal/v2/apis/${apiId}/documents/${docId}/content?organizationId=${organizationId}`;
            }

            const response = await fetch(url, { method: 'GET' });
            if (!response.ok) throw new Error(`Failed to load: ${response.statusText}`);
            const content = await response.text();
            setPreviewContent(content);
        } catch (e) {
            console.error('Failed to load document content', e);
            setPreviewContent('Failed to load content.');
        } finally {
            setLoadingPreview(false);
        }
    };

    const isLoading = propLoading || fetchingDocuments;
    const error = propError || fetchError;

    // Fetch documents if it's a self-hosted gateway API and they aren't provided via props
    useEffect(() => {
        if (isSelfHostedGateway && organizationId && apiId && !propDocuments) {
            const fetchDocs = async () => {
                setFetchingDocuments(true);
                setFetchError(null);
                try {
                    const url = `https://sts.choreo.dev/api/am/devportal/v2/apis/${apiId}/documents?organizationId=${organizationId}`;
                    const response = await fetch(url, { method: 'GET' });
                    if (!response.ok) throw new Error(`Failed to fetch documents: ${response.statusText}`);
                    const data = await response.json();
                    const docs = (data.list || []).map((doc: any) => ({
                        ...doc,
                        id: doc.id || doc.documentId
                    }));
                    setFetchedDocuments(docs);
                } catch (e: any) {
                    console.error('Failed to fetch documents from Choreo:', e);
                    setFetchError(e);
                } finally {
                    setFetchingDocuments(false);
                }
            };
            fetchDocs();
        }
    }, [isSelfHostedGateway, organizationId, apiId, propDocuments, fetch]);

    if (isLoading) {
        return (
            <InfoCard title={propTitle || "WSO2 Documents"} variant="gridItem">
                <Progress />
            </InfoCard>
        );
    }

    if (error) {
        return (
            <InfoCard title={propTitle || "WSO2 Documents"} variant="gridItem">
                <WarningPanel severity="error" title="Failed to load documents">
                    {error.message}
                </WarningPanel>
            </InfoCard>
        );
    }

    let documents: Wso2ApiDocument[] = (propDocuments || fetchedDocuments || []).map((doc: any) => ({
        ...doc,
        id: doc.id || doc.documentId,
    }));

    if (!propDocuments || documents.length === 0) {
        try {
            const wso2DocsJson = entity.metadata.annotations?.[WSO2_API_DOCS_ANNOTATION] || '[]';
            documents = JSON.parse(wso2DocsJson).map((doc: any) => ({
                ...doc,
                id: doc.id || doc.documentId,
            }));
        } catch (e) {
            console.warn('Failed to parse wso2.com/api-documents annotation', e);
        }
    }

    const columns = [
        {
            title: 'Name',
            field: 'name',
            render: (rowData: Wso2ApiDocument) => (
                <Link
                    href="#"
                    onClick={(e: React.MouseEvent) => {
                        e.preventDefault();
                        if (rowData.sourceType === 'MARKDOWN' || rowData.sourceType === 'INLINE') {
                            handlePreview(rowData);
                        } else {
                            handleDownload(rowData);
                        }
                    }}
                    style={{ color: '#0A66C2', textDecoration: 'underline', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    {rowData.name}
                </Link>
            )
        },
        { 
            title: 'Type', 
            field: 'type',
            render: (rowData: Wso2ApiDocument) => (
                <Chip size="small" label={rowData.type} variant="outlined" />
            )
        },
        { 
            title: 'Source', 
            field: 'sourceType',
            render: (rowData: Wso2ApiDocument) => {
                const isPreviewable = rowData.sourceType === 'MARKDOWN' || rowData.sourceType === 'INLINE';
                return (
                    <Typography variant="body2" color="textSecondary">
                        {rowData.sourceType} {isPreviewable ? '(Previewable)' : ''}
                    </Typography>
                );
            }
        },
        { title: 'Summary', field: 'summary' }
    ];

    // Trigger preview automatically if there is only one document
    useEffect(() => {
        if (documents.length === 1 && !previewDoc && !loadingPreview) {
            const doc = documents[0];
            if (doc.sourceType === 'MARKDOWN' || doc.sourceType === 'INLINE') {
                handlePreview(doc);
            }
        }
    }, [documents]);

    const renderPreview = () => {
        if (!previewDoc) return null;

        return (
            <Box>
                <Box display="flex" alignItems="center" mb={2} justifyContent="space-between">
                    <Box display="flex" alignItems="center">
                        {documents.length > 1 && (
                            <IconButton onClick={() => setPreviewDoc(null)} style={{ marginRight: 8 }}>
                                <ArrowBackIcon />
                            </IconButton>
                        )}
                        {/* Title moved inside Paper */}
                    </Box>
                    {previewDoc.sourceType !== 'INLINE' && previewDoc.sourceType !== 'MARKDOWN' && (
                        <Button
                            startIcon={<GetAppIcon />}
                            onClick={() => handleDownload(previewDoc)}
                            variant="outlined"
                            size="small"
                        >
                            Download
                        </Button>
                    )}
                </Box>
                <Divider />
                <Box mt={2}>
                    {loadingPreview ? (
                        <Progress />
                    ) : (
                        <Paper 
                            elevation={3} 
                            style={{ 
                                backgroundColor: '#fff', 
                                color: '#000', 
                                padding: '40px', 
                                maxHeight: 'calc(100vh - 300px)',
                                overflowY: 'auto',
                                minHeight: '500px',
                                border: '1px solid #eee'
                            }}
                        >
                            <Typography variant="h4" style={{ fontWeight: 700, marginBottom: 16 }}>
                                {previewDoc.name}
                            </Typography>
                            <Box mb={4} display="flex" style={{ gap: '12px' }}>
                                <Chip size="small" label={previewDoc.type} />
                                <Chip size="small" label={previewDoc.sourceType} variant="outlined" />
                            </Box>
                            <Divider style={{ marginBottom: 32 }} />
                            
                            {previewDoc.sourceType === 'MARKDOWN' || previewDoc.sourceType === 'INLINE' ? (
                                <MarkdownContent content={previewContent || ''} />
                            ) : (
                                <pre style={{ 
                                    whiteSpace: 'pre-wrap', 
                                    fontFamily: 'monospace',
                                    fontSize: '0.9rem',
                                    lineHeight: 1.6
                                }}>
                                    {previewContent}
                                </pre>
                            )}
                        </Paper>
                    )}
                </Box>
            </Box>
        );
    };

    const renderSingleDocView = () => {
        const doc = documents[0];
        const isPreviewable = doc.sourceType === 'MARKDOWN' || doc.sourceType === 'INLINE';

        if (isPreviewable && previewDoc) {
            return renderPreview();
        }

        return (
            <Box p={2} textAlign="center" border={1} borderColor="divider" borderRadius={4}>
                <Typography variant="h5" gutterBottom>{doc.name}</Typography>
                <Box mb={2}>
                    <Chip label={doc.type} color="primary" variant="outlined" style={{ marginRight: 8 }} />
                    <Chip label={doc.sourceType} variant="outlined" />
                </Box>
                <Typography variant="body1" color="textSecondary" paragraph>
                    {doc.summary || "This API has a single documentation resource available."}
                </Typography>
                <Box mt={2}>
                    {doc.sourceType !== 'INLINE' && doc.sourceType !== 'MARKDOWN' && (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<GetAppIcon />}
                            onClick={() => handleDownload(doc)}
                        >
                            Download Document
                        </Button>
                    )}
                </Box>
            </Box>
        );
    };

    return (
        <InfoCard 
            title={propTitle || "WSO2 Documents"} 
            variant="gridItem"
        >
            {documents.length === 0 ? (
                <EmptyState
                    title="No documents"
                    missing="info"
                    description="This API has no documents attached in WSO2 API Manager."
                />
            ) : (
                <>
                    {previewDoc && documents.length > 1 ? (
                        renderPreview()
                    ) : documents.length === 1 ? (
                        renderSingleDocView()
                    ) : (
                        <Table
                            options={{ paging: documents.length > 5, search: false }}
                            columns={columns}
                            data={documents}
                        />
                    )}
                </>
            )}
        </InfoCard>
    );
};
