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

import React, { useEffect } from 'react';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    InfoCard,
    EmptyState,
    Progress,
    WarningPanel,
} from '@backstage/core-components';
import { Wso2ApiDocument } from '../../api';
import { useWso2ApiDocuments } from './hooks/useWso2ApiDocuments';
import { Wso2DocumentPreview } from './components/Wso2DocumentPreview';
import { Wso2DocumentTable } from './components/Wso2DocumentTable';
import { Wso2SingleDocumentView } from './components/Wso2SingleDocumentView';

export interface EntityWso2ApiDocumentsCardProps {
    title?: string;
    documents?: Wso2ApiDocument[];
    loading?: boolean;
    error?: Error;
}

export const EntityWso2ApiDocumentsCard = (props: EntityWso2ApiDocumentsCardProps) => {
    const { documents: propDocuments, loading: propLoading, error: propError } = props;
    const { entity } = useEntity();

    const {
        documents,
        previewDoc,
        previewContent,
        loadingPreview,
        setPreviewDoc,
        handleDownload,
        handlePreview,
    } = useWso2ApiDocuments({ entity, propDocuments });

    // Trigger preview automatically if there is only one document
    useEffect(() => {
        if (documents.length === 1 && !previewDoc && !loadingPreview) {
            const doc = documents[0];
            if (doc.sourceType === 'MARKDOWN' || doc.sourceType === 'INLINE') {
                handlePreview(doc);
            }
        }
    }, [documents, previewDoc, loadingPreview, handlePreview]);

    if (propLoading) {
        return (
            <InfoCard variant="gridItem">
                <Progress />
            </InfoCard>
        );
    }

    if (propError) {
        return (
            <InfoCard variant="gridItem">
                <WarningPanel severity="error" title="Failed to load documents">
                    {propError.message}
                </WarningPanel>
            </InfoCard>
        );
    }

    const renderPreview = () => (
        <Wso2DocumentPreview
            previewDoc={previewDoc}
            previewContent={previewContent}
            loadingPreview={loadingPreview}
            showBackButton={documents.length > 1}
            onBack={() => setPreviewDoc(null)}
            onDownload={handleDownload}
        />
    );

    return (
        <InfoCard variant="gridItem">
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
                        <Wso2SingleDocumentView
                            document={documents[0]}
                            onDownload={handleDownload}
                            renderPreview={renderPreview}
                        />
                    ) : (
                        <Wso2DocumentTable
                            documents={documents}
                            onPreview={handlePreview}
                            onDownload={handleDownload}
                        />
                    )}
                </>
            )}
        </InfoCard>
    );
};
