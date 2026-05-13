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
import { Wso2Api } from './types';

/**
 * Fetches the API definition (Swagger or AsyncAPI).
 */
export async function fetchApiDefinition(
  client: Wso2Client,
  apiId: string,
  apiType: string,
  apiName: string,
): Promise<string> {
  const basePath = client.getPublisherBasePath();
  const isAsyncApi = ['WEBSUB', 'WS', 'SSE', 'ASYNC'].includes(apiType);
  const definitionUrl = isAsyncApi
    ? `${basePath}/apis/${apiId}/asyncapi`
    : `${basePath}/apis/${apiId}/swagger`;

  try {
    const data = await client.get<any>(definitionUrl);
    return JSON.stringify(data);
  } catch (error: any) {
    return `WSO2 API Document content placeholder for ${apiName}. Status: ${
      error.status || 'unknown'
    }`;
  }
}

/**
 * Fetches the documentation associated with an API.
 */
export async function fetchApiDocuments(
  client: Wso2Client,
  apiId: string,
): Promise<any[]> {
  const basePath = client.getPublisherBasePath();
  try {
    const data = await client.get<any>(`${basePath}/apis/${apiId}/documents`);
    return (data.list || []).map((doc: any) => ({
      ...doc,
      id: doc.id || doc.documentId,
    }));
  } catch (error) {
    // Silent catch as per previous implementation
  }
  return [];
}

/**
 * Fetches the detailed metadata for a single API.
 */
export async function fetchApiDetail(
  client: Wso2Client,
  logger: LoggerService,
  apiSummary: any,
): Promise<Wso2Api> {
  const apiId = apiSummary.id;
  const apiName = apiSummary.name || apiId;
  logger.info(`[Wso2Fetchers] Fetching detail for API "${apiName}" (${apiId})`);

  let api = { ...apiSummary };

  try {
    const basePath = client.getPublisherBasePath();
    const detailData = await client.get<any>(`${basePath}/apis/${apiId}`);
    api = { ...api, ...detailData };

    // Fetch documents and definitions
    api.documents = await fetchApiDocuments(client, apiId);
    api.definition = await fetchApiDefinition(client, apiId, api.type, api.name);
  } catch (error) {
    logger.error(`[Wso2Fetchers] Error fetching detail for API ${apiId}: ${error}`);
  }

  return api as Wso2Api;
}

/**
 * Fetches the list of all APIs from the WSO2 Publisher.
 */
export async function fetchApiList(
  client: Wso2Client,
  logger: LoggerService,
): Promise<Wso2Api[]> {
  const basePath = client.getPublisherBasePath();
  logger.info(`[Wso2Fetchers] Fetching APIs from ${basePath}/apis`);

  const data = await client.get<any>(`${basePath}/apis`);
  const apiList = data.list || [];
  logger.info(`[Wso2Fetchers] Retrieved ${apiList.length} APIs from Publisher.`);

  const enrichedApis: Wso2Api[] = [];
  for (const apiSummary of apiList) {
    enrichedApis.push(await fetchApiDetail(client, logger, apiSummary));
  }

  return enrichedApis;
}
