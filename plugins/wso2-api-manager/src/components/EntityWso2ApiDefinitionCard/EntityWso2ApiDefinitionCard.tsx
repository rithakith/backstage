import { useMemo, useState, useEffect, useRef } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
    InfoCard,
    WarningPanel,
    EmptyState,
    Link,
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
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
 * A specialized API Definition card for WSO2 APIs that enables Try it out 
 * and targets the WSO2 Gateway (port 8247) with automatic auth.
 */
export const EntityWso2ApiDefinitionCard = () => {
    const classes = useStyles();
    const { entity } = useEntity();
    const apiClient = useApi(wso2ApiManagerApiRef);
    const oauthApi = useApi(wso2AuthApiRef);
    const alertApi = useApi(alertApiRef);
    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
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

    const apiRawJson = entity.metadata.annotations?.['wso2.com/api-raw-json'];

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

    // Keep the state name for minimal disruption to the rest of the file
    const apiDetailState = { value: details, loading: false, error: undefined };

    // Get the actual OpenAPI definition (or GraphQL Schema) from the Catalog
    const apiDefinitionState = useMemo(() => {
        const definition = entity.spec?.definition as string | undefined;
        if (!definition) return { value: null, loading: false };

        if (typeof definition === 'string' && definition.trim().startsWith('{')) {
            try {
                return { value: JSON.parse(definition), loading: false };
            } catch (e) {
                console.warn('Failed to parse API definition as JSON:', e);
            }
        }
        return { value: definition, loading: false };
    }, [entity.spec?.definition]);

    // Editor state
    const [activeTab, setActiveTab] = useState(0); // 0=Swagger UI, 1=Source

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
        if (!apiId || tokenState.loading || !tokenState.value) {
            return undefined;
        }
        try {
            const result = await apiClient.generateApiKey(apiId, tokenState.value);
            return result;
        } catch (e: any) {
            console.error('[WSO2-DefinitionCard] Failed to generate API Key:', e.message);
            return null;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading]);

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

    // Extract Gateway URLs from annotation (supports multiple environments)
    const gatewayUrls = useMemo(() => {
        const annotationValue = entity.metadata.annotations?.[API_ENDPOINTS_ANNOTATION];
        if (!annotationValue) return [];
        try {
            const environments = JSON.parse(annotationValue);
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
                    description: `${env.environmentName} (${env.environmentType})`,
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
    const isDiscovered = entity.metadata.annotations?.['wso2.com/is-discovered'] === 'true';

    // Check if API is deployed according to revisions (used for deploy warning message)
    const revisionsState = useAsync(async () => {
        if (!apiId || tokenState.loading) return undefined;
        try {
            return await apiClient.getRevisions(apiId, { query: 'deployed:true', token: tokenState.value });
        } catch (e: any) {
            console.error('[WSO2-DefinitionCard] Failed to fetch revisions:', e.message);
            return null;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading]);


    // Swagger UI Plugin to replace the 'Try It Out' button with a message when not deployed or for SOAP APIs
    const tryItOutPlugin = useMemo(() => {
        const isSoap = apiDetailState.value?.type === 'SOAP';
        
        if (isDiscovered) {
            return {
                components: {
                    TryItOutButton: () => <DisabledTryItOutButton message="Try it out is disabled for discovered APIs" />,
                }
            };
        }

        if (isDeployed && !isSoap) return {};
        
        return {
            components: {
                TryItOutButton: () => (
                    <DisabledTryItOutButton 
                        message={isSoap ? "Try it out is not supported for SOAP APIs" : "API must be deployed to a gateway to enable Try it out"} 
                    />
                ),
            }
        };
    }, [isDeployed, isDiscovered, apiDetailState.value]);

    // Dynamically rewrite the Swagger/OpenAPI spec to hit the API Gateway directly
    const swaggerSpec = useMemo(() => {
        if (!apiDefinitionState.value) return undefined;
        try {
            let spec = typeof apiDefinitionState.value === 'string'
                ? JSON.parse(apiDefinitionState.value)
                : { ...apiDefinitionState.value };

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
    }, [apiDefinitionState.value, gatewayUrls]);

    // Detect if the definition is still just a placeholder from the backend
    const isPlaceholder = useMemo(() => {
        const val = apiDefinitionState.value;
        return typeof val === 'string' && val.includes('WSO2 API Document content placeholder');
    }, [apiDefinitionState.value]);

    if (!apiId) {
        return null; // Not a WSO2 API
    }

    const isLoading = apiDefinitionState.loading || apiDetailState.loading || revisionsState.loading || (isDeployed && generateKeyState.loading && !apiKey);

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
                                <Tab id="tab-swagger-ui" label="Swagger UI" className={classes.tabRoot} />
                            )}
                            <Tab id="tab-source" label="View Source" className={classes.tabRoot} />
                        </Tabs>
                    </Box>

                    {/* Tab 0: SwaggerUI rendered view (only for non-GraphQL and non-Async) */}
                    {activeTab === 0 &&
                        apiDetailState.value?.type !== 'GRAPHQL' &&
                        !isAsyncType(apiDetailState.value?.type) && (
                            <div className={classes.root}>
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

                                {/* Internal API Key Display and Regeneration - Only for deployed, non-discovered APIs */}
                                {isDeployed && !isDiscovered && (
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
                                                // WSO2 Gateway expects testing keys in 'Internal-Key' header
                                                req.headers['Internal-Key'] = apiKey;
                                            } else {
                                                // Diagnostic log for debugging missing tokens
                                                console.warn('[WSO2-Auth] No Internal-Key in state at request time.');
                                            }
                                            return req;
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                    {/* Tab 1: VSCode-like editor */}
                    {activeTab === 1 && (
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
