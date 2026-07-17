/*
 * Copyright 2026 WSO2 LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { Agent, fetch as undiciFetch, Response } from 'undici';
import {
  Wso2ApiDocument,
  Wso2ApiManagerConfig,
  Wso2ApiRevisionsResponse,
} from './types';


export function readWso2ApiManagerConfig(
  config: RootConfigService,
): Wso2ApiManagerConfig {
  const wso2Config = config.getOptionalConfig('wso2ApiManager');
  if (!wso2Config) {
    throw new Error('Missing wso2ApiManager configuration');
  }

  const baseUrl = wso2Config.getString('baseUrl');
  const publisherBasePath = wso2Config.getString('publisherBasePath');
  const developerBasePath = wso2Config.getString('developerBasePath');
  const serviceCatalogBasePath = wso2Config.getOptionalString('serviceCatalogBasePath');

  const authConfig = wso2Config.getConfig('auth');
  const clientId = authConfig.getString('clientId');
  const clientSecret = authConfig.getString('clientSecret');
  const tokenUrl = authConfig.getOptionalString('tokenUrl');

  const tlsRejectUnauthorized =
    wso2Config.getOptionalBoolean('tls.rejectUnauthorized') ?? true;

    const selfHostedGateways = config.getOptionalConfigArray('wso2PlatformGateway')?.map(gw => {
      const discoveryUsername = gw.getString('discoveryUsername');
      const discoveryPassword = gw.getString('discoveryPassword');
      
      // Credentials presence check
      
      return {
        name: gw.getString('name'),
        urls: gw.getStringArray('urls'),
        discoveryUrl: gw.getOptionalString('discoveryUrl'),
        discoveryAuth: (discoveryUsername && discoveryPassword)
            ? `Basic ${Buffer.from(`${discoveryUsername}:${discoveryPassword}`).toString('base64')}`
            : undefined,
        environmentType: gw.getOptionalString('environmentType') || 'PRODUCTION',
        description: gw.getOptionalString('description'),
        organizationId: gw.getOptionalString('organizationId'),
      };
    }) || [];

    return {
      baseUrl,
      publisherBasePath,
      developerBasePath,
      serviceCatalogBasePath,
      auth: {
        clientId,
        clientSecret,
        tokenUrl,
      },
      tls: {
        rejectUnauthorized: tlsRejectUnauthorized,
      },
      selfHostedGateways,
    };
  }

export class Wso2ApiManagerClient {
  private readonly config: Wso2ApiManagerConfig;
  private readonly logger: LoggerService;
  private readonly publisherBaseUrl: string;
  private readonly devportalBaseUrl: string;
  private readonly serviceCatalogBaseUrl: string;
  private readonly dispatcher?: Agent;

  constructor(options: { config: Wso2ApiManagerConfig; logger: LoggerService }) {
    this.config = options.config;
    this.logger = options.logger;
    this.publisherBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.publisherBasePath,
    );
    this.devportalBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.developerBasePath,
    );
    this.serviceCatalogBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.serviceCatalogBasePath || '/api/am/service-catalog/v1',
    );
    if (!options.config.tls.rejectUnauthorized) {
      this.dispatcher = new Agent({
        connect: {
          rejectUnauthorized: false,
        },
      });
    }
  }

  private async extractWso2ErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.text();
      try {
        const json = JSON.parse(body);
        if (json.message && json.description) {
          return `${json.message}: ${json.description}`;
        }
        return json.message || json.description || body;
      } catch (e) {
        return body || response.statusText || `Status ${response.status}`;
      }
    } catch (e) {
      return response.statusText || `Status ${response.status}`;
    }
  }

  async generateApiKey(apiId: string, options?: { keyName?: string }): Promise<Record<string, unknown>> {
    return await this.requestDevportal<Record<string, unknown>>(
      `/apis/${apiId}/api-keys/generate`,
      {
        method: 'POST',
        body: JSON.stringify({
          keyName: options?.keyName || 'Backstage_Key',
          keyType: 'PRODUCTION',
          validityPeriod: 3600,
          additionalProperties: {},
        }),
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );
  }

  private async requestDevportal<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
    token?: string
  ): Promise<T> {
    const isUserToken = !!token;
    const accessToken = token || (await this.resolveAccessToken());
    const url = `${this.devportalBaseUrl}${path}`;

    this.logger.debug(`[WSO2-Client] Fetching DevPortal ${url} using ${isUserToken ? 'a USER' : 'SERVICE-ACCOUNT'} token`);

    const response = await undiciFetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options?.headers ?? {}),
      },
      body: options?.body,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      if (response.status === 401 && isUserToken) {
        this.logger.warn(`[WSO2-Client] User token failed with 401 for DevPortal ${path}. Retrying with SERVICE-ACCOUNT token.`);
        return await this.requestDevportal(path, options, undefined);
      }

      const message = await this.extractWso2ErrorMessage(response);
      const errorMsg = `WSO2 DevPortal request failed (context: ${isUserToken ? 'USER' : 'SERVICE-ACCOUNT'}), status ${response.status}: ${message}`;
      this.logger.error(`[WSO2-Client] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      return text as unknown as T;
    }
  }

  private async requestServiceCatalog<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
    token?: string
  ): Promise<T> {
    const isUserToken = !!token;
    const accessToken = token || (await this.resolveAccessToken());
    const url = `${this.serviceCatalogBaseUrl}${path}`;

    this.logger.debug(`[WSO2-Client] Fetching Service Catalog ${url} using ${isUserToken ? 'USER' : 'SERVICE-ACCOUNT'} token`);

    const response = await undiciFetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options?.headers ?? {}),
      },
      body: options?.body,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      if (response.status === 401 && isUserToken) {
        this.logger.warn(`[WSO2-Client] User token failed with 401 for Service Catalog ${path}. Retrying with SERVICE-ACCOUNT token.`);
        return await this.requestServiceCatalog(path, options, undefined);
      }

      const message = await this.extractWso2ErrorMessage(response);
      const errorMsg = `WSO2 Service Catalog request failed, status ${response.status}: ${message}`;
      this.logger.error(`[WSO2-Client] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      return text as unknown as T;
    }
  }

  async getServices(options?: { offset?: number; limit?: number; token?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.offset !== undefined) params.set('offset', options.offset.toString());
    if (options?.limit !== undefined) params.set('limit', options.limit.toString());
    
    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.requestServiceCatalog<any>(`/services${query}`, {}, options?.token);
  }

  async getApis(options?: { offset?: number; limit?: number; token?: string }): Promise<any> {
    const params = new URLSearchParams();
    if (options?.offset !== undefined) params.set('offset', options.offset.toString());
    if (options?.limit !== undefined) params.set('limit', options.limit.toString());

    const query = params.toString() ? `?${params.toString()}` : '';
    return await this.requestPublisher<any>(`/apis${query}`, {}, options?.token);
  }

  async getServiceUsage(serviceId: string, token?: string): Promise<any> {
    return await this.requestServiceCatalog<any>(`/services/${serviceId}/usage`, {}, token);
  }

  async getServiceDefinition(serviceId: string, token?: string): Promise<string> {
    const isUserToken = !!token;
    const accessToken = token || (await this.resolveAccessToken());
    const url = `${this.serviceCatalogBaseUrl}/services/${serviceId}/definition`;

    const response = await undiciFetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      if (response.status === 401 && isUserToken) {
         return await this.getServiceDefinition(serviceId, undefined);
      }
      throw new Error(`Failed to fetch service definition for ${serviceId}`);
    }
    const text = await response.text();
    return text;
  }
  async getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse> {
    const params = new URLSearchParams();
    if (options?.query) {
      params.set('query', options.query);
    }
    return await this.requestPublisher<Wso2ApiRevisionsResponse>(
      `/apis/${apiId}/revisions?${params.toString()}`,
      {},
      options?.token
    );
  }

  async getDocument(apiId: string, documentId: string, token?: string): Promise<Wso2ApiDocument> {
    return await this.requestPublisher<Wso2ApiDocument>(
      `/apis/${apiId}/documents/${documentId}`,
      {},
      token
    );
  }

  async getDocumentContentStream(apiId: string, documentId: string, token?: string): Promise<Response> {
    return await this.fetchWithFallback(`/apis/${apiId}/documents/${documentId}/content?t=${Date.now()}`, {
      headers: { Accept: '*/*' }
    }, token);
  }

  async getApiWsdlStream(apiId: string, token?: string): Promise<Response> {
    return await this.fetchWithFallback(`/apis/${apiId}/wsdl`, {
      headers: { Accept: 'application/zip, application/wsdl+xml, text/xml, */*' }
    }, token);
  }

  async getSettings(token?: string): Promise<any> {
    return await this.requestPublisher<any>('/settings', {}, token);
  }

  getConfig(): Wso2ApiManagerConfig {
    return this.config;
  }

  async getGatewayApis(discoveryUrl: string, auth?: string): Promise<any[]> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (auth) {
      headers['Authorization'] = auth;
    }
    
    this.logger.info(`[WSO2-GATEWAY-DISCOVERY] Attempting to fetch APIs from gateway discovery URL: ${discoveryUrl} (Auth present: ${!!auth})`);
    
    try {
      const response = await undiciFetch(discoveryUrl, { 
        headers,
        dispatcher: this.dispatcher,
      });

      if (!response.ok) {
        const errText = await response.text();
        this.logger.error(`[WSO2-GATEWAY-DISCOVERY] Gateway Discovery failed for ${discoveryUrl}. Status: ${response.status}. Response: ${errText}`);
        throw new Error(`Failed to fetch APIs from gateway ${discoveryUrl}, status ${response.status}`);
      }

      const data = (await response.json()) as any;
      
      // If it's an array, we can log the count
      if (Array.isArray(data)) {
        this.logger.info(`[WSO2-GATEWAY-DISCOVERY] Successfully discovered ${data.length} APIs (Array) from gateway: ${discoveryUrl}`);
        this.logger.debug(`[WSO2-GATEWAY-DISCOVERY] API Names: ${data.map((a: any) => a.name || a.id).join(', ')}`);
        return data;
      }
      
      // If it's an object, check for common list patterns
      const list = data.list || data.apis || data.items || [];
      const count = Array.isArray(list) ? list.length : (data.count ?? 'unknown');
      
      this.logger.info(`[WSO2-GATEWAY-DISCOVERY] Successfully discovered ${count} APIs (Object) from gateway: ${discoveryUrl}`);
      this.logger.info(`[WSO2-GATEWAY-DISCOVERY] Response keys: ${Object.keys(data).join(', ')}`);
      
      if (Array.isArray(list)) {
        this.logger.debug(`[WSO2-GATEWAY-DISCOVERY] API Details: ${JSON.stringify(list, null, 2)}`);
      } else {
        this.logger.debug(`[WSO2-GATEWAY-DISCOVERY] Raw Response snippet: ${JSON.stringify(data).substring(0, 1000)}`);
      }
      
      return Array.isArray(list) ? list : [data]; // Fallback to wrapping the object in an array
    } catch (error: any) {
      const errorDetails = error.cause ? `${error.message} (Cause: ${error.cause})` : error.message;
      this.logger.error(`[WSO2-GATEWAY-DISCOVERY] Error during gateway discovery for ${discoveryUrl}: ${errorDetails}`);
      throw error;
    }
  }


  private cachedAccessToken: string | null = null;
  private tokenExpiryTime: number = 0;

  private async resolveAccessToken(): Promise<string> {
    if (this.cachedAccessToken && Date.now() < this.tokenExpiryTime - 300000) {
      return this.cachedAccessToken;
    }

    const { clientId, clientSecret, tokenUrl } = this.config.auth;
    if (!tokenUrl) {
      throw new Error('tokenUrl is required for client_credentials grant');
    }

    const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('scope', 'apim:api_generate_key apim:api_create apim:api_manage apim:api_view apim:api_publish apim:subscribe apim:api_key apim:mcp_server_view apim:publisher_settings apim:app_manage');

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
      throw new Error(`WSO2 token grant failed, status ${response.status}`);
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };

    if (!data.access_token) {
      throw new Error('WSO2 token grant: no access_token in response');
    }

    this.cachedAccessToken = data.access_token;
    this.tokenExpiryTime = Date.now() + (data.expires_in || 3600) * 1000;
    this.logger.info(
      `[WSO2-Client] Successfully obtained ${data.token_type ?? 'Bearer'} service-account token with scopes: ${data.scope ?? 'not returned'}`,
    );
    return data.access_token;
  }

  private async fetchWithFallback(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
    token?: string
  ): Promise<Response> {
    const isUserToken = !!token;
// First !: Converts the string to a Boolean and inverts it.
// If token is "abc", !token becomes false.
// If token is undefined, !token becomes true.
// Second !: Inverts it back to the correct Boolean state.
// !!("abc") -> true
// !!(undefined) -> false
    const accessToken = token || (await this.resolveAccessToken());
    const url = `${this.publisherBaseUrl}${path}`;

    this.logger.debug(`[WSO2-Client] Fetching ${url} using ${isUserToken ? '                                                                                                                                                                                                                                                                                                                      aUSER' : 'SERVICE-ACCOUNT'} token`);

    const response = await undiciFetch(url, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(options?.headers ?? {}),
      },
      body: options?.body,
      dispatcher: this.dispatcher,
    });

    // Handle 401 fallback
    if (response.status === 401 && isUserToken) {
      this.logger.warn(`[WSO2-Client] User token failed with 401 for ${path}. Retrying with SERVICE-ACCOUNT token.`);
      // Retry without user token
      return await this.fetchWithFallback(path, options, undefined);
    }

    return response;
  }

  private async requestPublisher<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
    token?: string
  ): Promise<T> {
    const response = await this.fetchWithFallback(path, options, token);
    const isUserToken = !!token;

    if (!response.ok) {
      const message = await this.extractWso2ErrorMessage(response);
      const errorMsg = `WSO2 Publisher request failed (context: ${isUserToken ? 'USER' : 'SERVICE-ACCOUNT'}), status ${response.status}: ${message.substring(0, 500)}`;
      this.logger.error(`[WSO2-Client] ${errorMsg}`);
      throw new Error(errorMsg);
    }

    const text = await response.text();
    try {
      return JSON.parse(text) as T;
    } catch (e) {
      return text as unknown as T;
    }
  }
}

function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.replace(/\/$/, '');
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${normalizedBase}${normalizedPath}`;
}
