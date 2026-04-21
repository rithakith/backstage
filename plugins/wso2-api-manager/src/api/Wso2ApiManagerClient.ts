import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiDetail,
  Wso2ApiProductDetail,
  Wso2ApiDocumentsResponse,
  Wso2McpListResponse,
  Wso2ApiRevisionsResponse,
  Wso2McpDetail,
  Wso2McpTool,
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



  async listMcps(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2McpListResponse> {
    const baseUrl = await this.getBaseUrl();
    const params = new URLSearchParams();
    if (options?.limit !== undefined) params.append('limit', String(options.limit));
    if (options?.offset !== undefined) params.append('offset', String(options.offset));
    if (options?.query) params.append('query', options.query);

    const headers: Record<string, string> = {};
    if (options?.token) headers['X-WSO2-Access-Token'] = options.token;

    const response = await this.fetchApi.fetch(
      `${baseUrl}/mcp-servers?${params.toString()}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Failed to list MCP Servers, status ${response.status}`);
    }

    return (await response.json()) as Wso2McpListResponse;
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

  async getApiProduct(apiId: string, token?: string): Promise<Wso2ApiProductDetail> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }
    const response = await this.fetchApi.fetch(
      `${baseUrl}/api-products/${apiId}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch API product, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiProductDetail;
  }

  async getMcp(mcpId: string, token?: string): Promise<Wso2McpDetail> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) headers['X-WSO2-Access-Token'] = token;
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/mcp-servers/${mcpId}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch MCP Server, status ${response.status}`);
    }
    return (await response.json()) as Wso2McpDetail;
  }

  async generateApiKey(apiId: string, token?: string): Promise<any> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      console.log(`🎫 [WSO2-APIClient] Adding X-WSO2-Access-Token header to generateApiKey request for ${apiId}`);
      headers['X-WSO2-Access-Token'] = token;
    } else {
      console.log(`⚠️ [WSO2-APIClient] No token provided to generateApiKey for ${apiId}`);
    }
    console.log(`🌐 [WSO2-APIClient] Fetching: POST ${baseUrl}/apis/${apiId}/generate-key`);
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/generate-key`,
      { method: 'POST', headers }
    );
    console.log(`🌐 [WSO2-APIClient] Response: ${response}`);
    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Failed to generate API key, status ${response.status}: ${errText}`);
    }
    return await response.json();
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

  async listMcpDocuments(mcpId: string, token?: string): Promise<Wso2ApiDocumentsResponse> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) headers['X-WSO2-Access-Token'] = token;
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/mcp-servers/${mcpId}/documents`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to list MCP documents, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiDocumentsResponse;
  }

  async listMcpTools(mcpId: string, token?: string): Promise<Wso2McpTool[]> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) headers['X-WSO2-Access-Token'] = token;
    
    const response = await this.fetchApi.fetch(
      `${baseUrl}/mcp-servers/${mcpId}/tools`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to list MCP tools, status ${response.status}`);
    }
    return (await response.json()) as Wso2McpTool[];
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
    console.log(`🌐 [WSO2-APIClient] Fetching: ${baseUrl}/apis/${apiId}/swagger`);
    const response = await this.fetchApi.fetch(
      `${baseUrl}/apis/${apiId}/swagger?t=${Date.now()}`,
      { headers },
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch API definition, status ${response.status}`);
    }
    return await response.json();
  }

  async getGraphqlSchema(apiId: string, token?: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/apis/${apiId}/graphql-schema?t=${Date.now()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GraphQL schema, status ${response.status}`);
    }

    return await response.text();
  }

  async getAsyncApiDefinition(apiId: string, token?: string): Promise<string> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {};
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/apis/${apiId}/asyncapi?t=${Date.now()}`, {
      headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch AsyncAPI definition, status ${response.status}`);
    }

    return await response.text();
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













}
