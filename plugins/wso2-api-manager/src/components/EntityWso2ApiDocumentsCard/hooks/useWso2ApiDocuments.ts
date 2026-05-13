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

import { useState, useMemo } from 'react';
import { Entity } from '@backstage/catalog-model';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { Wso2ApiDocument } from '../../../api';

const WSO2_API_DOCS_ANNOTATION = 'wso2.com/api-documents';
const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

export const useWso2ApiDocuments = (options: {
  entity: Entity;
  propDocuments?: Wso2ApiDocument[];
}) => {
  const { entity, propDocuments } = options;
  const config = useApi(configApiRef);
  const { fetch } = useApi(fetchApiRef);

  const [previewDoc, setPreviewDoc] = useState<Wso2ApiDocument | null>(null);
  const [previewContent, setPreviewContent] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
  const backendUrl = config.getString('backend.baseUrl');

  const documents = useMemo(() => {
    let docs: Wso2ApiDocument[] = [];
    if (propDocuments && propDocuments.length > 0) {
      docs = propDocuments;
    } else {
      try {
        const wso2DocsJson =
          entity.metadata.annotations?.[WSO2_API_DOCS_ANNOTATION] || '[]';
        docs = JSON.parse(wso2DocsJson);
      } catch (e) {
        console.warn('Failed to parse wso2.com/api-documents annotation', e);
      }
    }
    return docs.map((doc: any) => ({
      ...doc,
      id: doc.id || doc.documentId,
    }));
  }, [entity, propDocuments]);

  const handleDownload = async (rowData: Wso2ApiDocument) => {
    const docId = rowData.id || rowData.documentId;
    const { name, sourceType, sourceUrl } = rowData;

    if (sourceType === 'URL') {
      window.open(sourceUrl || '#', '_blank', 'noopener,noreferrer');
      return;
    }

    if (!docId) {
      console.error('Document ID is missing', rowData);
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
      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('Failed to download document content', e);
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
      setPreviewContent('Failed to load content: Missing document ID.');
      return;
    }

    setPreviewDoc(rowData);
    setLoadingPreview(true);
    setPreviewContent(null);

    try {
      const url = `${backendUrl}/api/wso2-api-manager/apis/${apiId}/documents/${docId}/content`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok)
        throw new Error(`Failed to load: ${response.statusText}`);
      const content = await response.text();
      setPreviewContent(content);
    } catch (e) {
      console.error('Failed to load document content', e);
      setPreviewContent('Failed to load content.');
    } finally {
      setLoadingPreview(false);
    }
  };

  return {
    documents,
    previewDoc,
    previewContent,
    loadingPreview,
    setPreviewDoc,
    handleDownload,
    handlePreview,
  };
};
