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
import { Wso2ApiProduct } from './types';

function formatDuration(durationMs: number): string {
  return `${durationMs}ms (${(durationMs / 1000).toFixed(2)}s)`;
}

/**
 * Fetches the definition (Swagger) for an API Product.
 */
export async function fetchApiProductDefinition(
  client: Wso2Client,
  productId: string,
  productName: string,
): Promise<string> {
  const basePath = client.getPublisherBasePath();
  try {
    const swaggerData = await client.get<any>(
      `${basePath}/api-products/${productId}/swagger`,
    );
    return JSON.stringify(swaggerData);
  } catch (error) {
    // Silent catch
  }
  return `WSO2 API Product definition placeholder for ${productName}`;
}

/**
 * Fetches the detailed metadata for a single API Product.
 */
export async function fetchApiProductDetail(
  client: Wso2Client,
  logger: LoggerService,
  productSummary: any,
): Promise<Wso2ApiProduct> {
  const startedAt = Date.now();
  const productId = productSummary.id;
  const product = { ...productSummary };

  try {
    const basePath = client.getPublisherBasePath();
    const detailData = await client.get<any>(
      `${basePath}/api-products/${productId}`,
    );
    Object.assign(product, detailData);

    // Fetch definition
    product.definition = await fetchApiProductDefinition(
      client,
      productId,
      product.name,
    );
  } catch (error) {
    logger.error(
      `[Wso2Fetchers] Error fetching detail for API Product ${productId}: ${error}`,
    );
  }

  logger.info(
    `[WSO2 Timing] API Product detail "${
      product.name || productId
    }" (${productId}) loaded in ${formatDuration(Date.now() - startedAt)}.`,
  );
  return product as Wso2ApiProduct;
}

/**
 * Fetches the list of all API Products from the WSO2 Publisher.
 */
export async function fetchApiProductList(
  client: Wso2Client,
  logger: LoggerService,
): Promise<Wso2ApiProduct[]> {
  const startedAt = Date.now();
  const basePath = client.getPublisherBasePath();
  logger.info(`[Wso2Fetchers] Fetching API Products from ${basePath}/api-products`);
  try {
    const data = await client.get<any>(`${basePath}/api-products`);
    const productList = data.list || [];
    logger.info(
      `[Wso2Fetchers] Retrieved ${productList.length} API Products from Publisher.`,
    );

    const enrichedProducts: Wso2ApiProduct[] = [];
    for (const productSummary of productList) {
      enrichedProducts.push(
        await fetchApiProductDetail(client, logger, productSummary),
      );
    }
    const durationMs = Date.now() - startedAt;
    logger.info(
      `[WSO2 Timing] API Products loaded: ${
        enrichedProducts.length
      } products in ${formatDuration(durationMs)}; average ${formatDuration(
        enrichedProducts.length === 0
          ? 0
          : Math.round(durationMs / enrichedProducts.length),
      )} per product.`,
    );
    return enrichedProducts;
  } catch (error) {
    logger.error(`[Wso2Fetchers] Error fetching API Products: ${error}`);
  }
  return [];
}
