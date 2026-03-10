import React from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    InfoCard,
    Table,
    EmptyState,
} from '@backstage/core-components';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import Link from '@material-ui/core/Link';

const WSO2_API_DOCS_ANNOTATION = 'wso2.com/api-documents';
const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

export const EntityWso2ApiDocumentsCard = () => {
    const { entity } = useEntity();
    const config = useApi(configApiRef);

    const wso2DocsJson = entity.metadata.annotations?.[WSO2_API_DOCS_ANNOTATION] || '[]';
    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
    const backendUrl = config.getString('backend.baseUrl');
    const { fetch } = useApi(fetchApiRef);

    const handleDownload = async (rowData: any) => {
        const { name, sourceType, sourceUrl } = rowData;
        const docId = rowData.documentId || rowData.id;

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

            // Attempt to extract real filename from content-disposition
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


    let apimDocs: any[] = [];
    try {
        apimDocs = JSON.parse(wso2DocsJson);
    } catch (e) {
        console.warn('Failed to parse wso2.com/api-documents annotation', e);
    }

    if (!apimDocs || apimDocs.length === 0) {
        return (
            <InfoCard title="WSO2 Documents">
                <EmptyState
                    title="No documents"
                    missing="info"
                    description="This API has no documents attached in WSO2 API Manager."
                />
            </InfoCard>
        );
    }

    const columns = [
        {
            title: 'Name',
            field: 'name',
            render: (rowData: any) => {
                // Determine document ID. According to WSO2 APIs it might be in `rowData.documentId` or `rowData.id`.
                const docId = rowData.documentId || rowData.id;

                return (
                    <Link
                        href="#"
                        onClick={(e: React.MouseEvent) => {
                            e.preventDefault();
                            handleDownload({ ...rowData, documentId: docId });
                        }}
                        style={{ color: '#0A66C2', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                        {rowData.name}
                    </Link>
                );
            }
        },
        { title: 'Type', field: 'type' },
        { title: 'Source Type', field: 'sourceType' },
        { title: 'Summary', field: 'summary' }
    ];

    return (
        <InfoCard title="WSO2 Documents">
            <Table
                options={{ paging: apimDocs.length > 5, search: false }}
                columns={columns}
                data={apimDocs}
            />
        </InfoCard>
    );
};
