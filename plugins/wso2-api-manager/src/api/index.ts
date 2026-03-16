import { createApiRef, OAuthApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiDetail,
  Wso2ApiDocumentsResponse,
  Wso2ApiListResponse,
} from './types';

export interface Wso2ApiManagerApi {
  listApis(options?: {
    limit?: number;
    offset?: number;
    query?: string;
    token?: string;
  }): Promise<Wso2ApiListResponse>;
  getApi(apiId: string, token?: string): Promise<Wso2ApiDetail>;
  listDocuments(apiId: string, token?: string): Promise<Wso2ApiDocumentsResponse>;
  getApiDefinition(apiId: string, token?: string): Promise<any>;
  generateApiKey(apiId: string, token?: string): Promise<any>;
  updateApiDefinition(apiId: string, definition: string, token?: string): Promise<void>;
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
  Wso2ApiDetail,
  Wso2ApiDocument,
  Wso2ApiListResponse,
  Wso2ApiDocumentsResponse,
} from './types';
