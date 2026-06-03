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

import express from 'express';
import request from 'supertest';
import { createRouter } from './router';
import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';

// Mock instance to control Wso2ApiManagerClient methods in router
const mockClientInstance = {
  generateApiKey: jest.fn(),
  getRevisions: jest.fn(),
  getGateways: jest.fn(),
  getSettings: jest.fn(),
  getConfig: jest.fn(),
  getGatewayApis: jest.fn(),
  getDocument: jest.fn(),
  getDocumentContentStream: jest.fn(),
};

jest.mock('./wso2Client', () => {
  const actual = jest.requireActual('./wso2Client');
  return {
    ...actual,
    Wso2ApiManagerClient: jest.fn().mockImplementation(() => mockClientInstance),
  };
});

describe('wso2-api-manager-backend router', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  let app: express.Express;

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfig = new ConfigReader({
      wso2ApiManager: {
        baseUrl: 'https://apim.wso2.com',
        publisherBasePath: '/api/am/publisher/v3',
        developerBasePath: '/api/am/devportal/v3',
        auth: {
          clientId: 'id',
          clientSecret: 'secret',
          tokenUrl: 'https://apim.wso2.com/oauth2/token',
        },
        tls: {
          rejectUnauthorized: true,
        },
      },
    });

    const mockHttpAuth = {
      credentials: jest.fn().mockResolvedValue({}),
    };
//resolvedvalue means returning a promise. returnvalue means immediate return
    mockClientInstance.getConfig.mockReturnValue({
      selfHostedGateways: [],
    });

    const router = await createRouter({
      logger: mockServices.logger.mock(),
      httpAuth: mockHttpAuth as any,
      config: mockConfig,
      userInfo: {} as any,
    });

    app = express();
    app.use(router);
  });

  describe('POST /refresh', () => {
    it('should return catalog refresh triggered message', async () => {
      const response = await request(app).post('/refresh');
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Catalog refresh triggered');

      console.log(formatTestCaseDoc(`
=== [Router Route: POST /refresh] ===
Status: 200 OK
Response: ${JSON.stringify(response.body)}
`));
    });
  });

  describe('GET /gateways', () => {
    it('should return successfully merged APIM environments and self-hosted config gateways', async () => {
      // 1. Settings gateway mock
      mockClientInstance.getSettings.mockResolvedValueOnce({
        environment: [
          {
            name: 'SandboxEnv',
            gatewayType: 'synapse',
            description: 'APIM Sandbox',
            endpoints: [{ url: 'https://sandbox.gw.com' }],
          },
        ],
      });

      // 2. Config gateway mock
      mockClientInstance.getConfig.mockReturnValueOnce({
        selfHostedGateways: [
          {
            name: 'K8s Gateway',
            environmentType: 'hybrid',
            urls: ['https://k8s.gw.com'],
            discoveryUrl: 'https://k8s.gw.com/discovery',
          },
        ],
      });

      mockClientInstance.getGatewayApis.mockResolvedValueOnce([{ id: 'api-1' }]);

      const response = await request(app).get('/gateways');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          name: 'SandboxEnv',
          type: 'wso2',
          gatewayType: 'wso2',
          description: 'APIM Sandbox',
          source: 'APIM',
          urls: ['https://sandbox.gw.com'],
          status: 'Online',
        },
        {
          name: 'K8s Gateway',
          type: 'hybrid',
          gatewayType: 'hybrid',
          description: 'Self-hosted Gateway: K8s Gateway',
          source: 'Config',
          urls: ['https://k8s.gw.com'],
          status: 'Online',
          discoveredApis: [{ id: 'api-1' }],
        },
      ]);

      console.log(formatTestCaseDoc(`
=== [Router Route: GET /gateways Success] ===
Resolved Gateways Merged:
${JSON.stringify(response.body, null, 2)}
`));
    });

    it('should handle gateway API discovery failure gracefully and mark it Offline', async () => {
      mockClientInstance.getSettings.mockResolvedValueOnce({ environment: [] });
      mockClientInstance.getConfig.mockReturnValueOnce({
        selfHostedGateways: [
          {
            name: 'Offline Gateway',
            environmentType: 'synapse',
            urls: ['https://offline.com'],
            discoveryUrl: 'https://offline.com/discovery',
          },
        ],
      });

      mockClientInstance.getGatewayApis.mockRejectedValueOnce(new Error('Gateway down'));

      const response = await request(app).get('/gateways');
      expect(response.status).toBe(200);
      expect(response.body[0].status).toBe('Offline');
      expect(response.body[0].discoveredApis).toEqual([]);
    });
  });

  describe('POST /apis/:apiId/generate-key', () => {
    it('should invoke client and return generated key response', async () => {
      const mockResult = { key: 'secret-key-123' };
      mockClientInstance.generateApiKey.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/apis/api-123/generate-key')
        .send({ keyName: 'BackstageKey' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.generateApiKey).toHaveBeenCalledWith('api-123', {
        keyName: 'BackstageKey',
      });
    });
  });

  describe('GET /apis/:apiId/revisions', () => {
    it('should invoke client revisions with correct options and query params', async () => {
      const mockResult = { list: [] };
      mockClientInstance.getRevisions.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get('/apis/api-123/revisions')
        .query({ query: 'active' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.getRevisions).toHaveBeenCalledWith('api-123', {
        query: 'active',
        token: undefined,
      });
    });
  });

  describe('GET /apis/:apiId/documents/:documentId/content', () => {
    it('should fallback to markdown content on 404 for inline documents', async () => {
      // 1. Content stream mock returns 404
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      // 2. Document details mock returns inline markdown
      mockClientInstance.getDocument.mockResolvedValueOnce({
        name: 'My Document',
        sourceType: 'MARKDOWN',
        inlineContent: '# Hello Markdown',
      });

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(200);
      expect(response.text).toBe('# Hello Markdown');
      expect(response.headers['content-type']).toContain('text/markdown');
      expect(response.headers['content-disposition']).toContain('filename="My Document.md"');

      console.log(formatTestCaseDoc(`
=== [Router Route: GET Document Stream 404 Fallback] ===
Outcome: Gracefully resolved 404 to inline Markdown content
Content: "${response.text}"
`));
    });

    it('should pipe content stream successfully on 200 OK', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'text/plain';
          if (name === 'content-disposition') return 'attachment; filename="doc.txt"';
          return null;
        }),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Streamed Text Content'));
          controller.close();
        },
      });

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toBe('Streamed Text Content');
    });

    it('should handle JSON responses from stream fallbacks', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'application/json';
          return null;
        }),
      };

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: {} as any, // prevent 204 body-absence early exit
        json: jest.fn().mockResolvedValueOnce({ inlineContent: 'JSON Text Content' }),
      } as any);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(200);
      expect(response.text).toBe('JSON Text Content');
    });
  });
});
