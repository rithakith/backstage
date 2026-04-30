import { useMemo, useState, useEffect, useRef } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
    InfoCard,
    WarningPanel,
    EmptyState,
    Link,
} from '@backstage/core-components';
import { useApi, alertApiRef, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    Box,
    Tabs,
    Tab,
    Button,
    TextField,
    Typography,
    CircularProgress,
    Tooltip,
} from '@material-ui/core';
import {
    wso2ApiManagerApiRef,
    wso2AuthApiRef,
    Wso2ApiDetail,
} from '../../api';
// @ts-ignore
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { SwaggerEditorPanel } from '../SwaggerEditorPanel';

import { useStyles } from './styles';

const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const API_ENDPOINTS_ANNOTATION = 'wso2.com/api-endpoints';
const GATEWAY_ENDPOINTS_ANNOTATION = 'wso2-gateway.com/api-endpoints';
const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';
const WSO2_ORGANIZATION_ID_ANNOTATION = 'wso2.com/organization-id';
const WSO2_GATEWAY_API_ID_ANNOTATION = 'wso2-gateway.com/api-id';
const WSO2_DISCOVERED_FROM_ANNOTATION = 'wso2-gateway.com/discovered-from';

/**
 * Quick and dirty GraphQL SDL formatter since we don't have a dedicated library in the frontend.
 * Adds newlines and basic indentation for readability.
 */
const formatGraphQL = (sdl: string): string => {
    if (!sdl) return sdl;

    let workingSdl = sdl;

    // Handle escaped characters like \n if they are literal backslashes
    // Often WSO2 returns the schema JSON-escaped
    if (workingSdl.includes('\\n')) {
        workingSdl = workingSdl.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }

    // Basic formatting logic
    let indent = 0;
    let result = '';

    // Split into lines first if we now have actual newlines
    const lines = workingSdl.split('\n');

    for (const line of lines) {
        let trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // If a line is very long and has braces, it might be minified
        if (trimmedLine.length > 100 && (trimmedLine.includes('{') || trimmedLine.includes('}'))) {
            // Process as a minified string
            const parts = trimmedLine.split(/([{}])/);
            for (let part of parts) {
                const trimmedPart = part.trim();
                if (!trimmedPart) continue;

                if (trimmedPart === '{') {
                    result += ' {\n';
                    indent++;
                    result += '  '.repeat(indent);
                } else if (trimmedPart === '}') {
                    indent--;
                    result = result.trimEnd() + '\n' + '  '.repeat(indent) + '}\n' + '  '.repeat(indent);
                } else {
                    result += trimmedPart;
                }
            }
        } else {
            // Keep existing line structure but apply indentation
            if (trimmedLine.includes('}')) indent = Math.max(0, indent - 1);
            result += '  '.repeat(indent) + trimmedLine + '\n';
            if (trimmedLine.includes('{')) indent++;
        }
    }

    return result.replace(/\n\s*\n/g, '\n').trim();
};

/**
 * Helper to check if an API type is event-driven/async and should use the Source tab only.
 */
const isAsyncType = (type?: string) =>
    ['ASYNC', 'WS', 'SSE', 'WEBHOOK', 'WEBSUB'].includes(type || '');

/**
 * Quick and dirty AsyncAPI/YAML formatter.
 * Ensures basic indentation and newlines are preserved.
 */
const formatAsyncApi = (yaml: string): string => {
    if (!yaml) return yaml;

    let workingYaml = yaml;

    // Handle JSON-escaped strings if present
    if (workingYaml.includes('\\n')) {
        workingYaml = workingYaml.replace(/\\n/g, '\n').replace(/\\"/g, '"');
    }

    // If it's pure JSON but labeled as ASYNC, pretty print it
    try {
        if (workingYaml.trim().startsWith('{')) {
            const json = JSON.parse(workingYaml);
            return JSON.stringify(json, null, 2);
        }
    } catch (e) {
        // Not JSON, continue with YAML formatting
    }

    return workingYaml.trim();
};

/**
 * A disabled "Try it out" button with a tooltip explanation.
 */
const DisabledTryItOutButton = ({ message }: { message: string }) => (
    <Tooltip title={message} arrow placement="top">
        <span style={{ cursor: 'not-allowed' }}>
            <Button 
                variant="contained" 
                disabled 
                style={{ 
                    backgroundColor: '#f5f5f5',
                    color: 'rgba(0, 0, 0, 0.26)',
                    textTransform: 'none',
                    fontWeight: 'bold',
                    padding: '4px 12px'
                }}
            >
                Try it out
            </Button>
        </span>
    </Tooltip>
);

/**
 * A simple list of operations (methods and paths) for APIs that don't have a full Swagger definition.
 */
const Wso2OperationsList = ({ operations }: { operations: any[] }) => {
    const getMethodColor = (method: string) => {
        const m = method.toUpperCase();
        if (m === 'GET') return '#61affe';
        if (m === 'POST') return '#49cc90';
        if (m === 'PUT') return '#fca130';
        if (m === 'DELETE') return '#f93e3e';
        if (m === 'PATCH') return '#50e3c2';
        return '#9012fe';
    };

    return (
        <Box p={2}>
            <Typography variant="subtitle2" gutterBottom style={{ fontWeight: 'bold', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Available Operations
            </Typography>
            <Box mt={2}>
                {operations.map((op, idx) => (
                    <Box 
                        key={idx} 
                        display="flex" 
                        alignItems="center" 
                        mb={1.5} 
                        p={1.5} 
                        border={1} 
                        borderColor="rgba(0,0,0,0.08)" 
                        borderRadius={8}
                        bgcolor="rgba(0,0,0,0.02)"
                        style={{ transition: 'all 0.2s ease' }}
                    >
                        <Box 
                            px={1.5} 
                            py={0.5} 
                            mr={2} 
                            borderRadius={4} 
                            style={{ 
                                backgroundColor: getMethodColor(op.method), 
                                color: 'white', 
                                fontWeight: 'bold',
                                minWidth: '80px',
                                textAlign: 'center',
                                fontSize: '0.75rem',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                            }}
                        >
                            {op.method.toUpperCase()}
                        </Box>
                        <Typography variant="body2" style={{ fontFamily: '"Roboto Mono", monospace', fontWeight: 500, color: '#333' }}>
                            {op.path}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
};

/**
 * A specialized API Definition card for WSO2 APIs that enables Try it out 
 * and targets the WSO2 Gateway (port 8247) with automatic auth.
 */
export const EntityWso2ApiDefinitionCard = () => {
    const classes = useStyles();
    const { entity } = useEntity();
    const apiClient = useApi(wso2ApiManagerApiRef);
    const oauthApi = useApi(wso2AuthApiRef);
    const alertApi = useApi(alertApiRef);
    const config = useApi(configApiRef);
    const { fetch } = useApi(fetchApiRef);
    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION] || 
                  entity.metadata.annotations?.[WSO2_GATEWAY_API_ID_ANNOTATION];
    const organizationId = entity.metadata.annotations?.[WSO2_ORGANIZATION_ID_ANNOTATION];
    const discoveredFrom = entity.metadata.annotations?.[WSO2_DISCOVERED_FROM_ANNOTATION];
    
    const isSelfHosted = entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION] === 'self-hosted-gateway';
    // Respect the explicit annotation — self-hosted gateway APIs set this to 'false'
    const isDiscovered = entity.metadata.annotations?.['wso2.com/is-discovered'] === 'true';
    const apiRawJson = entity.metadata.annotations?.['wso2.com/api-raw-json'];
    
    const apiKeyRef = useRef<string | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [expiresIn, setExpiresIn] = useState<number | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

    // Get the user's Asgardeo OAuth token from existing session
    const tokenState = useAsyncRetry(async () => {
        try {
            const t = await oauthApi.getAccessToken(
                ['openid', 'profile', 'email', 'apim:api_view', 'apim:api_generate_key', 'apim:api_manage'],
                { optional: true },
            );
            return t;
        } catch (error: any) {
            console.error('[WSO2-DefinitionCard] Token retrieval failed:', error);
            return undefined;
        }
    }, [oauthApi]);



    // Get API Details from Catalog metadata
    const details = useMemo(() => {
        if (!apiRawJson) return undefined;
        try {
            return JSON.parse(apiRawJson) as Wso2ApiDetail;
        } catch (e) {
            console.error('Failed to parse WSO2 API raw JSON:', e);
            return undefined;
        }
    }, [apiRawJson]);

    // Fallback: Fetch API definition from Backend if organizationId is missing
    const fallbackDefinitionState = useAsync(async () => {
        if (isSelfHosted && !organizationId && apiId && discoveredFrom) {
            try {
                const backendUrl = config.getString('backend.baseUrl');
                const url = `${backendUrl}/api/wso2-api-manager/apis/${apiId}/definition?discoveredFrom=${discoveredFrom}`;
                
                const response = await fetch(url);
                if (response.ok) {
                    const spec = await response.json();
                    console.log(`[WSO2-Fallback] Successfully fetched fallback spec from backend for ${apiId}`);
                    return spec;
                }
                console.warn(`[WSO2-Fallback] Backend failed to fetch definition. Status: ${response.status}`);
            } catch (e) {
                console.error('[WSO2-Fallback] Error fetching fallback definition from backend:', e);
            }
        }
        return undefined;
    }, [isSelfHosted, organizationId, apiId, discoveredFrom, config, fetch]);

    // Keep the state name for minimal disruption to the rest of the file
    const apiDetailState = { value: details, loading: false, error: undefined };

    // Get the actual OpenAPI definition (or GraphQL Schema) from the Catalog (or fallback)
    const apiDefinitionState = useMemo(() => {
        // Prioritize fallback definition if it exists
        if (fallbackDefinitionState.value) {
            return { value: fallbackDefinitionState.value, loading: false };
        }

        const definition = entity.spec?.definition as string | undefined;
        const isEntityPlaceholder = typeof definition === 'string' && (
            definition.includes('WSO2 Discovered API') ||
            definition.includes('WSO2 API Document content placeholder')
        );

        // If it's a placeholder and we are still fetching the fallback, stay in loading state
        if (isEntityPlaceholder && fallbackDefinitionState.loading) {
            return { value: null, loading: true };
        }

        if (!definition) return { value: null, loading: fallbackDefinitionState.loading };

        // If fallback already succeeded, don't re-parse from catalog placeholder
        if (isEntityPlaceholder && !fallbackDefinitionState.loading && !fallbackDefinitionState.value) {
            return { value: null, loading: false };
        }

        if (typeof definition === 'string' && definition.trim().startsWith('{')) {
            try {
                return { value: JSON.parse(definition), loading: false };
            } catch (e) {
                console.warn('Failed to parse API definition as JSON:', e);
            }
        }
        return { value: definition, loading: false };
    }, [entity.spec?.definition, fallbackDefinitionState.value, fallbackDefinitionState.loading]);

    // Check if we only have operations (no full Swagger/OpenAPI spec)
    const hasOperationsOnly = useMemo(() => {
        const val = apiDefinitionState.value;
        if (!val || typeof val !== 'object') return false;
        // Check top-level or nested under configuration.spec
        const ops = (val as any).operations || (val as any).configuration?.spec?.operations;
        return Array.isArray(ops) && !(val as any).openapi && !(val as any).swagger;
    }, [apiDefinitionState.value]);

    // Extract operations from wherever they live in the response
    const gatewayOperations = useMemo(() => {
        const val = apiDefinitionState.value as any;
        if (!val) return [];
        return val.operations || val.configuration?.spec?.operations || [];
    }, [apiDefinitionState.value]);

    // Editor state
    const [activeTab, setActiveTab] = useState(0); // 0=Swagger UI/Operations, 1=Source

    // Sync display content when definition loads
    useEffect(() => {
        const type = apiDetailState.value?.type;
        if (type === 'GRAPHQL' || isAsyncType(type)) {
            setActiveTab(1);
        }
    }, [apiDetailState.value]);

    const [editContent, setEditContent] = useState('');

    // Sync display content when definition loads
    useEffect(() => {
        if (apiDefinitionState.value) {
            let content = '';
            const type = apiDetailState.value?.type;
            if (type === 'GRAPHQL' && typeof apiDefinitionState.value === 'string') {
                content = formatGraphQL(apiDefinitionState.value);
            } else if (isAsyncType(type) && typeof apiDefinitionState.value === 'string') {
                content = formatAsyncApi(apiDefinitionState.value);
            } else {
                content = typeof apiDefinitionState.value === 'string'
                    ? apiDefinitionState.value
                    : JSON.stringify(apiDefinitionState.value, null, 2);
            }
            setEditContent(content);
        }
    }, [apiDefinitionState.value, apiDetailState.value]);



    // Generate an API test key for the Try it out functionality
    const generateKeyState = useAsyncRetry(async () => {
        // We need the user token to request an Internal Key from WSO2
        // Skip key generation for self-hosted gateways as they don't use the Publisher's key API
        if (!apiId || tokenState.loading || !tokenState.value || isSelfHosted) {
            return undefined;
        }
        try {
            const result = await apiClient.generateApiKey(apiId, tokenState.value);
            return result;
        } catch (e: any) {
            console.error('[WSO2-DefinitionCard] Failed to generate API Key:', e.message);
            return null;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading, isSelfHosted]);

    // Update the ref and state whenever the key changes
    useEffect(() => {
        if (generateKeyState.value) {
            const keyData = generateKeyState.value;
            const key = keyData.token
                || keyData.InternalKey
                || keyData.internalKey
                || keyData.apikey
                || keyData.apiKey
                || (keyData.token && typeof keyData.token === 'object' ? keyData.token.accessToken : undefined)
                || (typeof keyData === 'string' ? keyData : '');

            const isInitial = apiKeyRef.current === null;
            apiKeyRef.current = key || null;
            setApiKey(key || null);
            setLastUpdated(Date.now());

            const validity = keyData.validityPeriod || keyData.expires_in;
            if (validity) {
                setExpiresIn(Number(validity));
            }

            if (!isInitial && key) {
                alertApi.post({ message: 'Internal API Key refreshed', severity: 'success' });
            }
            console.log('🗝️ [WSO2-Auth] API Key Ref and State updated:', key ? 'READY' : 'EMPTY');
        } else if (generateKeyState.error) {
            apiKeyRef.current = null;
            setApiKey(null);
        }
    }, [generateKeyState.value, generateKeyState.error, alertApi]);

    // Extract Gateway URLs from annotations (supports both standard and gateway-discovered APIs)
    const gatewayUrls = useMemo(() => {
        const standardEndpoints = entity.metadata.annotations?.[API_ENDPOINTS_ANNOTATION];
        const gatewayEndpoints = entity.metadata.annotations?.[GATEWAY_ENDPOINTS_ANNOTATION];
        
        let allEnvs: any[] = [];
        try {
            if (gatewayEndpoints) {
                const parsed = JSON.parse(gatewayEndpoints);
                if (Array.isArray(parsed)) allEnvs = [...allEnvs, ...parsed];
            }
            if (standardEndpoints) {
                const parsed = JSON.parse(standardEndpoints);
                if (Array.isArray(parsed)) {
                    const existingNames = new Set(allEnvs.map(e => (e.environmentName || '').toUpperCase()));
                    const uniqueStandard = parsed.filter(e => !existingNames.has((e.environmentName || '').toUpperCase()));
                    allEnvs = [...allEnvs, ...uniqueStandard];
                }
            }
        } catch (e) {
            console.error('Failed to parse gateway endpoints annotation:', e);
        }

        if (allEnvs.length === 0) return [];
        
        try {
            const environments = allEnvs;
            if (!Array.isArray(environments)) return [];

            // Sort so PRODUCTION comes first
            const sortedEnvs = [...environments].sort((a: any, b: any) => {
                const typeA = (a.environmentType || '').toUpperCase();
                const typeB = (b.environmentType || '').toUpperCase();
                if (typeA === 'PRODUCTION' && typeB !== 'PRODUCTION') return -1;
                if (typeA !== 'PRODUCTION' && typeB === 'PRODUCTION') return 1;
                return 0;
            });

            return sortedEnvs.flatMap((env: any) =>
                (env.urls || []).map((url: string) => ({
                    url,
                    description: env.displayName || env.environmentName,
                    environmentName: env.environmentName,
                    environmentType: env.environmentType
                }))
            );
        } catch (e) {
            console.error('Failed to parse gateway endpoints annotation:', e);
            return [];
        }
    }, [entity]);

    const isDeployed = gatewayUrls.length > 0;

    // Check if API is deployed according to revisions (used for deploy warning message)
    const revisionsState = useAsync(async () => {
        if (!apiId || tokenState.loading || isSelfHosted) return undefined;
        try {
            return await apiClient.getRevisions(apiId, { query: 'deployed:true', token: tokenState.value });
        } catch (e: any) {
            console.error('[WSO2-DefinitionCard] Failed to fetch revisions:', e.message);
            return null;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading, isSelfHosted]);


    // Swagger UI Plugin to replace the 'Try It Out' button based on deployment and discovery type
    const tryItOutPlugin = useMemo(() => {
        const type = (apiDetailState.value?.type || '').toUpperCase();
        const isSoap = type === 'SOAP';
        const isAsync = isAsyncType(type);

        // Enable Try it out only for:
        // - Standard WSO2 Synapse HTTP/AI APIs (if deployed and not SOAP/Async)
        // - Self-hosted gateway APIs
        // Disable for:
        // - Publisher-discovered APIs (not managed in Publisher)
        const canTry = isDeployed && !isSoap && !isAsync && (!isDiscovered || isSelfHosted);

        if (canTry) {
            return {}; // Use default Swagger UI button
        }

        // Return disabled button with descriptive message for other cases
        let message = "Try it out is not available for this API";
        if (isSoap) message = "Try it out is not supported for SOAP APIs";
        else if (isAsync) message = "Try it out is not supported for Async APIs";
        else if (isDiscovered && !isSelfHosted) message = "Try it out is not enabled for discovered APIs";
        else if (!isDeployed) message = "API is not deployed to any gateway";

        return {
            components: {
                TryItOutButton: () => (
                    <DisabledTryItOutButton message={message} />
                ),
            }
        };
    }, [isDeployed, isSelfHosted, apiDetailState.value]);

    // Dynamically rewrite the Swagger/OpenAPI spec to hit the API Gateway directly
    const swaggerSpec = useMemo(() => {
        if (!apiDefinitionState.value || hasOperationsOnly) return undefined;
        try {
            const val = apiDefinitionState.value;
            let spec: any;
            if (typeof val === 'string') {
                if (!val.trim().startsWith('{')) {
                    return undefined; // Skip placeholders or SDL
                }
                try {
                    spec = JSON.parse(val);
                } catch (e) {
                    return undefined;
                }
            } else {
                spec = { ...val };
            }

            // Handle Gateway URLs based on spec version
            if (gatewayUrls.length > 0) {
                if (spec.openapi) {
                    // OpenAPI 3.x: Supports multiple servers
                    spec.servers = gatewayUrls.map(gw => ({
                        url: gw.url,
                        description: gw.description
                    }));
                } else if (spec.swagger === '2.0') {
                    // Swagger 2.0: Supports only one host/basePath
                    try {
                        const firstGw = gatewayUrls[0];
                        const urlObj = new URL(firstGw.url);
                        spec.host = urlObj.host;
                        spec.basePath = urlObj.pathname !== '/' ? urlObj.pathname : (spec.basePath || '/');
                        
                        // Collect all unique schemes from all gateway URLs
                        const schemes = new Set<string>();
                        gatewayUrls.forEach(gw => {
                            try {
                                schemes.add(new URL(gw.url).protocol.replace(':', ''));
                            } catch (e) { /* ignore */ }
                        });
                        spec.schemes = Array.from(schemes);
                    } catch (e) {
                        console.warn('Failed to parse gateway URL for Swagger 2.0:', e);
                    }
                }
            }

            // Always ensure paths exists to avoid Swagger UI crashes (entrySeq error)
            if (!spec.paths) spec.paths = {};

            return spec;
        } catch (e) {
            console.warn('Failed to process Swagger spec for UI:', e);
            return apiDefinitionState.value;
        }
    }, [apiDefinitionState.value, gatewayUrls, hasOperationsOnly]);

    // Detect if the definition is still just a placeholder from the backend
    const isPlaceholder = useMemo(() => {
        // Only show loading spinner if we have a placeholder AND the fallback hasn't loaded yet
        if (fallbackDefinitionState.value) return false;
        const val = apiDefinitionState.value;
        return typeof val === 'string' && (
            val.includes('WSO2 API Document content placeholder') ||
            val.includes('WSO2 Discovered API')
        );
    }, [apiDefinitionState.value, fallbackDefinitionState.value]);

    if (!apiId) {
        return null; // Not a WSO2 API
    }

    const isLoading = apiDefinitionState.loading || fallbackDefinitionState.loading || apiDetailState.loading || revisionsState.loading || (isDeployed && generateKeyState.loading && !apiKey);

    return (
        <InfoCard 
            title={
                <Box display="flex" alignItems="center">
                    <Typography variant="h6">API Definition</Typography>
                    {isDiscovered && (
                        <Box ml={2} px={1} py={0.5} bgcolor="#e6f7ff" border={1} borderColor="#91d5ff" borderRadius={4}>
                            <Typography variant="caption" style={{ color: '#0050b3', fontWeight: 'bold', textTransform: 'uppercase' }}>
                                Discovered API
                            </Typography>
                        </Box>
                    )}
                </Box>
            }
        >
            {(isLoading || isPlaceholder) && (
                <Box display="flex" justifyContent="center" alignItems="center" height={200} flexDirection="column">
                    <CircularProgress size={40} thickness={4} style={{ color: '#ff5000' }} />
                    <Box mt={2}>
                        <Typography variant="body2" color="textSecondary">
                            {isPlaceholder ? 'Syncing with WSO2 Gateway...' : 'Loading API Definition...'}
                        </Typography>
                    </Box>
                </Box>
            )}

            {!isLoading && !isPlaceholder && apiDefinitionState.value === null && (
                <EmptyState
                    title="No Definition"
                    missing="info"
                    description="This API does not have a definition available in the catalog."
                />
            )}

            {apiDefinitionState.value && !isPlaceholder && (
                <>
                    {/* Authentication Status for 'Try it out' */}
                    {!tokenState.loading && !tokenState.value && (
                        <Box mb={2}>
                            <WarningPanel
                                title="Authentication Required"
                                message="Sign in with your Asgardeo account to enable 'Try it out' functionality."
                            />
                        </Box>
                    )}

                    {/* Gateway Error for 'Try it out' - Only for non-discovered APIs */}
                    {!isDiscovered && generateKeyState.value === null && (
                        <Box mb={2}>
                            <WarningPanel
                                title="Gateway Access Failed"
                                message="Failed to generate a temporary access key for the WSO2 Gateway. Please try refreshing the page or checking your connectivity."
                            />
                        </Box>
                    )}

                    {/* Tab bar: Swagger UI / Source */}
                    <Box borderBottom={1} borderColor="divider" mb={2}>
                        <Tabs
                            value={activeTab}
                            onChange={(_, v) => setActiveTab(v)}
                            indicatorColor="primary"
                            textColor="primary"
                        >
                            {apiDetailState.value?.type !== 'GRAPHQL' && !isAsyncType(apiDetailState.value?.type) && (
                                <Tab id="tab-swagger-ui" label={hasOperationsOnly ? "Operations" : "Swagger UI"} className={classes.tabRoot} />
                            )}
                            {!hasOperationsOnly && (
                                <Tab id="tab-source" label="View Source" className={classes.tabRoot} />
                            )}
                        </Tabs>
                    </Box>

                    {/* Tab 0: SwaggerUI or Operations List */}
                    {activeTab === 0 && (
                        <div className={classes.root}>
                            {hasOperationsOnly ? (
                                <Wso2OperationsList operations={gatewayOperations} />
                            ) : (
                                <>
                                    {/* Discreet SSL troubleshooting link */}
                                    <Box display="flex" justifyContent="flex-end" px={2} pt={1}>
                                        <Link
                                            to={gatewayUrls.find(u => u.url.startsWith('https'))?.url || gatewayUrls[0]?.url || '#'}
                                            target="_blank"
                                            style={{ fontSize: '0.75rem', opacity: 0.7 }}
                                        >
                                            Troubleshoot Gateway Connection (SSL)
                                        </Link>
                                    </Box>

                                    {/* Deployment Status Info Message - High Visibility */}
                                    {!revisionsState.loading && !isDeployed && !isDiscovered && (
                                        <Box mx={2} my={2} p={2.5} border={1} borderColor="#91d5ff" borderRadius={4} bgcolor="#e6f7ff">
                                            <Typography variant="body2" style={{ color: '#0050b3', display: 'flex', alignItems: 'center', gap: '12px', fontWeight: 500 }}>
                                                <span style={{ fontSize: '1.5rem' }}>ℹ️</span>
                                                <Box>
                                                    <strong>API is not deployed yet! Please deploy the API before trying out</strong>
                                                </Box>
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Internal API Key Display and Regeneration */}
                                    {isDeployed && !isDiscovered && !isSelfHosted && (
                                        <Box mx={2} my={1} p={2} border={1} borderColor="divider" borderRadius={4} bgcolor="background.paper">
                                            <Box display="flex" alignItems="center" justifyContent="space-between">
                                                <TextField
                                                    label="Internal API Key"
                                                    value={generateKeyState.loading ? 'Generating...' : (apiKey || 'No key available')}
                                                    variant="outlined"
                                                    size="small"
                                                    InputProps={{
                                                        readOnly: true,
                                                        style: { fontFamily: 'monospace', fontSize: '0.875rem' }
                                                    }}
                                                    fullWidth
                                                />
                                                <Box ml={2}>
                                                    <Button
                                                        variant="contained"
                                                        color="primary"
                                                        onClick={() => generateKeyState.retry()}
                                                        disabled={generateKeyState.loading}
                                                        size="small"
                                                    >
                                                        {generateKeyState.loading ? 'Generating...' : 'Generate'}
                                                    </Button>
                                                </Box>
                                            </Box>
                                            <Box mt={1}>
                                                <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                                    Expires in {expiresIn ? Math.round(expiresIn / 3600) : 1} hour(s)
                                                </span>
                                            </Box>
                                        </Box>
                                    )}

                                    <div style={{ padding: '16px', borderRadius: '4px' }}>
                                        <SwaggerUI
                                            key={`swagger-ui-${lastUpdated}-${isDeployed}`}
                                            spec={swaggerSpec}
                                            plugins={[tryItOutPlugin]}
                                            supportedSubmitMethods={['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace']}
                                            requestInterceptor={(req: any) => {
                                                if (apiKey) {
                                                    console.log('🚀 [WSO2-Auth] Injecting Internal-Key into request:', req.url);
                                                    req.headers['Internal-Key'] = apiKey;
                                                }
                                                return req;
                                            }}
                                        />
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Tab 1: Source View (Hidden if only operations are available) */}
                    {activeTab === 1 && !hasOperationsOnly && (
                        <SwaggerEditorPanel
                            value={editContent}
                            readOnly
                        />
                    )}
                </>
            )}
        </InfoCard>
    );
};
