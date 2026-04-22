import { EntityProvider, EntityProviderConnection } from '@backstage/plugin-catalog-node';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { GroupEntity, UserEntity } from '@backstage/catalog-model';

/**
 * Normalizes a name for use as a Backstage entity name.
 * Backstage names must be lowercase alphanumeric with dashes only.
 */
function normalizeEntityName(name: string): string {
    return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/**
 * Provides user and group entities from Asgardeo SCIM 2.0 API.
 */
export class AsgardeoEntityProvider implements EntityProvider {
    private readonly config: Config;
    private readonly logger: LoggerService;
    private readonly id: string;
    private readonly roleAttribute: string;
    private connection?: EntityProviderConnection;

    constructor(options: {
        id: string;
        config: Config;
        logger: LoggerService;
    }) {
        this.id = options.id;
        this.config = options.config;
        this.logger = options.logger;
        this.roleAttribute = options.config.getOptionalString(`catalog.providers.${options.id}.roleAttribute`) || 'user_role';
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
        
        // Extract org name from metadataUrl or allow explicit config
        let asgardeoOrgName = this.config.getOptionalString(`catalog.providers.${this.id}.organization`);
        if (!asgardeoOrgName) {
            const metadataUrl = this.config.getString('auth.providers.oidc.development.metadataUrl');
            // Try to extract from https://api.asgardeo.io/t/<org>/...
            const match = metadataUrl.match(/\/t\/([^\/]+)\//);
            asgardeoOrgName = match ? match[1] : 'backstageplugin';
        }

        try {
            // 1. Authenticate to get an access token using Client Credentials
            // Using scopes that are authorized for the application in Asgardeo
            // Available scopes: apim:api_publish apim:api_delete apim:api_create apim:subscribe apim:api_view
            //                   internal_user_mgt_list internal_user_mgt_view internal_org_user_mgt_list internal_org_user_mgt_view
            //                   internal_role_mgt_view internal_group_mgt_view internal_org_role_mgt_view
            // @ritzy: Missing scope 'internal_group_mgt_list' - couldn't find it in Asgardeo. Group listing may fail without it.
            const tokenResponse = await fetch(`https://api.asgardeo.io/t/${asgardeoOrgName}/oauth2/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
                },
                body: new URLSearchParams({
                    grant_type: 'client_credentials',
                    scope: 'internal_user_mgt_list internal_user_mgt_view internal_role_mgt_view internal_group_mgt_view'
                })
            });

            if (!tokenResponse.ok) {
                throw new Error(`Failed to get Asgardeo token: ${tokenResponse.statusText}`);
            }

            const tokenData = await tokenResponse.json();
            const accessToken = tokenData.access_token;

            // 2. Fetch Groups from SCIM 2.0 API first
            const groupsResponse = await fetch(`https://api.asgardeo.io/t/${asgardeoOrgName}/scim2/Groups`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Accept': 'application/scim+json'
                }
            });

            // Build a map of group ID -> normalized group name
            const groupIdToName: Map<string, string> = new Map();
            const groups: GroupEntity[] = [];

            if (groupsResponse.ok) {
                const groupsData = await groupsResponse.json();
                this.logger.info(`Asgardeo Groups: totalResults=${groupsData.totalResults}, count=${(groupsData.Resources || []).length}`);

                for (const group of (groupsData.Resources || [])) {
                    // Group displayName might be like "Internal/admin" or just "developers"
                    const displayName = group.displayName || group.id;
                    // Extract just the role name after any prefix
                    const baseName = displayName.includes('/')
                        ? displayName.split('/').pop()!
                        : displayName;
                    const normalizedName = normalizeEntityName(baseName);

                    groupIdToName.set(group.id, normalizedName);
                    this.logger.info(`Asgardeo group: id="${group.id}", displayName="${displayName}", normalized="${normalizedName}"`);

                    groups.push({
                        apiVersion: 'backstage.io/v1alpha1',
                        kind: 'Group',
                        metadata: {
                            name: normalizedName,
                            description: `Asgardeo group: ${displayName}`,
                            annotations: {
                                'backstage.io/managed-by-location': `asgardeo:${asgardeoOrgName}`,
                                'backstage.io/managed-by-origin-location': `asgardeo:${asgardeoOrgName}`,
                                'asgardeo.io/group-id': group.id,
                            },
                        },
                        spec: {
                            type: 'team',
                            children: [],
                        },
                    } as GroupEntity);
                }
            } else {
                this.logger.warn(`Failed to fetch Asgardeo groups: ${groupsResponse.statusText}`);
            }

            // 3. Fetch Users from SCIM 2.0 API
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
            this.logger.info(`Asgardeo SCIM Users: totalResults=${usersData.totalResults}, count=${(usersData.Resources || []).length}`);

            // 4. Map Asgardeo SCIM Users to Backstage User Entities
            const users: UserEntity[] = (usersData.Resources || []).map((user: any) => {
                // Debug: log each raw user from SCIM - ALL attributes
                this.logger.info(`Asgardeo raw user (full): ${JSON.stringify(user).substring(0, 500)}`);
                this.logger.info(`Asgardeo raw user: userName="${user.userName}", emails=${JSON.stringify(user.emails)}, groups=${JSON.stringify(user.groups)}`);

                // Check for configured role attribute
                if (user[this.roleAttribute]) {
                    this.logger.info(`  ✅ Found ${this.roleAttribute}: ${JSON.stringify(user[this.roleAttribute])}`);
                } else {
                    this.logger.warn(`  ⚠️  No ${this.roleAttribute} attribute found for user ${user.userName}`);
                }

                // Check for custom schema extensions
                for (const key of Object.keys(user)) {
                    if (key.startsWith('urn:') || key.toLowerCase().includes('role')) {
                        this.logger.info(`  🔍 Found attribute: ${key} = ${JSON.stringify(user[key])}`);
                    }
                }

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

                // Extract asgardeo_role from custom schema extension (declare once, use multiple times)
                const customSchema = user['urn:scim:schemas:extension:custom:User'];

                // Extract group memberships from SCIM groups attribute
                // Each group has { value: groupId, display: groupName }
                const memberOf: string[] = [];
                if (Array.isArray(user.groups)) {
                    for (const grp of user.groups) {
                        const groupId = grp.value || grp.$ref?.split('/').pop();
                        if (groupId && groupIdToName.has(groupId)) {
                            memberOf.push(groupIdToName.get(groupId)!);
                        } else if (grp.display) {
                            // Fallback: use display name and normalize it
                            const baseName = grp.display.includes('/')
                                ? grp.display.split('/').pop()!
                                : grp.display;
                            memberOf.push(normalizeEntityName(baseName));
                        }
                    }
                }

                // Add configured role to memberOf if present
                if (customSchema && customSchema[this.roleAttribute]) {
                    const roleValue = String(customSchema[this.roleAttribute]);
                    // Add the role as a group membership so it can be used for permissions
                    // Normalize it to match Backstage group naming conventions
                    const normalizedRole = normalizeEntityName(roleValue);
                    if (!memberOf.includes(normalizedRole)) {
                        memberOf.push(normalizedRole);
                    }
                    this.logger.info(`  ✅ Added ${this.roleAttribute} to memberOf: ${roleValue} -> ${normalizedRole}`);
                }

                this.logger.info(`Asgardeo mapped user: name="${name}", email="${email}", memberOf=${JSON.stringify(memberOf)}`);

                // Build annotations
                const annotations: Record<string, string> = {
                    'backstage.io/managed-by-location': `asgardeo:${asgardeoOrgName}`,
                    'backstage.io/managed-by-origin-location': `asgardeo:${asgardeoOrgName}`,
                    'asgardeo.io/user-id': user.id,
                };

                // Add configured role as annotation from custom schema
                if (customSchema && customSchema[this.roleAttribute]) {
                    annotations['asgardeo.io/role'] = String(customSchema[this.roleAttribute]);
                }

                // Check for roles in other schema extensions (keep for backwards compatibility)
                const schemaExtensions = Object.keys(user).filter(k => k.startsWith('urn:'));
                for (const schemaKey of schemaExtensions) {
                    if (schemaKey === 'urn:scim:schemas:extension:custom:User') {
                        continue; // Already processed above
                    }
                    const schemaData = user[schemaKey];
                    if (schemaData && typeof schemaData === 'object') {
                        if (schemaData[this.roleAttribute]) {
                            annotations['asgardeo.io/role-from-schema'] = String(schemaData[this.roleAttribute]);
                        }
                    }
                }

                return {
                    apiVersion: 'backstage.io/v1alpha1',
                    kind: 'User',
                    metadata: {
                        name: name,
                        annotations: annotations,
                    },
                    spec: {
                        profile: {
                            displayName: user.name?.formatted || user.name?.givenName || cleanUserName,
                            email: email,
                        },
                        memberOf: memberOf,
                    },
                } as UserEntity;
            });

            // Combine the entities and format them
            await this.connection.applyMutation({
                type: 'full',
                entities: [...users, ...groups].map(entity => ({
                    entity,
                    locationKey: this.getProviderName(),
                })),
            });

            this.logger.info(`Successfully ingested ${users.length} users and ${groups.length} groups from Asgardeo`);

        } catch (error) {
            this.logger.error(`Error syncing entities from Asgardeo: ${error instanceof Error ? error.message : error}`);
        }
    }
}
