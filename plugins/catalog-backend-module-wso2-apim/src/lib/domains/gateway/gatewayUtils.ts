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
import { fetch as undiciFetch } from 'undici';
import { PlatformGateway } from './types';

/**
 * Discovers APIs directly from self-hosted gateways.
 */
export async function discoverGatewayApis(
  platformGateways: PlatformGateway[],
  logger: LoggerService,
  dispatcher: any,
): Promise<any[]> {
  const discoveredGatewayApis: any[] = [];
  for (const gw of platformGateways) {
    if (gw.discoveryUrl) {
      logger.info(
        `[WSO2-GATEWAY-DISCOVERY] Attempting discovery from ${gw.environmentName} (${gw.discoveryUrl})`,
      );
      try {
        const headers: Record<string, string> = { Accept: 'application/json' };
        if (gw.discoveryAuth) headers.Authorization = gw.discoveryAuth;

        const response = await undiciFetch(gw.discoveryUrl, { headers, dispatcher });
        if (response.ok) {
          const data = (await response.json()) as any;
          const apis = Array.isArray(data)
            ? data
            : data.list || data.apis || data.items || [];
          const list = Array.isArray(apis) ? apis : [data];

          for (const apiItem of list) {
            const apiId =
              apiItem.id || (typeof apiItem === 'string' ? apiItem : undefined);
            if (!apiId) continue;

            try {
              const detailResponse = await undiciFetch(`${gw.discoveryUrl}/${apiId}`, {
                headers,
                dispatcher,
              });
              if (detailResponse.ok) {
                const detailData = (await detailResponse.json()) as any;
                const apiConfig = detailData.api || detailData;

                const api = {
                  ...apiConfig,
                  id: apiConfig.id || apiId,
                  initiatedFromGateway: true,
                  isDirectDiscovery: true,
                  discoveredFrom: gw.environmentName,
                  environmentType: gw.environmentType,
                  gatewayUrls: gw.urls,
                  fullConfig: apiConfig.configuration || apiConfig,
                };

                const gwSpec =
                  apiConfig.configuration?.spec || apiConfig.spec || apiConfig;
                api.fetchedSwagger = JSON.stringify(gwSpec, null, 2);
                discoveredGatewayApis.push(api);
              }
            } catch (err) {
              logger.error(
                `[WSO2-GATEWAY-DISCOVERY] Error fetching details for ${apiId}: ${err}`,
              );
            }
          }
        }
      } catch (error: any) {
        logger.error(
          `[WSO2-GATEWAY-DISCOVERY] Error during discovery from ${gw.environmentName}: ${error.message}`,
        );
      }
    }
  }
  return discoveredGatewayApis;
}
