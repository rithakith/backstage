import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { RootConfig } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { GroupEntity, UserEntity } from '@backstage/catalog-model';

/**
 * Provides user and group entities from Asgardeo SCIM 2.0 API.
 */
export class AsgardeoEntityProvider implements EntityProvider {
    private readonly config: RootConfig;
    private readonly logger: LoggerService;
    private readonly id: string;
    private connection?: EntityProviderConnection;

    constructor(options: {
        id: string;
        config: RootConfig;
        logger: LoggerService;
    }) {
        this.id = options.id;
        this.config = options.config;
        this.logger = options.logger;
    }

    getProviderName(): string {
        return `asgardeo-${this.id}`;
    }

    async connect(connection: EntityProviderConnection): Promise<void> {
        this.connection = connection;
    }

    async run(): Promise<void> {
        if (!this.connection) {
            throw new Error('Not initialized');
        }

        this.logger.info(`Running AsgardeoEntityProvider`);

        // Get the credentials from app-config.yaml
        const clientId = this.config.getString('auth.providers.oidc.development.clientId');
        const clientSecret = this.config.getString('auth.providers.oidc.development.clientSecret');
        const asgardeoOrgName = 'backstageplugin'; // Extracted from metadataUrl

        try {
            // 1. Authenticate to get an access token using Client Credentials
            const tokenResponse = await fetch(`https://api.asgardeo.io/t/${asgardeoOrgName}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    scope: 'internal_user_mgt_list internal_user_mgt_view internal_group_mgt_list internal_group_mgt_view'
                })
            });

            if (!tokenResponse.ok) {
                throw new Error(`Failed to get Asgardeo token: ${tokenResponse.statusText}`);
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // 2. Fetch Users from SCIM 2.0 API
            const usersResponse = await fetch(`https://api.asgardeo.io/t/${asgardeoOrgName}/scim2/Users`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/scim+json'
                }
            });

            if (!usersResponse.ok) {
                throw new Error(`Failed to fetch Asgardeo users: ${usersResponse.statusText}`);
            }

            const usersData = await usersResponse.json();

            // Debug: log the raw SCIM response to understand the data structure
            this.logger.info(`Asgardeo SCIM response totalResults: ${usersData.totalResults}, Resources count: ${(usersData.Resources || []).length}`);

            // 3. Map Asgardeo SCIM Users to Backstage User Entities
            const users: UserEntity[] = (usersData.Resources || []).map((user: any) => {
                // Debug: log each raw user from SCIM
                this.logger.info(`Asgardeo raw user: userName="${user.userName}", emails=${JSON.stringify(user.emails)}, id="${user.id}", name=${JSON.stringify(user.name)}`);

                // Determine the email - Asgardeo SCIM returns emails as plain strings ["foo@bar.com"], not objects [{value:"foo@bar.com"}]
                const rawEmail = user.emails && user.emails.length > 0
                    ? (typeof user.emails[0] === 'string' ? user.emails[0] : user.emails[0].value)
                    : user.userName;
                const email = rawEmail || user.userName;

                // Strip the Asgardeo userstore prefix (e.g. "DEFAULT/") from userName before computing entity name
                const rawUserName = (user.userName || email) as string;
                const cleanUserName = rawUserName.includes('/') ? rawUserName.split('/').pop()! : rawUserName;
                // Backstage names must be alphanumeric/dashes
                const name = cleanUserName.split('@')[0].replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();

                this.logger.info(`Asgardeo mapped user: name="${name}", email="${email}"`);

                return {
                    apiVersion: 'backstage.io/v1alpha1',
                    kind: 'User',
                    metadata: {
                        name: name,
                        annotations: {
                            'backstage.io/managed-by-location': `asgardeo:${asgardeoOrgName}`,
                            'backstage.io/managed-by-origin-location': `asgardeo:${asgardeoOrgName}`,
                            'asgardeo.io/user-id': user.id,
                        },
                    },
                    spec: {
                        profile: {
                            displayName: user.name?.formatted || user.userName,
                            email: email,
                        },
                        memberOf: [] // Groups would go here
                    },
                } as UserEntity;
            });

            const groups: GroupEntity[] = []; // Leaving groups empty for this POC, but same logic applies

            // Combine the entities and format them
            await this.connection.applyMutation({
                type: 'full',
                entities: [...users, ...groups].map(entity => ({
                    entity,
                    locationKey: this.getProviderName(),
                })),
            });

            this.logger.info(`Successfully ingested ${users.length} users from Asgardeo`);

        } catch (error) {
            this.logger.error(`Error syncing entities from Asgardeo: ${error instanceof Error ? error.message : error}`);
        }
    }
}
