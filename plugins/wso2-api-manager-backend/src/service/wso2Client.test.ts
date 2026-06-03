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

import { readWso2ApiManagerConfig, Wso2ApiManagerClient } from './wso2Client';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import { fetch as undiciFetch } from 'undici';

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

describe('wso2Client and Wso2ApiManagerClient', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const logger = mockServices.logger.mock();

  beforeEach(() => {
    mockFetch.mockReset();
    jest.clearAllMocks();
  });

  describe('readWso2ApiManagerConfig', () => {
    it('should successfully read complete configuration', () => {
      const config = new ConfigReader({
        wso2ApiManager: {
          baseUrl: 'https://apim.wso2.com',
          publisherBasePath: '/api/am/publisher/v3',
          developerBasePath: '/api/am/devportal/v3',
          auth: {
            clientId: 'client-id-abc',
            clientSecret: 'client-secret-xyz',
            tokenUrl: 'https://apim.wso2.com/oauth2/token',
          },
          tls: {
            rejectUnauthorized: false,
          },
        },
        wso2PlatformGateway: [
          {
            name: 'Production Gateway',
            urls: ['https://gw1.wso2.com'],
            discoveryUrl: 'https://gw1.wso2.com/discovery',
            discoveryUsername: 'admin',
            discoveryPassword: 'password123',
            environmentType: 'PRODUCTION',
            description: 'My Gateway',
          },
        ],
      });

      const result = readWso2ApiManagerConfig(config);

      expect(result.baseUrl).toBe('https://apim.wso2.com');
      expect(result.publisherBasePath).toBe('/api/am/publisher/v3');
      expect(result.developerBasePath).toBe('/api/am/devportal/v3');
      expect(result.auth.clientId).toBe('client-id-abc');
      expect(result.auth.clientSecret).toBe('client-secret-xyz');
      expect(result.tls.rejectUnauthorized).toBe(false);
      expect(result.selfHostedGateways.length).toBe(1);
      expect(result.selfHostedGateways[0].name).toBe('Production Gateway');
      expect(result.selfHostedGateways[0].discoveryAuth).toBe(
        `Basic ${Buffer.from('admin:password123').toString('base64')}`,
      );

      console.log(formatTestCaseDoc(`
=== [Config Reader: readWso2ApiManagerConfig Success] ===
Resolved Base URL: "${result.baseUrl}"
Client ID: "${result.auth.clientId}"
Gateways Discovered Count: ${result.selfHostedGateways.length}
`));
    });

    it('should throw error if wso2ApiManager configuration block is completely missing', () => {
      const config = new ConfigReader({});
      expect(() => readWso2ApiManagerConfig(config)).toThrow(
        'Missing wso2ApiManager configuration',
      );
    });
  });

  describe('Wso2ApiManagerClient operations', () => {
    let client: Wso2ApiManagerClient;
    const clientConfig = {
      baseUrl: 'https://apim.wso2.com',
      publisherBasePath: '/api/am/publisher/v3',
      developerBasePath: '/api/am/devportal/v3',
      auth: {
        clientId: 'client-id-abc',
        clientSecret: 'client-secret-xyz',
        tokenUrl: 'https://apim.wso2.com/oauth2/token',
      },
      tls: {
        rejectUnauthorized: false,
      },
      selfHostedGateways: [],
    };

    beforeEach(() => {
      client = new Wso2ApiManagerClient({ config: clientConfig, logger });
    });

    describe('resolveAccessToken & OAuth flows', () => {
      it('should successfully fetch client credentials token, cache, and reuse it', async () => {
        // 1. Success token response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({
            access_token: 'wso2-bearer-token-123',
            expires_in: 3600,
          }),
        } as any);

        // 2. Success GET endpoint response
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify({ status: 'active' })),
        } as any);

        const result1 = await client.getSettings();
        expect(result1).toEqual({ status: 'active' });

        // Verify token POST configurations
        const expectedBasicAuth = `Basic ${Buffer.from('client-id-abc:client-secret-xyz').toString('base64')}`;
        expect(mockFetch).toHaveBeenNthCalledWith(
          1,
          'https://apim.wso2.com/oauth2/token',
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              Authorization: expectedBasicAuth,
            }),
          }),
        );

        // Second GET request should hit the token cache
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify({ status: 'active' })),
        } as any);

        await client.getSettings();
        // Total fetches should be 3 (1 token POST + 2 GETs)
        expect(mockFetch).toHaveBeenCalledTimes(3);

        console.log(formatTestCaseDoc(`
=== [Client OAuth: Token Retrieval & Cache Hit] ===
Acquired Token: "wso2-bearer-token-123"
Verified Cache: Reused cached token on 2nd invocation.
`));
      });

      it('should throw error if token URL is completely missing during grant', async () => {
        const invalidClient = new Wso2ApiManagerClient({
          config: {
            ...clientConfig,
            auth: { clientId: 'id', clientSecret: 'secret', tokenUrl: undefined as any },
          },
          logger,
        });

        await expect(invalidClient.getSettings()).rejects.toThrow(
          'tokenUrl is required for client_credentials grant',
        );
      });

      it('should throw error if token grant request returns non-ok status', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 400,
        } as any);

        await expect(client.getSettings()).rejects.toThrow(
          'WSO2 token grant failed, status 400',
        );
      });

      it('should throw error if token grant response has missing token', async () => {
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({}),
        } as any);

        await expect(client.getSettings()).rejects.toThrow(
          'WSO2 token grant: no access_token in response',
        );
      });
    });

    describe('requestDevportal and token fallback', () => {
      it('should perform POST generate-key successfully', async () => {
        // Token mock
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);

        // POST mock
        const mockResult = { key: 'sandbox-key-val' };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockResult)),
        } as any);

        const result = await client.generateApiKey('api-id', { keyName: 'Backstage' });
        expect(result).toEqual(mockResult);
     

        expect(mockFetch).toHaveBeenNthCalledWith(
          2,
          'https://apim.wso2.com/api/am/devportal/v3/apis/api-id/api-keys/generate',
          expect.objectContaining({
            method: 'POST',
            body: JSON.stringify({
              keyName: 'Backstage',
              keyType: 'PRODUCTION',
              validityPeriod: 3600,
              additionalProperties: {},
            }),
          }),
        );
      });

      it('should retry with service account token if user token fails with 401', async () => {
        // 1. First GET returns 401
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        } as any);

        // 2. Token request succeeds
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'service-token' }),
        } as any);

        // 3. Second GET succeeds
        const mockData = { revisions: [] };
        mockFetch.mockResolvedValueOnce({
          ok: true,
          text: jest.fn().mockResolvedValueOnce(JSON.stringify(mockData)),
        } as any);

        const result = await client.getRevisions('api-id', { token: 'invalid-user-token' });
        expect(result).toEqual(mockData);

        // Verify warning logged
        expect(logger.warn).toHaveBeenCalledWith(
          expect.stringContaining('User token failed with 401'),
        );

        console.log(formatTestCaseDoc(`
=== [Client Error Recovery: User Token 401 Fallback] ===
Initial State: GET returns 401 on User Token
Recovery Flow: Requested Service Account token -> retried request successfully.
`));
      });

      it('should throw an error with detailed WSO2 message on failed response', async () => {
        // Token mock
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);

        // Failed GET mock with JSON error message
        mockFetch.mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: jest.fn().mockResolvedValueOnce(
            JSON.stringify({ message: 'Resource Not Found', description: 'API could not be resolved' }),
          ),
        } as any);

        await expect(client.getDocument('api-id', 'doc-id')).rejects.toThrow(
          'WSO2 Publisher request failed (context: SERVICE-ACCOUNT), status 404: Resource Not Found: API could not be resolved',
        );
      });
    });

    describe('getGatewayApis Ingestion', () => {
      it('should successfully parse discovered APIs when response is an array', async () => {
        const mockApis = [{ id: 'api-1', name: 'Service A' }];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce(mockApis),
        } as any);

        const result = await client.getGatewayApis('https://gw.com/discovery', 'Basic base64');
        expect(result).toEqual(mockApis);

        expect(mockFetch).toHaveBeenCalledWith(
          'https://gw.com/discovery',
          expect.objectContaining({
            headers: {
              Accept: 'application/json',
              Authorization: 'Basic base64',
            },
          }),
        );
      });

      it('should parse discovered APIs when response contains an nested items list', async () => {
        const mockApis = [{ id: 'api-2', name: 'Service B' }];
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ items: mockApis }),
        } as any);

        const result = await client.getGatewayApis('https://gw.com/discovery');
        expect(result).toEqual(mockApis);
      });

      it('should throw error on gateway connection failure', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Connection timeout'));

        await expect(client.getGatewayApis('https://gw.com/discovery')).rejects.toThrow(
          'Connection timeout',
        );
      });
    });

    describe('Document download operations', () => {
      it('should perform GET document content stream successfully', async () => {
        // Token mock
        mockFetch.mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValueOnce({ access_token: 'token' }),
        } as any);

        // GET mock
        const mockStreamResponse = { ok: true, status: 200 } as any;
        mockFetch.mockResolvedValueOnce(mockStreamResponse);

        const result = await client.getDocumentContentStream('api-id', 'doc-id');
        expect(result.status).toBe(200);
      });
    });
  });
});
