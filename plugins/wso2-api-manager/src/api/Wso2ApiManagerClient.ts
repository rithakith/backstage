import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiDetail,
  Wso2ApiDocumentsResponse,
  Wso2ApiListResponse,
} from './types';



export class Wso2ApiManagerClient {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('wso2-api-manager');
  }

  async listApis(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2ApiListResponse> {
    const baseUrl = await this.getBaseUrl(); // e.g. http://localhost:7007/api/wso2-api-manager
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.append('offset', String(options.offset));
    }
    if (options?.query) {
      params.append('query', options.query);
    }

    const headers: Record<string, string> = {};
    if (options?.token) {
      headers['X-WSO2-Access-Token'] = options.token;
    }

    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis?${params.toString()}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Failed to list APIs, status ${response.status}`);
    }

    return (await response.json()) as Wso2ApiListResponse;
  }

  async getApi(apiId: string, token?: string): Promise<Wso2ApiDetail> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch API, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiDetail;
  }

  async listDocuments(apiId: string, token?: string): Promise<Wso2ApiDocumentsResponse> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/documents`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to list documents, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiDocumentsResponse;
  }

  async listPublisherApis(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2ApiListResponse> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.append('limit', String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.append('offset', String(options.offset));
    }
    if (options?.query) {
      params.append('query', options.query);
    }

    const headers: Record<string, string> = {};
    if (options?.token) {
      headers['X-WSO2-Access-Token'] = options.token;
    }

    const response = await this.fetchApi.fetch(
      `${baseUrl}/publisher/apis?${params.toString()}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(
        `Failed to list publisher APIs, status ${response.status}`,
      );
    }
    return (await response.json()) as Wso2ApiListResponse;
  }

  async createPublisherApi(input: {
    name: string;
    context: string;
    version: string;
    endpointUrl: string;
    description?: string;
    token?: string;
  }): Promise<Wso2ApiDetail> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (input.token) {
      headers['X-WSO2-Access-Token'] = input.token;
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/publisher/apis`, {
      method: 'POST',
      headers,
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Failed to create publisher API, status ${response.status}: ${body}`,
      );
    }
    return (await response.json()) as Wso2ApiDetail;
  }
}
