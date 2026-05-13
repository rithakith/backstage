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
import { Wso2Client } from '../../Wso2Client';
import { GlobalSettings } from './types';

/**
 * Fetches the global settings and environment metadata from WSO2 Publisher.
 */
export async function fetchGlobalSettings(
  client: Wso2Client,
  logger: LoggerService,
): Promise<GlobalSettings | undefined> {
  const basePath = client.getPublisherBasePath();
  logger.info(`[Wso2Fetchers] Fetching Global Settings from ${basePath}/settings`);
  try {
    const data = await client.get<GlobalSettings>(`${basePath}/settings`);
    logger.info(
      `[Wso2Fetchers] Successfully retrieved global settings with ${
        data?.environment?.length || 0
      } environments.`,
    );
    return data;
  } catch (error) {
    logger.error(`[Wso2Fetchers] Error fetching global settings: ${error}`);
  }
  return undefined;
}
