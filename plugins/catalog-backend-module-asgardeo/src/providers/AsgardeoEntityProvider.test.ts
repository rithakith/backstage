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

import { AsgardeoEntityProvider } from './AsgardeoEntityProvider';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { AsgardeoClient } from '../lib/AsgardeoClient';

jest.mock('../lib/AsgardeoClient');

const mockFetchGroups = jest.fn();
const mockFetchUsers = jest.fn();
jest.mocked(AsgardeoClient).mockImplementation(() => ({
  fetchGroups: mockFetchGroups,
  fetchUsers: mockFetchUsers,
} as any));

describe('AsgardeoEntityProvider', () => {
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
    it('should successfully construct using static factory method', () => {
      const config = new ConfigReader({
        catalog: {
          providers: {
            asgardeo: {
              organization: 'my-org',
            },
          },
        },
      });

      const provider = AsgardeoEntityProvider.fromConfig(config, {
        id: 'asgardeo',
        logger,
      });

      expect(provider).toBeInstanceOf(AsgardeoEntityProvider);
      expect(provider.getProviderName()).toBe('asgardeo');

      console.log(formatTestCaseDoc(`
=== [Entity Provider: Construction] ===
Config:
  catalog.providers.asgardeo.organization: "my-org"
Result:
  Provider Name: "${provider.getProviderName()}"
  Instance Valid: ${provider instanceof AsgardeoEntityProvider}
`));
    });
  });

  describe('run', () => {
    it('should throw an error if connection is not established', async () => {
      const config = new ConfigReader({
        catalog: { providers: { asgardeo: { organization: 'my-org' } } },
      });
      const provider = AsgardeoEntityProvider.fromConfig(config, { id: 'asgardeo', logger });

      await expect(provider.run()).rejects.toThrow('Asgardeo entity provider not initialized');

      console.log(formatTestCaseDoc(`
=== [Entity Provider Error: Run without Connection] ===
Expected Exception:
  "Asgardeo entity provider not initialized"
`));
    });

    it('should retrieve organization from explicit config and perform standard run successfully', async () => {
      const config = new ConfigReader({
        catalog: {
          providers: {
            asgardeo: {
              organization: 'explicit-org',
            },
          },
        },
      });

      const provider = AsgardeoEntityProvider.fromConfig(config, {
        id: 'asgardeo',
        logger,
      });

      await provider.connect(mockConnection);

      const scimGroups = [
        { id: 'grp-1', displayName: 'Internal/admin' },
      ];
      const scimUsers = [
        { id: 'usr-1', userName: 'DEFAULT/bob', emails: ['bob@wso2.com'], groups: [{ value: 'grp-1' }] },
      ];

      mockFetchGroups.mockResolvedValue(scimGroups);
      mockFetchUsers.mockResolvedValue(scimUsers);

      await provider.run();

      expect(mockFetchGroups).toHaveBeenCalledWith('explicit-org');
      expect(mockFetchUsers).toHaveBeenCalledWith('explicit-org');

      expect(mockConnection.applyMutation).toHaveBeenCalledWith({
        type: 'full',
        entities: [
          {
            entity: {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'User',
              metadata: {
                name: 'bob-wso2-com',
                annotations: {
                  'backstage.io/managed-by-location': 'asgardeo:explicit-org',
                  'backstage.io/managed-by-origin-location': 'asgardeo:explicit-org',
                  'asgardeo.io/user-id': 'usr-1',
                },
              },
              spec: {
                profile: {
                  displayName: 'bob',
                  email: 'bob@wso2.com',
                },
                memberOf: ['internal-admin'],
              },
            },
            locationKey: 'asgardeo',
          },
          {
            entity: {
              apiVersion: 'backstage.io/v1alpha1',
              kind: 'Group',
              metadata: {
                name: 'internal-admin',
                description: 'Asgardeo group: Internal/admin',
                annotations: {
                  'backstage.io/managed-by-location': 'asgardeo:explicit-org',
                  'backstage.io/managed-by-origin-location': 'asgardeo:explicit-org',
                  'asgardeo.io/group-id': 'grp-1',
                },
              },
              spec: {
                type: 'team',
                children: [],
              },
            },
            locationKey: 'asgardeo',
          },
        ],
      });
      expect(logger.info).toHaveBeenCalledWith('Successfully ingested 1 users and 1 groups from Asgardeo');

      console.log(formatTestCaseDoc(`
=== [Entity Provider: standard full Sync] ===
Organization: "explicit-org"

SCIM Ingestion Input:
  Groups: ${JSON.stringify(scimGroups, null, 2)}
  Users: ${JSON.stringify(scimUsers, null, 2)}

Resulting Mutation applied:
  full mutation with 1 User and 1 Group
`));
    });

    it('should gracefully log and catch run-time fetch exceptions', async () => {
      const config = new ConfigReader({
        catalog: { providers: { asgardeo: { organization: 'err-org' } } },
      });
      const provider = AsgardeoEntityProvider.fromConfig(config, { id: 'asgardeo', logger });
      await provider.connect(mockConnection);

      mockFetchGroups.mockRejectedValue(new Error('SCIM Server Down'));

      await expect(provider.run()).rejects.toThrow('SCIM Server Down');

      expect(logger.error).toHaveBeenCalledWith('Error syncing entities from Asgardeo: SCIM Server Down');

      console.log(formatTestCaseDoc(`
=== [Entity Provider: Error handling during ingestion] ===
Simulated Exception:
  "SCIM Server Down"

Resulting Logger Error logged:
  "Error syncing entities from Asgardeo: SCIM Server Down"
`));
    });
  });
});
