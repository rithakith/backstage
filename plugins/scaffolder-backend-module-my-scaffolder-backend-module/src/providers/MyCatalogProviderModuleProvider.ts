/*
 * Copyright 2026 The Backstage Authors
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
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { LoggerService, SchedulerService } from '@backstage/backend-plugin-api';
import { Config } from '@backstage/config';
import {
  ANNOTATION_LOCATION,
  ANNOTATION_ORIGIN_LOCATION,
} from '@backstage/catalog-model';

/**
 * Mock Entity Provider that returns sample API entities.
 */
export class MyCatalogProviderModuleProvider implements EntityProvider {
  private connection?: EntityProviderConnection;

  static fromConfig(
    _config: Config,
    options: { logger: LoggerService; scheduler: SchedulerService },
  ) {
    return new MyCatalogProviderModuleProvider(
      options.logger,
      options.scheduler,
    );
  }

  constructor(
    private readonly logger: LoggerService,
    private readonly scheduler: SchedulerService,
  ) {}

  getProviderName() {
    return 'MyCatalogProviderModuleProvider';
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
    this.logger.info(`Connected: ${this.getProviderName()}`);

    // Emit entities immediately on connect so they appear in the Catalog.
    try {
      await this.refresh();
    } catch (e) {
      this.logger.error('Initial refresh failed', e as Error);
    }

    // Create a scheduled task runner to refresh periodically.
    const taskRunner = await this.scheduler.createScheduledTaskRunner({
      frequency: { minutes: 30 },
      timeout: { minutes: 3 },
    });

    // Schedule the refresh task to run periodically.
    void taskRunner.run({
      id: 'my-catalog-provider-module-refresh',
      fn: async () => {
        await this.refresh();
      },
    });
  }

  async refresh(): Promise<void> {
    if (!this.connection) {
      throw new Error('Not connected');
    }

    this.logger.info('Refreshing mock catalog entities...');

    // Mock entity data - properly formatted for Backstage catalog.
    const mockEntities = [
      {
        apiVersion: 'backstage.io/v1beta1',
        kind: 'API',
        metadata: {
          name: 'petstore-api',
          namespace: 'default',
          title: 'Pet Store API',
          description: 'Pet Store API - Sample Mock API',
          annotations: {
            [ANNOTATION_LOCATION]: 'my-catalog-provider-module:petstore-api',
            [ANNOTATION_ORIGIN_LOCATION]:
              'my-catalog-provider-module:petstore-api',
          },
        },
        spec: {
          type: 'openapi',
          lifecycle: 'production',
          owner: 'platform-team',
          definition: `openapi: 3.0.0
info:
  title: Pet Store API
  version: 1.0.0
paths:
  /pets:
    get:
      summary: List all pets
    post:
      summary: Create a pet`,
        },
      },
      {
        apiVersion: 'backstage.io/v1beta1',
        kind: 'API',
        metadata: {
          name: 'user-service-api',
          namespace: 'default',
          title: 'User Service API',
          description: 'User Management Service API',
          annotations: {
            [ANNOTATION_LOCATION]:
              'my-catalog-provider-module:user-service-api',
            [ANNOTATION_ORIGIN_LOCATION]:
              'my-catalog-provider-module:user-service-api',
          },
        },
        spec: {
          type: 'openapi',
          lifecycle: 'production',
          owner: 'platform-team',
          definition: `openapi: 3.0.0
info:
  title: User Service API
  version: 2.0.0
paths:
  /users:
    get:
      summary: List all users
    post:
      summary: Create a user`,
        },
      },
      {
        apiVersion: 'backstage.io/v1beta1',
        kind: 'Component',
        metadata: {
          name: 'api-gateway',
          namespace: 'default',
          title: 'API Gateway',
          description: 'Central API Gateway Component',
          annotations: {
            [ANNOTATION_LOCATION]: 'my-catalog-provider-module:api-gateway',
            [ANNOTATION_ORIGIN_LOCATION]:
              'my-catalog-provider-module:api-gateway',
          },
        },
        spec: {
          type: 'service',
          lifecycle: 'production',
          owner: 'platform-team',
        },
      },
    ];

    // Emit the entities to the catalog with locationKey.
    await this.connection.applyMutation({
      type: 'full',
      entities: mockEntities.map(entity => ({
        locationKey: 'my-catalog-provider-module',
        entity,
      })),
    });

    this.logger.info(`Emitted ${mockEntities.length} mock entities`);
  }
}
