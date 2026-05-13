/*
 * Copyright 2026 WSO2 LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { createApiRef, OAuthApi } from '@backstage/core-plugin-api';
import { Wso2ApiManagerApi } from './types';

export const wso2ApiManagerApiRef = createApiRef<Wso2ApiManagerApi>({
  id: 'plugin.wso2-api-manager.service',
});

export const wso2AuthApiRef = createApiRef<OAuthApi>({
  id: 'plugin.wso2-api-manager.auth',
});

export { Wso2ApiManagerClient } from './Wso2ApiManagerClient';
export type {
  Wso2ApiSummary,
  Wso2ApiProductSummary,
  Wso2McpSummary,
  Wso2ApiDetail,
  Wso2ApiProductDetail,
  Wso2McpDetail,
  Wso2ApiProductResource,
  Wso2ApiProductOperation,
  Wso2ApiDocument,
  Wso2ApiRevision,
  Wso2ApiRevisionsResponse,
  Wso2McpTool,
} from './types';
