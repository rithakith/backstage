/**
 * EntityWso2ApiOverviewCard
 * 
 * A UI component for Backstage API entities that are managed by WSO2 API Manager.
 * It displays:
 * 1. Core API metadata (version, provider, context, lifecycle status) from WSO2.
 * 2. Associated documentation (PDFs, Markdown, links) with download support via the backend proxy.
 */
import { useAsync, useAsyncRetry } from 'react-use';
import { useMemo } from 'react';
import Grid from '@material-ui/core/Grid';
import {
    EmptyState,
    InfoCard,
    Progress,
    StructuredMetadataTable,
    Table,
    WarningPanel,
} from '@backstage/core-components';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import Link from '@material-ui/core/Link';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    Wso2ApiDetail,
    Wso2ApiProductDetail,
    Wso2ApiProductResource,
    Wso2ApiDocument,
    wso2ApiManagerApiRef,
    wso2AuthApiRef,
} from '../../api';
import { EntityWso2ApiDocumentsCard } from '../EntityWso2ApiDocumentsCard';


const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const IS_API_PRODUCT_ANNOTATION = 'wso2.com/is-api-product';
const PRODUCT_RESOURCES_ANNOTATION = 'wso2.com/product-resources';

export const EntityWso2ApiOverviewCard = () => {
    // entity: { metadata: { name: 'pizza-shack', annotations: { 'wso2.com/api-id': '...' } }, kind: 'API', ... }
    const { entity } = useEntity();

    // apiClient: Interface providing getApi(id), listDocuments(id), etc.
    const apiClient = useApi(wso2ApiManagerApiRef);

    // oauthApi: Interface showing getAccessToken(['scope1', 'scope2'], { optional: true })
    const oauthApi = useApi(wso2AuthApiRef);

    // apiId: A string ID from the entity annotations (e.g., '7a9b3c4d-...')
    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
    const isApiProduct = entity.metadata.annotations?.[IS_API_PRODUCT_ANNOTATION] === 'true';
    const productResourcesRaw = entity.metadata.annotations?.[PRODUCT_RESOURCES_ANNOTATION];

    const productResources = useMemo(() => {
        if (!productResourcesRaw) return [];
        try {
            return JSON.parse(productResourcesRaw) as Wso2ApiProductResource[];
        } catch (e) {
            console.error('Failed to parse WSO2 product resources:', e);
            return [];
        }
    }, [productResourcesRaw]);

    // config: Access to app-config.yaml settings
    const config = useApi(configApiRef);

    // fetch: A wrapper around the browser fetch API with built-in auth for Backstage backends
    const { fetch } = useApi(fetchApiRef);

    // backendUrl: The root URL of the Backstage backend (e.g., 'http://localhost:7007')
    const backendUrl = config.getString('backend.baseUrl');

    // Get the user's Asgardeo OAuth token from existing session
    const tokenState = useAsync(async () => {
        console.log('🔑 [WSO2-EntityCard] Attempting to retrieve Asgardeo OAuth token from session...');
        try {
            const token = await oauthApi.getAccessToken(
                ['openid', 'profile', 'email', 'apim:api_view', 'apim:subscribe'],
                { optional: true },
            );
            if (token) {
                console.log('✅ [WSO2-EntityCard] Asgardeo OAuth token retrieved from session');
                console.log(`📊 [WSO2-EntityCard] Token length: ${token.length} characters`);
            } else {
                console.warn('⚠️ [WSO2-EntityCard] No OAuth token in session');
            }
            return token;
        } catch (error) {
            console.error('❌ [WSO2-EntityCard] Failed to get Asgardeo OAuth token:', error);
            return undefined;
        }
    }, [oauthApi]);

    const apiDetailState = useAsync(async () => {
        if (!apiId) {
            return undefined;
        }
        if (isApiProduct) {
            return apiClient.getApiProduct(apiId, tokenState.value);
        }
        return apiClient.getApi(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value, isApiProduct]);

    const apiDocumentsState = useAsyncRetry(async () => {
        if (!apiId) {
            return undefined;
        }
        return apiClient.listDocuments(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value]);

    if (!apiId) {
        return (
            <EmptyState
                title="Missing WSO2 API annotation"
                missing="info"
                description={`Add ${WSO2_API_ID_ANNOTATION} to the entity annotations.`}
            />
        );
    }

    if (apiDetailState.loading) {
        return <Progress />;
    }

    if (apiDetailState.error) {
        return (
            <WarningPanel
                title="Failed to load WSO2 API"
                message={apiDetailState.error.message}
            />
        );
    }

    const details = apiDetailState.value;

    if (!details) {
        return (
            <EmptyState
                title="API not found"
                missing="info"
                description="The API could not be loaded from WSO2 API Manager."
            />
        );
    }

    return (
        <Grid container spacing={3} alignItems="stretch">
            <Grid item xs={12} md={6}>
                <InfoCard title="WSO2 API details">
                    <ApiDetails details={details} />
                </InfoCard>
            </Grid>
            <Grid item xs={12} md={6}>
                <EntityWso2ApiDocumentsCard
                    title="WSO2 documents"
                    documents={apiDocumentsState.value?.documents}
                    loading={apiDocumentsState.loading}
                    error={apiDocumentsState.error}
                    onRefresh={apiDocumentsState.retry}
                />
            </Grid>
            {isApiProduct && productResources.length > 0 && (
                <Grid item xs={12}>
                    <InfoCard title="Resources">
                        <ProductResourcesTable resources={productResources} />
                    </InfoCard>
                </Grid>
            )}
        </Grid>
    );
};

const ProductResourcesTable = ({ resources }: { resources: Wso2ApiProductResource[] }) => {
    const columns = [
        { 
            title: 'API Name', 
            field: 'name',
            render: (rowData: any) => (
                <Link
                  href={`/catalog/default/api/${rowData.name.toLowerCase()}`}
                  style={{ fontWeight: 'bold', color: '#007acc' }}
                >
                  {rowData.name}
                </Link>
            ),
        },
        { title: 'Version', field: 'version' },
        { title: 'Path', field: 'target' },
        { 
            title: 'Method', 
            field: 'verb',
            render: (rowData: any) => (
                <span style={{ 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    backgroundColor: getVerbColor(rowData.verb),
                    color: '#fff',
                    fontWeight: 'bold',
                    fontSize: '0.8rem'
                }}>
                    {rowData.verb}
                </span>
            )
        },
    ];

    const data = resources.flatMap(res => 
        res.operations.map(op => ({
            name: res.name,
            version: res.version,
            target: op.target,
            verb: op.verb,
        }))
    );

    return (
        <Table
            options={{ search: true, paging: true, pageSize: 5 }}
            columns={columns}
            data={data}
        />
    );
};

const getVerbColor = (verb: string) => {
    switch (verb.toUpperCase()) {
        case 'GET': return '#61affe';
        case 'POST': return '#49cc90';
        case 'PUT': return '#fca130';
        case 'DELETE': return '#f93e3e';
        case 'PATCH': return '#50e3c2';
        default: return '#999';
    }
};

const ApiDetails = ({ details }: { details: Wso2ApiDetail | Wso2ApiProductDetail }) => {
    const metadata: Record<string, string> = {
        Name: details.name,
    };

    if (details.version) {
        metadata.Version = details.version;
    }
    if (details.provider) {
        metadata.Provider = details.provider;
    }
    if (details.context) {
        metadata.Context = details.context;
    }
    if (details.lifeCycleStatus) {
        metadata.Status = details.lifeCycleStatus;
    }
    if (details.type) {
        metadata.Type = details.type;
    }
    if (details.description) {
        metadata.Description = details.description;
    }

    return <StructuredMetadataTable metadata={metadata} />;
};
