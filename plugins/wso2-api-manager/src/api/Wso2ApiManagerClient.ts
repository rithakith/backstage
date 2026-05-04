import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiRevisionsResponse,
  Wso2ApiManagerApi,
} from './types';



export class Wso2ApiManagerClient implements Wso2ApiManagerApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('wso2-api-manager');
  }


  async generateApiKey(apiId: string, token?: string): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      console.log(`[WSO2-APIClient] Adding X-WSO2-Access-Token header to generateApiKey request for ${apiId}`);
      headers['X-WSO2-Access-Token'] = token;
    } else {
      console.log(`[WSO2-APIClient] No token provided to generateApiKey for ${apiId}`);
    }
    console.log(`[WSO2-APIClient] Fetching: POST ${baseUrl}/apis/${apiId}/generate-key`);
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/generate-key`,
      { method: 'POST', headers }
    );
    console.log(`[WSO2-APIClient] Response: ${response}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to generate API key, status ${response.status}: ${errText}`);
    }
    return await response.json();
  }

  async getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (options?.query) {
      params.append('query', options.query);
    }

    const headers: Record<string, string> = {};
    if (options?.token) {
      headers['X-WSO2-Access-Token'] = options.token;
    }

    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/revisions?${params.toString()}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch API revisions, status ${response.status}`);
    }

    return (await response.json()) as Wso2ApiRevisionsResponse;
  }
  async getGateways(token?: string): Promise<any[]> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }
    const response = await this.fetchApi.fetch(`${baseUrl}/gateways`, { headers });
    if (!response.ok) {
      let errText = '';
      try { errText = await response.text(); } catch (e) {}
      throw new Error(`Failed to fetch gateways, status ${response.status}: ${errText}`);
    }
    const text = await response.text();
    if (!text || text.trim() === '') {
      return [];
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn('[WSO2-APIClient] Invalid JSON from /gateways:', text);
      return [];
    }
  }
}
