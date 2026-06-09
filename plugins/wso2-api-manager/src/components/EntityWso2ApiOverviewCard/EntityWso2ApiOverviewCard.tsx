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

/**
 * EntityWso2ApiOverviewCard
 * 
 * A UI component for Backstage API entities that are managed by WSO2 API Manager.
 * It displays:
 * 1. Core API metadata (version, provider, context, lifecycle status) from WSO2.
 * 2. Associated documentation (PDFs, Markdown, links) with download support via the backend proxy.
 */
import { useMemo } from 'react';
import Grid from '@material-ui/core/Grid';
import {
    EmptyState,
    InfoCard,
    Table,
} from '@backstage/core-components';
import Link from '@material-ui/core/Link';
import { useEntity } from '@backstage/plugin-catalog-react';
import { EntityWso2ApiDocumentsCard } from '../EntityWso2ApiDocumentsCard';


const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const API_DOCUMENTS_ANNOTATION = 'wso2.com/api-documents';
const API_ENDPOINTS_ANNOTATION = 'wso2.com/api-endpoints';
const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';


export const EntityWso2ApiOverviewCard = () => {
    // entity: { metadata: { name: 'pizza-shack', annotations: { 'wso2.com/api-id': '...' } }, kind: 'API', ... }
    const { entity } = useEntity();



    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
    const apiDocumentsRaw = entity.metadata.annotations?.[API_DOCUMENTS_ANNOTATION];
    const apiEndpointsRaw = entity.metadata.annotations?.[API_ENDPOINTS_ANNOTATION];
    const isApiPlatform = entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION] === 'api-platform-gateway';

    const apiDocuments = useMemo(() => {
        if (!apiDocumentsRaw) return [];
        try {
            return JSON.parse(apiDocumentsRaw) as any[];
        } catch (e) {
            console.error('Failed to parse WSO2 API documents:', e);
            return [];
        }
    }, [apiDocumentsRaw]);


    const endpoints = useMemo(() => {
        if (!apiEndpointsRaw) return [];
        try {
            return JSON.parse(apiEndpointsRaw) as any[];
        } catch (e) {
            console.error('Failed to parse WSO2 API endpoints:', e);
            return [];
        }
    }, [apiEndpointsRaw]);

    if (!apiId) {
        return (
            <EmptyState
                title="Missing WSO2 API annotation"
                missing="info"
                description={`Add ${WSO2_API_ID_ANNOTATION} to the entity annotations.`}
            />
        );
    }

    return (
        <Grid container spacing={3} alignItems="stretch">
     
            <Grid item xs={12}>
                <EntityWso2ApiDocumentsCard
                    documents={apiDocuments}
                    loading={false}
                />
            </Grid>
            { endpoints.length > 0 && !isApiPlatform && (
                <Grid item xs={12}>
                    <InfoCard title="Gateway Endpoints">
                        <EndpointTable endpoints={endpoints} />
                    </InfoCard>
                </Grid>
            )}
        </Grid>
    );
};

const EndpointTable = ({ endpoints }: { endpoints: any[] }) => {
    const columns = [
        { title: 'Environment', field: 'environmentName' },
        { title: 'Type', field: 'environmentType' },
        { 
            title: 'URLs', 
            field: 'urls',
            render: (rowData: any) => (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                    {rowData.urls?.map((url: string) => (
                        <li key={url}>
                            <Link href={url} target="_blank" rel="noopener noreferrer">
                                {url}
                            </Link>
                        </li>
                    ))}
                </ul>
            )
        },
    ];

    return (
        <Table
            options={{ search: false, paging: false, toolbar: false }}
            columns={columns}
            data={endpoints}
        />
    );
};



