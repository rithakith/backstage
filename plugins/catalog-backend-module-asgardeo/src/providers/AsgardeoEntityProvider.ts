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
  EntityProvider,
  EntityProviderConnection,
} from '@backstage/plugin-catalog-node';
import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { AsgardeoClient } from '../lib/AsgardeoClient';
import { mapScimGroupToEntity, mapScimUserToEntity } from '../lib/scim';

/**
 * Provides user and group entities from Asgardeo SCIM 2.0 API.
 */
export class AsgardeoEntityProvider implements EntityProvider {
  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly id: string;
  private readonly client: AsgardeoClient;
  private connection?: EntityProviderConnection;

  /**
   * Static factory method to create the provider from configuration.
   */
  static fromConfig(
    config: Config,
    options: { id: string; logger: LoggerService },
  ) {
    const client = new AsgardeoClient({ config, logger: options.logger });
    return new AsgardeoEntityProvider({
      id: options.id,
      config,
      logger: options.logger,
      client,
    });
  }

  private constructor(options: {
    id: string;
    config: Config;
    logger: LoggerService;
    client: AsgardeoClient;
  }) {
    this.id = options.id;
    this.config = options.config;
    this.logger = options.logger;
    this.client = options.client;
  }

  getProviderName(): string {
    return this.id;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async run(): Promise<void> {
    if (!this.connection) {
      throw new Error('Asgardeo entity provider not initialized');
    }

    this.logger.debug(`Running AsgardeoEntityProvider`);

    const organization = this.getOrganization();

    try {
      // 1. Fetch Groups
      const scimGroups = await this.client.fetchGroups(organization);
      const groupIdToName = new Map<string, string>();

      const groupEntities = scimGroups.map(group => {
        const entity = mapScimGroupToEntity(group, { organization });
        groupIdToName.set(group.id, entity.metadata.name);
        return entity;
      });

      this.logger.info(`Fetched ${groupEntities.length} groups from Asgardeo`);

      // 2. Fetch Users
      const scimUsers = await this.client.fetchUsers(organization);
      const userEntities = scimUsers.map(user =>
        mapScimUserToEntity(user, { organization, groupIdToName }),
      );

      this.logger.info(`Fetched ${userEntities.length} users from Asgardeo`);

      // 3. Apply mutations
      await this.connection.applyMutation({
        type: 'full',
        entities: [...userEntities, ...groupEntities].map(entity => ({
          entity,
          locationKey: this.getProviderName(),
        })),
      });

      this.logger.info(
        `Successfully ingested ${userEntities.length} users and ${groupEntities.length} groups from Asgardeo`,
      );
    } catch (error) {
      this.logger.error(
        `Error syncing entities from Asgardeo: ${
          error instanceof Error ? error.message : error
        }`,
      );
      throw error;
    }
  }

  private getOrganization(): string {
    return this.config.getString(
      `catalog.providers.${this.id}.organization`,
    );
  }
}
