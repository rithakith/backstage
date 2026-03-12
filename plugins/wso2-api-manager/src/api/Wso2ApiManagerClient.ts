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
      console.log('🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to listApis request');
      headers['X-WSO2-Access-Token'] = options.token;
    } else {
      console.log('⚠️ [WSO2-APIClient] No token provided to listApis - header will not be added');
    }

    console.log(`🌐 [WSO2-APIClient] Fetching: ${baseUrl}/apis?${params.toString()}`);
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
      console.log(`🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to getApi request for ${apiId}`);
      headers['X-WSO2-Access-Token'] = token;
    } else {
      console.log(`⚠️ [WSO2-APIClient] No token provided to getApi for ${apiId}`);
    }
    console.log(`🌐 [WSO2-APIClient] Fetching: ${baseUrl}/apis/${apiId}`);
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
      console.log(`🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to listDocuments request for ${apiId}`);
      headers['X-WSO2-Access-Token'] = token;
    } else {
      console.log(`⚠️ [WSO2-APIClient] No token provided to listDocuments for ${apiId}`);
    }
    console.log(`🌐 [WSO2-APIClient] Fetching: ${baseUrl}/apis/${apiId}/documents`);
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/documents`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to list documents, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiDocumentsResponse;
  }

  async getApiDefinition(apiId: string, token?: string): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) {
      console.log(`🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to getApiDefinition request for ${apiId}`);
      headers['X-WSO2-Access-Token'] = token;
    } else {
      console.log(`⚠️ [WSO2-APIClient] No token provided to getApiDefinition for ${apiId}`);
    }
    console.log(`🌐 [WSO2-APIClient] Fetching: ${baseUrl}/apis/${apiId}/definition`);
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/definition`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch API definition, status ${response.status}`);
    }
    return await response.json();
  }

  async updateApiDefinition(apiId: string, definition: string, token?: string): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      console.log(`🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to updateApiDefinition request for ${apiId}`);
      headers['X-WSO2-Access-Token'] = token;
    } else {
      console.log(`⚠️ [WSO2-APIClient] No token provided to updateApiDefinition for ${apiId}`);
    }
    console.log(`🌐 [WSO2-APIClient] Updating definition: PUT ${baseUrl}/publisher/apis/${apiId}/definition`);
    const response = await this.fetchApi.fetch(
      `${baseUrl}/publisher/apis/${apiId}/definition`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({ definition }),
      },
    );
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Failed to update API definition, status ${response.status}: ${body}`);
    }
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
      console.log('🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to listPublisherApis request');
      headers['X-WSO2-Access-Token'] = options.token;
    } else {
      console.log('⚠️ [WSO2-APIClient] No token provided to listPublisherApis');
    }

    console.log(`🌐 [WSO2-APIClient] Fetching: ${baseUrl}/publisher/apis?${params.toString()}`);
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
      console.log('🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to createPublisherApi request');
      headers['X-WSO2-Access-Token'] = input.token;
    } else {
      console.log('⚠️ [WSO2-APIClient] No token provided to createPublisherApi');
    }

    console.log(`🌐 [WSO2-APIClient] Creating API: ${baseUrl}/publisher/apis`);
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
