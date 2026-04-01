import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiDetail,
  Wso2ApiProductDetail,
  Wso2ApiDocumentsResponse,
  Wso2ApiListResponse,
  Wso2ApiProductListResponse,
  Wso2McpListResponse,
  Wso2ApiRevisionsResponse,
  Wso2ApiDocument,
  Wso2ApiDocumentCreate,
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

  async listApiProducts(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2ApiProductListResponse> {
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
      `${baseUrl}/api-products?${params.toString()}`,
      { headers },
    );

    if (!response.ok) {
      throw new Error(`Failed to list API Products, status ${response.status}`);
    }

    return (await response.json()) as Wso2ApiProductListResponse;
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
    console.log(`🌐 [WSO2-APIClient] Updating definition: PUT ${baseUrl}/publisher/apis/${apiId}/swagger`);
    const response = await this.fetchApi.fetch(
      `${baseUrl}/publisher/apis/${apiId}/swagger`,
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

  async updateGraphqlSchema(
    apiId: string,
    schema: string,
    token?: string,
  ): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['X-WSO2-Access-Token'] = token;
    }

    const response = await this.fetchApi.fetch(`${baseUrl}/apis/${apiId}/graphql-schema`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ schema }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to update AsyncAPI definition, status ${response.status}`);
    }
  }

  async addDocument(
    apiId: string,
    document: Wso2ApiDocumentCreate,
    token?: string,
  ): Promise<Wso2ApiDocument> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['X-WSO2-Access-Token'] = token;

    const response = await this.fetchApi.fetch(
      `${baseUrl}/publisher/apis/${apiId}/documents`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify(document),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to add document, status ${response.status}`);
    }
    return (await response.json()) as Wso2ApiDocument;
  }

  async validateDocumentName(
    apiId: string,
    name: string,
    token?: string,
  ): Promise<boolean> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['X-WSO2-Access-Token'] = token;

    const response = await this.fetchApi.fetch(
      `${baseUrl}/publisher/apis/${apiId}/documents/validate?name=${encodeURIComponent(name)}`,
      {
        method: 'POST',
        headers,
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to validate document name, status ${response.status}`);
    }
    
    const result = await response.json();
    console.log(`🔍 [WSO2-APIClient] Validation result:`, result);
    return result.isValid;
  }

  async addDocumentContent(
    apiId: string,
    documentId: string,
    content: string | File,
    filename?: string,
    token?: string,
  ): Promise<void> {
    const baseUrl = await this.getBaseUrl();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) headers['X-WSO2-Access-Token'] = token;

    let finalContent = content;
    let finalFilename = filename;

    if (content instanceof File) {
      finalFilename = filename || content.name;
      finalContent = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(content);
      });
    }

    const response = await this.fetchApi.fetch(
      `${baseUrl}/publisher/apis/${apiId}/documents/${documentId}/content`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          content: finalContent,
          filename: finalFilename,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || `Failed to add document content, status ${response.status}`);
    }
  }
}
