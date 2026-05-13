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
import { Wso2McpServer } from './types';

/**
 * Fetches the documents associated with an MCP Server.
 */
export async function fetchMcpDocuments(
  client: Wso2Client,
  mcpId: string,
): Promise<any[]> {
  const basePath = client.getPublisherBasePath();
  try {
    const data = await client.get<any>(
      `${basePath}/mcp-servers/${mcpId}/documents`,
    );
    return (data.list || []).map((doc: any) => ({
      ...doc,
      id: doc.id || doc.documentId,
    }));
  } catch (error) {
    // Silent catch
  }
  return [];
}

/**
 * Fetches the detailed metadata for a single MCP Server.
 */
export async function fetchMcpServerDetail(
  client: Wso2Client,
  logger: LoggerService,
  mcpSummary: any,
): Promise<Wso2McpServer> {
  const mcpId = mcpSummary.id;
  let mcp = { ...mcpSummary };

  try {
    const basePath = client.getPublisherBasePath();
    const detailData = await client.get<any>(`${basePath}/mcp-servers/${mcpId}`);
    const operations = detailData.operations || detailData.list || [];
    mcp.tools = operations
      .filter((op: any) => op.feature === 'TOOL')
      .map((op: any) => ({
        name: String(op.target || op.name || ''),
        description: String(op.description || ''),
        authType: String(op.authType || ''),
        throttlingPolicy: String(op.throttlingPolicy || ''),
      }));

    // Fetch documents
    mcp.documents = await fetchMcpDocuments(client, mcpId);
  } catch (error) {
    logger.error(
      `[Wso2Fetchers] Error fetching detail for MCP Server ${mcpId}: ${error}`,
    );
  }

  return mcp as Wso2McpServer;
}

/**
 * Fetches the list of all MCP Servers from the WSO2 Publisher.
 */
export async function fetchMcpServerList(
  client: Wso2Client,
  logger: LoggerService,
): Promise<Wso2McpServer[]> {
  const basePath = client.getPublisherBasePath();
  logger.info(`[Wso2Fetchers] Fetching MCP Servers from ${basePath}/mcp-servers`);
  try {
    const data = await client.get<any>(`${basePath}/mcp-servers`);
    const mcpList = data.list || [];
    logger.info(
      `[Wso2Fetchers] Retrieved ${mcpList.length} MCP Servers from Publisher.`,
    );

    const enrichedMcps: Wso2McpServer[] = [];
    for (const mcpSummary of mcpList) {
      enrichedMcps.push(await fetchMcpServerDetail(client, logger, mcpSummary));
    }
    return enrichedMcps;
  } catch (error) {
    logger.error(`[Wso2Fetchers] Error fetching MCP Servers: ${error}`);
  }
  return [];
}
