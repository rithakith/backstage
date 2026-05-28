
export type Wso2GatewayInfo = {
  name: string;
  displayName: string;
  gatewayType: string;
};

export type Wso2ApiSummary = {
  id: string;
  name: string;
  displayName?: string;
  entityName?: string;
  namespace?: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
  isDiscovered?: boolean;
  gateways?: Wso2GatewayInfo[];
};
export type Wso2ApiProductSummary = {
  id: string;
  name: string;
  displayName?: string;
  entityName?: string;
  namespace?: string;
  version?: string;
  provider?: string;
  context?: string;
  lifeCycleStatus?: string;
  type?: string;
  isDiscovered?: boolean;
  gateways?: Wso2GatewayInfo[];
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
  isDiscovered?: boolean;
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
  apiPolicies?: {
    request?: any[];
    response?: any[];
    fault?: any[];
  };
  operations?: any[];
  accessControlAllowHeaders?: string[];
  corsConfiguration?: {
    corsConfigurationEnabled?: boolean;
    accessControlAllowOrigins?: string[];
    accessControlAllowCredentials?: boolean;
    accessControlAllowHeaders?: string[];
    accessControlAllowMethods?: string[];
  };
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
export type Wso2ApiDocumentSourceType = 'INLINE' | 'URL' | 'FILE' | 'MARKDOWN';export type Wso2ApiRevision = {
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

export type Wso2HealthStatus = 'Online' | 'Offline';

export type Wso2HealthReport = {
  apim: {
    baseUrl: string;
    status: Wso2HealthStatus;
  };
  platform: Array<{
    name: string;
    urls: string[];
    status: Wso2HealthStatus;
    type: string;
    discoveryAuthPresent?: boolean;
  }>;
  configs: Array<{
    name: string;
    url: string;
    status: Wso2HealthStatus;
  }>;
};

export interface Wso2ApiManagerApi {
  generateApiKey(apiId: string, options?: { keyName?: string }): Promise<any>;
  getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse>;
  getGateways(token?: string): Promise<any[]>;
  getHealth(token?: string): Promise<Wso2HealthReport>;
  refreshCatalog(token?: string): Promise<{ message: string }>;
}
