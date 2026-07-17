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

import { LoggerService } from '@backstage/backend-plugin-api';
import { Entity } from '@backstage/catalog-model';
import { Wso2Client } from './Wso2Client';
import { fetchGlobalSettings } from './domains/settings';
import { fetchApiList, mapWso2ApiToEntity } from './domains/api';
import { fetchApiProductList, mapWso2ProductToEntity } from './domains/product';
import { fetchMcpServerList, mapWso2McpToEntity } from './domains/mcp';
import { fetchServiceList, mapWso2ServiceToEntity } from './domains/service';
import { discoverGatewayApis, mapDiscoveredApiToEntity, PlatformGateway } from './domains/gateway';

function formatDuration(durationMs: number): string {
  return `${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`;
}

async function timePhase<T>(
  logger: LoggerService,
  label: string,
  action: () => Promise<T>,
): Promise<T> {
  const startedAt = Date.now();
  logger.info(`[WSO2 Timing] ${label} started.`);
  try {
    const result = await action();
    logger.info(
      `[WSO2 Timing] ${label} completed in ${formatDuration(
        Date.now() - startedAt,
      )}.`,
    );
    return result;
  } catch (error) {
    logger.error(
      `[WSO2 Timing] ${label} failed after ${formatDuration(
        Date.now() - startedAt,
      )}: ${error}`,
    );
    throw error;
  }
}

/**
 * Service responsible for orchestrating the discovery of WSO2 entities.
 */
export class Wso2DiscoveryService {
  private readonly client: Wso2Client;
  private readonly logger: LoggerService;

  constructor(options: { client: Wso2Client; logger: LoggerService }) {
    this.client = options.client;
    this.logger = options.logger;
  }

  /**
   * Discovers all entities from WSO2 and maps them to Backstage entities.
   */
  async discoverAll(options: {
    namespace: string;
    providerId: string;
    platformGateways: PlatformGateway[];
    onPublisherApiProgress?: (progress: {
      loaded: number;
      total?: number;
      message?: string;
    }) => void;
  }): Promise<Entity[]> {
    const discoveryStartedAt = Date.now();
    const { namespace, providerId, platformGateways, onPublisherApiProgress } =
      options;

    this.logger.info(`[Wso2DiscoveryService] Starting discovery for provider ${providerId}`);

    // 1. Fetch raw data from WSO2 domains
    const globalSettings = await timePhase(
      this.logger,
      'Global settings load',
      () => fetchGlobalSettings(this.client, this.logger),
    );
    const apiList = await timePhase(this.logger, 'Publisher API load', () =>
      fetchApiList(this.client, this.logger, {
        onProgress: onPublisherApiProgress,
      }),
    );
    const productList = await timePhase(this.logger, 'API Product load', () =>
      fetchApiProductList(this.client, this.logger),
    );
    const mcpList = await timePhase(this.logger, 'MCP Server load', () =>
      fetchMcpServerList(this.client, this.logger),
    );
    const serviceList = await timePhase(
      this.logger,
      'Service Catalog load',
      () => fetchServiceList(this.client, this.logger),
    );
    const discoveredGatewayApis = await timePhase(
      this.logger,
      'Gateway API discovery',
      () =>
        discoverGatewayApis(
          platformGateways,
          this.logger,
          this.client.getDispatcher(),
        ),
    );

    // 2. Map WSO2 objects to Backstage entities
    const mappingStartedAt = Date.now();
    const apiEntities = apiList.map(api =>
      mapWso2ApiToEntity(api, namespace, providerId, globalSettings, platformGateways, this.logger),
    );

    const productEntities = productList.map(product =>
      mapWso2ProductToEntity(product, namespace, providerId, globalSettings, platformGateways, this.logger),
    );

    const mcpEntities = mcpList.map(mcp =>
      mapWso2McpToEntity(mcp, namespace, providerId),
    );

    const serviceEntities = serviceList.map(svc =>
      mapWso2ServiceToEntity(svc, namespace, providerId),
    );

    const discoveredEntities = discoveredGatewayApis.map(api =>
      mapDiscoveredApiToEntity(api),
    );

    const allEntities = [
      ...apiEntities,
      ...productEntities,
      ...mcpEntities,
      ...serviceEntities,
      ...discoveredEntities,
    ];

    this.logger.info(
      `[Wso2DiscoveryService] Discovery complete. Found ${allEntities.length} entities.`,
    );
    this.logger.info(
      `[WSO2 Timing] Entity mapping completed in ${formatDuration(
        Date.now() - mappingStartedAt,
      )}. Counts: APIs=${apiEntities.length}, Products=${
        productEntities.length
      }, MCP=${mcpEntities.length}, Services=${
        serviceEntities.length
      }, Gateway APIs=${discoveredEntities.length}.`,
    );
    this.logger.info(
      `[WSO2 Timing] Full WSO2 discovery completed in ${formatDuration(
        Date.now() - discoveryStartedAt,
      )}; total catalog entities=${allEntities.length}.`,
    );

    return allEntities;
  }
}
