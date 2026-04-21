

export type Wso2ApiSummary = {
  id: string;
  name: string;
  namespace?: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
};
export type Wso2ApiProductSummary = {
  id: string;
  name: string;
  namespace?: string;
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
  namespace?: string;
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
  businessInformation?: {
    businessOwner?: string;
    businessOwnerEmail?: string;
    technicalOwner?: string;
    technicalOwnerEmail?: string;
  };
  apiThrottlingPolicy?: string;
  visibility?: string;
  transport?: string[];
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
  getGraphqlSchema(apiId: string, token?: string): Promise<string>;
  getAsyncApiDefinition(apiId: string, token?: string): Promise<string>;
  getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse>;
}
