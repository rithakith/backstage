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

const API_LIST_PAGE_SIZE = 1000;
const API_DETAIL_CONCURRENCY = 10;

function formatDuration(durationMs: number): string {
  return `${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`;
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  const results = new Array<TOutput>(items.length);
  let nextIndex = 0;

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex]);
      }
    },
  );

  await Promise.all(workers);
  return results;
}

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
 * Fetches the WSDL definition if it is a SOAP/SOAPTOREST API.
 */
export async function fetchApiWsdl(
  client: Wso2Client,
  apiId: string,
): Promise<string | undefined> {
  const basePath = client.getPublisherBasePath();
  const wsdlUrl = `${basePath}/apis/${apiId}/wsdl`;

  try {
    const data = await client.getText(wsdlUrl);
    // If the fetched data is binary (e.g. starts with ZIP file magic header 'PK'), skip it.
    if (data.startsWith('PK')) {
      return undefined;
    }
    return data;
  } catch (error: any) {
    return undefined;
  }
}

/**
 * Fetches the detailed metadata for a single API.
 */
export async function fetchApiDetail(
  client: Wso2Client,
  logger: LoggerService,
  apiSummary: any,
): Promise<Wso2Api> {
  const startedAt = Date.now();
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
    api.definition = await fetchApiDefinition(
      client,
      apiId,
      api.type,
      api.name,
    );

    if (['SOAP', 'SOAPTOREST'].includes(api.type)) {
      api.wsdlDefinition = await fetchApiWsdl(client, apiId);
    }
  } catch (error) {
    logger.error(
      `[Wso2Fetchers] Error fetching detail for API ${apiId}: ${error}`,
    );
  }

  logger.info(
    `[WSO2 Timing] API detail "${apiName}" (${apiId}) loaded in ${formatDuration(
      Date.now() - startedAt,
    )}.`,
  );
  return api as Wso2Api;
}

/**
 * Fetches the list of all APIs from the WSO2 Publisher.
 */
export async function fetchApiList(
  client: Wso2Client,
  logger: LoggerService,
  options?: {
    onProgress?: (progress: {
      loaded: number;
      total?: number;
      message?: string;
    }) => void;
  },
): Promise<Wso2Api[]> {
  const startedAt = Date.now();
  const basePath = client.getPublisherBasePath();
  logger.info(`[Wso2Fetchers] Fetching APIs from ${basePath}/apis`);
  options?.onProgress?.({
    loaded: 0,
    total: undefined,
    message: 'Connecting to WSO2 Publisher portal.',
  });

  const apiList: any[] = [];
  let offset = 0;
  let total: number | undefined;
  let hasMore = false;

  do {
    options?.onProgress?.({
      loaded: 0,
      total,
      message:
        offset === 0
          ? 'Determining Publisher API count.'
          : `Loading Publisher API list (${apiList.length}${
              total === undefined ? '' : `/${total}`
            } discovered).`,
    });
    const data = await client.get<any>(
      `${basePath}/apis?limit=${API_LIST_PAGE_SIZE}&offset=${offset}`,
    );
    const page = data.list || [];
    apiList.push(...page);

    total =
      typeof data.pagination?.total === 'number'
        ? data.pagination.total
        : undefined;
    options?.onProgress?.({
      loaded: 0,
      total,
      message:
        total === undefined
          ? `Discovered ${apiList.length} Publisher APIs so far.`
          : `Publisher API count determined: ${total}.`,
    });
    offset += page.length;
    hasMore =
      total === undefined ? page.length === API_LIST_PAGE_SIZE : offset < total;

    logger.info(
      `[Wso2Fetchers] Retrieved API page with ${
        page.length
      } APIs. Total so far: ${apiList.length}${
        total === undefined ? '' : `/${total}`
      }.`,
    );
  } while (hasMore);

  logger.info(
    `[Wso2Fetchers] Retrieved ${apiList.length} APIs from Publisher.`,
  );

  let loaded = 0;
  options?.onProgress?.({
    loaded,
    total: total ?? apiList.length,
    message: `Loading details for ${total ?? apiList.length} Publisher APIs.`,
  });

  const detailStartedAt = Date.now();
  const detailDurationsMs: number[] = [];
  const enrichedApis = await mapWithConcurrency(
    apiList,
    API_DETAIL_CONCURRENCY,
    async apiSummary => {
      const apiStartedAt = Date.now();
      const api = await fetchApiDetail(client, logger, apiSummary);
      detailDurationsMs.push(Date.now() - apiStartedAt);
      loaded += 1;
      options?.onProgress?.({
        loaded,
        total: total ?? apiList.length,
        message: `Loading Publisher API details (${loaded}/${
          total ?? apiList.length
        }).`,
      });
      return api;
    },
  );
  const detailDurationMs = Date.now() - detailStartedAt;
  logger.info(
    `[WSO2 Timing] API catalog load completed: ${
      enrichedApis.length
    } APIs in ${formatDuration(
      Date.now() - startedAt,
    )}; API detail phase ${formatDuration(
      detailDurationMs,
    )}; average individual API detail ${formatDuration(
      detailDurationsMs.length === 0
        ? 0
        : Math.round(
            detailDurationsMs.reduce((sum, value) => sum + value, 0) /
              detailDurationsMs.length,
          ),
    )}; throughput average ${formatDuration(
      enrichedApis.length === 0
        ? 0
        : Math.round(detailDurationMs / enrichedApis.length),
    )} per API at concurrency ${API_DETAIL_CONCURRENCY}.`,
  );
  return enrichedApis;
}
