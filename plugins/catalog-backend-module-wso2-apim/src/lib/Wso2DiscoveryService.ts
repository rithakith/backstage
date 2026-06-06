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
  }): Promise<Entity[]> {
    const { namespace, providerId, platformGateways } = options;

    this.logger.info(`[Wso2DiscoveryService] Starting discovery for provider ${providerId}`);

    // 1. Fetch raw data from WSO2 domains
    const globalSettings = await fetchGlobalSettings(this.client, this.logger);
    const apiList = await fetchApiList(this.client, this.logger);
    const productList = await fetchApiProductList(this.client, this.logger);
    const mcpList = await fetchMcpServerList(this.client, this.logger);
    const serviceList = await fetchServiceList(this.client, this.logger);
    const discoveredGatewayApis = await discoverGatewayApis(
      platformGateways,
      this.logger,
      this.client.getDispatcher(),
    );

    // 2. Map WSO2 objects to Backstage entities
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

    return allEntities;
  }
}
