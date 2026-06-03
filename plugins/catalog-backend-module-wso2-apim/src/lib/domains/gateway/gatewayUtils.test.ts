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

import { discoverGatewayApis } from './gatewayUtils';
import { mockServices } from '@backstage/backend-test-utils';
import { fetch as undiciFetch } from 'undici';
import { PlatformGateway } from './types';

jest.mock('undici', () => ({
  fetch: jest.fn(),
  Agent: jest.fn(),
}));

const mockFetch = jest.mocked(undiciFetch);

describe('gateway/gatewayUtils', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();
  const mockDispatcher = {} as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should skip discovery if no gateway has discoveryUrl configured', async () => {
    const gateways: PlatformGateway[] = [
      { environmentName: 'gw-1', environmentType: 'PROD', urls: ['https://gw1.com'] },
    ];

    const result = await discoverGatewayApis(gateways, logger, mockDispatcher);
    expect(result).toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should successfully discover and map APIs from gateways', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'MySelfHostedGate',
        environmentType: 'PRODUCTION',
        urls: ['https://gateway.com'],
        discoveryUrl: 'https://discovery-service.com/apis',
        discoveryAuth: 'Basic abc-auth',
      },
    ];

    const mockApisList = {
      list: [
        { id: 'api-1', name: 'Service One' },
        { id: 'api-2', name: 'Service Two' },
      ],
    };

    const mockApiDetail1 = {
      api: {
        id: 'api-1',
        description: 'Details 1',
        spec: { version: '1.0.0', context: 's1' },
      },
    };

    const mockApiDetail2 = {
      api: {
        id: 'api-2',
        description: 'Details 2',
        spec: { version: '2.0.0', context: 's2' },
      },
    };

    // First fetch: get list of APIs
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockApisList),
    } as any);

    // Second fetch: get details of API 1
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockApiDetail1),
    } as any);

    // Third fetch: get details of API 2
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockApiDetail2),
    } as any);

    const result = await discoverGatewayApis(gateways, logger, mockDispatcher);

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      id: 'api-1',
      description: 'Details 1',
      spec: { version: '1.0.0', context: 's1' },
      initiatedFromGateway: true,
      isDirectDiscovery: true,
      discoveredFrom: 'MySelfHostedGate',
      gatewayUrls: ['https://gateway.com'],
      fullConfig: mockApiDetail1.api,
      fetchedSwagger: JSON.stringify(mockApiDetail1.api.spec, null, 2),
    });

    expect(mockFetch).toHaveBeenNthCalledWith(
      1,
      'https://discovery-service.com/apis',
      expect.objectContaining({
        headers: { Accept: 'application/json', Authorization: 'Basic abc-auth' },
        dispatcher: mockDispatcher,
      }),
    );

    console.log(formatTestCaseDoc(`
=== [Gateway Discovery: Successful Scan] ===
Discovery URL: "${gateways[0].discoveryUrl}"
Matched discovered APIs count: ${result.length}
First API Detail extracted:
${JSON.stringify(result[0], null, 2)}
`));
  });

  it('should gracefully log and continue if one of the detail fetches fails', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'MySelfHostedGate',
        environmentType: 'PRODUCTION',
        urls: ['https://gateway.com'],
        discoveryUrl: 'https://discovery-service.com/apis',
        discoveryAuth: 'Basic abc-auth',
      },
    ];

    const mockApisList = {
      list: [{ id: 'api-1' }],
    };

    // First fetch: list APIs
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: jest.fn().mockResolvedValueOnce(mockApisList),
    } as any);

    // Second fetch: detail fetch rejects (throws error)
    mockFetch.mockRejectedValueOnce(new Error('Connection abort'));

    const result = await discoverGatewayApis(gateways, logger, mockDispatcher);
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      '[WSO2-GATEWAY-DISCOVERY] Error fetching details for api-1: Error: Connection abort',
    );

    console.log(formatTestCaseDoc(`
=== [Gateway Discovery Error: Detail Fetch Failure] ===
Discovered API: "api-1"
Simulated Detail Fetch Error: "Connection abort"
Provider state: Ingestion skipped for "api-1", sync cycle completed.
`));
  });

  it('should gracefully log and catch outer fetch connection errors', async () => {
    const gateways: PlatformGateway[] = [
      {
        environmentName: 'MySelfHostedGate',
        environmentType: 'PRODUCTION',
        urls: ['https://gateway.com'],
        discoveryUrl: 'https://discovery-service.com/apis',
      },
    ];

    mockFetch.mockRejectedValueOnce(new Error('Discovery service offline'));

    const result = await discoverGatewayApis(gateways, logger, mockDispatcher);
    expect(result).toEqual([]);
    expect(logger.error).toHaveBeenCalledWith(
      '[WSO2-GATEWAY-DISCOVERY] Error during discovery from MySelfHostedGate: Discovery service offline',
    );

    console.log(formatTestCaseDoc(`
=== [Gateway Discovery Error: Outer scan Failure] ===
Discovery URL: "${gateways[0].discoveryUrl}"
Simulated Discovery Server Error: "Discovery service offline"
Provider state: Outer discovery cycle failed gracefully.
`));
  });
});
