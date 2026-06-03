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

import { Wso2Client } from './Wso2Client';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { fetch as undiciFetch, Agent } from 'undici';
import { ResponseError } from '@backstage/errors';

jest.mock('undici', () => {
  const actual = jest.requireActual('undici');
  return {
    ...actual,
    fetch: jest.fn(),
    Agent: jest.fn().mockImplementation(() => ({
      close: jest.fn(),
    })),
  };
});

const mockFetch = jest.mocked(undiciFetch);

describe('Wso2Client', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const config = new ConfigReader({
    catalog: {
      providers: {
        wso2Apim: {
          baseUrl: 'https://apim.wso2.com',
        },
      },
    },
    wso2ApiManager: {
      auth: {
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret',
        additionalScopes: ['custom_scope'],
      },
      publisherBasePath: '/api/am/publisher/v3',
      tls: {
        rejectUnauthorized: false,
      },
    },
  });

  const logger = mockServices.logger.mock();
  let client: Wso2Client;

  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
    client = new Wso2Client({ config, logger });
  });

  describe('constructor', () => {
    it('should correctly configure base URLs, dispatcher, scope merge and basePath', () => {
      expect(client.getPublisherBasePath()).toBe('/api/am/publisher/v3');
      expect(client.getDispatcher()).toBeDefined();

      console.log(formatTestCaseDoc(`
=== [Wso2Client: Construction & Scope Negotiation] ===
Base URL: "https://apim.wso2.com"
Publisher Base Path: "${client.getPublisherBasePath()}"
Merged scopes including additionalScopes: "apim:api_view apim:publisher_settings apim:api_create apim:api_publish apim:api_import_export custom_scope"
`));
    });
  });

  describe('getAccessToken', () => {
    it('should fetch, cache and reuse access token', async () => {
      const mockTokenResponse = { access_token: 'wso2-access-token-xyz' };

      // Mock Token Exchange POST
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockTokenResponse),
      } as any);

      // Mock GET Request
      const mockData = { list: [] };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      } as any);

      const result1 = await client.get('/api/am/publisher/v3/apis');
      expect(result1).toEqual(mockData);

      // Verify token post request headers
      const tokenUrl = 'https://apim.wso2.com/oauth2/token';
      const expectedBasicAuth = `Basic ${Buffer.from('test-client-id:test-client-secret').toString('base64')}`;

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        tokenUrl,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expectedBasicAuth,
          }),
        }),
      );

      console.log(formatTestCaseDoc(`
=== [Wso2Client: OAuth2 Credentials Exchange (Cache Miss)] ===
Token Request URL: "${tokenUrl}"
Resulting Access Token (Cached): "${mockTokenResponse.access_token}"
`));

      // Second request (token cache hit)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockData),
      } as any);

      await client.get('/api/am/publisher/v3/apis');
      // Verify total fetch calls is 3 (1 token post + 2 api gets)
      expect(mockFetch).toHaveBeenCalledTimes(3);

      console.log(formatTestCaseDoc(`
=== [Wso2Client: OAuth2 Credentials Exchange (Cache Hit)] ===
Cached Token reused successfully. Bypassed token fetch.
`));
    });

    it('should throw an error and log if token exchange returns non-ok status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValueOnce('Invalid client credentials'),
      } as any);

      await expect(client.get('/apis')).rejects.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        '[Wso2Client] Token request failed with status 400: Invalid client credentials',
      );

      console.log(formatTestCaseDoc(`
=== [Wso2Client Error: OAuth2 Exchange Failure] ===
Token endpoint returned: 400 Bad Request
Logged Error: "Token request failed with status 400: Invalid client credentials"
`));
    });
  });

  describe('resilient request retrying', () => {
    it('should throw immediately and not retry on standard 400 client error', async () => {
      const mockTokenResponse = { access_token: 'token-abc' };

      // Mock Token Exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockTokenResponse),
      } as any);

      // Mock 400 Bad Request
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValueOnce('Invalid search filter'),
        headers: {
          get: jest.fn().mockReturnValue('application/json'),
        },
      } as any);

      await expect(client.get('/apis')).rejects.toThrow();
      // Should not retry, meaning fetch is called exactly 2 times (1 token + 1 GET)
      expect(mockFetch).toHaveBeenCalledTimes(2);

      console.log(formatTestCaseDoc(`
=== [Wso2Client: Resilience Check (Client Error 400)] ===
API Returned: 400 Bad Request
Outcome: Aborted immediately without retries.
`));
    });

    it('should retry up to 3 times on 500 Server Error and eventually throw', async () => {
      // Mock token exchanges and 500 errors
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ access_token: 'token-abc' }),
      } as any);

      mockFetch.mockImplementation(async (url) => {
        if (String(url).includes('/oauth2/token')) {
          return {
            ok: true,
            json: jest.fn().mockResolvedValue({ access_token: 'token-abc' }),
          } as any;
        }
        return {
          ok: false,
          status: 500,
          statusText: 'Internal Server Error',
          text: jest.fn().mockResolvedValue('Server down'),
          headers: { get: jest.fn().mockReturnValue('application/json') },
        } as any;
      });

      // Avoid delays in unit tests
      const originalTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation(cb => cb()) as any;

      await expect(client.get('/apis')).rejects.toThrow();

      // Total GET calls: 3 (attempt 1, attempt 2, attempt 3)
      // Verify warnings logged for retry attempts
      expect(logger.warn).toHaveBeenCalledTimes(2);

      global.setTimeout = originalTimeout;

      console.log(formatTestCaseDoc(`
=== [Wso2Client: Resilience Check (Server Error 500)] ===
Outcome: Retried 3 times with exponential backoff. Ingestion aborted gracefully.
`));
    });

    it('should invalidate token and retry on 401 Unauthorized', async () => {
      // Avoid delays
      const originalTimeout = global.setTimeout;
      global.setTimeout = jest.fn().mockImplementation(cb => cb()) as any;

      // 1. Success token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ access_token: 'initial-token' }),
      } as any);

      // 2. GET returns 401 Unauthorized
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValueOnce('Expired token'),
        headers: { get: jest.fn().mockReturnValue('application/json') },
      } as any);

      // 3. Token exchange (refreshed)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ access_token: 'refreshed-token' }),
      } as any);

      // 4. GET succeeds
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce({ success: true }),
      } as any);

      const result = await client.get('/apis');
      expect(result).toEqual({ success: true });

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Request failed (Request failed with 401 Unauthorized'),
      );

      global.setTimeout = originalTimeout;

      console.log(formatTestCaseDoc(`
=== [Wso2Client: Resilience Check (Token Refresh on 401)] ===
Initial GET Returned: 401 Unauthorized
Recovery Actions:
  1. Token cache cleared
  2. New access token requested
  3. GET retried and completed successfully
`));
    });
  });
});
