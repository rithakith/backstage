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
      environment: [
        { name: 'Dev', type: 'hybrid' },
        { name: 'Prod', type: 'synapse' },
      ],
    };
    mockClient.get.mockResolvedValueOnce(mockSettings);

    const result = await fetchGlobalSettings(mockClient, logger);

    expect(result).toEqual(mockSettings);
    expect(mockClient.get).toHaveBeenCalledWith('/api/am/publisher/v3/settings');
    expect(logger.info).toHaveBeenCalledWith('[Wso2Fetchers] Fetching Global Settings from /api/am/publisher/v3/settings');
    expect(logger.info).toHaveBeenCalledWith('[Wso2Fetchers] Successfully retrieved global settings with 2 environments.');

    console.log(formatTestCaseDoc(`
=== [Settings Fetcher: Global Settings Success] ===
Successfully fetched settings.
Environments list count: ${result?.environment?.length}
`));
  });

  it('should log error and return undefined on fetch failure', async () => {
    mockClient.get.mockRejectedValueOnce(new Error('Network offline'));

    const result = await fetchGlobalSettings(mockClient, logger);

    expect(result).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      '[Wso2Fetchers] Error fetching global settings: Error: Network offline',
    );

    console.log(formatTestCaseDoc(`
=== [Settings Fetcher: Global Settings Failure] ===
Exception Simulated: "Network offline"
Outcome: Logged error message and returned undefined gracefully.
`));
  });
});
