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

export type Wso2McpSummary = {
  id: string;
  name: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
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
