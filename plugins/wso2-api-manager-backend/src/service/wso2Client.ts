import { LoggerService, RootConfigService } from '@backstage/backend-plugin-api';
import { Agent, fetch as undiciFetch, Response } from 'undici';

export type Wso2ApiSummary = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
};

export type Wso2ApiDetail = Wso2ApiSummary & {
  description?: string;
  endpointURLs?: Array<{
    environmentName?: string;
    environmentType?: string;
    urls?: string[];
  }>;
};

export type Wso2ApiDocument = {
  id: string;
  name: string;
  summary?: string;
  sourceType?: string;
  sourceUrl?: string;
  documentId?: string;
  type?: string;
  inlineContent?: string;
};

export type Wso2ApiRevision = {
  id: string;
  displayName: string;
  description?: string;
  createdTime?: string;
  deploymentInfo?: Array<{
    name: string;
    type: string;
    deployedTime: string;
  }>;
};

export type Wso2ApiRevisionsResponse = {
  count: number;
  list: Wso2ApiRevision[];
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

  async generateApiKey(apiId: string, token?: string): Promise<Record<string, unknown>> {
    return await this.requestPublisher<Record<string, unknown>>(
      `/apis/${apiId}/generate-key`,
      {
        method: 'POST',
        body: JSON.stringify({}),
        headers: {
          'Content-Type': 'application/json',
        },
      },
      token
    );
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
    return await this.fetchWithFallback(`/apis/${apiId}/documents/${documentId}/content?t=${Date.now()}`, {}, token);
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
    params.append('scope', 'apim:api_generate_key apim:api_create apim:api_manage apim:api_view apim:api_publish apim:subscribe apim:api_key apim:mcp_server_view');

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
    };

    if (!data.access_token) {
      throw new Error('WSO2 token grant: no access_token in response');
    }

    this.cachedAccessToken = data.access_token;
    this.tokenExpiryTime = Date.now() + (data.expires_in || 3600) * 1000;
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
    const accessToken = token || (await this.resolveAccessToken());
    const url = `${this.publisherBaseUrl}${path}`;

    this.logger.debug(`[WSO2-Client] Fetching ${url} using ${isUserToken ? 'USER' : 'SERVICE-ACCOUNT'} token`);

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
