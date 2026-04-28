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
import {
    Wso2ApiDetail,
    Wso2ApiProductDetail,
} from '../../api';
import { EntityWso2ApiDocumentsCard } from '../EntityWso2ApiDocumentsCard';


const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const API_DOCUMENTS_ANNOTATION = 'wso2.com/api-documents';
const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';


export const EntityWso2ApiOverviewCard = () => {
    // entity: { metadata: { name: 'pizza-shack', annotations: { 'wso2.com/api-id': '...' } }, kind: 'API', ... }
    const { entity } = useEntity();



    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
    const apiDocumentsRaw = entity.metadata.annotations?.[API_DOCUMENTS_ANNOTATION];
    const isSelfHosted = entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION] === 'self-hosted-gateway';

    const apiDocuments = useMemo(() => {
        if (!apiDocumentsRaw) return [];
        try {
            return JSON.parse(apiDocumentsRaw) as any[];
        } catch (e) {
            console.error('Failed to parse WSO2 API documents:', e);
            return [];
        }
    }, [apiDocumentsRaw]);


    const apiRawJson = entity.metadata.annotations?.['wso2.com/api-raw-json'];

    const details = useMemo(() => {
        if (!apiRawJson) return undefined;
        try {
            return JSON.parse(apiRawJson) as Wso2ApiDetail | Wso2ApiProductDetail;
        } catch (e) {
            console.error('Failed to parse WSO2 API raw JSON:', e);
            return undefined;
        }
    }, [apiRawJson]);

    if (!apiId) {
        return (
            <EmptyState
                title="Missing WSO2 API annotation"
                missing="info"
                description={`Add ${WSO2_API_ID_ANNOTATION} to the entity annotations.`}
            />
        );
    }

    if (!details) {
        return (
            <EmptyState
                title="API not found"
                missing="info"
                description="The API metadata could not be found in the Catalog."
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
            { 'endpointURLs' in details && details.endpointURLs && details.endpointURLs.length > 0 && !isSelfHosted && (
                <Grid item xs={12}>
                    <InfoCard title="Gateway Endpoints">
                        <EndpointTable endpoints={details.endpointURLs} />
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



