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
  }): Promise<Wso2ApiListResponse> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.set('offset', String(options.offset));
    }
    if (options?.query) {
      params.set('query', options.query);
    }
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis?${params.toString()}`,
    );
    if (!response.ok) {
      throw new Error(`Failed to list APIs, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiListResponse;
  }

  async getApi(apiId: string): Promise<Wso2ApiDetail> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/apis/${apiId}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch API, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiDetail;
  }

  async listDocuments(apiId: string): Promise<Wso2ApiDocumentsResponse> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/documents`,
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
  }): Promise<Wso2ApiListResponse> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options?.offset !== undefined) {
      params.set('offset', String(options.offset));
    }
    if (options?.query) {
      params.set('query', options.query);
    }
    const response = await this.fetchApi.fetch(
      `${baseUrl}/publisher/apis?${params.toString()}`,
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
  }): Promise<Wso2ApiDetail> {
    const baseUrl = await this.getBaseUrl();
    const response = await this.fetchApi.fetch(`${baseUrl}/publisher/apis`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
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
