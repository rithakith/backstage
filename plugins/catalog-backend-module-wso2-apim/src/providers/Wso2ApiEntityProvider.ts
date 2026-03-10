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
                    scope: 'apim:api_view'
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
            this.logger.info(`[WSO2 APIM Provider] RAW DETAILED JSON Response: \n${JSON.stringify(apiList, null, 2)}`);

            // 2.5 Fetch documents for each API
            for (const api of apiList) {
                const apiId = api.id;
                const docsUrl = `${baseUrl}/api/am/publisher/v4/apis/${apiId}/documents`;
                this.logger.info(`[WSO2 APIM Provider] Fetching documents for API ${api.name} (${apiId}) - Request URL: ${docsUrl}`);
                try {
                    const docsResponse = await fetch(docsUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        agent: httpsAgent,
                    });

                    if (!docsResponse.ok) {
                        const errText = await docsResponse.text();
                        this.logger.error(`[WSO2 APIM Provider] Document Fetch failed for API ${apiId}. Status: ${docsResponse.status}. Response: ${errText}`);
                        api.documents = [];
                    } else {
                        const docsData = await docsResponse.json() as any;
                        this.logger.info(`[WSO2 APIM Provider] Document Fetch Response Format for API ${apiId}:\n${JSON.stringify(docsData, null, 2)}`);
                        api.documents = docsData.list || [];
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
                this.logger.info(`[WSO2 APIM Provider] Fetching swagger definition for API ${api.name} (${apiId}) - Request URL: ${swaggerUrl}`);
                try {
                    const swaggerResponse = await fetch(swaggerUrl, {
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Accept': 'application/json'
                        },
                        agent: httpsAgent,
                    });

                    if (!swaggerResponse.ok) {
                        const errText = await swaggerResponse.text();
                        this.logger.error(`[WSO2 APIM Provider] Swagger Fetch failed for API ${apiId}. Status: ${swaggerResponse.status}. Response: ${errText}`);
                        api.definition = `WSO2 API Document content placeholder for ${api.name}. Could not fetch actual definition. Status: ${swaggerResponse.status}`;
                    } else {
                        const swaggerData = await swaggerResponse.json() as any;
                        this.logger.info(`[WSO2 APIM Provider] Successfully fetched Swagger Definition for API ${apiId}.`);
                        api.definition = JSON.stringify(swaggerData);
                    }
                } catch (error) {
                    this.logger.error(`[WSO2 APIM Provider] Error fetching swagger for API ${apiId}: ${error}`);
                    api.definition = `WSO2 API Document content placeholder for ${api.name}. Error fetching actual definition: ${error}`;
                }
            }

            // 3. Map WSO2 APIs to Backstage API Entities
            const apiEntities: ApiEntity[] = apiList.map((api: any) => {
                const normalizedName = normalizeEntityName(api.name);

                this.logger.info(`[WSO2 APIM Provider] Mapping API: "${api.name}" v${api.version} -> Entity: "${normalizedName}"`);
                this.logger.debug(`[WSO2 APIM Provider] Raw API Payload: ${JSON.stringify(api).substring(0, 300)}...`);

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
                            'wso2.com/api-subtype': api.subtype || '',
                            'wso2.com/api-audience': api.audience || '',
                            'wso2.com/api-audiences': api.audiences ? JSON.stringify(api.audiences) : '',
                            'wso2.com/api-lifecycle-status': api.lifeCycleStatus || '',
                            'wso2.com/api-workflow-status': api.workflowStatus || '',
                            'wso2.com/api-created-time': api.createdTime ? String(api.createdTime) : '',
                            'wso2.com/api-updated-time': api.updatedTime ? String(api.updatedTime) : '',
                            'wso2.com/api-updated-by': api.updatedBy || '',
                            'wso2.com/api-gateway-vendor': api.gatewayVendor || '',
                            'wso2.com/api-gateway-type': api.gatewayType || '',
                            'wso2.com/api-business-owner': api.businessOwner || '',
                            'wso2.com/api-business-owner-email': api.businessOwnerEmail || '',
                            'wso2.com/api-technical-owner': api.technicalOwner || '',
                            'wso2.com/api-technical-owner-email': api.technicalOwnerEmail || '',
                            'wso2.com/api-documents': api.documents ? JSON.stringify(api.documents) : '[]',
                            // Complete payload dumped into string
                            'wso2.com/api-raw-json': rawApiJsonString,
                        },
                        tags: api.tags || [],
                    },
                    spec: {
                        type: api.type === 'WS' ? 'websocket' : (api.type === 'GRAPHQL' ? 'graphql' : 'openapi'),
                        lifecycle: api.lifeCycleStatus === 'PUBLISHED' ? 'production' : (api.lifeCycleStatus === 'DEPRECATED' ? 'deprecated' : 'experimental'),
                        owner: api.provider || 'unknown',
                        definition: api.definition || `WSO2 API Document content placeholder for ${api.name}. Will be replaced by actual definition if configured later.`,
                    },
                } as ApiEntity;
            });

            // Combine the entities and format them
            await this.connection.applyMutation({
                type: 'full',
                entities: apiEntities.map(entity => ({
                    entity,
                    locationKey: this.getProviderName(),
                })),
            });

            this.logger.info(`[WSO2 APIM Provider] Successfully ingested ${apiEntities.length} APIs into the Catalog`);

        } catch (error) {
            this.logger.error(`[WSO2 APIM Provider] Validation/Sync Error: ${error instanceof Error ? error.message : error}`);
        }
    }
}

