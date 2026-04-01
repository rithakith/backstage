import { createApiRef, OAuthApi } from '@backstage/core-plugin-api';

export type Wso2ApiSummary = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
};
export type Wso2ApiProductSummary = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
};

export type Wso2ApiProductOperation = {
  target: string;
  verb: string;
};

export type Wso2ApiProductResource = {
  apiId: string;
  name: string;
  version: string;
  operations: Wso2ApiProductOperation[];
};

export type Wso2ApiProductDetail = Wso2ApiProductSummary & {
  description?: string;
  apis: Wso2ApiProductResource[];
};

export type Wso2McpTool = {
  name: string;
  description?: string;
  authType?: string;
  throttlingPolicy?: string;
  payloadSchema?: any;
};

export type Wso2McpSummary = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  tools?: Wso2McpTool[];
};

export type Wso2McpDetail = Wso2McpSummary & {
  description?: string;
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
};

export type Wso2ApiDocumentType = 'HOWTO' | 'SAMPLES' | 'PUBLIC_FORUM' | 'SUPPORT_FORUM' | 'OTHER' | 'SWAGGER_DOC';
export type Wso2ApiDocumentSourceType = 'INLINE' | 'URL' | 'FILE' | 'MARKDOWN';

export type Wso2ApiDocumentCreate = {
  name: string;
  type: string;
  summary?: string;
  sourceType: string;
  sourceUrl?: string;
  inlineContent?: string;
  otherTypeName?: string;
  visibility?: 'API_LEVEL' | 'PRIVATE' | 'OWNER_ONLY';
};

export type Wso2ApiListResponse = {
  apis: Wso2ApiSummary[];
  pagination?: {
    offset: number;
    limit: number;
    total: number;
  };
};

export type Wso2ApiProductListResponse = {
  apiProducts: Wso2ApiProductSummary[];
  pagination?: {
    offset: number;
    limit: number;
    total: number;
  };
};

export type Wso2McpListResponse = {
  mcpServers: Wso2McpSummary[];
  pagination?: {
    offset: number;
    limit: number;
    total: number;
  };
};

export type Wso2ApiDocumentsResponse = {
  documents: Wso2ApiDocument[];
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
  getMcp(mcpId: string, token?: string): Promise<Wso2McpDetail>;
  listDocuments(apiId: string, token?: string): Promise<Wso2ApiDocumentsResponse>;
  listMcpDocuments(mcpId: string, token?: string): Promise<Wso2ApiDocumentsResponse>;
  listMcpTools(mcpId: string, token?: string): Promise<Wso2McpTool[]>;
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
