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

import { fetchGlobalSettings } from './settingsUtils';
import { mockServices } from '@backstage/backend-test-utils';

describe('settings/settingsUtils', () => {
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

  it('should successfully fetch and return global settings', async () => {
    const mockSettings = {
      devportalUrl: 'https://localhost:9447/devportal',
      environment: [
        {
          id: 'Default',
          name: 'Default',
          displayName: 'Default',
          type: 'hybrid',
          gatewayType: 'Regular',
          mode: 'WRITE_ONLY',
          serverUrl: 'https://localhost:9447/services/',
          provider: 'wso2',
          showInApiConsole: true,
          vhosts: [
            {
              host: 'localhost',
              httpContext: '',
              httpPort: 8284,
              httpsPort: 8247,
              wsPort: 9099,
              wsHost: 'localhost',
              wssPort: 8099,
              wssHost: 'localhost',
              websubHttpPort: 9021,
              websubHttpsPort: 8021,
            },
          ],
          endpointURIs: [],
          additionalProperties: [],
          permissions: {
            permissionType: 'PUBLIC',
            roles: [],
          },
        },
        {
          id: '014681a1-c2db-4bed-8b4a-41e14a793764',
          name: 'Dasun-gateway',
          displayName: 'Dasun-gateway',
          type: 'hybrid',
          gatewayType: 'AWS',
          mode: 'WRITE_ONLY',
          serverUrl: null,
          provider: 'external',
          showInApiConsole: true,
          vhosts: [
            {
              host: '{apiId}.execute-api.{region}.amazonaws.com',
              httpContext: '',
              httpPort: 80,
              httpsPort: 443,
              wsPort: null,
              wsHost: '{apiId}.execute-api.{region}.amazonaws.com',
              wssPort: null,
              wssHost: '{apiId}.execute-api.{region}.amazonaws.com',
              websubHttpPort: 9021,
              websubHttpsPort: 8021,
            },
          ],
          endpointURIs: [],
          additionalProperties: [
            { key: 'secret_key', value: '*****' },
            { key: 'stage', value: 'fed' },
            { key: 'region', value: 'ap-south-1' },
            { key: 'access_key', value: '*****' },
            { key: 'organization', value: 'carbon.super' },
          ],
          permissions: {
            permissionType: 'PUBLIC',
            roles: [],
          },
        },
      ],
      gatewayTypes: [
        'Regular',
        'APK',
        'AWS',
        'Azure',
        'Kong',
        'Envoy',
        'APIPlatform',
      ],
      gatewayFeatureCatalog: {
        gatewayFeatures: {
          Azure: {
            basic: [],
            runtime: ['cors', 'transportsHTTP', 'transportsHTTPS'],
            resources: [],
            localScopes: [],
            policies: ['policies'],
            monetization: [],
            subscriptions: [],
            endpoints: ['http', 'typePRODUCTION'],
            endpointSecurity: [],
            tryout: [],
          },
        },
      },
    };
    mockClient.get.mockResolvedValueOnce(mockSettings);

    const result = await fetchGlobalSettings(mockClient, logger);

    expect(result).toEqual(mockSettings);
    expect(mockClient.get).toHaveBeenCalledWith('/api/am/publisher/v3/settings');
    expect(logger.info).toHaveBeenCalledWith(
      '[Wso2Fetchers] Fetching Global Settings from /api/am/publisher/v3/settings',
    );
    expect(logger.info).toHaveBeenCalledWith(
      '[Wso2Fetchers] Successfully retrieved global settings with 2 environments.',
    );

    console.log(
      formatTestCaseDoc(`
=== [Settings Fetcher: Global Settings Success] ===
Successfully fetched settings.
Environments list count: ${result?.environment?.length}
`),
    );
  });

  it('should log 401 unauthenticated response and return undefined', async () => {
    const mock401Error = new Error('Unauthenticated request');
    (mock401Error as any).status = 401;
    (mock401Error as any).body = {
      code: 401,
      message: '',
      description: 'Unauthenticated request',
      moreInfo: '',
      error: [],
    };
    mockClient.get.mockRejectedValueOnce(mock401Error);

    const result = await fetchGlobalSettings(mockClient, logger);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('[Wso2Fetchers] Error fetching global settings:'),
    );

    console.log(
      formatTestCaseDoc(`
=== [Settings Fetcher: Global Settings 401 Unauthorized] ===
Exception Simulated: 401 Unauthenticated request
Outcome: Logged error message and returned undefined.
`),
    );
  });

  it('should log error and return undefined on other fetch failures', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('Network offline'));

    const result = await fetchGlobalSettings(mockClient, logger);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      '[Wso2Fetchers] Error fetching global settings: Error: Network offline',
    );

    console.log(
      formatTestCaseDoc(`
=== [Settings Fetcher: Global Settings Failure] ===
Exception Simulated: "Network offline"
Outcome: Logged error message and returned undefined gracefully.
`),
    );
  });
});
