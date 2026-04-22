import { useMemo, useState, useEffect, useRef } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
    InfoCard,
    Progress,
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
 * Placeholder component for the Swagger UI 'Try It Out' button when the API is not deployed.
 */
const NotDeployedTryItOutPlaceholder = () => (
    <Button 
        variant="contained" 
        disabled 
        style={{ 
            marginTop: '10px', 
            marginBottom: '10px',
            textTransform: 'none',
            fontWeight: 600,
            cursor: 'not-allowed'
        }}
    >
        Try it out
    </Button>
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

    // Calculate the Gateway URLs from harvested endpoints
    const gatewayUrls = useMemo<string[]>(() => {
        const details = apiDetailState.value;
        const endpointsRaw = entity.metadata.annotations?.[API_ENDPOINTS_ANNOTATION];
        
        let endpoints: Array<{ 
            urls: string[], 
            environmentType?: string, 
            environmentName?: string 
        }> = [];

        if (endpointsRaw) {
            try {
                endpoints = JSON.parse(endpointsRaw);
            } catch (e) {
                console.error('Failed to parse api-endpoints annotation:', e);
            }
        }

        // 1. Try dedicated endpoints annotation first (enriched by backend)
        if (endpoints && endpoints.length > 0) {
            const prodEnv = endpoints.find((e: any) => e.environmentType?.toUpperCase() === 'PRODUCTION') 
                         || endpoints[0];
            
            if (prodEnv && prodEnv.urls && prodEnv.urls.length > 0) {
                return prodEnv.urls;
            }
        }

        // 2. Fallback to what's in the raw JSON (if any)
        if (details?.endpointURLs && details.endpointURLs.length > 0) {
            const prodEnv = details.endpointURLs.find((e: any) => e.environmentType?.toUpperCase() === 'PRODUCTION') 
                         || details.endpointURLs[0];
            
            if (prodEnv && prodEnv.urls && prodEnv.urls.length > 0) {
                return prodEnv.urls;
            }
        }

        return [];
    }, [apiDetailState.value, entity.metadata.annotations]);

    // Check if API is deployed
    const revisionsState = useAsync(async () => {
        if (!apiId || tokenState.loading) return undefined;
        try {
            return await apiClient.getRevisions(apiId, { query: 'deployed:true', token: tokenState.value });
        } catch (e: any) {
            console.error('[WSO2-DefinitionCard] Failed to fetch revisions:', e.message);
            return null;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading]);

    const isDeployed = useMemo(() => {
        return (revisionsState.value?.list?.length ?? 0) > 0;
    }, [revisionsState.value]);

    // Swagger UI Plugin to replace the 'Try It Out' button with a message when not deployed or for SOAP APIs
    const tryItOutPlugin = useMemo(() => {
        const isSoap = apiDetailState.value?.type === 'SOAP';
        if (isDeployed && !isSoap) return {};
        return {
            components: {
                TryItOutButton: NotDeployedTryItOutPlaceholder,
            }
        };
    }, [isDeployed, apiDetailState.value]);

    // Dynamically rewrite the Swagger/OpenAPI spec URL to hit the API Gateway directly (e.g. 8247)
    const swaggerSpec = useMemo(() => {
        if (!apiDefinitionState.value || gatewayUrls.length === 0) return apiDefinitionState.value;

        try {
            const spec = JSON.parse(JSON.stringify(apiDefinitionState.value));

            if (spec.openapi) { // OpenAPI 3 Support
                spec.servers = gatewayUrls.map(url => ({
                    url
                }));
                // Clear overlapping servers in paths
                if (spec.paths) {
                    for (const pathKey of Object.keys(spec.paths)) {
                        if (spec.paths[pathKey].servers) {
                            delete spec.paths[pathKey].servers;
                        }
                    }
                }
            } else if (spec.swagger) { // Swagger 2 Support
                const urlObj = new URL(gatewayUrls[0]); // Fallback to first URL for Swagger 2
                spec.host = urlObj.host;
                spec.schemes = gatewayUrls.map(u => u.split(':')[0]);
                spec.basePath = urlObj.pathname !== '/' ? urlObj.pathname : '/';
            }

            return spec;
        } catch (e) {
            console.warn('[WSO2-DefinitionCard] Failed to rewrite Swagger spec URLs', e);
            return apiDefinitionState.value;
        }
    }, [apiDefinitionState.value, gatewayUrls]);

    if (!apiId) {
        return null; // Not a WSO2 API
    }

    return (
        <InfoCard title="API Definition" >
            {(apiDefinitionState.loading || apiDetailState.loading) && <Progress />}

            {!apiDefinitionState.loading && apiDefinitionState.value === null && (
                <EmptyState
                    title="No Definition"
                    missing="info"
                    description={apiDetailState.value?.type === 'GRAPHQL'
                        ? "This API does not have a GraphQL schema available."
                        : "This API does not have an OpenAPI/Swagger definition available."}
                />
            )}

            {apiDefinitionState.value && (
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

                    {/* Gateway Error for 'Try it out' */}
                    {generateKeyState.value === null && (
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
                                        to={gatewayUrls.find(u => u.startsWith('https')) || gatewayUrls[0]}
                                        target="_blank"
                                        style={{ fontSize: '0.75rem', opacity: 0.7 }}
                                    >
                                        Troubleshoot Gateway Connection (SSL)
                                    </Link>
                                </Box>

                                {/* Deployment Status Info Message - High Visibility */}
                                {!revisionsState.loading && !isDeployed && (
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
                                {isDeployed && (
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
