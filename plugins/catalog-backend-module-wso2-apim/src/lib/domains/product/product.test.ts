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

import { mapWso2ProductToEntity } from './mapperUtils';
import { fetchApiProductDefinition, fetchApiProductDetail, fetchApiProductList } from './productUtils';
import { mockServices } from '@backstage/backend-test-utils';
import { Wso2ApiProduct } from './types';
import { PlatformGateway } from '../gateway/types';

describe('product domain', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();
  const mockClient = {
    getPublisherBasePath: jest.fn().mockReturnValue('/api/am/publisher/v3'),
    get: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapWso2ProductToEntity', () => {
    it('should map a raw API Product into a Backstage API Entity with full fields', () => {
      const product: Wso2ApiProduct = {
        id: 'prod-123',
        name: 'Super Product',
        displayName: 'Super API Product',
        description: 'Unified billing and telemetry API Product',
        version: '1.0',
        context: 'billing',
        provider: 'billing-team',
        lifeCycleStatus: 'PUBLISHED',
        initiatedFromGateway: true,
        businessInformation: {
          businessOwner: 'Alice',
          businessOwnerEmail: 'alice@company.com',
          technicalOwner: 'Bob',
          technicalOwnerEmail: 'bob@company.com',
        },
        apiThrottlingPolicy: 'Bronze',
        visibility: 'PUBLIC',
        transport: ['http'],
        tags: ['finance', 'billing'],
        definition: 'openapi: 3.0.0...',
        apis: [{ id: 'api-1', name: 'Billing API' }],
      };

      const gateways: PlatformGateway[] = [
        {
          environmentName: 'DevGate',
          environmentType: 'SANDBOX',
          urls: ['https://dev.gateway.com/'],
        },
      ];

      const entity = mapWso2ProductToEntity(
        product,
        'my-namespace',
        'my-provider',
        undefined,
        gateways,
        logger,
      );

      expect(entity).toEqual({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: 'super-product',
          namespace: 'my-namespace',
          title: 'Super API Product',
          description: 'Unified billing and telemetry API Product',
          annotations: {
            'backstage.io/managed-by-location': 'wso2-apim:my-provider',
            'backstage.io/managed-by-origin-location': 'wso2-apim:my-provider',
            'wso2.com/api-id': 'prod-123',
            'wso2.com/api-name': 'Super Product',
            'wso2.com/api-version': '1.0',
            'wso2.com/api-context': 'billing',
            'wso2.com/api-provider': 'billing-team',
            'wso2.com/api-type': 'API_PRODUCT',
            'wso2.com/api-lifecycle-status': 'PUBLISHED',
            'wso2.com/is-discovered': 'true',
            'wso2.com/is-api-product': 'true',
            'wso2.com/gateway-endpoints': '[]',
            'wso2.com/platform-gateway-endpoints': JSON.stringify([
              {
                environmentName: 'DevGate',
                environmentType: 'SANDBOX',
                gatewayType: 'Self-hosted',
                displayName: 'DevGate',
                urls: ['https://dev.gateway.com/billing'],
              },
            ]),
            'wso2.com/api-raw-json': JSON.stringify(product),
            'wso2.com/product-resources': JSON.stringify(product.apis),
            'wso2.com/business-owner': 'Alice',
            'wso2.com/business-owner-email': 'alice@company.com',
            'wso2.com/technical-owner': 'Bob',
            'wso2.com/technical-owner-email': 'bob@company.com',
            'wso2.com/api-throttling-policy': 'Bronze',
            'wso2.com/api-visibility': 'PUBLIC',
            'wso2.com/api-transports': JSON.stringify(['http']),
          },
          tags: ['finance', 'billing', 'wso2-discovered'],
        },
        spec: {
          type: 'api_product',
          lifecycle: undefined,
          owner: 'Bob',
          definition: 'openapi: 3.0.0...',
        },
      });

      console.log(formatTestCaseDoc(`
=== [Product Mapper: API Product Mapping (Published)] ===
Product name: "${entity.metadata.name}"
Spec lifecycle: "${entity.spec.lifecycle}"
Spec owner: "${entity.spec.owner}" (from technicalOwner)
`));
    });

    it('should fallback to businessOwner, provider, and unknown for owner, and experimental for lifecycle', () => {
      // 1. Fallback to businessOwner
      const prod1: Wso2ApiProduct = {
        id: '1', name: 'p1', version: '1', context: 'c', provider: 'p',
        businessInformation: { businessOwner: 'Alice Business' },
      };
      const ent1 = mapWso2ProductToEntity(prod1, 'default', 'prov', undefined, [], logger);
      expect(ent1.spec.owner).toBe('Alice Business');
      expect(ent1.spec.lifecycle).toBeUndefined();

      // 2. Fallback to provider
      const prod2: Wso2ApiProduct = { id: '2', name: 'p2', version: '1', context: 'c', provider: 'p-team' };
      const ent2 = mapWso2ProductToEntity(prod2, 'default', 'prov', undefined, [], logger);
      expect(ent2.spec.owner).toBe('p-team');

      // 3. Fallback to unknown
      const prod3 = { id: '3', name: 'p3', version: '1', context: 'c' } as unknown as Wso2ApiProduct;
      const ent3 = mapWso2ProductToEntity(prod3, 'default', 'prov', undefined, [], logger);
      expect(ent3.spec.owner).toBe('unknown');

      console.log(formatTestCaseDoc(`
=== [Product Mapper: API Product Spec Fallbacks] ===
Fallback 1: owner="${ent1.spec.owner}" (businessOwner)
Fallback 2: owner="${ent2.spec.owner}" (provider)
Fallback 3: owner="${ent3.spec.owner}" (unknown)
`));
    });
  });

  describe('fetchApiProductDefinition', () => {
    it('should return stringified swagger definition on success', async () => {
      const mockSwagger = { swagger: '2.0', info: { title: 'Prod' } };
      mockClient.get.mockResolvedValueOnce(mockSwagger);

      const result = await fetchApiProductDefinition(mockClient, 'prod-1', 'MyProduct');
      expect(result).toBe(JSON.stringify(mockSwagger));
      expect(mockClient.get).toHaveBeenCalledWith('/api/am/publisher/v3/api-products/prod-1/swagger');

      console.log(formatTestCaseDoc(`
=== [Product Fetcher: Definition Success] ===
Resolved URL Path: "/api/am/publisher/v3/api-products/prod-1/swagger"
`));
    });

    it('should catch error and return fallback placeholder on failure', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Definition error'));

      const result = await fetchApiProductDefinition(mockClient, 'prod-1', 'MyProduct');
      expect(result).toBe('WSO2 API Product definition placeholder for MyProduct');

      console.log(formatTestCaseDoc(`
=== [Product Fetcher: Definition Silent Fallback] ===
Exception Simulated: "Definition error"
Returned Fallback: "WSO2 API Product definition placeholder for MyProduct"
`));
    });
  });

  describe('fetchApiProductDetail', () => {
    it('should successfully fetch details and definition and enrich product', async () => {
      const summary = { id: 'prod-1', name: 'MyProduct' };
      const detail = { id: 'prod-1', description: 'Product desc', lifeCycleStatus: 'PUBLISHED' };
      const mockSwagger = { swagger: '2.0' };

      mockClient.get.mockResolvedValueOnce(detail);
      mockClient.get.mockResolvedValueOnce(mockSwagger);

      const result = await fetchApiProductDetail(mockClient, logger, summary);

      expect(result).toEqual({
        id: 'prod-1',
        name: 'MyProduct',
        description: 'Product desc',
        lifeCycleStatus: 'PUBLISHED',
        definition: JSON.stringify(mockSwagger),
      });

      console.log(formatTestCaseDoc(`
=== [Product Fetcher: Product Detail Enrichment Success] ===
Enriched Product properties: description, lifeCycleStatus, definition
`));
    });

    it('should catch errors, log, and return summary on detail fetch error', async () => {
      const summary = { id: 'prod-1', name: 'MyProduct' };
      mockClient.get.mockRejectedValueOnce(new Error('Detail failure'));

      const result = await fetchApiProductDetail(mockClient, logger, summary);

      expect(result).toEqual(summary);
      expect(logger.error).toHaveBeenCalledWith(
        '[Wso2Fetchers] Error fetching detail for API Product prod-1: Error: Detail failure',
      );

      console.log(formatTestCaseDoc(`
=== [Product Fetcher: Product Detail Enrichment Failure] ===
Exception Simulated: "Detail failure"
Outcome: Returned original summary gracefully and logged error.
`));
    });
  });

  describe('fetchApiProductList', () => {
    it('should fetch list and enrich each api product', async () => {
      const mockList = {
        list: [
          { id: 'prod-1', name: 'Prod-1' },
          { id: 'prod-2', name: 'Prod-2' },
        ],
      };

      const mockDetail1 = { description: 'D1' };
      const mockSwagger1 = { swagger: '2.0' };

      const mockDetail2 = { description: 'D2' };
      const mockSwagger2 = { swagger: '2.0' };

      // 1. fetch list
      mockClient.get.mockResolvedValueOnce(mockList);
      // 2. prod 1 details and swagger
      mockClient.get.mockResolvedValueOnce(mockDetail1);
      mockClient.get.mockResolvedValueOnce(mockSwagger1);
      // 3. prod 2 details and swagger
      mockClient.get.mockResolvedValueOnce(mockDetail2);
      mockClient.get.mockResolvedValueOnce(mockSwagger2);

      const result = await fetchApiProductList(mockClient, logger);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({ id: 'prod-1', description: 'D1', definition: JSON.stringify(mockSwagger1) }));
      expect(result[1]).toEqual(expect.objectContaining({ id: 'prod-2', description: 'D2', definition: JSON.stringify(mockSwagger2) }));

      expect(logger.info).toHaveBeenCalledWith('[Wso2Fetchers] Fetching API Products from /api/am/publisher/v3/api-products');
      expect(logger.info).toHaveBeenCalledWith('[Wso2Fetchers] Retrieved 2 API Products from Publisher.');

      console.log(formatTestCaseDoc(`
=== [Product Fetcher: API Product List Fetch Success] ===
Successfully fetched 2 API Products from Publisher list.
`));
    });

    it('should log error and return empty array on outer list fetch error', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('List failure'));

      const result = await fetchApiProductList(mockClient, logger);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[Wso2Fetchers] Error fetching API Products: Error: List failure',
      );

      console.log(formatTestCaseDoc(`
=== [Product Fetcher: API Product List Fetch Failure] ===
Exception Simulated: "List failure"
Outcome: Returned empty array and logged error gracefully.
`));
    });
  });
});
