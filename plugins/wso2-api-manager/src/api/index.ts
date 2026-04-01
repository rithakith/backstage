import { createApiRef, OAuthApi } from '@backstage/core-plugin-api';
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
  Wso2McpDetail,
  Wso2McpTool,
  Wso2ApiManagerApi,
} from './types';

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
  Wso2McpTool,
} from './types';
