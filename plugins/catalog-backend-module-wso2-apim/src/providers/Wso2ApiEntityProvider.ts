import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ApiEntity } from '@backstage/catalog-model';
import { Agent, fetch as undiciFetch } from 'undici';

/**
 * Normalizes a name for use as a Backstage entity name.
 * Backstage names must be lowercase alphanumeric with dashes only.
 */
function normalizeEntityName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/**
 * Provides API entities from WSO2 Publisher API.
 */
export class Wso2ApiEntityProvider implements EntityProvider {
    private readonly config: Config;
    private readonly logger: LoggerService;
    private readonly id: string;
    private connection?: EntityProviderConnection;

    constructor(options: {
        id: string;
        config: Config;
        logger: LoggerService;
    }) {
        this.id = options.id;
        this.config = options.config;
        this.logger = options.logger;
    }

    getProviderName(): string {
        return `wso2-apim-${this.id}`;
    }

    async connect(connection: EntityProviderConnection): Promise<void> {
        this.connection = connection;
    }

    async run(): Promise<void> {
        if (!this.connection) {
            throw new Error('Not initialized');
        }

        this.logger.info(`Running Wso2ApiEntityProvider`);

        // Get the configuration from app-config.yaml
        // @tharika Do you think we should add fallback values for these?
        const baseUrl = this.config.getOptionalString('catalog.providers.wso2Apim.baseUrl') || 'https://localhost:9447';
        const namespace = this.config.getOptionalString('catalog.providers.wso2Apim.namespace') || 'default';
        const username = this.config.getOptionalString('catalog.providers.wso2Apim.username') || 'admin';
        const password = this.config.getOptionalString('catalog.providers.wso2Apim.password') || 'admin';
        const clientId = this.config.getOptionalString('wso2ApiManager.auth.clientId') || '';
        const clientSecret = this.config.getOptionalString('wso2ApiManager.auth.clientSecret') || '';

        // Temporary measure: Ignore self-signed certificates in local WSO2 setup
        const dispatcher = new Agent({
            connect: { rejectUnauthorized: false },
        });

        try {
            this.logger.info(`[WSO2 APIM Provider] Fetching token from ${baseUrl}/oauth2/token`);
            this.logger.debug(`[WSO2 APIM Provider] Authenticating using password grant for user: ${username}`);

            // 1. Authenticate to get an access token using Password Grant
            const tokenResponse = await undiciFetch(`${baseUrl}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'password',
                    username: username,
                    password: password,
                    scope: 'apim:api_view apim:subscribe apim:api_create apim:api_publish apim:api_key apim:mcp_server_view'
                }).toString(),
                dispatcher,
            });

            if (!tokenResponse.ok) {
                const errText = await tokenResponse.text();
                this.logger.error(`[WSO2 APIM Provider] Token Request failed. Status: ${tokenResponse.status}. Response: ${errText}`);
                throw new Error(`Failed to get WSO2 token: ${tokenResponse.statusText} - ${errText}`);
            }

            const tokenData = await tokenResponse.json() as any;
            const accessToken = tokenData.access_token;
            this.logger.info(`[WSO2 APIM Provider] Successfully acquired WSO2 Access Token.`);

            // 2. Fetch Global Settings from Publisher API v4 (used for Gateway URL discovery)
            this.logger.info(`[WSO2 APIM Provider] Fetching Global Settings from ${baseUrl}/api/am/publisher/v4/settings`);
            let globalSettings: any = null;
            try {
                const settingsResponse = await undiciFetch(`${baseUrl}/api/am/publisher/v4/settings`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    dispatcher,
                });
                if (settingsResponse.ok) {
                    globalSettings = await settingsResponse.json();
                    this.logger.info(`[WSO2 APIM Provider] Successfully retrieved global settings with ${globalSettings?.environment?.length || 0} environments.`);
                }
            } catch (error) {
                this.logger.error(`[WSO2 APIM Provider] Error fetching global settings: ${error}`);
            }

            // 2.1 Fetch APIs from Publisher API v4
            const apisResponse = await undiciFetch(`${baseUrl}/api/am/publisher/v4/apis`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                dispatcher,
            });

            if (!apisResponse.ok) {
                const errText = await apisResponse.text();
                this.logger.error(`[WSO2 APIM Provider] API Fetch failed. Status: ${apisResponse.status}. Response: ${errText}`);
                throw new Error(`Failed to fetch WSO2 Publisher APIs: ${apisResponse.statusText} - ${errText}`);
            }

            const apisData = await apisResponse.json() as any;
            const apiList = apisData.list || [];

            this.logger.info(`[WSO2 APIM Provider] Retrieved ${apiList.length} APIs from Publisher.`);

            // 2.3 Fetch full details for each API to get endpointURLs and other missing fields
            // We use DevPortal v3 for better endpoint information, with a fallback to Publisher v4
            for (let i = 0; i < apiList.length; i++) {
                const apiId = apiList[i].id;
                const apiName = apiList[i].name || apiId;
                const publisherDetailUrl = `${baseUrl}/api/am/publisher/v4/apis/${apiId}`;
                
                this.logger.info(`[WSO2 APIM Provider] Fetching detail for API "${apiName}" (${apiId}) from Publisher v4`);
                
                try {
                    let detailResponse = await undiciFetch(publisherDetailUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        dispatcher,
                    });

                    if (detailResponse.ok) {
                        const detailData = await detailResponse.json() as any;
                        const endpointsFound = detailData.endpointURLs?.length || 0;
                        this.logger.info(`[WSO2 APIM Provider] Successfully fetched detail for API "${apiName}". Endpoints found: ${endpointsFound}`);
                        // Replace/Enrich the summary with full detail
                        apiList[i] = { ...apiList[i], ...detailData };
                    } else {
                        const errText = await detailResponse.text();
                        this.logger.warn(`[WSO2 APIM Provider] Failed to fetch full detail for API ${apiId}. Status: ${detailResponse.status}. Response: ${errText}`);
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching full detail for API ${apiId}: ${error}`);
                }
            }

            // 2.5 Fetch documents for each API
            for (const api of apiList) {
                const apiId = api.id;
                const docsUrl = `${baseUrl}/api/am/publisher/v4/apis/${apiId}/documents`;
                try {
                    const docsResponse = await undiciFetch(docsUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        dispatcher,
                    });

                    if (docsResponse.ok) {
                        const docsData = await docsResponse.json() as any;
                        // Map documentId to id to ensure consistency in Backstage frontend
                        api.documents = (docsData.list || []).map((doc: any) => ({
                            ...doc,
                            id: doc.id || doc.documentId
                        }));
                    } else {
                        api.documents = [];
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching documents for API ${apiId}: ${error}`);
                    api.documents = [];
                }
            }

            // 2.6 Fetch definitions (Swagger/OpenAPI or AsyncAPI) for each API
            for (const api of apiList) {
                const apiId = api.id;
                const apiType = api.type;
                
                // Determine the correct definition endpoint based on API type
                // WebSub, WS (WebSocket), SSE, and ASYNC APIs use AsyncAPI
                const isAsyncApi = apiType === 'WEBSUB' || apiType === 'WS' || apiType === 'SSE' || apiType === 'ASYNC';
                const definitionUrl = isAsyncApi 
                    ? `${baseUrl}/api/am/publisher/v4/apis/${apiId}/asyncapi`
                    : `${baseUrl}/api/am/publisher/v4/apis/${apiId}/swagger`;
                
                this.logger.debug(`[WSO2 APIM Provider] Fetching ${isAsyncApi ? 'AsyncAPI' : 'Swagger'} definition for API ${api.name} (${apiId}) from ${definitionUrl}`);

                try {
                    const response = await undiciFetch(definitionUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        dispatcher,
                    });

                    if (response.ok) {
                        const data = await response.json() as any;
                        api.definition = JSON.stringify(data);
                    } else {
                        api.definition = `WSO2 API Document content placeholder for ${api.name}. Status: ${response.status}`;
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching definition for API ${apiId}: ${error}`);
                    api.definition = `WSO2 API Document content placeholder for ${api.name}. Error: ${error}`;
                }
            }

            // 2.7 Fetch API Products from Publisher API v4
            this.logger.info(`[WSO2 APIM Provider] Fetching API Products from ${baseUrl}/api/am/publisher/v4/api-products`);
            let productList: any[] = [];
            try {
                const productsResponse = await undiciFetch(`${baseUrl}/api/am/publisher/v4/api-products`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    dispatcher,
                });

                if (productsResponse.ok) {
                    const productsData = await productsResponse.json() as any;
                    productList = productsData.list || [];
                    this.logger.info(`[WSO2 APIM Provider] Retrieved ${productList.length} API Products from Publisher.`);
                } else {
                    const errText = await productsResponse.text();
                    this.logger.error(`[WSO2 APIM Provider] API Product Fetch failed. Status: ${productsResponse.status}. Response: ${errText}`);
                }
            } catch (error) {
                this.logger.error(`[WSO2 APIM Provider] Error fetching API Products: ${error}`);
            }

            // 2.7.5 Fetch details for each API Product to get its constituent APIs
            for (const product of productList) {
                const productId = product.id;
                const detailUrl = `${baseUrl}/api/am/publisher/v4/api-products/${productId}`;
                try {
                    const detailResponse = await undiciFetch(detailUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        dispatcher,
                    });

                    if (detailResponse.ok) {
                        const detailData = await detailResponse.json() as any;
                        // Fully merge detail data into the product object
                        Object.assign(product, detailData);
                    } else {
                        product.apis = [];
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching details for API Product ${productId}: ${error}`);
                    product.apis = [];
                }
            }

            // 2.7.6 Fetch swagger definitions for each API Product
            for (const product of productList) {
                const productId = product.id;
                const swaggerUrl = `${baseUrl}/api/am/publisher/v4/api-products/${productId}/swagger`;
                try {
                    const swaggerResponse = await undiciFetch(swaggerUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        dispatcher,
                    });

                    if (swaggerResponse.ok) {
                        const swaggerData = await swaggerResponse.json() as any;
                        product.definition = JSON.stringify(swaggerData);
                    } else {
                        product.definition = `WSO2 API Product Document content placeholder for ${product.name}. Status: ${swaggerResponse.status}`;
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching swagger for API Product ${productId}: ${error}`);
                    product.definition = `WSO2 API Product Document content placeholder for ${product.name}. Error: ${error}`;
                }
            }

            // 2.8 Fetch MCP Servers from Publisher API v4
            this.logger.info(`[WSO2 APIM Provider] Fetching MCP Servers from ${baseUrl}/api/am/publisher/v4/mcp-servers`);
            let mcpList: any[] = [];
            try {
                const mcpResponse = await undiciFetch(`${baseUrl}/api/am/publisher/v4/mcp-servers`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    dispatcher,
                });

                if (mcpResponse.ok) {
                    const mcpData = await mcpResponse.json() as any;
                    mcpList = mcpData.list || [];
                    this.logger.info(`[WSO2 APIM Provider] Retrieved ${mcpList.length} MCP Servers from Publisher.`);
                } else {
                    const errText = await mcpResponse.text();
                    this.logger.error(`[WSO2 APIM Provider] MCP Server Fetch failed. Status: ${mcpResponse.status}. Response: ${errText}`);
                }
            } catch (error) {
                this.logger.error(`[WSO2 APIM Provider] Error fetching MCP Servers: ${error}`);
            }

            // 2.8.5 Fetch details and documents for each MCP Server
            for (const mcp of mcpList) {
                const mcpId = mcp.id;

                // Fetch detail to extract tools (operations with feature === 'TOOL')
                const detailUrl = `${baseUrl}/api/am/publisher/v4/mcp-servers/${mcpId}`;
                try {
                    const detailResponse = await undiciFetch(detailUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        dispatcher,
                    });

                    if (detailResponse.ok) {
                        const detailData = await detailResponse.json() as any;
                        const operations = detailData.operations || detailData.list || [];
                        mcp.tools = operations.filter((op: any) => op.feature === 'TOOL').map((op: any) => ({
                            name: String(op.target || op.name || ''),
                            description: String(op.description || ''),
                            authType: String(op.authType || ''),
                            throttlingPolicy: String(op.throttlingPolicy || ''),
                        }));
                    } else {
                        mcp.tools = [];
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching details for MCP Server ${mcpId}: ${error}`);
                    mcp.tools = [];
                }

                // Fetch documents
                const docsUrl = `${baseUrl}/api/am/publisher/v4/mcp-servers/${mcpId}/documents`;
                try {
                    const docsResponse = await undiciFetch(docsUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        dispatcher,
                    });

                    if (docsResponse.ok) {
                        const docsData = await docsResponse.json() as any;
                        // Map documentId to id to ensure consistency in Backstage frontend
                        mcp.documents = (docsData.list || []).map((doc: any) => ({
                            ...doc,
                            id: doc.id || doc.documentId
                        }));
                    } else {
                        mcp.documents = [];
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching documents for MCP Server ${mcpId}: ${error}`);
                    mcp.documents = [];
                }
            }

            // 3. Map WSO2 APIs to Backstage API Entities
            const apiEntities: ApiEntity[] = apiList.map((api: any) => {
                const normalizedName = normalizeEntityName(api.name);
                const rawApiJsonString = JSON.stringify(api);

                return {
                    apiVersion: 'backstage.io/v1alpha1',
                    kind: 'API',
                    metadata: {
                        name: normalizedName,
                        namespace,
                        title: api.displayName || api.name,
                        description: api.description || `WSO2 API: ${api.name}`,
                        annotations: {
                            'backstage.io/managed-by-location': `wso2-apim:${this.id}`,
                            'backstage.io/managed-by-origin-location': `wso2-apim:${this.id}`,
                            'wso2.com/api-id': api.id || '',
                            'wso2.com/api-name': api.name || '',
                            'wso2.com/api-version': api.version || '',
                            'wso2.com/api-context': api.context || '',
                            'wso2.com/api-provider': api.provider || '',
                            'wso2.com/api-type': api.type || '',
                            'wso2.com/api-lifecycle-status': api.lifeCycleStatus || '',
                            'wso2.com/api-documents': api.documents ? JSON.stringify(api.documents) : '[]',
                            'wso2.com/api-endpoints': (() => {
                                // Strictly use global settings to reconstruct URLs, ignoring potentially incorrect WSO2 defaults
                                if (globalSettings && globalSettings.environment) {
                                    const enrichedEndpoints = globalSettings.environment.map((env: any) => {
                                        const vhost = env.vhosts?.[0]; // Use first vhost
                                        if (!vhost) return null;

                                        let host = vhost.host;
                                        // Replace common placeholders (e.g. for AWS gateways)
                                        if (host.includes('{apiId}')) host = host.replace('{apiId}', api.id);
                                        
                                        // Handle additional properties from settings
                                        if (env.additionalProperties) {
                                            env.additionalProperties.forEach((prop: any) => {
                                                const placeholder = `{${prop.key}}`;
                                                if (host.includes(placeholder)) {
                                                    host = host.replace(placeholder, prop.value);
                                                }
                                            });
                                        }

                                        // Ensure context starts with / and ends with the version
                                        let fullContext = api.context ? (api.context.startsWith('/') ? api.context : `/${api.context}`) : '';
                                        if (api.version && !fullContext.endsWith(api.version)) {
                                            fullContext = `${fullContext.replace(/\/$/, '')}/${api.version}`;
                                        }

                                        const urls: string[] = [];
                                        
                                        // Add HTTPS URL if port available
                                        if (vhost.httpsPort) {
                                            const httpsPortString = (vhost.httpsPort === 443) ? '' : `:${vhost.httpsPort}`;
                                            urls.push(`https://${host}${httpsPortString}${fullContext}`);
                                        }
                                        
                                        // Add HTTP URL if port available
                                        if (vhost.httpPort) {
                                            const httpPortString = (vhost.httpPort === 80) ? '' : `:${vhost.httpPort}`;
                                            urls.push(`http://${host}${httpPortString}${fullContext}`);
                                        }

                                        this.logger.info(`[WSO2-DEBUG] Reconstructed ${urls.length} Gateway URLs for API "${api.name}" in Env "${env.name}": ${urls.join(', ')}`);

                                        return {
                                            environmentName: env.name,
                                            environmentType: env.type,
                                            urls
                                        };
                                    }).filter(Boolean);

                                    if (enrichedEndpoints.length > 0) {
                                        this.logger.debug(`[WSO2 APIM Provider] Enriched endpoint URLs for API ${api.name} using global settings.`);
                                        return JSON.stringify(enrichedEndpoints);
                                    }
                                }
                                
                                return '[]';
                            })(),
                            'wso2.com/api-raw-json': rawApiJsonString,
                            'wso2.com/business-owner': api.businessInformation?.businessOwner || '',
                            'wso2.com/business-owner-email': api.businessInformation?.businessOwnerEmail || '',
                            'wso2.com/technical-owner': api.businessInformation?.technicalOwner || '',
                            'wso2.com/technical-owner-email': api.businessInformation?.technicalOwnerEmail || '',
                            'wso2.com/api-throttling-policy': api.apiThrottlingPolicy || '',
                            'wso2.com/api-visibility': api.visibility || '',
                            'wso2.com/api-transports': Array.isArray(api.transport) ? JSON.stringify(api.transport) : '[]',
                        },
                        tags: api.tags || [],
                    },
                    spec: {
                        type: (() => {
                            const type = api.type || 'HTTP';
                            if (type === 'HTTP' || type === 'SOAP') return 'openapi';
                            if (type === 'GRAPHQL') return 'graphql';
                            if (type === 'WEBSUB' || type === 'WS' || type === 'SSE' || type === 'ASYNC') return 'asyncapi';
                            return 'api';
                        })(),
                        lifecycle: api.lifeCycleStatus === 'PUBLISHED' ? 'production' : 'experimental',
                        owner: api.provider || 'unknown',
                        definition: api.definition || `WSO2 API: ${api.name}`,
                    },
                } as ApiEntity;
            });

            // 3.1 Map WSO2 API Products to Backstage API Entities
            const productEntities: ApiEntity[] = productList.map((product: any) => {
                const normalizedName = normalizeEntityName(product.name);
                const rawProductJsonString = JSON.stringify(product);

                return {
                    apiVersion: 'backstage.io/v1alpha1',
                    kind: 'API',
                    metadata: {
                        name: normalizedName,
                        namespace,
                        title: product.displayName || product.name,
                        description: product.description || `WSO2 API Product: ${product.name}`,
                        annotations: {
                            'backstage.io/managed-by-location': `wso2-apim:${this.id}`,
                            'backstage.io/managed-by-origin-location': `wso2-apim:${this.id}`,
                            'wso2.com/api-id': product.id || '',
                            'wso2.com/api-name': product.name || '',
                            'wso2.com/api-version': product.version || '',
                            'wso2.com/api-context': product.context || '',
                            'wso2.com/api-provider': product.provider || '',
                            'wso2.com/api-type': 'API_PRODUCT',
                            'wso2.com/api-lifecycle-status': product.lifeCycleStatus || '',
                            'wso2.com/is-api-product': 'true',
                            'wso2.com/api-endpoints': (() => {
                                // Strictly use global settings to reconstruct URLs for API Products
                                if (globalSettings && globalSettings.environment) {
                                    const enrichedEndpoints = globalSettings.environment.map((env: any) => {
                                        const vhost = env.vhosts?.[0];
                                        if (!vhost) return null;
                                        let host = vhost.host;
                                        if (host.includes('{apiId}')) host = host.replace('{apiId}', product.id);
                                        if (env.additionalProperties) {
                                            env.additionalProperties.forEach((prop: any) => {
                                                const placeholder = `{${prop.key}}`;
                                                if (host.includes(placeholder)) host = host.replace(placeholder, prop.value);
                                            });
                                        }
                                        let fullContext = product.context ? (product.context.startsWith('/') ? product.context : `/${product.context}`) : '';
                                        // API Products might not always have versions in same way, but we apply same logic if present
                                        if (product.version && !fullContext.endsWith(product.version)) {
                                            fullContext = `${fullContext.replace(/\/$/, '')}/${product.version}`;
                                        }

                                        const urls: string[] = [];
                                        if (vhost.httpsPort) {
                                            const httpsPortString = (vhost.httpsPort === 443) ? '' : `:${vhost.httpsPort}`;
                                            urls.push(`https://${host}${httpsPortString}${fullContext}`);
                                        }
                                        if (vhost.httpPort) {
                                            const httpPortString = (vhost.httpPort === 80) ? '' : `:${vhost.httpPort}`;
                                            urls.push(`http://${host}${httpPortString}${fullContext}`);
                                        }
                                        
                                        this.logger.info(`[WSO2-DEBUG-PRODUCT] Reconstructed ${urls.length} Gateway URLs for Product "${product.name}" in Env "${env.name}": ${urls.join(', ')}`);
                                        return { environmentName: env.name, environmentType: env.type, urls };
                                    }).filter(Boolean);
                                    if (enrichedEndpoints.length > 0) return JSON.stringify(enrichedEndpoints);
                                }
                                return '[]';
                            })(),
                            'wso2.com/api-raw-json': rawProductJsonString,
                            'wso2.com/product-resources': product.apis ? JSON.stringify(product.apis) : '[]',
                            'wso2.com/business-owner': product.businessInformation?.businessOwner || '',
                            'wso2.com/business-owner-email': product.businessInformation?.businessOwnerEmail || '',
                            'wso2.com/technical-owner': product.businessInformation?.technicalOwner || '',
                            'wso2.com/technical-owner-email': product.businessInformation?.technicalOwnerEmail || '',
                            'wso2.com/api-throttling-policy': product.apiThrottlingPolicy || '',
                            'wso2.com/api-visibility': product.visibility || '',
                            'wso2.com/api-transports': Array.isArray(product.transport) ? JSON.stringify(product.transport) : '[]',
                        },
                        tags: product.tags || [],
                    },
                    spec: {
                        type: 'openapi',
                        lifecycle: product.lifeCycleStatus === 'PUBLISHED' ? 'production' : 'experimental',
                        owner: product.provider || 'unknown',
                        definition: product.definition || `WSO2 API Product: ${product.name}`,
                    },
                } as ApiEntity;
            });

            // 3.2 Map WSO2 MCP Servers to Backstage API Entities
            const mcpEntities: ApiEntity[] = mcpList.map((mcp: any) => {
                const normalizedName = normalizeEntityName(mcp.name);
                const rawMcpJsonString = JSON.stringify(mcp);

                return {
                    apiVersion: 'backstage.io/v1alpha1',
                    kind: 'API',
                    metadata: {
                        name: normalizedName,
                        namespace,
                        title: mcp.name,
                        description: mcp.description || `WSO2 MCP Server: ${mcp.name}`,
                        annotations: {
                            'backstage.io/managed-by-location': `wso2-apim:${this.id}`,
                            'backstage.io/managed-by-origin-location': `wso2-apim:${this.id}`,
                            'wso2.com/api-id': mcp.id || '',
                            'wso2.com/api-name': mcp.name || '',
                            'wso2.com/api-version': mcp.version || '',
                            'wso2.com/api-context': mcp.context || '',
                            'wso2.com/api-provider': mcp.provider || '',
                            'wso2.com/api-type': 'MCP',
                            'wso2.com/api-lifecycle-status': mcp.lifeCycleStatus || '',
                            'wso2.com/is-mcp-server': 'true',
                            'wso2.com/api-raw-json': rawMcpJsonString,
                            'wso2.com/mcp-tools': mcp.tools ? JSON.stringify(mcp.tools) : '[]',
                            'wso2.com/api-documents': mcp.documents ? JSON.stringify(mcp.documents) : '[]',
                        },
                        tags: mcp.tags || [],
                    },
                    spec: {
                        type: 'mcp',
                        lifecycle: mcp.lifeCycleStatus === 'PUBLISHED' ? 'production' : 'experimental',
                        owner: mcp.provider || 'unknown',
                        definition: `WSO2 MCP Server: ${mcp.name}`,
                    },
                } as ApiEntity;
            });

            const allEntities = [...apiEntities, ...productEntities, ...mcpEntities];

            // 4. Apply mutation
            await this.connection.applyMutation({
                type: 'full',
                entities: allEntities.map(entity => ({
                    entity,
                    locationKey: this.getProviderName(),
                })),
            });

            this.logger.info(`[WSO2 APIM Provider] Successfully ingested ${allEntities.length} entities (${apiEntities.length} APIs, ${productEntities.length} API Products, ${mcpEntities.length} MCP Servers) into the Catalog`);

        } catch (error) {
            this.logger.error(`[WSO2 APIM Provider] Validation/Sync Error: ${error instanceof Error ? error.message : error}`);
        }
    }
}

