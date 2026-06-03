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

import { catalogModuleAsgardeoEntityProvider } from './module';
import { startTestBackend, mockServices } from '@backstage/backend-test-utils';
import { catalogProcessingExtensionPoint } from '@backstage/plugin-catalog-node';
import { AsgardeoEntityProvider } from './providers/AsgardeoEntityProvider';

jest.mock('./providers/AsgardeoEntityProvider', () => ({
  AsgardeoEntityProvider: {
    fromConfig: jest.fn(),
  },
}));

describe('catalogModuleAsgardeoEntityProvider', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const addEntityProvider = jest.fn();
  const mockProvider = {
    getProviderName: jest.fn().mockReturnValue('asgardeo'),
    run: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (AsgardeoEntityProvider.fromConfig as jest.Mock).mockReturnValue(mockProvider);
  });

  it('should register provider at catalog processing extension point and start schedule task runner with defaults', async () => {
    const runMock = jest.fn();
    const createScheduledTaskRunnerMock = jest.fn().mockReturnValue({ run: runMock });
    const schedulerMock = mockServices.scheduler.mock({
      createScheduledTaskRunner: createScheduledTaskRunnerMock,
    });

    const config = mockServices.rootConfig.factory({
      data: {
        auth: {
          providers: {
            oidc: {
              development: {
                clientId: 'c-id',
                clientSecret: 'c-secret',
                metadataUrl: 'https://api.asgardeo.io/t/myorg/token',
              },
            },
          },
        },
      },
    });

    await startTestBackend({
      extensionPoints: [
        [catalogProcessingExtensionPoint, { addEntityProvider }],
      ],
      features: [
        catalogModuleAsgardeoEntityProvider,
        schedulerMock.factory,
        config,
      ],
    });

    expect(AsgardeoEntityProvider.fromConfig).toHaveBeenCalledTimes(1);
    expect(addEntityProvider).toHaveBeenCalledWith(mockProvider);
    expect(createScheduledTaskRunnerMock).toHaveBeenCalledWith({
      frequency: { minutes: 30 },
      timeout: { minutes: 5 },
      initialDelay: { seconds: 5 },
    });
    expect(runMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'asgardeo',
        fn: expect.any(Function),
      }),
    );

    // Call the run function to verify it calls provider.run()
    const taskFn = runMock.mock.calls[0][0].fn;
    await taskFn();
    expect(mockProvider.run).toHaveBeenCalledTimes(1);

    console.log(formatTestCaseDoc(`
=== [Backend Catalog Module: Integration with Default Schedule] ===
Wiring:
  - Provider Name: "${mockProvider.getProviderName()}"
  - Extension point: Registered successfully
  - Task Runner Schedule (Default):
      Frequency: 30 minutes
      Timeout: 5 minutes
      Initial Delay: 5 seconds
`));
  });

  it('should support custom scheduler task configuration from config', async () => {
    const runMock = jest.fn();
    const createScheduledTaskRunnerMock = jest.fn().mockReturnValue({ run: runMock });
    const schedulerMock = mockServices.scheduler.mock({
      createScheduledTaskRunner: createScheduledTaskRunnerMock,
    });

    const config = mockServices.rootConfig.factory({
      data: {
        auth: {
          providers: {
            oidc: {
              development: {
                clientId: 'c-id',
                clientSecret: 'c-secret',
                metadataUrl: 'https://api.asgardeo.io/t/myorg/token',
              },
            },
          },
        },
        catalog: {
          providers: {
            asgardeo: {
              schedule: {
                frequency: 'PT15M',
                timeout: 'PT2M',
                initialDelay: 'PT10S',
              },
            },
          },
        },
      },
    });

    await startTestBackend({
      extensionPoints: [
        [catalogProcessingExtensionPoint, { addEntityProvider }],
      ],
      features: [
        catalogModuleAsgardeoEntityProvider,
        schedulerMock.factory,
        config,
      ],
    });

    expect(createScheduledTaskRunnerMock).toHaveBeenCalledWith(
      expect.objectContaining({
        frequency: expect.objectContaining({ minutes: 15 }),
        timeout: expect.objectContaining({ minutes: 2 }),
        initialDelay: expect.objectContaining({ seconds: 10 }),
      }),
    );

    console.log(formatTestCaseDoc(`
=== [Backend Catalog Module: Integration with Custom Configured Schedule] ===
Custom Schedule Parsed:
  Frequency: 'PT15M' -> 15 minutes
  Timeout: 'PT2M' -> 2 minutes
  Initial Delay: 'PT10S' -> 10 seconds
`));
  });
});
