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

import {
  normalizeEntityName,
  normalizeGatewayType,
  mapWso2ApiToEntity,
  reconstructGatewayEndpoints,
} from './mapperUtils';
import { mockServices } from '@backstage/backend-test-utils';
import { Wso2Api } from './types';
import { GlobalSettings } from '../settings/types';
import { PlatformGateway } from '../gateway/types';

describe('api/mapperUtils', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();

  describe('normalizeEntityName', () => {
    it('should sanitize and normalize string inputs correctly', () => {
      const inputs = ['ASGARDEO', 'my-group-123', 'Internal/admin group', 'group#$_name', ''];
      const outputs = inputs.map(normalizeEntityName);

      expect(outputs[0]).toBe('asgardeo');
      expect(outputs[1]).toBe('my-group-123');
      expect(outputs[2]).toBe('internal-admin-group');
      expect(outputs[3]).toBe('group-name');
      expect(outputs[4]).toBe('unknown');

      console.log(formatTestCaseDoc(`
=== [Utility: Entity Name Normalization] ===
Test Cases:
  1. "ASGARDEO" -> "${outputs[0]}"
  2. "my-group-123" -> "${outputs[1]}"
  3. "Internal/admin group" -> "${outputs[2]}"
  4. "group#$_name" -> "${outputs[3]}"
  5. "" (empty) -> "${outputs[4]}"
`));
    });
  });

  describe('normalizeGatewayType', () => {
    it('should normalize known gateway types to wso2 or retain lowercase trim values', () => {
      const inputs = ['wso2/synapse', 'synapse', 'regular', 'wso2', '  Self-hosted  ', ''];
      const outputs = inputs.map(normalizeGatewayType);

      expect(outputs[0]).toBe('wso2');
      expect(outputs[1]).toBe('wso2');
      expect(outputs[2]).toBe('wso2');
      expect(outputs[3]).toBe('wso2');
      expect(outputs[4]).toBe('self-hosted');
      expect(outputs[5]).toBe('wso2');

      console.log(formatTestCaseDoc(`
=== [Utility: Gateway Type Normalization] ===
Test Cases:
  1. "wso2/synapse" -> "${outputs[0]}"
  2. "synapse" -> "${outputs[1]}"
  3. "regular" -> "${outputs[2]}"
  4. "wso2" -> "${outputs[3]}"
  5. "  Self-hosted  " -> "${outputs[4]}"
  6. "" (empty) -> "${outputs[5]}"
`));
    });
  });

  describe('reconstructGatewayEndpoints', () => {
    it('should return empty list string when globalSettings are missing', () => {
      const api = { id: 'api-1', context: 'foo' };
      const output = reconstructGatewayEndpoints(api, undefined, logger);
      expect(output).toBe('[]');
    });

    it('should correctly enrich and parse gateway endpoints based on environment matching', () => {
      const api = {
        id: 'api-123',
        name: 'test-api',
        context: '/test-context',
        version: '1.0.0',
        deployedGatewayNames: ['PROD-GATEWAY'],
        gatewayType: 'synapse',
      };

      const globalSettings: GlobalSettings = {
        environment: [
          {
            name: 'PROD-GATEWAY',
            type: 'production',
            gatewayType: 'wso2',
            displayName: 'Production Gateway',
            endpoints: [{ url: 'https://gateway.wso2.com' }],
          },
          {
            name: 'SANDBOX-GATEWAY',
            type: 'sandbox',
            vhosts: [{ host: 'sandbox.wso2.com', httpsPort: 443, httpPort: 80, basePath: '/sandbox' }],
          },
        ],
      };

      const output = reconstructGatewayEndpoints(api, globalSettings, logger);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual([
        {
          environmentName: 'PROD-GATEWAY',
          environmentType: 'production',
          urls: ['https://gateway.wso2.com'],
        },
      ]);

      console.log(formatTestCaseDoc(`
=== [Utility: Reconstruct Gateway Endpoints (Endpoints List Match)] ===
API:
  context: "${api.context}"
  deployedGatewayNames: ${JSON.stringify(api.deployedGatewayNames)}
Global Settings:
  environments: PROD-GATEWAY, SANDBOX-GATEWAY
Result:
${JSON.stringify(parsed, null, 2)}
`));
    });

    it('should build endpoints from vhost specifications and replace placeholder keys', () => {
      const api = {
        id: 'api-456',
        name: 'vhost-api',
        context: '/vhost-context',
        version: '2.0.0',
        gatewayType: 'self-hosted',
      };

      const globalSettings: GlobalSettings = {
        environment: [
          {
            name: 'custom-env',
            type: 'production',
            gatewayType: 'self-hosted',
            displayName: 'Custom Self-Hosted env',
            vhosts: [
              {
                host: 'api-{apiId}.{tenant-domain}.com',
                httpsPort: 8443,
                httpPort: 80,
                basePath: '/custom-path',
              },
            ],
            additionalProperties: [
              { key: 'tenant-domain', value: 'myorg' },
            ],
          },
        ],
      };

      const output = reconstructGatewayEndpoints(api, globalSettings, logger);
      const parsed = JSON.parse(output);

      expect(parsed).toEqual([
        {
          environmentName: 'custom-env',
          environmentType: 'production',
          gatewayType: 'self-hosted',
          displayName: 'Custom Self-Hosted env',
          urls: [
            'https://api-api-456.myorg.com:8443/custom-path/vhost-context/2.0.0',
            'http://api-api-456.myorg.com/custom-path/vhost-context/2.0.0',
          ],
        },
      ]);

      console.log(formatTestCaseDoc(`
=== [Utility: Reconstruct Gateway Endpoints (VHost Placeholders)] ===
API ID: "${api.id}"
VHost Host Template: "api-{apiId}.{tenant-domain}.com"
Resulting Mapped URLs:
${JSON.stringify(parsed[0].urls, null, 2)}
`));
    });
  });

  describe('mapWso2ApiToEntity', () => {
    it('should map a raw WSO2 API correctly into an API entity with full fields', () => {
      const api: Wso2Api = {
        id: 'api-id-888',
        name: 'Customer Service API',
        displayName: 'Customer Service',
        description: 'Handles customer records',
        version: '1.2.3',
        context: 'customers',
        provider: 'admin-team',
        type: 'HTTP',
        lifeCycleStatus: 'PUBLISHED',
        tags: ['crm', 'customer-service'],
        gatewayType: 'synapse',
        initiatedFromGateway: true,
        documents: [{ name: 'Guide', summary: 'Quick start guide' }],
        definition: 'openapi: 3.0.0...',
        apiThrottlingPolicy: 'Unlimited',
        transport: ['http', 'https'],
        visibility: 'PUBLIC',
      };

      const platformGateways: PlatformGateway[] = [
        {
          environmentName: 'MyGate',
          environmentType: 'PRODUCTION',
          urls: ['https://mygate.com/'],
        },
      ];

      const entity = mapWso2ApiToEntity(
        api,
        'my-namespace',
        'my-provider-id',
        undefined,
        platformGateways,
        logger,
      );

      expect(entity).toEqual({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: 'customer-service-api',
          namespace: 'my-namespace',
          title: 'Customer Service',
          description: 'Handles customer records',
          tags: ['crm', 'customer-service'],
          annotations: {
            'backstage.io/managed-by-location': 'wso2-apim:my-provider-id',
            'backstage.io/managed-by-origin-location': 'wso2-apim:my-provider-id',
            'wso2.com/api-id': 'api-id-888',
            'wso2.com/api-name': 'Customer Service API',
            'wso2.com/api-version': '1.2.3',
            'wso2.com/api-context': 'customers',
            'wso2.com/api-provider': 'admin-team',
            'wso2.com/api-type': 'HTTP',
            'wso2.com/api-lifecycle-status': 'PUBLISHED',
            'wso2.com/api-gateway': 'synapse',
            'wso2.com/is-discovered': 'true',
            'wso2.com/api-documents': JSON.stringify(api.documents),
            'wso2.com/gateway-endpoints': '[]',
            'wso2.com/raw-endpoint-urls': '[]',
            'wso2.com/platform-gateway-endpoints': JSON.stringify([
              {
                environmentName: 'MyGate',
                environmentType: 'PRODUCTION',
                gatewayType: 'self-hosted',
                displayName: 'MyGate',
                urls: ['https://mygate.com/customers'],
              },
            ]),
            'wso2.com/api-raw-json': JSON.stringify(api),
            'wso2.com/api-throttling-policy': 'Unlimited',
            'wso2.com/api-transports': JSON.stringify(['http', 'https']),
            'wso2.com/api-visibility': 'PUBLIC',
          },
        },
        spec: {
          type: 'http',
          lifecycle: undefined,
          owner: 'admin-team',
          definition: 'openapi: 3.0.0...',
        },
      });

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: API Mapping (Standard REST)] ===
Raw API Type: "${api.type}" (Status: ${api.lifeCycleStatus})
Resulting Backstage Entity Spec Type: "${entity.spec.type}"
Resulting Backstage Entity Lifecycle: "${entity.spec.lifecycle}"
`));
    });

    it('should map different spec types (GraphQL/WS) and experimental lifecycles correctly', () => {
      const api: Wso2Api = {
        id: 'graphql-api',
        name: 'GraphQL API',
        context: 'gql',
        version: '1.0.0',
        type: 'GRAPHQL',
        lifeCycleStatus: 'CREATED',
        definition: 'type Query { ... }',
      };

      const entity = mapWso2ApiToEntity(
        api,
        'default',
        'provider-id',
        undefined,
        [],
        logger,
      );

      expect(entity.spec.type).toBe('graphql');
      expect(entity.spec.lifecycle).toBeUndefined();

      const wsApi: Wso2Api = {
        id: 'ws-api',
        name: 'WS API',
        context: 'ws',
        version: '1.0.0',
        type: 'WS',
        lifeCycleStatus: 'PUBLISHED',
      };

      const wsEntity = mapWso2ApiToEntity(
        wsApi,
        'default',
        'provider-id',
        undefined,
        [],
        logger,
      );

      expect(wsEntity.spec.type).toBe('ws');

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: API Spec Type Fallbacks] ===
GraphQL Input -> Backstage Spec Type: "${entity.spec.type}" (Lifecycle: ${entity.spec.lifecycle})
WS Input -> Backstage Spec Type: "${wsEntity.spec.type}"
`));
    });
  });
});
