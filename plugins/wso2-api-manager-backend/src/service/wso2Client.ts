import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { Agent, fetch as undiciFetch } from 'undici';
export type Wso2ApiSummary = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
  /** 
   * API visibility: PUBLIC, RESTRICTED, or PRIVATE
   * NOTE: This field is NOT returned by the DevPortal API (/api/am/devportal/v3).
   * WSO2 performs server-side filtering and only returns APIs the user can access.
   * This field would only be present if using the Publisher API (/api/am/publisher/v4).
   */
  visibility?: 'PUBLIC' | 'RESTRICTED' | 'PRIVATE';
  /** 
   * Roles that can access this API when visibility is RESTRICTED
   * NOTE: This field is NOT returned by the DevPortal API.
   * See visibility field comment above.
   */
  visibleRoles?: string[];
};



export type Wso2ApiDetail = Wso2ApiSummary & {
  description?: string;
  endpointURLs?: Array<{
    environmentName?: string;
    environmentType?: string;
    urls?: string[];
  }>;
};



/**
 * Checks if a user can access an API based on its visibility settings.
 * 
 * NOTE: This function is currently NOT USED for DevPortal API integration because:
 * 1. WSO2 DevPortal API performs server-side filtering
 * 2. The visibility/visibleRoles fields are not exposed by the DevPortal API
 * 3. All APIs returned by the DevPortal API are already accessible to the user
 * 
 * This function is kept for potential future use with the Publisher API
 * or custom visibility logic.
 */
export function canAccessApi(
  api: Wso2ApiSummary,
  userRoles: string[],
): boolean {
  // PUBLIC APIs are visible to everyone
  if (!api.visibility || api.visibility === 'PUBLIC') {
    return true;
  }

  // PRIVATE APIs are only for internal use (admin/creator)
  if (api.visibility === 'PRIVATE') {
    // Check if user has admin/Internal/creator role
    const adminRoles = ['admin', 'Internal/creator', 'Internal/publisher', 'apim:admin'];
    return userRoles.some(role => adminRoles.includes(role));
  }

  // RESTRICTED APIs require specific roles
  if (api.visibility === 'RESTRICTED') {
    if (!api.visibleRoles || api.visibleRoles.length === 0) {
      return false;
    }
    // Check if user has any of the required roles
    return api.visibleRoles.some(requiredRole =>
      userRoles.some(userRole =>
        userRole.toLowerCase() === requiredRole.toLowerCase() ||
        userRole.endsWith(`/${requiredRole}`), // Handle Internal/rolename format
      ),
    );
  }

  return false;
}

export type Wso2ApiDocument = {
  id: string;
  name: string;
  summary?: string;
  sourceType?: string;
  sourceUrl?: string;
  documentId?: string;
  type?: string;
};

export type Wso2ApiListResponse = {
  apis: Wso2ApiSummary[];
  pagination?: {
    offset: number;
    limit: number;
    total: number;
  };
};

export type Wso2ApiDocumentsResponse = {
  documents: Wso2ApiDocument[];
};

// SCIM2 Types for user and role management
export type Wso2ScimUser = {
  id?: string;
  userName?: string;
  displayName?: string;
  emails?: Array<{ value?: string; primary?: boolean }>;
  groups?: Array<{ display?: string; value?: string }>;
  roles?: Array<{ display?: string; value?: string }>;
  asgardeo_role?: string | string[];
  'urn:scim:wso2:schema'?: Record<string, unknown>;
  'urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'?: Record<string, unknown>;
  'urn:scim:schemas:extension:enterprise:2.0:User'?: Record<string, unknown>;
  // Asgardeo custom schema extensions
  'urn:ietf:params:scim:schemas:extension:asgardeo:2.0:User'?: Record<string, unknown>;
  'urn:scim:schemas:extension:custom:User'?: Record<string, unknown>;
  // Allow any other schema extensions
  [key: string]: unknown;
};

export type Wso2ScimListResponse = {
  totalResults?: number;
  startIndex?: number;
  itemsPerPage?: number;
  Resources?: Wso2ScimUser[];
};

export type Wso2ScimRole = {
  id?: string;
  displayName?: string;
  permissions?: string[];
};

export type Wso2ScimRolesResponse = {
  totalResults?: number;
  Resources?: Wso2ScimRole[];
};

export type Wso2ScimUserAttributes = {
  username: string;
  displayName?: string;
  email?: string;
  roles: string[];
  groups: string[];
  attributes: Record<string, unknown>;
};

export type Wso2RolePermissions = {
  roleName: string;
  permissions: string[];
};

export type Wso2UserPermissions = {
  username: string;
  roles: string[];
  permissions: string[];
  rolePermissions: Wso2RolePermissions[];
};

export type Wso2ApiManagerConfig = {
  baseUrl: string;
  devportalBasePath: string;
  publisherBasePath: string;
  auth: {
    clientId: string;
    clientSecret: string;
    tokenUrl?: string;
  };
  tls: {
    rejectUnauthorized: boolean;
  };
};

export function readWso2ApiManagerConfig(
  config: RootConfigService,
): Wso2ApiManagerConfig {
  const wso2Config = config.getOptionalConfig('wso2ApiManager');
  if (!wso2Config) {
    throw new Error('Missing wso2ApiManager configuration');
  }

  const baseUrl = wso2Config.getString('baseUrl');
  const devportalBasePath =
    wso2Config.getOptionalString('devportalBasePath') ??
    '/api/am/devportal/v3';
  const publisherBasePath =
    wso2Config.getOptionalString('publisherBasePath') ??
    '/api/am/publisher/v4';

  const authConfig = wso2Config.getConfig('auth');
  const clientId = authConfig.getString('clientId');
  const clientSecret = authConfig.getString('clientSecret');
  const tokenUrl = authConfig.getOptionalString('tokenUrl');

  const tlsRejectUnauthorized =
    wso2Config.getOptionalBoolean('tls.rejectUnauthorized') ?? true;

  return {
    baseUrl,
    devportalBasePath,
    publisherBasePath,
    auth: {
      clientId,
      clientSecret,
      tokenUrl,
    },
    tls: {
      rejectUnauthorized: tlsRejectUnauthorized,
    },
  };
}

export class Wso2ApiManagerClient {
  private readonly config: Wso2ApiManagerConfig;
  private readonly logger: LoggerService;
  private readonly publisherBaseUrl: string;
  private readonly dispatcher?: Agent;

  constructor(options: { config: Wso2ApiManagerConfig; logger: LoggerService }) {
    this.config = options.config;
    this.logger = options.logger;
    this.publisherBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.publisherBasePath,
    );
    if (!options.config.tls.rejectUnauthorized) {
      this.dispatcher = new Agent({
        connect: {
          rejectUnauthorized: false,
        },
      });
    }
  }

  async listApis(options: {
    limit: number;
    offset: number;
    query?: string;
  }): Promise<Wso2ApiListResponse> {
    const params = new URLSearchParams({
      limit: String(options.limit),
      offset: String(options.offset),
    });
    if (options.query) {
      params.set('query', options.query);
    }

    const data = await this.requestPublisher<{
      list?: unknown[];
      pagination?: { offset: number; limit: number; total: number };
    }>(`/apis?${params.toString()}`);

    const allApis = (data.list ?? []).map(mapApiSummary);

    this.logger.info(`📊 Retrieved ${allApis.length} API(s) from WSO2 Publisher`);

    return {
      apis: allApis,
      pagination: data.pagination,
    };
  }

  async getApi(apiId: string): Promise<Wso2ApiDetail> {
    const data = await this.requestPublisher<Record<string, unknown>>(`/apis/${apiId}`);
    return mapApiDetail(data);
  }

  async generateApiKey(apiId: string): Promise<Record<string, unknown>> {
    const data = await this.requestPublisher<Record<string, unknown>>(`/apis/${apiId}/generate-key`, {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
      },
    });
    return data;
  }

  async getApiDefinition(apiId: string): Promise<any> {
    // Attempt to fetch swagger definition
    // Usually available at `/apis/{apiId}/swagger` in DevPortal/Publisher APIs
    // Return raw JSON response for Swagger UI
    const data = await this.requestPublisher<any>(`/apis/${apiId}/swagger`);
    return data;
  }

  /**
   * Updates the swagger/OpenAPI definition for an API on the WSO2 Publisher Portal.
   * Sends a PUT request to /apis/{apiId}/swagger with the definition as multipart/form-data.
   * WSO2 Publisher v4 expects the definition in the `apiDefinition` form field.
   */
  async updateApiDefinition(apiId: string, definition: string): Promise<void> {
    const accessToken = await this.resolveAccessToken();
    const url = `${this.publisherBaseUrl}/apis/${apiId}/swagger`;

    // Build multipart/form-data body manually for compatibility
    const boundary = `----FormBoundary${Date.now()}`;
    const body =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="apiDefinition"\r\n\r\n` +
      `${definition}\r\n` +
      `--${boundary}--\r\n`;

    this.logger.info(`Updating API definition for ${apiId} via PUT ${url}`);

    const response = await undiciFetch(url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const errBody = await response.text();
      this.logger.error(
        `Failed to update API definition ${response.status} ${response.statusText}: ${errBody}`,
      );
      throw new Error(
        `Failed to update API definition, status ${response.status}: ${errBody}`,
      );
    }
    this.logger.info(`Successfully updated API definition for ${apiId}`);
  }

  async listDocuments(apiId: string): Promise<Wso2ApiDocumentsResponse> {
    const data = await this.requestPublisher<{ list?: unknown[] }>(
      `/apis/${apiId}/documents`
    );

    return {
      documents: (data.list ?? []).map(mapApiDocument),
    };
  }

  async getDocument(apiId: string, documentId: string): Promise<any> {
    const data = await this.requestPublisher<Record<string, unknown>>(
      `/apis/${apiId}/documents/${documentId}`
    );
    return data;
  }

  async getDocumentContentStream(apiId: string, documentId: string): Promise<any> {
    const accessToken = await this.resolveAccessToken();
    const url = `${this.publisherBaseUrl}/apis/${apiId}/documents/${documentId}/content`;

    this.logger.info(`Fetching document content: ${url}`);

    // Do a raw fetch
    const response = await undiciFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      this.logger.warn(`WSO2 Content Fetch returned ${response.status} for ${url}`);
    }

    return response;
  }

  async listPublisherApis(options: {
    limit: number;
    offset: number;
    query?: string;
  }): Promise<Wso2ApiListResponse> {
    const params = new URLSearchParams({
      limit: String(options.limit),
      offset: String(options.offset),
    });
    if (options.query) {
      params.set('query', options.query);
    }

    const data = await this.requestPublisher<{
      list?: unknown[];
      pagination?: { offset: number; limit: number; total: number };
    }>(`/apis?${params.toString()}`);

    return {
      apis: (data.list ?? []).map(mapApiSummary),
      pagination: data.pagination,
    };
  }

  async createPublisherApi(input: {
    name: string;
    context: string;
    version: string;
    endpointUrl: string;
    description?: string;
  }): Promise<Wso2ApiDetail> {
    const payload = buildPublisherCreatePayload(input);
    const data = await this.requestPublisher<Record<string, unknown>>(
      '/apis',
      {
        method: 'POST',
        body: JSON.stringify(payload),
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
    return mapApiDetail(data);
  }



  /**
   * Fetches user attributes from WSO2 SCIM2 API by username.
   * This retrieves the full user profile including custom attributes like asgardeo_role.
   * 
   * @param username - The username to look up (e.g., email or user ID)
   * @param credentials - The credentials to authenticate the request
   * @returns User attributes including roles and custom claims
   */
  async getUserAttributesFromScim(
    username: string,
  ): Promise<Wso2ScimUserAttributes> {
    const accessToken = await this.resolveAccessToken();

    // SCIM2 filter to find user by username
    const filter = encodeURIComponent(`userName eq "${username}"`);
    const url = `${this.config.baseUrl}/scim2/Users?filter=${filter}`;

    this.logger.info(`SCIM2 request: GET ${url}`);

    const response = await undiciFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/scim+json',
      },
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`SCIM2 request failed ${response.status}: ${body}`);
      throw new Error(`SCIM2 request failed, status ${response.status}`);
    }

    const data = (await response.json()) as Wso2ScimListResponse;

    this.logger.info(`SCIM2 response: ${JSON.stringify(data).substring(0, 2000)}`);

    if (!data.Resources || data.Resources.length === 0) {
      this.logger.warn(`No user found in SCIM2 for username: ${username}`);
      return {
        username,
        roles: [],
        groups: [],
        attributes: {},
      };
    }

    const user = data.Resources[0];
    this.logger.info(`SCIM2 user data: ${JSON.stringify(user).substring(0, 2000)}`);
    return this.mapScimUserToAttributes(user);
  }

  /**
   * Fetches the permissions associated with a role from WSO2.
   * This queries the SCIM2 Roles endpoint to get role details including permissions.
   * 
   * @param roleName - The role name (e.g., "Internal/creator", "admin")
   * @param credentials - The credentials to authenticate the request
   * @returns Role permissions
   */
  async getRolePermissions(
    roleName: string,
  ): Promise<Wso2RolePermissions> {
    const accessToken = await this.resolveAccessToken();

    // SCIM2 filter to find role by displayName
    const filter = encodeURIComponent(`displayName eq "${roleName}"`);
    const url = `${this.config.baseUrl}/scim2/Roles?filter=${filter}`;

    this.logger.info(`SCIM2 Roles request: GET ${url}`);

    const response = await undiciFetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/scim+json',
      },
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(`SCIM2 Roles request failed ${response.status}: ${body}`);
      throw new Error(`SCIM2 Roles request failed, status ${response.status}`);
    }

    const data = (await response.json()) as Wso2ScimRolesResponse;

    if (!data.Resources || data.Resources.length === 0) {
      this.logger.warn(`No role found in SCIM2 for roleName: ${roleName}`);
      return {
        roleName,
        permissions: [],
      };
    }

    const role = data.Resources[0];
    return {
      roleName: role.displayName || roleName,
      permissions: role.permissions || [],
    };
  }

  /**
   * Gets all permissions for a user by fetching their roles and then retrieving
   * permissions for each role.
   * 
   * @param username - The username to look up
   * @param credentials - The credentials to authenticate the request
   * @returns User with all their permissions aggregated from their roles
   */
  async getUserPermissions(
    username: string,
  ): Promise<Wso2UserPermissions> {
    // First get user attributes including roles
    const userAttributes = await this.getUserAttributesFromScim(username);

    // Combine roles from different sources:
    // 1. Roles from SCIM groups
    // 2. Roles from asgardeo_role custom attribute
    const allRoles = [...new Set([...userAttributes.roles, ...userAttributes.groups])];

    // Add asgardeo_role if present in custom attributes
    const asgardeoRoles = userAttributes.attributes['asgardeo_role'];
    if (asgardeoRoles) {
      const parsedRoles = Array.isArray(asgardeoRoles)
        ? asgardeoRoles
        : String(asgardeoRoles).split(',').map(r => r.trim()).filter(Boolean);
      allRoles.push(...parsedRoles);
    }

    const uniqueRoles = [...new Set(allRoles)];

    // Fetch permissions for each role in parallel
    const permissionResults = await Promise.all(
      uniqueRoles.map(async role => {
        try {
          return await this.getRolePermissions(role);
        } catch (err) {
          this.logger.warn(`Could not fetch permissions for role ${role}: ${err}`);
          return { roleName: role, permissions: [] };
        }
      }),
    );

    // Aggregate all permissions
    const allPermissions = permissionResults.flatMap(r => r.permissions);
    const uniquePermissions = [...new Set(allPermissions)];

    return {
      username,
      roles: uniqueRoles,
      permissions: uniquePermissions,
      rolePermissions: permissionResults,
    };
  }

  private mapScimUserToAttributes(user: Wso2ScimUser): Wso2ScimUserAttributes {
    const roles: string[] = [];
    const groups: string[] = [];
    const attributes: Record<string, unknown> = {};
    const userObj = user as Record<string, unknown>;

    this.logger.info(`Mapping SCIM user: ${JSON.stringify(Object.keys(user))}`);

    // Extract roles from groups
    if (user.groups) {
      for (const group of user.groups) {
        if (group.display) {
          groups.push(group.display);
          // WSO2 roles are typically in format "Internal/rolename" or "Application/appname"
          if (group.display.includes('/')) {
            roles.push(group.display);
          }
        }
      }
    }

    // Extract roles from roles array (if present)
    if (user.roles) {
      for (const role of user.roles) {
        if (role.display) {
          roles.push(role.display);
        }
      }
    }

    // Extract custom attributes from urn:scim:wso2:schema
    const wso2Schema = user['urn:scim:wso2:schema'] as Record<string, unknown> | undefined;
    if (wso2Schema) {
      this.logger.info(`Found urn:scim:wso2:schema: ${JSON.stringify(wso2Schema)}`);
      Object.assign(attributes, wso2Schema);
    }

    // Also check for urn:ietf:params:scim:schemas:extension:enterprise:2.0:User
    const enterpriseSchema = user['urn:ietf:params:scim:schemas:extension:enterprise:2.0:User'] as Record<string, unknown> | undefined;
    if (enterpriseSchema) {
      this.logger.info(`Found enterprise schema: ${JSON.stringify(enterpriseSchema)}`);
      Object.assign(attributes, enterpriseSchema);
    }

    // Check for Asgardeo custom schema
    const asgardeoSchema = user['urn:ietf:params:scim:schemas:extension:asgardeo:2.0:User'] as Record<string, unknown> | undefined;
    if (asgardeoSchema) {
      this.logger.info(`Found asgardeo schema: ${JSON.stringify(asgardeoSchema)}`);
      Object.assign(attributes, asgardeoSchema);
    }

    // Check for custom schema (where asgardeo_role is typically stored)
    const customSchema = user['urn:scim:schemas:extension:custom:User'] as Record<string, unknown> | undefined;
    if (customSchema) {
      this.logger.info(`Found custom schema: ${JSON.stringify(customSchema)}`);
      Object.assign(attributes, customSchema);
      // Extract asgardeo_role specifically from custom schema
      if (customSchema.asgardeo_role) {
        this.logger.info(`✅ Found asgardeo_role in custom schema: ${customSchema.asgardeo_role}`);
        // Also add it as a role
        const roleValue = String(customSchema.asgardeo_role);
        if (!roles.includes(roleValue)) {
          roles.push(roleValue);
        }
      }
    }

    // Check all schema extensions (any key starting with "urn:")
    for (const key of Object.keys(userObj)) {
      if (key.startsWith('urn:') && typeof userObj[key] === 'object' && userObj[key] !== null) {
        this.logger.info(`Found schema extension ${key}: ${JSON.stringify(userObj[key])}`);
        Object.assign(attributes, userObj[key] as Record<string, unknown>);
      }
    }

    // Check for asgardeo_role in various locations
    // 1. Top-level attribute
    if (user.asgardeo_role) {
      this.logger.info(`Found asgardeo_role at top level: ${user.asgardeo_role}`);
      attributes['asgardeo_role'] = user.asgardeo_role;
    }

    // 2. Check in wso2Schema if not already found
    if (!attributes['asgardeo_role'] && wso2Schema?.asgardeo_role) {
      this.logger.info(`Found asgardeo_role in wso2Schema: ${wso2Schema.asgardeo_role}`);
      attributes['asgardeo_role'] = wso2Schema.asgardeo_role;
    }

    // 3. Check all keys in user object (case-insensitive search)
    for (const key of Object.keys(userObj)) {
      if (key.toLowerCase().includes('asgardeo') || key.toLowerCase().includes('role')) {
        this.logger.info(`Found potential role attribute: ${key} = ${JSON.stringify(userObj[key])}`);
        if (!attributes[key]) {
          attributes[key] = userObj[key];
        }
      }
    }

    this.logger.info(`Final attributes: ${JSON.stringify(attributes)}`);

    return {
      username: user.userName || '',
      displayName: user.displayName,
      email: user.emails?.[0]?.value,
      roles: [...new Set(roles)],
      groups: [...new Set(groups)],
      attributes,
    };
  }

  /**
   * Resolves the access token to use against WSO2.
   *
   * We exclusively use the client_credentials grant type to authenticate the backend plugin.
   */
  private async resolveAccessToken(): Promise<string> {
    const { clientId, clientSecret, tokenUrl } = this.config.auth;

    if (!tokenUrl) {
      throw new Error('tokenUrl is required for client_credentials grant');
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'apim:api_view apim:subscribe apim:api_create apim:api_publish');

    this.logger.info('Requesting WSO2 access token via client_credentials grant');

    const response = await undiciFetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basicAuth}`,
      },
      body: params.toString(),
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `WSO2 token grant failed ${response.status} ${response.statusText}: ${body}`,
      );
      throw new Error(
        `WSO2 token grant failed, status ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new Error('WSO2 token grant: no access_token in response');
    }

    this.logger.info('WSO2 access token obtained via client_credentials grant');
    return data.access_token;
  }



  private async requestPublisher<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<T> {
    const accessToken = await this.resolveAccessToken();
    const response = await undiciFetch(`${this.publisherBaseUrl}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...(options?.headers ?? {}),
      },
      body: options?.body,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `WSO2 Publisher request failed ${response.status} ${response.statusText}: ${body}`,
      );
      throw new Error(
        `WSO2 Publisher request failed, status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }
}

function mapApiSummary(value: unknown): Wso2ApiSummary {
  const item = value as Record<string, unknown>;
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    version: toOptionalString(item.version),
    provider: toOptionalString(item.provider),
    context: toOptionalString(item.context),
    lifeCycleStatus: toOptionalString(item.lifeCycleStatus),
    type: toOptionalString(item.type),
    visibility: toVisibility(item.visibility),
    visibleRoles: toStringArray(item.visibleRoles),
  };
}

function mapApiDetail(value: Record<string, unknown>): Wso2ApiDetail {
  return {
    id: String(value.id ?? ''),
    name: String(value.name ?? ''),
    version: toOptionalString(value.version),
    provider: toOptionalString(value.provider),
    context: toOptionalString(value.context),
    lifeCycleStatus: toOptionalString(value.lifeCycleStatus),
    type: toOptionalString(value.type),
    description: toOptionalString(value.description),
    visibility: toVisibility(value.visibility),
    visibleRoles: toStringArray(value.visibleRoles),
    endpointURLs: Array.isArray(value.endpointURLs)
      ? (value.endpointURLs as Wso2ApiDetail['endpointURLs'])
      : undefined,
  };
}

function toVisibility(value: unknown): 'PUBLIC' | 'RESTRICTED' | 'PRIVATE' | undefined {
  if (value === 'PUBLIC' || value === 'RESTRICTED' || value === 'PRIVATE') {
    return value;
  }
  return undefined;
}

function toStringArray(value: unknown): string[] | undefined {
  if (Array.isArray(value)) {
    return value.filter(v => typeof v === 'string').map(String);
  }
  return undefined;
}

function mapApiDocument(value: unknown): Wso2ApiDocument {
  const item = value as Record<string, unknown>;
  return {
    id: String(item.documentId ?? item.id ?? ''),
    name: String(item.name ?? ''),
    summary: toOptionalString(item.summary),
    sourceType: toOptionalString(item.sourceType),
    sourceUrl: toOptionalString(item.sourceUrl),
    type: toOptionalString(item.type),
  };
}

function toOptionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function buildPublisherCreatePayload(input: {
  name: string;
  context: string;
  version: string;
  endpointUrl: string;
  description?: string;
}) {
  const endpointConfig = {
    endpoint_type: 'http',
    production_endpoints: {
      url: input.endpointUrl,
      config: null,
    },
    sandbox_endpoints: {
      url: input.endpointUrl,
      config: null,
    },
  };

  return {
    name: input.name,
    context: input.context,
    version: input.version,
    type: 'HTTP',
    transport: ['http', 'https'],
    visibility: 'PUBLIC',
    description: input.description,
    endpointConfig: JSON.stringify(endpointConfig),
  };
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
