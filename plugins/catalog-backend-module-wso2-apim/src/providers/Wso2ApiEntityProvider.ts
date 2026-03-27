import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { ApiEntity } from '@backstage/catalog-model';
import fetch from 'node-fetch';
import https from 'https';

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
        const baseUrl = this.config.getOptionalString('catalog.providers.wso2Apim.baseUrl') || 'https://localhost:9447';
        const username = this.config.getOptionalString('catalog.providers.wso2Apim.username') || 'admin';
        const password = this.config.getOptionalString('catalog.providers.wso2Apim.password') || 'admin';
        const clientId = this.config.getOptionalString('wso2ApiManager.auth.clientId') || '';
        const clientSecret = this.config.getOptionalString('wso2ApiManager.auth.clientSecret') || '';

        // Temporary measure: Ignore self-signed certificates in local WSO2 setup
        const httpsAgent = new https.Agent({
            rejectUnauthorized: false,
        });

        try {
            this.logger.info(`[WSO2 APIM Provider] Fetching token from ${baseUrl}/oauth2/token`);
            this.logger.debug(`[WSO2 APIM Provider] Authenticating using password grant for user: ${username}`);

            // 1. Authenticate to get an access token using Password Grant
            const tokenResponse = await fetch(`${baseUrl}/oauth2/token`, {
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
                }),
                agent: httpsAgent,
            });

            if (!tokenResponse.ok) {
                const errText = await tokenResponse.text();
                this.logger.error(`[WSO2 APIM Provider] Token Request failed. Status: ${tokenResponse.status}. Response: ${errText}`);
                throw new Error(`Failed to get WSO2 token: ${tokenResponse.statusText} - ${errText}`);
            }

            const tokenData = await tokenResponse.json() as any;
            const accessToken = tokenData.access_token;
            this.logger.info(`[WSO2 APIM Provider] Successfully acquired WSO2 Access Token.`);

            // 2. Fetch APIs from Publisher API v4
            this.logger.info(`[WSO2 APIM Provider] Fetching APIs from ${baseUrl}/api/am/publisher/v4/apis`);
            const apisResponse = await fetch(`${baseUrl}/api/am/publisher/v4/apis?limit=100`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/json'
                },
                agent: httpsAgent,
            });

            if (!apisResponse.ok) {
                const errText = await apisResponse.text();
                this.logger.error(`[WSO2 APIM Provider] API Fetch failed. Status: ${apisResponse.status}. Response: ${errText}`);
                throw new Error(`Failed to fetch WSO2 Publisher APIs: ${apisResponse.statusText} - ${errText}`);
            }

            const apisData = await apisResponse.json() as any;
            const apiList = apisData.list || [];

            this.logger.info(`[WSO2 APIM Provider] Retrieved ${apiList.length} APIs from Publisher.`);

            // 2.5 Fetch documents for each API
            for (const api of apiList) {
                const apiId = api.id;
                const docsUrl = `${baseUrl}/api/am/publisher/v4/apis/${apiId}/documents`;
                try {
                    const docsResponse = await fetch(docsUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        agent: httpsAgent,
                    });

                    if (docsResponse.ok) {
                        const docsData = await docsResponse.json() as any;
                        api.documents = docsData.list || [];
                    } else {
                        api.documents = [];
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching documents for API ${apiId}: ${error}`);
                    api.documents = [];
                }
            }

            // 2.6 Fetch swagger definitions for each API
            for (const api of apiList) {
                const apiId = api.id;
                const swaggerUrl = `${baseUrl}/api/am/publisher/v4/apis/${apiId}/swagger`;
                try {
                    const swaggerResponse = await fetch(swaggerUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        agent: httpsAgent,
                    });

                    if (swaggerResponse.ok) {
                        const swaggerData = await swaggerResponse.json() as any;
                        api.definition = JSON.stringify(swaggerData);
                    } else {
                        api.definition = `WSO2 API Document content placeholder for ${api.name}. Status: ${swaggerResponse.status}`;
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching swagger for API ${apiId}: ${error}`);
                    api.definition = `WSO2 API Document content placeholder for ${api.name}. Error: ${error}`;
                }
            }

            // 2.7 Fetch API Products from Publisher API v4
            this.logger.info(`[WSO2 APIM Provider] Fetching API Products from ${baseUrl}/api/am/publisher/v4/api-products`);
            let productList: any[] = [];
            try {
                const productsResponse = await fetch(`${baseUrl}/api/am/publisher/v4/api-products?limit=100`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    agent: httpsAgent,
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

            // 2.8 Fetch MCP Servers from Publisher API v4
            this.logger.info(`[WSO2 APIM Provider] Fetching MCP Servers from ${baseUrl}/api/am/publisher/v4/mcp-servers`);
            let mcpList: any[] = [];
            try {
                const mcpResponse = await fetch(`${baseUrl}/api/am/publisher/v4/mcp-servers?limit=100`, {
                    headers: {
                        'Authorization': `Bearer ${accessToken}`,
                        'Accept': 'application/json'
                    },
                    agent: httpsAgent,
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

            // 3. Map WSO2 APIs to Backstage API Entities
            const apiEntities: ApiEntity[] = apiList.map((api: any) => {
                const normalizedName = normalizeEntityName(api.name);
                const rawApiJsonString = JSON.stringify(api);

                return {
                    apiVersion: 'backstage.io/v1alpha1',
                    kind: 'API',
                    metadata: {
                        name: normalizedName,
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
                            'wso2.com/api-raw-json': rawApiJsonString,
                        },
                        tags: api.tags || [],
                    },
                    spec: {
                        type: api.type === 'GRAPHQL' ? 'graphql' : 'openapi',
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
                            'wso2.com/api-raw-json': rawProductJsonString,
                        },
                        tags: product.tags || [],
                    },
                    spec: {
                        type: 'openapi',
                        lifecycle: product.lifeCycleStatus === 'PUBLISHED' ? 'production' : 'experimental',
                        owner: product.provider || 'unknown',
                        definition: `WSO2 API Product: ${product.name}`,
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

