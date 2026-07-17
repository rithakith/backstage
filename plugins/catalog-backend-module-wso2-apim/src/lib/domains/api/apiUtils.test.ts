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
  fetchApiDefinition,
  fetchApiDocuments,
  fetchApiDetail,
  fetchApiList,
  fetchApiWsdl,
} from './apiUtils';
import { mockServices } from '@backstage/backend-test-utils';

describe('api/apiUtils', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${
      expect.getState().currentTestName
    }\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();
  const mockClient = {
    getPublisherBasePath: jest.fn().mockReturnValue('/api/am/publisher/v3'),
    get: jest.fn(),
    getText: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchApiDefinition', () => {
    it('should successfully fetch swagger definition for standard REST HTTP type', async () => {
      const mockSwagger = { openapi: '3.0.0' };
      mockClient.get.mockResolvedValueOnce(mockSwagger);

      const result = await fetchApiDefinition(
        mockClient,
        'api-123',
        'HTTP',
        'MyAPI',
      );
      expect(result).toBe(JSON.stringify(mockSwagger));
      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/am/publisher/v3/apis/api-123/swagger',
      );

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: Swagger Definition Success] ===
API Type: "HTTP"
Resolved URL Path: "/api/am/publisher/v3/apis/api-123/swagger"
`),
      );
    });

    it('should successfully fetch asyncapi definition for WS type', async () => {
      const mockAsyncApi = { asyncapi: '2.0.0' };
      mockClient.get.mockResolvedValueOnce(mockAsyncApi);

      const result = await fetchApiDefinition(
        mockClient,
        'api-456',
        'WS',
        'MyWS',
      );
      expect(result).toBe(JSON.stringify(mockAsyncApi));
      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/am/publisher/v3/apis/api-456/asyncapi',
      );

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: AsyncAPI Definition Success] ===
API Type: "WS"
Resolved URL Path: "/api/am/publisher/v3/apis/api-456/asyncapi"
`),
      );
    });

    it('should fallback to document placeholder string on definition fetch error', async () => {
      mockClient.get.mockRejectedValueOnce({ status: 500 });

      const result = await fetchApiDefinition(
        mockClient,
        'api-123',
        'HTTP',
        'MyAPI',
      );
      expect(result).toBe(
        'WSO2 API Document content placeholder for MyAPI. Status: 500',
      );

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: Definition Fetch Error Handling] ===
Exception Simulated: Status 500 Internal Error
Returned Value: "WSO2 API Document content placeholder for MyAPI. Status: 500"
`),
      );
    });
  });

  describe('fetchApiWsdl', () => {
    it('should successfully fetch WSDL content as raw text', async () => {
      const mockWsdl = '<?xml version="1.0"?><definitions></definitions>';
      mockClient.getText.mockResolvedValueOnce(mockWsdl);

      const result = await fetchApiWsdl(mockClient, 'api-123');
      expect(result).toBe(mockWsdl);
      expect(mockClient.getText).toHaveBeenCalledWith(
        '/api/am/publisher/v3/apis/api-123/wsdl',
      );
    });

    it('should return undefined if the content starts with PK (zip archive)', async () => {
      const mockZip = 'PK\x03\x04local-file-header';
      mockClient.getText.mockResolvedValueOnce(mockZip);

      const result = await fetchApiWsdl(mockClient, 'api-123');
      expect(result).toBeUndefined();
    });

    it('should return undefined and catch errors silently', async () => {
      mockClient.getText.mockRejectedValueOnce(new Error('Failed to fetch'));

      const result = await fetchApiWsdl(mockClient, 'api-123');
      expect(result).toBeUndefined();
    });
  });

  describe('fetchApiDocuments', () => {
    it('should fetch and map documents successfully', async () => {
      const mockDocList = {
        list: [
          { documentId: 'doc-1', name: 'Guide' },
          { id: 'doc-2', name: 'Reference' },
        ],
      };
      mockClient.get.mockResolvedValueOnce(mockDocList);

      const result = await fetchApiDocuments(mockClient, 'api-123');
      expect(result).toEqual([
        { documentId: 'doc-1', name: 'Guide', id: 'doc-1' },
        { id: 'doc-2', name: 'Reference' },
      ]);
      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/am/publisher/v3/apis/api-123/documents',
      );

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: Documents Fetch Success] ===
Documents Fetched count: ${result.length}
Mapped Document IDs: doc-1, doc-2
`),
      );
    });

    it('should return empty array and catch errors silently', async () => {
      mockClient.get.mockRejectedValueOnce(new Error('Network drop'));

      const result = await fetchApiDocuments(mockClient, 'api-123');
      expect(result).toEqual([]);

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: Documents Fetch Silent Failure] ===
Exception Simulated: "Network drop"
Outcome: Returned empty array [] silently.
`),
      );
    });
  });

  describe('fetchApiDetail', () => {
    it('should fetch and enrich api summary with details, documents, and definition', async () => {
      const summary = { id: 'api-123', name: 'MyAPI', type: 'HTTP' };
      const detail = {
        id: 'api-123',
        description: 'Detailed desc',
        lifeCycleStatus: 'PUBLISHED',
      };
      const mockDocList = { list: [{ documentId: 'doc-1', name: 'Doc' }] };
      const mockSwagger = { openapi: '3.0.0' };

      // 1. Fetch details
      mockClient.get.mockResolvedValueOnce(detail);
      // 2. Fetch documents
      mockClient.get.mockResolvedValueOnce(mockDocList);
      // 3. Fetch swagger definition
      mockClient.get.mockResolvedValueOnce(mockSwagger);

      const result = await fetchApiDetail(mockClient, logger, summary);

      expect(result).toEqual({
        id: 'api-123',
        name: 'MyAPI',
        type: 'HTTP',
        description: 'Detailed desc',
        lifeCycleStatus: 'PUBLISHED',
        documents: [{ documentId: 'doc-1', name: 'Doc', id: 'doc-1' }],
        definition: JSON.stringify(mockSwagger),
      });

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: API Detail Enrichment Success] ===
API Resolved: "${result.name}" (${result.id})
Enriched Properties: description, lifeCycleStatus, documents, definition
`),
      );
    });

    it('should return base summary and log error if detail fetch fails', async () => {
      const summary = { id: 'api-123', name: 'MyAPI' };
      mockClient.get.mockRejectedValueOnce(new Error('Detail fetch failed'));

      const result = await fetchApiDetail(mockClient, logger, summary);
      expect(result).toEqual(summary);
      expect(logger.error).toHaveBeenCalledWith(
        '[Wso2Fetchers] Error fetching detail for API api-123: Error: Detail fetch failed',
      );

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: API Detail Enrichment Failure] ===
Exception Simulated: "Detail fetch failed"
Outcome: Gracefully logged error and returned original summary.
`),
      );
    });
  });

  describe('fetchApiList', () => {
    it('should fetch all APIs and enrich each with detailed metadata', async () => {
      const mockApisList = {
        list: [
          { id: 'api-1', name: 'API-1', type: 'HTTP' },
          { id: 'api-2', name: 'API-2', type: 'WS' },
        ],
        pagination: { total: 2 },
      };

      mockClient.get.mockImplementation(async (path: string) => {
        switch (path) {
          case '/api/am/publisher/v3/apis?limit=1000&offset=0':
            return mockApisList;
          case '/api/am/publisher/v3/apis/api-1':
            return { description: 'Detail 1' };
          case '/api/am/publisher/v3/apis/api-1/documents':
            return { list: [] };
          case '/api/am/publisher/v3/apis/api-1/swagger':
            return { openapi: '3.0.0' };
          case '/api/am/publisher/v3/apis/api-2':
            return { description: 'Detail 2' };
          case '/api/am/publisher/v3/apis/api-2/documents':
            return { list: [] };
          case '/api/am/publisher/v3/apis/api-2/asyncapi':
            return { asyncapi: '2.0.0' };
          default:
            throw new Error(`Unexpected request: ${path}`);
        }
      });

      const result = await fetchApiList(mockClient, logger);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: 'api-1',
          description: 'Detail 1',
          definition: JSON.stringify({ openapi: '3.0.0' }),
        }),
      );
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: 'api-2',
          description: 'Detail 2',
          definition: JSON.stringify({ asyncapi: '2.0.0' }),
        }),
      );

      expect(mockClient.get).toHaveBeenCalledWith(
        '/api/am/publisher/v3/apis?limit=1000&offset=0',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[Wso2Fetchers] Fetching APIs from /api/am/publisher/v3/apis',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[Wso2Fetchers] Retrieved 2 APIs from Publisher.',
      );

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: API List Fetch Success] ===
Publisher list fetch matched 2 APIs.
All APIs successfully enriched.
`),
      );
    });

    it('should page through APIs beyond the first 1000 results', async () => {
      const firstPage = Array.from({ length: 1000 }, (_, index) => ({
        id: `api-${index + 1}`,
        name: `API-${index + 1}`,
        type: 'HTTP',
      }));
      const secondPage = [{ id: 'api-1001', name: 'API-1001', type: 'HTTP' }];

      mockClient.get.mockImplementation(async (path: string) => {
        if (path === '/api/am/publisher/v3/apis?limit=1000&offset=0') {
          return { list: firstPage, pagination: { total: 1001 } };
        }
        if (path === '/api/am/publisher/v3/apis?limit=1000&offset=1000') {
          return { list: secondPage, pagination: { total: 1001 } };
        }
        if (path.endsWith('/documents')) {
          return { list: [] };
        }
        if (path.endsWith('/swagger')) {
          return { openapi: '3.0.0' };
        }
        const detailMatch = path.match(/\/apis\/(api-\d+)$/);
        if (detailMatch) {
          return { description: `Detail for ${detailMatch[1]}` };
        }
        throw new Error(`Unexpected request: ${path}`);
      });

      const result = await fetchApiList(mockClient, logger);

      expect(result).toHaveLength(1001);
      expect(result[1000]).toEqual(
        expect.objectContaining({
          id: 'api-1001',
          description: 'Detail for api-1001',
        }),
      );
      expect(mockClient.get).toHaveBeenNthCalledWith(
        1,
        '/api/am/publisher/v3/apis?limit=1000&offset=0',
      );
      expect(mockClient.get).toHaveBeenNthCalledWith(
        2,
        '/api/am/publisher/v3/apis?limit=1000&offset=1000',
      );
      expect(logger.info).toHaveBeenCalledWith(
        '[Wso2Fetchers] Retrieved 1001 APIs from Publisher.',
      );

      console.log(
        formatTestCaseDoc(`
=== [API Fetcher: API List Pagination Success] ===
Publisher list fetch crossed the 1000 API page boundary.
All paged APIs successfully enriched.
`),
      );
    });
  });
});
