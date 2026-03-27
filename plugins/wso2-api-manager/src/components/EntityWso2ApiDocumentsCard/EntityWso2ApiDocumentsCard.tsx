import React, { useState } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    InfoCard,
    Table,
    EmptyState,
    Progress,
    WarningPanel,
} from '@backstage/core-components';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import Link from '@material-ui/core/Link';
import Button from '@material-ui/core/Button';

import { Wso2ApiDocument } from '../../api';
import { wso2PublisherUpdatePermission } from '../../permissions';
import { AddDocumentDialog } from './AddDocumentDialog';

const WSO2_API_DOCS_ANNOTATION = 'wso2.com/api-documents';
const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

export interface EntityWso2ApiDocumentsCardProps {
    title?: string;
    documents?: Wso2ApiDocument[];
    loading?: boolean;
    error?: Error;
    onRefresh?: () => void;
}

export const EntityWso2ApiDocumentsCard = (props: EntityWso2ApiDocumentsCardProps) => {
    const { title: propTitle, documents: propDocuments, loading, error, onRefresh } = props;
    const { entity } = useEntity();
    const config = useApi(configApiRef);
    const { fetch } = useApi(fetchApiRef);

    const [isDialogOpen, setDialogOpen] = useState(false);

    const { allowed: canUpdate } = usePermission({
        permission: wso2PublisherUpdatePermission,
    });

    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
    const backendUrl = config.getString('backend.baseUrl');

    const handleDownload = async (rowData: Wso2ApiDocument) => {
        const { name, sourceType, sourceUrl, id: docId } = rowData;

        if (sourceType === 'URL') {
            window.open(sourceUrl || '#', '_blank', 'noopener,noreferrer');
            return;
        }

        try {
            const url = `${backendUrl}/api/wso2-api-manager/apis/${apiId}/documents/${docId}/content`;
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

    if (loading) {
        return (
            <InfoCard title={propTitle || "WSO2 Documents"} variant="gridItem">
                <Progress />
            </InfoCard>
        );
    }

    if (error) {
        return (
            <InfoCard title={propTitle || "WSO2 Documents"} variant="gridItem">
                <WarningPanel severity="error">
                    Failed to load documents: {error.message}
                </WarningPanel>
            </InfoCard>
        );
    }

    let documents: Wso2ApiDocument[] = propDocuments || [];

    if (!propDocuments) {
        try {
            const wso2DocsJson = entity.metadata.annotations?.[WSO2_API_DOCS_ANNOTATION] || '[]';
            documents = JSON.parse(wso2DocsJson);
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
                        handleDownload(rowData);
                    }}
                    style={{ color: '#0A66C2', textDecoration: 'underline', cursor: 'pointer' }}
                >
                    {rowData.name}
                </Link>
            )
        },
        { title: 'Type', field: 'type' },
        { title: 'Source Type', field: 'sourceType' },
        { title: 'Summary', field: 'summary' }
    ];

    return (
        <InfoCard 
            title={propTitle || "WSO2 Documents"} 
            variant="gridItem"
            action={
                canUpdate && (
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={() => setDialogOpen(true)}
                    >
                        Add Document
                    </Button>
                )
            }
        >
            {documents.length === 0 ? (
                <EmptyState
                    title="No documents"
                    missing="info"
                    description="This API has no documents attached in WSO2 API Manager."
                />
            ) : (
                <Table
                    options={{ paging: documents.length > 5, search: false }}
                    columns={columns}
                    data={documents}
                />
            )}

            {apiId && (
                <AddDocumentDialog
                    open={isDialogOpen}
                    onClose={() => setDialogOpen(false)}
                    apiId={apiId}
                    onSuccess={() => {
                        setDialogOpen(false);
                        if (onRefresh) onRefresh();
                        else window.location.reload();
                    }}
                />
            )}
        </InfoCard>
    );
};
