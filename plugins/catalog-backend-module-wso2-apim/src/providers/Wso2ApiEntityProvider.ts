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

import { Wso2Client } from '../lib/Wso2Client';
import { Wso2DiscoveryService } from '../lib/Wso2DiscoveryService';
import { PlatformGateway } from '../lib/domains/gateway';
import { updateWso2ApimSyncStatus } from '../lib/syncStatus';

function formatDuration(durationMs: number): string {
  return `${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`;
}

/**
 * Provides API entities from WSO2 Publisher API.
 */
export class Wso2ApiEntityProvider implements EntityProvider {
  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly id: string;
  private connection?: EntityProviderConnection;
  private readonly discoveryService: Wso2DiscoveryService;

  /**
   * Static factory method to create the provider from configuration.
   */
  static fromConfig(config: Config, options: { id: string; logger: LoggerService }) {
    const client = new Wso2Client({ config, logger: options.logger });
    const discoveryService = new Wso2DiscoveryService({ client, logger: options.logger });
    return new Wso2ApiEntityProvider({ 
      id: options.id, 
      config, 
      logger: options.logger, 
      discoveryService 
    });
  }

  private constructor(options: { 
    id: string; 
    config: Config; 
    logger: LoggerService; 
    discoveryService: Wso2DiscoveryService 
  }) {
    this.id = options.id;
    this.config = options.config;
    this.logger = options.logger;
    this.discoveryService = options.discoveryService;
  }

  getProviderName(): string {
    return `${this.id}`;
  }

  async connect(connection: EntityProviderConnection): Promise<void> {
    this.connection = connection;
  }

  async run(): Promise<void> {
    const runStartedAt = Date.now();
    if (!this.connection) {
      throw new Error(`${this.getProviderName()} entity provider is not initialized`);
    }

    this.logger.debug(`Running ${this.getProviderName()}`);

    const namespace = this.config.getOptionalString('catalog.providers.wso2Apim.namespace') || 'default';
    const platformGateways = this.parsePlatformGateways();
    const startedAt = new Date().toISOString();

    updateWso2ApimSyncStatus({
      providerId: this.id,
      phase: 'fetching',
      message: 'Preparing WSO2 Publisher catalog synchronization.',
      startedAt,
      completedAt: undefined,
      error: undefined,
      publisherApis: { loaded: 0, total: undefined },
      totals: {},
    });

    try {
      const discoveryStartedAt = Date.now();
      const allEntities = await this.discoveryService.discoverAll({
        namespace,
        providerId: this.id,
        platformGateways,
        onPublisherApiProgress: ({ loaded, total, message }) => {
          updateWso2ApimSyncStatus({
            phase: 'fetching',
            message:
              message ??
              (total === undefined
                ? `Loading Publisher APIs (${loaded} loaded).`
                : `Loading Publisher APIs (${loaded}/${total} loaded).`),
            publisherApis: { loaded, total },
          });
        },
      });
      this.logger.info(
        `[WSO2 Timing] ${this.getProviderName()} discovery returned ${
          allEntities.length
        } entities in ${formatDuration(Date.now() - discoveryStartedAt)}.`,
      );

      updateWso2ApimSyncStatus({
        phase: 'applying',
        message: 'Applying WSO2 entities to the Backstage catalog.',
        totals: { catalogEntities: allEntities.length },
      });

      const applyStartedAt = Date.now();
      await this.connection.applyMutation({
        type: 'full',
        entities: allEntities.map(entity => ({
          entity,
          locationKey: this.getProviderName(),
        })),
      });
      this.logger.info(
        `[WSO2 Timing] Applied ${allEntities.length} entities to Backstage catalog in ${formatDuration(
          Date.now() - applyStartedAt,
        )}.`,
      );

      updateWso2ApimSyncStatus({
        phase: 'complete',
        message: `Catalog sync complete. Ingested ${allEntities.length} entities.`,
        completedAt: new Date().toISOString(),
        totals: { catalogEntities: allEntities.length },
      });

      this.logger.info(`[WSO2 Provider] Successfully ingested ${allEntities.length} entities.`);
      this.logger.info(
        `[WSO2 Timing] ${this.getProviderName()} catalog sync finished in ${formatDuration(
          Date.now() - runStartedAt,
        )}.`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateWso2ApimSyncStatus({
        phase: 'failed',
        message: `Catalog sync failed: ${message}`,
        error: message,
        completedAt: new Date().toISOString(),
      });
      this.logger.error(`[WSO2 Provider] Sync Error: ${message}`);
      this.logger.error(
        `[WSO2 Timing] ${this.getProviderName()} catalog sync failed after ${formatDuration(
          Date.now() - runStartedAt,
        )}.`,
      );
    }
  }

  private parsePlatformGateways(): PlatformGateway[] {
    return this.config.getOptionalConfigArray('wso2PlatformGateway')?.map(gw => ({
      environmentName: gw.getString('name'),
      environmentType: gw.getOptionalString('environmentType') || 'wso2',
      urls: gw.getStringArray('urls'),
      discoveryUrl: gw.getOptionalString('discoveryUrl'),
      discoveryAuth: (gw.getOptionalString('discoveryUsername') && gw.getOptionalString('discoveryPassword'))
          ? `Basic ${Buffer.from(`${gw.getString('discoveryUsername')}:${gw.getString('discoveryPassword')}`).toString('base64')}`
          : undefined,
      organizationId: gw.getOptionalString('organizationId'),
    })) || [];
  }
}
