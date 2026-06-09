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

import { ApiEntity } from '@backstage/catalog-model';
import { Wso2McpServer } from './types';
import { normalizeEntityName } from '../api';

/**
 * Maps a WSO2 MCP Server to a Backstage ApiEntity.
 */
export function mapWso2McpToEntity(
  mcp: Wso2McpServer,
  namespace: string,
  providerId: string,
): ApiEntity {
  const normalizedName = normalizeEntityName(mcp.name);
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: normalizedName,
      namespace,
      title: mcp.name,
      description: mcp.description || `WSO2 MCP Server: ${mcp.name}`,
      annotations: {
        'backstage.io/managed-by-location': `wso2-apim:${providerId}`,
        'backstage.io/managed-by-origin-location': `wso2-apim:${providerId}`,
        'wso2.com/api-id': mcp.id || '',
        'wso2.com/api-name': mcp.name || '',
        'wso2.com/api-version': mcp.version || '',
        'wso2.com/api-context': mcp.context || '',
        'wso2.com/api-provider': mcp.provider || '',
        'wso2.com/api-lifecycle-status': mcp.lifeCycleStatus || '',
        'wso2.com/api-type': 'MCP',
        'wso2.com/is-mcp-server': 'true',
        'wso2.com/mcp-tools': mcp.tools ? JSON.stringify(mcp.tools) : '[]',
        'wso2.com/api-documents': mcp.documents ? JSON.stringify(mcp.documents) : '[]',
      },
      tags: mcp.tags || [],
    },
    spec: {
      type: 'mcp',
      lifecycle: 'production',
      owner: mcp.provider || 'unknown',
      definition: `WSO2 MCP Server: ${mcp.name}`,
    },
  } as ApiEntity;
}
