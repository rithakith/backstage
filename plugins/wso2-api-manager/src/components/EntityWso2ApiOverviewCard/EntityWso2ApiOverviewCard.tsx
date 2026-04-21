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
import { useApi } from '@backstage/core-plugin-api';
import Link from '@material-ui/core/Link';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    Wso2ApiDetail,
    Wso2ApiProductDetail,
    Wso2ApiProductResource,
    Wso2McpDetail,
    Wso2McpTool,
    wso2ApiManagerApiRef,
    wso2AuthApiRef,
} from '../../api';
import { EntityWso2ApiDocumentsCard } from '../EntityWso2ApiDocumentsCard';


const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const IS_API_PRODUCT_ANNOTATION = 'wso2.com/is-api-product';
const PRODUCT_RESOURCES_ANNOTATION = 'wso2.com/product-resources';
const IS_MCP_SERVER_ANNOTATION = 'wso2.com/is-mcp-server';
const MCP_TOOLS_ANNOTATION = 'wso2.com/mcp-tools';
const API_DOCUMENTS_ANNOTATION = 'wso2.com/api-documents';
const API_ENDPOINTS_ANNOTATION = 'wso2.com/api-endpoints';
const BUSINESS_OWNER_ANNOTATION = 'wso2.com/business-owner';
const TECHNICAL_OWNER_ANNOTATION = 'wso2.com/technical-owner';

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
    const isMcpServer = entity.metadata.annotations?.[IS_MCP_SERVER_ANNOTATION] === 'true';
    const mcpToolsRaw = entity.metadata.annotations?.[MCP_TOOLS_ANNOTATION];
    const apiDocumentsRaw = entity.metadata.annotations?.[API_DOCUMENTS_ANNOTATION];

    const productResources = useMemo(() => {
        if (!productResourcesRaw) return [];
        try {
            return JSON.parse(productResourcesRaw) as Wso2ApiProductResource[];
        } catch (e) {
            console.error('Failed to parse WSO2 product resources:', e);
            return [];
        }
    }, [productResourcesRaw]);

    const mcpTools = useMemo(() => {
        if (!mcpToolsRaw) return [];
        try {
            return JSON.parse(mcpToolsRaw) as Wso2McpTool[];
        } catch (e) {
            console.error('Failed to parse WSO2 MCP tools:', e);
            return [];
        }
    }, [mcpToolsRaw]);

    const apiDocuments = useMemo(() => {
        if (!apiDocumentsRaw) return [];
        try {
            return JSON.parse(apiDocumentsRaw) as any[];
        } catch (e) {
            console.error('Failed to parse WSO2 API documents:', e);
            return [];
        }
    }, [apiDocumentsRaw]);


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
        if (isMcpServer) {
            return apiClient.getMcp(apiId, tokenState.value);
        }
        if (isApiProduct) {
            return apiClient.getApiProduct(apiId, tokenState.value);
        }
        return apiClient.getApi(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value, isApiProduct, isMcpServer]);

    const apiDocumentsState = useAsyncRetry(async () => {
        if (!apiId) {
            return undefined;
        }
        if (isMcpServer) {
            return apiClient.listMcpDocuments(apiId, tokenState.value);
        }
        return apiClient.listDocuments(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value, isMcpServer]);

    const mcpToolsState = useAsync(async () => {
        if (!apiId || !isMcpServer) {
            return undefined;
        }
        return apiClient.listMcpTools(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value, isMcpServer]);

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
                <InfoCard title="API Details">
                    <ApiDetails details={details} />
                </InfoCard>
            </Grid>
            <Grid item xs={12} md={6}>
                <EntityWso2ApiDocumentsCard
                    documents={(apiDocumentsState.value?.documents && apiDocumentsState.value.documents.length > 0) ? apiDocumentsState.value.documents : (apiDocuments || [])}
                    loading={apiDocumentsState.loading}
                    error={apiDocumentsState.error}
                    onRefresh={apiDocumentsState.retry}
                />
            </Grid>
            {details.endpointURLs && details.endpointURLs.length > 0 && (
                <Grid item xs={12}>
                    <InfoCard title="Gateway Endpoints">
                        <EndpointTable endpoints={details.endpointURLs} />
                    </InfoCard>
                </Grid>
            )}
            {details.businessInformation && (details.businessInformation.businessOwner || details.businessInformation.technicalOwner) && (
                <Grid item xs={12}>
                    <InfoCard title="Business Information">
                        <BusinessInfoTable info={details.businessInformation} />
                    </InfoCard>
                </Grid>
            )}
            {isApiProduct && productResources.length > 0 && (
                <Grid item xs={12}>
                    <InfoCard title="Resources">
                        <ProductResourcesTable resources={productResources} />
                    </InfoCard>
                </Grid>
            )}
            {isMcpServer && (
                <Grid item xs={12}>
                    <InfoCard title="Tools">
                        {mcpToolsState.loading ? (
                            <Progress />
                        ) : mcpToolsState.error ? (
                            <WarningPanel title="Failed to load tools" message={mcpToolsState.error.message} />
                        ) : (
                            <McpToolsTable tools={(mcpToolsState.value && mcpToolsState.value.length > 0) ? mcpToolsState.value : (mcpTools || [])} />
                        )}
                    </InfoCard>
                </Grid>
            )}
        </Grid>
    );
};

const ProductResourcesTable = ({ resources }: { resources: Wso2ApiProductResource[] }) => {
    const { entity } = useEntity();
    const namespace = entity.metadata.namespace || 'default';

    const columns = [
        { 
            title: 'API Name', 
            field: 'name',
            render: (rowData: any) => (
                <Link
                  href={`/catalog/${namespace}/api/${rowData.name.toLowerCase()}`}
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

const McpToolsTable = ({ tools }: { tools: Wso2McpTool[] }) => {
    const columns = [
        { 
            title: 'Tool Name', 
            field: 'name',
            render: (rowData: any) => (
                <span style={{ fontWeight: 'bold', color: '#007acc' }}>
                  {rowData.name}
                </span>
            ),
        },
        { title: 'Description', field: 'description' },
        { title: 'Auth Type', field: 'authType' },
        { title: 'Throttling Policy', field: 'throttlingPolicy' },
    ];

    return (
        <Table
            options={{ search: true, paging: true, pageSize: 5 }}
            columns={columns}
            data={tools}
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

const BusinessInfoTable = ({ info }: { info: any }) => {
    const metadata: Record<string, string> = {};
    
    if (info.businessOwner) {
        metadata['Business Owner'] = info.businessOwnerEmail ? `${info.businessOwner} (${info.businessOwnerEmail})` : info.businessOwner;
    }
    if (info.technicalOwner) {
        metadata['Technical Owner'] = info.technicalOwnerEmail ? `${info.technicalOwner} (${info.technicalOwnerEmail})` : info.technicalOwner;
    }

    return <StructuredMetadataTable metadata={metadata} />;
};

const ApiDetails = ({ details }: { details: Wso2ApiDetail | Wso2ApiProductDetail | Wso2McpDetail }) => {
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
    if ((details as Wso2ApiDetail).apiThrottlingPolicy) {
        metadata['Throttling Policy'] = (details as Wso2ApiDetail).apiThrottlingPolicy!;
    }
    if ((details as Wso2ApiDetail).visibility) {
        metadata.Visibility = (details as Wso2ApiDetail).visibility!;
    }
    if ((details as Wso2ApiDetail).transport && (details as Wso2ApiDetail).transport!.length > 0) {
        metadata.Transports = (details as Wso2ApiDetail).transport!.join(', ');
    }
    if (details.description) {
        metadata.Description = details.description;
    }

    return <StructuredMetadataTable metadata={metadata} />;
};
