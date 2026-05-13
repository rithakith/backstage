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
import { LoggerService } from '@backstage/backend-plugin-api';
import { Wso2ApiProduct } from './types';
import { GlobalSettings } from '../settings/types';
import { PlatformGateway } from '../gateway/types';
import { normalizeEntityName, reconstructGatewayEndpoints } from '../api';

/**
 * Maps a WSO2 API Product to a Backstage ApiEntity.
 */
export function mapWso2ProductToEntity(
  product: Wso2ApiProduct,
  namespace: string,
  providerId: string,
  globalSettings: GlobalSettings | undefined,
  platformGateways: PlatformGateway[],
  logger: LoggerService,
): ApiEntity {
  const normalizedName = normalizeEntityName(product.name);
  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: normalizedName,
      namespace,
      title: product.displayName || product.name,
      description: product.description || `WSO2 API Product: ${product.name}`,
      annotations: {
        'backstage.io/managed-by-location': `wso2-apim:${providerId}`,
        'backstage.io/managed-by-origin-location': `wso2-apim:${providerId}`,
        'wso2.com/api-id': product.id,
        'wso2.com/api-name': product.name,
        'wso2.com/api-version': product.version,
        'wso2.com/api-context': product.context,
        'wso2.com/api-provider': product.provider,
        'wso2.com/api-type': 'API_PRODUCT',
        'wso2.com/api-lifecycle-status': product.lifeCycleStatus || '',
        'wso2.com/is-discovered': product.initiatedFromGateway === true ? 'true' : 'false',
        'wso2.com/is-api-product': 'true',
        'wso2.com/gateway-endpoints': reconstructGatewayEndpoints(product, globalSettings, logger),
        'wso2.com/platform-gateway-endpoints': JSON.stringify(
          platformGateways.map(gw => ({
            environmentName: gw.environmentName,
            environmentType: gw.environmentType || 'PRODUCTION',
            gatewayType: 'Self-hosted',
            displayName: gw.environmentName,
            urls: gw.urls.map(u => {
              const base = u.replace(/\/$/, '');
              const ctx = product.context.startsWith('/') ? product.context : `/${product.context}`;
              return `${base}${ctx.replace(/\/$/, '')}`;
            }),
          })),
        ),
        'wso2.com/api-raw-json': JSON.stringify(product),
        'wso2.com/product-resources': product.apis ? JSON.stringify(product.apis) : '[]',
        'wso2.com/business-owner': product.businessInformation?.businessOwner || '',
        'wso2.com/business-owner-email': product.businessInformation?.businessOwnerEmail || '',
        'wso2.com/technical-owner': product.businessInformation?.technicalOwner || '',
        'wso2.com/technical-owner-email': product.businessInformation?.technicalOwnerEmail || '',
        'wso2.com/api-throttling-policy': product.apiThrottlingPolicy || '',
        'wso2.com/api-visibility': product.visibility || '',
        'wso2.com/api-transports': Array.isArray(product.transport) ? JSON.stringify(product.transport) : '[]',
      },
      tags: [...(product.tags || []), ...(product.initiatedFromGateway ? ['wso2-discovered'] : [])],
    },
    spec: {
      type: 'openapi',
      lifecycle: product.lifeCycleStatus === 'PUBLISHED' ? 'production' : 'experimental',
      owner: product.businessInformation?.technicalOwner || product.businessInformation?.businessOwner || product.provider || 'unknown',
      definition: product.definition || `WSO2 API Product: ${product.name}`,
    },
  } as ApiEntity;
}
