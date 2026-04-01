import { createApiRef, OAuthApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiDetail,
  Wso2ApiProductDetail,
  Wso2ApiProductResource,
  Wso2ApiProductOperation,
  Wso2ApiDocumentsResponse,
  Wso2ApiListResponse,
  Wso2ApiProductListResponse,
  Wso2McpListResponse,
  Wso2ApiRevisionsResponse,
  Wso2ApiDocument,
  Wso2ApiDocumentCreate,
} from './types';

export interface Wso2ApiManagerApi {
  listApis(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2ApiListResponse>;
  listApiProducts(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2ApiProductListResponse>;
  listMcps(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2McpListResponse>;
  getApi(apiId: string, token?: string): Promise<Wso2ApiDetail>;
  getApiProduct(apiId: string, token?: string): Promise<Wso2ApiProductDetail>;
  listDocuments(apiId: string, token?: string): Promise<Wso2ApiDocumentsResponse>;
  getApiDefinition(apiId: string, token?: string): Promise<any>;
  generateApiKey(apiId: string, token?: string): Promise<any>;
  updateApiDefinition(apiId: string, definition: string, token?: string): Promise<void>;
  getGraphqlSchema(apiId: string, token?: string): Promise<string>;
  updateGraphqlSchema(apiId: string, schema: string, token?: string): Promise<void>;
  getAsyncApiDefinition(apiId: string, token?: string): Promise<string>;
  updateAsyncApiDefinition(apiId: string, definition: string, token?: string): Promise<void>;
  getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse>;
  listPublisherApis(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2ApiListResponse>;
  createPublisherApi(input: {
    name: string;
    context: string;
    version: string;
    endpointUrl: string;
    description?: string;
    token?: string;
  }): Promise<Wso2ApiDetail>;
  addDocument(
    apiId: string,
    document: Wso2ApiDocumentCreate,
    token?: string,
  ): Promise<Wso2ApiDocument>;
  validateDocumentName(
    apiId: string,
    name: string,
    token?: string,
  ): Promise<boolean>;
  addDocumentContent(
    apiId: string,
    documentId: string,
    content: string | File,
    filename?: string,
    token?: string,
  ): Promise<void>;
}

export const wso2ApiManagerApiRef = createApiRef<Wso2ApiManagerApi>({
  id: 'plugin.wso2-api-manager.service',
});

export const wso2AuthApiRef = createApiRef<OAuthApi>({
  id: 'plugin.wso2-api-manager.auth',
});

export const thunderAuthApiRef = createApiRef<OAuthApi>({
  id: 'auth.thunder-auth',
});

export { Wso2ApiManagerClient } from './Wso2ApiManagerClient';
export type {
  Wso2ApiSummary,
  Wso2ApiProductSummary,
  Wso2McpSummary,
  Wso2ApiDetail,
  Wso2ApiProductDetail,
  Wso2ApiProductResource,
  Wso2ApiProductOperation,
  Wso2ApiDocument,
  Wso2ApiListResponse,
  Wso2ApiProductListResponse,
  Wso2McpListResponse,
  Wso2ApiDocumentsResponse,
  Wso2ApiRevision,
  Wso2ApiRevisionsResponse,
  Wso2ApiDocumentCreate,
} from './types';
