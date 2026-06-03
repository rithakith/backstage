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

import { Wso2ApiManagerClient } from './Wso2ApiManagerClient';
import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';

describe('Wso2ApiManagerClient', () => {
  let mockDiscoveryApi: jest.Mocked<DiscoveryApi>;
  let mockFetchApi: jest.Mocked<FetchApi>;
  let client: Wso2ApiManagerClient;

  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  beforeEach(() => {
    mockDiscoveryApi = {
      getBaseUrl: jest.fn().mockResolvedValue('https://wso2-api-manager.backend'),
    } as any;

    mockFetchApi = {
      fetch: jest.fn(),
    } as any;

    client = new Wso2ApiManagerClient({
      discoveryApi: mockDiscoveryApi,
      fetchApi: mockFetchApi,
    });
  });

  describe('request helper and generateApiKey', () => {
    it('should perform a POST request with correct URL, body, and headers', async () => {
      const mockResult = { key: 'secret-key-123' };
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResult)),
      } as any);

      const result = await client.generateApiKey('api-123', { keyName: 'test-key' });

      expect(mockDiscoveryApi.getBaseUrl).toHaveBeenCalledWith('wso2-api-manager');
      expect(mockFetchApi.fetch).toHaveBeenCalledWith(
        'https://wso2-api-manager.backend/apis/api-123/generate-key',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ keyName: 'test-key' }),
        }),
      );
      expect(result).toEqual(mockResult);

      console.log(formatTestCaseDoc(`
=== [API Client: API Key Generation] ===
Endpoint path: /apis/api-123/generate-key
Payload: { keyName: 'test-key' }
Returned Access API Key successfully.
`));
    });

    it('should throw an error if the response is not ok', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValueOnce('Invalid key request format'),
      } as any);

      await expect(client.generateApiKey('api-123')).rejects.toThrow(
        'WSO2 API request failed [400]: Invalid key request format',
      );

      console.log(formatTestCaseDoc(`
=== [API Client Error: Bad Request 400] ===
Simulated Response status: 400 Bad Request
Simulated Response body: "Invalid key request format"
Outcome: Correctly threw custom Error and logged message.
`));
    });

    it('should return empty object if response is empty', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(''),
      } as any);

      const result = await client.generateApiKey('api-123');
      expect(result).toEqual({});
    });

    it('should throw parse error if JSON is malformed', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce('{invalid-json'),
      } as any);

      await expect(client.generateApiKey('api-123')).rejects.toThrow(
        'Failed to parse WSO2 API response: {invalid-json',
      );
    });
  });

  describe('getRevisions', () => {
    it('should call revisions endpoint with token and query parameters', async () => {
      const mockResult = { list: [{ id: 'rev-1' }] };
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResult)),
      } as any);

      const result = await client.getRevisions('api-123', {
        query: 'status:active',
        token: 'user-token',
      });

      expect(mockFetchApi.fetch).toHaveBeenCalledWith(
        'https://wso2-api-manager.backend/apis/api-123/revisions?query=status%3Aactive',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-WSO2-Access-Token': 'user-token',
          },
        }),
      );
      expect(result).toEqual(mockResult);

      console.log(formatTestCaseDoc(`
=== [API Client: Get Revisions] ===
Revisions GET path: /apis/api-123/revisions?query=status%3Aactive
Authentication token header: 'X-WSO2-Access-Token' -> 'user-token'
Returned list of revisions successfully.
`));
    });
  });

  describe('getGateways', () => {
    it('should return arrays from endpoint successfully', async () => {
      const mockResult = [{ name: 'Production Gateway' }];
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResult)),
      } as any);

      const result = await client.getGateways('user-token');

      expect(mockFetchApi.fetch).toHaveBeenCalledWith(
        'https://wso2-api-manager.backend/gateways',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-WSO2-Access-Token': 'user-token',
          },
        }),
      );
      expect(result).toEqual(mockResult);

      console.log(formatTestCaseDoc(`
=== [API Client: Get Gateways] ===
Gateways GET path: /gateways
Outcome: Successfully retrieved arrays.
`));
    });

    it('should return fallback empty array if response is not an array', async () => {
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(JSON.stringify({ notAnArray: true })),
      } as any);

      const result = await client.getGateways();
      expect(result).toEqual([]);
    });
  });

  describe('getHealth', () => {
    it('should fetch health check status', async () => {
      const mockResult = { status: 'healthy' };
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResult)),
      } as any);

      const result = await client.getHealth('user-token');

      expect(mockFetchApi.fetch).toHaveBeenCalledWith(
        'https://wso2-api-manager.backend/health',
        expect.objectContaining({
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'X-WSO2-Access-Token': 'user-token',
          },
        }),
      );
      expect(result).toEqual(mockResult);

      console.log(formatTestCaseDoc(`
=== [API Client: Health Check] ===
Health GET path: /health
Outcome: Checked status successfully: ${JSON.stringify(result)}
`));
    });
  });

  describe('refreshCatalog', () => {
    it('should perform POST call to /refresh', async () => {
      const mockResult = { message: 'Catalog Sync Triggered' };
      mockFetchApi.fetch.mockResolvedValueOnce({
        ok: true,
        text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResult)),
      } as any);

      const result = await client.refreshCatalog('user-token');

      expect(mockFetchApi.fetch).toHaveBeenCalledWith(
        'https://wso2-api-manager.backend/refresh',
        expect.objectContaining({
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
            'X-WSO2-Access-Token': 'user-token',
          },
        }),
      );
      expect(result).toEqual(mockResult);

      console.log(formatTestCaseDoc(`
=== [API Client: Sync/Refresh Ingest Trigger] ===
Trigger POST path: /refresh
Outcome: Sync successfully triggered: "Catalog Sync Triggered"
`));
    });
  });
});
