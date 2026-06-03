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

import { mapWso2McpToEntity } from './mapperUtils';
import { fetchMcpDocuments, fetchMcpServerDetail, fetchMcpServerList } from './mcpUtils';
import { mockServices } from '@backstage/backend-test-utils';
import { Wso2McpServer } from './types';

describe('mcp domain', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();
  const mockClient = {
    getPublisherBasePath: jest.fn().mockReturnValue('/api/am/publisher/v3'),
    get: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('mapWso2McpToEntity', () => {
    it('should map a raw MCP Server into a Backstage API Entity with full fields', () => {
      const mcp: Wso2McpServer = {
        id: 'mcp-123',
        name: 'Gitea Tools MCP',
        description: 'MCP server for Gitea integration',
        provider: 'devops-team',
        lifeCycleStatus: 'PUBLISHED',
        tags: ['git', 'mcp'],
        tools: [
          { name: 'list-repos', description: 'Lists repos', authType: 'None', throttlingPolicy: 'Unlimited' },
        ],
        documents: [{ id: 'doc-1', name: 'MCP Guide' }],
      };

      const entity = mapWso2McpToEntity(mcp, 'my-namespace', 'my-provider');

      expect(entity).toEqual({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'API',
        metadata: {
          name: 'gitea-tools-mcp',
          namespace: 'my-namespace',
          title: 'Gitea Tools MCP',
          description: 'MCP server for Gitea integration',
          annotations: {
            'backstage.io/managed-by-location': 'wso2-apim:my-provider',
            'backstage.io/managed-by-origin-location': 'wso2-apim:my-provider',
            'wso2.com/api-id': 'mcp-123',
            'wso2.com/api-name': 'Gitea Tools MCP',
            'wso2.com/api-type': 'MCP',
            'wso2.com/is-mcp-server': 'true',
            'wso2.com/api-raw-json': JSON.stringify(mcp),
            'wso2.com/mcp-tools': JSON.stringify(mcp.tools),
            'wso2.com/api-documents': JSON.stringify(mcp.documents),
          },
          tags: ['git', 'mcp'],
        },
        spec: {
          type: 'mcp',
          lifecycle: undefined,
          owner: 'devops-team',
          definition: 'WSO2 MCP Server: Gitea Tools MCP',
        },
      });

      console.log(formatTestCaseDoc(`
=== [MCP Mapper: MCP Server Mapping (Published)] ===
MCP name: "${entity.metadata.name}"
Spec lifecycle: "${entity.spec.lifecycle}"
Spec owner: "${entity.spec.owner}" (from provider)
`));
    });

    it('should fallback to unknown for owner, and experimental for lifecycle', () => {
      // 1. Fallback to unknown & experimental
      const mcp1: Wso2McpServer = { id: '1', name: 'm1' };
      const ent1 = mapWso2McpToEntity(mcp1, 'default', 'prov');
      expect(ent1.spec.owner).toBe('unknown');
      expect(ent1.spec.lifecycle).toBeUndefined();

      console.log(formatTestCaseDoc(`
=== [MCP Mapper: MCP Server Spec Fallbacks] ===
Fallback 1: owner="${ent1.spec.owner}" (unknown)
Fallback 2: lifecycle="${ent1.spec.lifecycle}" (undefined)
`));
    });
  });

  describe('fetchMcpDocuments', () => {
    it('should fetch and map MCP documents successfully', async () => {
      const mockDocList = {
        list: [
          { documentId: 'doc-1', name: 'Guide' },
          { id: 'doc-2', name: 'Reference' },
        ],
      };
      mockClient.get.mockResolvedValueOnce(mockDocList);

      const result = await fetchMcpDocuments(mockClient, 'mcp-1');
      expect(result).toEqual([
        { documentId: 'doc-1', name: 'Guide', id: 'doc-1' },
        { id: 'doc-2', name: 'Reference' },
      ]);
      expect(mockClient.get).toHaveBeenCalledWith('/api/am/publisher/v3/mcp-servers/mcp-1/documents');

      console.log(formatTestCaseDoc(`
=== [MCP Fetcher: Documents Success] ===
Documents list count: ${result.length}
Resolved URL Path: "/api/am/publisher/v3/mcp-servers/mcp-1/documents"
`));
    });

    it('should catch error and return empty array on failure', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Documents failure'));

      const result = await fetchMcpDocuments(mockClient, 'mcp-1');
      expect(result).toEqual([]);

      console.log(formatTestCaseDoc(`
=== [MCP Fetcher: Documents Silent Fallback] ===
Exception Simulated: "Documents failure"
Outcome: Returned empty array silently.
`));
    });
  });

  describe('fetchMcpServerDetail', () => {
    it('should successfully fetch details, filter and map operations to tools, and enrich documents', async () => {
      const summary = { id: 'mcp-1', name: 'MyMCP' };
      const detail = {
        id: 'mcp-1',
        description: 'Server desc',
        operations: [
          { feature: 'TOOL', target: 'list-files', description: 'Lists files', authType: 'None', throttlingPolicy: 'Unlimited' },
          { feature: 'RESOURCE', target: 'read-file', description: 'Reads files' }, // Ignored since not feature === 'TOOL'
        ],
      };
      const mockDocs = { list: [{ id: 'doc-1', name: 'Doc' }] };

      mockClient.get.mockResolvedValueOnce(detail);
      mockClient.get.mockResolvedValueOnce(mockDocs);

      const result = await fetchMcpServerDetail(mockClient, logger, summary);

      expect(result).toEqual({
        id: 'mcp-1',
        name: 'MyMCP',
        tools: [
          { name: 'list-files', description: 'Lists files', authType: 'None', throttlingPolicy: 'Unlimited' },
        ],
        documents: [{ id: 'doc-1', name: 'Doc' }],
      });

      console.log(formatTestCaseDoc(`
=== [MCP Fetcher: MCP Server Detail Enrichment Success] ===
Enriched tools count: ${result.tools?.length} (Filtered out non-TOOL features)
`));
    });

    it('should fetch using fallback detailData.list for operations if detailData.operations is missing', async () => {
      const summary = { id: 'mcp-1', name: 'MyMCP' };
      const detail = {
        id: 'mcp-1',
        list: [
          { feature: 'TOOL', name: 'list-files', description: 'Lists files', authType: 'None', throttlingPolicy: 'Unlimited' },
        ],
      };
      const mockDocs = { list: [] };

      mockClient.get.mockResolvedValueOnce(detail);
      mockClient.get.mockResolvedValueOnce(mockDocs);

      const result = await fetchMcpServerDetail(mockClient, logger, summary);

      expect(result.tools).toEqual([
        { name: 'list-files', description: 'Lists files', authType: 'None', throttlingPolicy: 'Unlimited' },
      ]);
    });

    it('should catch errors, log, and return summary on detail fetch error', async () => {
      const summary = { id: 'mcp-1', name: 'MyMCP' };
      mockClient.get.mockRejectedValueOnce(new Error('Detail failure'));

      const result = await fetchMcpServerDetail(mockClient, logger, summary);

      expect(result).toEqual(summary);
      expect(logger.error).toHaveBeenCalledWith(
        '[Wso2Fetchers] Error fetching detail for MCP Server mcp-1: Error: Detail failure',
      );

      console.log(formatTestCaseDoc(`
=== [MCP Fetcher: MCP Server Detail Enrichment Failure] ===
Exception Simulated: "Detail failure"
Outcome: Returned original summary gracefully and logged error.
`));
    });
  });

  describe('fetchMcpServerList', () => {
    it('should fetch list and enrich each MCP server', async () => {
      const mockList = {
        list: [
          { id: 'mcp-1', name: 'MCP-1' },
          { id: 'mcp-2', name: 'MCP-2' },
        ],
      };

      const mockDetail1 = { operations: [] };
      const mockDocs1 = { list: [] };

      const mockDetail2 = { operations: [] };
      const mockDocs2 = { list: [] };

      // 1. fetch list
      mockClient.get.mockResolvedValueOnce(mockList);
      // 2. mcp 1 details and docs
      mockClient.get.mockResolvedValueOnce(mockDetail1);
      mockClient.get.mockResolvedValueOnce(mockDocs1);
      // 3. mcp 2 details and docs
      mockClient.get.mockResolvedValueOnce(mockDetail2);
      mockClient.get.mockResolvedValueOnce(mockDocs2);

      const result = await fetchMcpServerList(mockClient, logger);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(expect.objectContaining({ id: 'mcp-1', tools: [] }));
      expect(result[1]).toEqual(expect.objectContaining({ id: 'mcp-2', tools: [] }));

      expect(logger.info).toHaveBeenCalledWith('[Wso2Fetchers] Fetching MCP Servers from /api/am/publisher/v3/mcp-servers');
      expect(logger.info).toHaveBeenCalledWith('[Wso2Fetchers] Retrieved 2 MCP Servers from Publisher.');

      console.log(formatTestCaseDoc(`
=== [MCP Fetcher: MCP Servers List Fetch Success] ===
Successfully fetched 2 MCP Servers from Publisher list.
`));
    });

    it('should log error and return empty array on outer list fetch error', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('List failure'));

      const result = await fetchMcpServerList(mockClient, logger);

      expect(result).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        '[Wso2Fetchers] Error fetching MCP Servers: Error: List failure',
      );

      console.log(formatTestCaseDoc(`
=== [MCP Fetcher: MCP Servers List Fetch Failure] ===
Exception Simulated: "List failure"
Outcome: Returned empty array and logged error gracefully.
`));
    });
  });
});
