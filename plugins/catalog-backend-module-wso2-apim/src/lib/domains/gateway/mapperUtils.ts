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
import { normalizeEntityName, normalizeGatewayType } from '../api';

/**
 * Maps an API discovered directly from a gateway to a Backstage ApiEntity.
 */
export function mapDiscoveredApiToEntity(api: any): ApiEntity {
  const config = api.fullConfig || {};
  const spec = config.spec || {};
  const displayName = spec.displayName || api.name || 'unnamed-api';
  const normalizedName = normalizeEntityName(displayName);
  const discoveryNamespace = 'wso2-gateways';

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: `${normalizedName}-${normalizeEntityName(api.discoveredFrom)}`,
      namespace: discoveryNamespace,
      title: displayName,
      description: api.description || `Discovered API from Gateway: ${api.discoveredFrom}`,
      annotations: {
        'backstage.io/managed-by-location': `wso2-gateway:${api.discoveredFrom}`,
        'backstage.io/managed-by-origin-location': `wso2-gateway:${api.discoveredFrom}`,
        'wso2-gateway.com/api-id': api.id,
        'wso2-gateway.com/api-name': displayName,
        'wso2-gateway.com/api-version': spec.version || '1.0.0',
        'wso2-gateway.com/api-context': spec.context || '/',
        'wso2-gateway.com/discovered-from': api.discoveredFrom,
        'wso2-gateway.com/api-endpoints': JSON.stringify([{
          environmentName: api.discoveredFrom,
          environmentType: 'PRODUCTION',
          gatewayType: normalizeGatewayType('Self-hosted'),
          displayName: api.discoveredFrom,
          urls: (api.gatewayUrls || []).map((u: string) => {
            const base = u.replace(/\/$/, '');
            const ctx = spec.context?.startsWith('/') ? spec.context : `/${spec.context || '/'}`;
            return `${base}${ctx.replace(/\/$/, '')}`;
          }),
        }]),
        'wso2.com/api-id': api.id,
        'wso2.com/organization-id': api.organizationId || '',
        'wso2.com/api-discovery-type': 'self-hosted-gateway',
        'wso2.com/api-gateway-vendor': normalizeGatewayType('wso2'),
        'wso2.com/is-discovered': 'false',
        'wso2.com/api-raw-json': JSON.stringify(api),
        'wso2.com/api-documents': api.documents ? JSON.stringify(api.documents) : '[]',
      },
      tags: [`gateway-${normalizeEntityName(api.discoveredFrom)}`],
    },
    spec: {
      type: 'openapi',
      lifecycle: 'production',
      owner: 'unknown',
      definition: api.fetchedSwagger || '',
    },
  } as ApiEntity;
}
