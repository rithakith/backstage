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

import { Wso2ApiEntityProvider } from './Wso2ApiEntityProvider';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { Wso2Client } from '../lib/Wso2Client';
import { Wso2DiscoveryService } from '../lib/Wso2DiscoveryService';

jest.mock('../lib/Wso2Client');
jest.mock('../lib/Wso2DiscoveryService');

const mockDiscoverAll = jest.fn();
jest.mocked(Wso2DiscoveryService).mockImplementation(() => ({
  discoverAll: mockDiscoverAll,
} as any));

describe('Wso2ApiEntityProvider', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();
  const mockConnection = {
    applyMutation: jest.fn().mockResolvedValue(undefined),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fromConfig', () => {
    it('should successfully instantiate the provider using factory method', () => {
      const config = new ConfigReader({
        catalog: {
          providers: {
            wso2Apim: {
              baseUrl: 'https://apim.wso2.com',
            },
          },
        },
        wso2ApiManager: {
          auth: { clientId: 'id', clientSecret: 'secret' },
          publisherBasePath: '/api/am/publisher/v3',
        },
      });

      const provider = Wso2ApiEntityProvider.fromConfig(config, {
        id: 'wso2-pub',
        logger,
      });

      expect(provider).toBeInstanceOf(Wso2ApiEntityProvider);
      expect(provider.getProviderName()).toBe('wso2-pub');

      console.log(formatTestCaseDoc(`
=== [Entity Provider: Construction] ===
Provider ID: "${provider.getProviderName()}"
Static Factory fromConfig built successfully.
`));
    });
  });

  describe('run', () => {
    it('should throw an error if run is called before connect is established', async () => {
      const config = new ConfigReader({
        catalog: { providers: { wso2Apim: { baseUrl: 'https://apim.wso2.com' } } },
        wso2ApiManager: {
          auth: { clientId: 'id', clientSecret: 'secret' },
          publisherBasePath: '/api/am/publisher/v3',
        },
      });
      const provider = Wso2ApiEntityProvider.fromConfig(config, { id: 'wso2-pub', logger });

      await expect(provider.run()).rejects.toThrow('wso2-pub entity provider is not initialized');

      console.log(formatTestCaseDoc(`
=== [Entity Provider Error: Run without Connection] ===
Expected Exception:
  "wso2-pub entity provider is not initialized"
`));
    });

    it('should successfully run sync cycles, parse platform gateways, discover and apply full mutation', async () => {
      const config = new ConfigReader({
        catalog: {
          providers: {
            wso2Apim: {
              baseUrl: 'https://apim.wso2.com',
              namespace: 'wso2-namespace',
            },
          },
        },
        wso2ApiManager: {
          auth: { clientId: 'id', clientSecret: 'secret' },
          publisherBasePath: '/api/am/publisher/v3',
        },
        wso2PlatformGateway: [
          {
            name: 'gate-one',
            environmentType: 'SANDBOX',
            urls: ['https://gw1.com'],
            discoveryUrl: 'https://discovery1.com',
            discoveryUsername: 'gw-user',
            discoveryPassword: 'gw-password',
            organizationId: 'tenant-1',
          },
        ],
      });

      const provider = Wso2ApiEntityProvider.fromConfig(config, {
        id: 'wso2-publisher-apis',
        logger,
      });

      await provider.connect(mockConnection);

      const mockEntities = [
        { apiVersion: 'backstage.io/v1alpha1', kind: 'API', metadata: { name: 'api-1' } },
      ];
      mockDiscoverAll.mockResolvedValueOnce(mockEntities);

      await provider.run();

      expect(mockDiscoverAll).toHaveBeenCalledWith({
        namespace: 'wso2-namespace',
        providerId: 'wso2-publisher-apis',
        platformGateways: [
          {
            environmentName: 'gate-one',
            environmentType: 'SANDBOX',
            urls: ['https://gw1.com'],
            discoveryUrl: 'https://discovery1.com',
            discoveryAuth: `Basic ${Buffer.from('gw-user:gw-password').toString('base64')}`,
            organizationId: 'tenant-1',
          },
        ],
      });

      expect(mockConnection.applyMutation).toHaveBeenCalledWith({
        type: 'full',
        entities: [
          {
            entity: mockEntities[0],
            locationKey: 'wso2-publisher-apis',
          },
        ],
      });

      expect(logger.info).toHaveBeenCalledWith('[WSO2 Provider] Successfully ingested 1 entities.');

      console.log(formatTestCaseDoc(`
=== [Entity Provider: standard full Ingestion Cycle] ===
Parsed Platform Gateways URL: "https://gw1.com"
Mutation applied successfully.
Ingested Entities Count: ${mockEntities.length}
`));
    });

    it('should catch and gracefully log error messages if discovery throws exceptions', async () => {
      const config = new ConfigReader({
        catalog: { providers: { wso2Apim: { baseUrl: 'https://apim.wso2.com' } } },
        wso2ApiManager: {
          auth: { clientId: 'id', clientSecret: 'secret' },
          publisherBasePath: '/api/am/publisher/v3',
        },
      });
      const provider = Wso2ApiEntityProvider.fromConfig(config, { id: 'wso2-pub', logger });
      await provider.connect(mockConnection);

      mockDiscoverAll.mockRejectedValueOnce(new Error('Auth failed'));

      await provider.run();

      expect(logger.error).toHaveBeenCalledWith('[WSO2 Provider] Sync Error: Auth failed');

      console.log(formatTestCaseDoc(`
=== [Entity Provider: Graceful Sync Exception Handling] ===
Simulated Exception:
  "Auth failed"
Logged Error Outcome:
  "[WSO2 Provider] Sync Error: Auth failed"
`));
    });
  });
});
