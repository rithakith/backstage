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

export type Wso2ApiManagerConfig = {
  baseUrl: string;
  devportalBasePath: string;
  publisherBasePath: string;
  tls: {
    rejectUnauthorized: boolean;
  };
  auth: {
    tokenUrl: string;
    grantType: 'client_credentials' | 'password';
    scopes?: string[];
    username?: string;
    password?: string;
    clientId: string;
    clientSecret: string;
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
  const tokenUrl =
    authConfig.getOptionalString('tokenUrl') ??
    `${baseUrl.replace(/\/$/, '')}/oauth2/token`;

  const tlsRejectUnauthorized =
    wso2Config.getOptionalBoolean('tls.rejectUnauthorized') ?? true;

  return {
    baseUrl,
    devportalBasePath,
    publisherBasePath,
    tls: {
      rejectUnauthorized: tlsRejectUnauthorized,
    },
    auth: {
      tokenUrl,
      grantType:
        authConfig.getOptionalString('grantType') === 'password'
          ? 'password'
          : 'client_credentials',
      scopes: authConfig.getOptionalStringArray('scopes'),
      username: authConfig.getOptionalString('username'),
      password: authConfig.getOptionalString('password'),
      clientId: authConfig.getString('clientId'),
      clientSecret: authConfig.getString('clientSecret'),
    },
  };
}

export class Wso2ApiManagerClient {
  private readonly config: Wso2ApiManagerConfig;
  private readonly logger: LoggerService;
  private readonly devportalBaseUrl: string;
  private readonly publisherBaseUrl: string;
  private readonly dispatcher?: Agent;
  private accessToken?: string;
  private tokenExpiresAt?: number;

  constructor(options: { config: Wso2ApiManagerConfig; logger: LoggerService }) {
    this.config = options.config;
    this.logger = options.logger;
    this.devportalBaseUrl = joinUrl(
      options.config.baseUrl,
      options.config.devportalBasePath,
    );
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

    const data = await this.request<{
      list?: unknown[];
      pagination?: { offset: number; limit: number; total: number };
    }>(`/apis?${params.toString()}`);

    return {
      apis: (data.list ?? []).map(mapApiSummary),
      pagination: data.pagination,
    };
  }

  async getApi(apiId: string): Promise<Wso2ApiDetail> {
    const data = await this.request<Record<string, unknown>>(`/apis/${apiId}`);
    return mapApiDetail(data);
  }

  async listDocuments(apiId: string): Promise<Wso2ApiDocumentsResponse> {
    const data = await this.request<{ list?: unknown[] }>(
      `/apis/${apiId}/documents`,
    );

    return {
      documents: (data.list ?? []).map(mapApiDocument),
    };
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

  private async request<T>(path: string): Promise<T> {
    const token = await this.getAccessToken();
    const response = await undiciFetch(`${this.devportalBaseUrl}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `WSO2 API Manager request failed ${response.status} ${response.statusText}: ${body}`,
      );
      throw new Error(
        `WSO2 API Manager request failed, status ${response.status}`,
      );
    }

    return (await response.json()) as T;
  }

  private async requestPublisher<T>(
    path: string,
    options?: {
      method?: string;
      headers?: Record<string, string>;
      body?: string;
    },
  ): Promise<T> {
    const token = await this.getAccessToken();
    const response = await undiciFetch(`${this.publisherBaseUrl}${path}`, {
      method: options?.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
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

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.tokenExpiresAt) {
      if (Date.now() < this.tokenExpiresAt) {
        return this.accessToken;
      }
    }

    const encoded = Buffer.from(
      `${this.config.auth.clientId}:${this.config.auth.clientSecret}`,
      'utf8',
    ).toString('base64');

    const form = new URLSearchParams();
    form.set('grant_type', this.config.auth.grantType);
    if (this.config.auth.grantType === 'password') {
      if (!this.config.auth.username || !this.config.auth.password) {
        throw new Error('WSO2 password grant requires username and password');
      }
      form.set('username', this.config.auth.username);
      form.set('password', this.config.auth.password);
    }
    if (this.config.auth.scopes?.length) {
      form.set('scope', this.config.auth.scopes.join(' '));
    }

    const response = await undiciFetch(this.config.auth.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${encoded}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: form,
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.error(
        `Failed to obtain WSO2 token ${response.status} ${response.statusText}: ${body}`,
      );
      throw new Error(
        `Failed to obtain WSO2 access token, status ${response.status}`,
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };

    if (!data.access_token) {
      throw new Error('WSO2 token response missing access_token');
    }

    const expiresInMs = (data.expires_in ?? 3600) * 1000;
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + Math.max(expiresInMs - 60000, 0);

    return this.accessToken;
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
    endpointURLs: Array.isArray(value.endpointURLs)
      ? (value.endpointURLs as Wso2ApiDetail['endpointURLs'])
      : undefined,
  };
}

function mapApiDocument(value: unknown): Wso2ApiDocument {
  const item = value as Record<string, unknown>;
  return {
    id: String(item.id ?? ''),
    name: String(item.name ?? ''),
    summary: toOptionalString(item.summary),
    sourceType: toOptionalString(item.sourceType),
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
