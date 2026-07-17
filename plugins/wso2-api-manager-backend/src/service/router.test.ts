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
  getApiWsdlStream: jest.fn(),
  getServices: jest.fn(),
  getServiceUsage: jest.fn(),
  getServiceDefinition: jest.fn(),
};
jest.mock('./wso2Client', () => {
  const actual = jest.requireActual('./wso2Client');
  return {
    ...actual,
    Wso2ApiManagerClient: jest.fn().mockImplementation(() => mockClientInstance),
  };
});

describe('wso2-api-manager-backend router', () => {
  let app: express.Express;
  let mockHttpAuth: { credentials: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();

    const mockConfig = new ConfigReader({
      wso2ApiManager: {
        baseUrl: 'https://apim.wso2.com',
        publisherBasePath: '/api/am/publisher/v3',
        developerBasePath: '/api/am/devportal/v3',
        serviceCatalogBasePath: '/api/am/service-catalog/v1',
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

    mockHttpAuth = {
      credentials: jest.fn().mockResolvedValue({}),
    };

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

  describe('GET /health', () => {
    it('should report APIM and configured URLs as online when checks pass', async () => {
      mockClientInstance.getSettings.mockResolvedValueOnce({ environment: [] });

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        apim: {
          baseUrl: 'https://apim.wso2.com',
          status: 'Online',
        },
        platform: [],
        configs: [
          {
            name: 'Publisher API',
            url: 'https://apim.wso2.com/api/am/publisher/v3',
            status: 'Online',
          },
          {
            name: 'DevPortal API',
            url: 'https://apim.wso2.com/api/am/devportal/v3',
            status: 'Online',
          },
          {
            name: 'Service Catalog API',
            url: 'https://apim.wso2.com/api/am/service-catalog/v1',
            status: 'Online',
          },
        ],
      });
      expect(mockHttpAuth.credentials).not.toHaveBeenCalled();
    });

    it('should mark APIM and offline gateway checks without failing the route', async () => {
      mockClientInstance.getSettings.mockRejectedValueOnce(new Error('APIM down'));
      mockClientInstance.getConfig.mockReturnValueOnce({
        selfHostedGateways: [
          {
            name: 'Hybrid Gateway',
            environmentType: 'hybrid',
            urls: ['https://hybrid.gw.com'],
            discoveryUrl: 'https://hybrid.gw.com/discovery',
            discoveryAuth: 'Basic token',
          },
        ],
      });
      mockClientInstance.getGatewayApis.mockRejectedValueOnce(new Error('Gateway down'));

      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body.apim.status).toBe('Offline');
      expect(response.body.configs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'Publisher API', status: 'Offline' }),
          expect.objectContaining({ name: 'DevPortal API', status: 'Offline' }),
          expect.objectContaining({ name: 'Service Catalog API', status: 'Offline' }),
        ]),
      );
      expect(response.body.platform).toEqual([
        {
          name: 'Hybrid Gateway',
          urls: ['https://hybrid.gw.com'],
          status: 'Offline',
          type: 'hybrid',
          discoveryAuthPresent: true,
        },
      ]);
    });
  });

  describe('POST /refresh', () => {
    it('should return catalog refresh triggered message', async () => {
      const response = await request(app).post('/refresh');
      expect(response.status).toBe(200);
      expect(response.body.message).toContain('Catalog refresh triggered');
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
    it('should authenticate Backstage user and generate key with client credentials', async () => {
      const mockResult = { key: 'secret-key-123' };
      mockClientInstance.generateApiKey.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .post('/apis/api-123/generate-key')
        .set('X-WSO2-Access-Token', 'user-token-should-not-be-forwarded')
        .send({ keyName: 'BackstageKey' });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockHttpAuth.credentials).toHaveBeenCalledWith(
        expect.anything(),
        { allow: ['user'] },
      );
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

    it('should return 204 for document content stream with null body', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'text/plain';
          return null;
        }),
      };
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: null,
      } as any);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(204);
    });

    it('should handle error when content stream fails with non-404 status', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockResolvedValueOnce('Internal error occurred'),
      } as any);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(500);
      expect(response.text).toBe('Internal error occurred');
    });

    it('should handle error when content stream fails with non-404 status and text() throws', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: jest.fn().mockRejectedValueOnce(new Error('fail text')),
        statusText: 'Internal Error',
      } as any);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(500);
      expect(response.text).toBe('Internal Error');
    });

    it('should return error when content stream is 404 but document details fails', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValueOnce('Not Found'),
      } as any);
      mockClientInstance.getDocument.mockResolvedValueOnce(null);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(404);
    });

    it('should handle catch block errors gracefully', async () => {
      mockClientInstance.getDocumentContentStream.mockRejectedValueOnce(new Error('Unexpected error'));

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(500);
      expect(response.text).toBe('Unexpected error');
    });
  });

  describe('GET /apis/:apiId/wsdl', () => {
    it('should pipe WSDL stream successfully on 200 OK', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'application/wsdl+xml';
          return null;
        }),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('WSDL Content'));
          controller.close();
        },
      });

      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('application/wsdl+xml');
      expect(response.text).toBe('WSDL Content');
    });

    it('should return 204 for null WSDL stream body', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation(() => null),
      };
      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: null,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(204);
    });

    it('should handle non-200 WSDL stream response', async () => {
      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValueOnce('Bad Request'),
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(400);
      expect(response.text).toBe('Bad Request');
    });

    it('should handle non-200 WSDL stream response when text() throws', async () => {
      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: jest.fn().mockRejectedValueOnce(new Error('fail text')),
        statusText: 'Bad Request',
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(400);
      expect(response.text).toBe('Bad Request');
    });

    it('should handle catch block errors gracefully', async () => {
      mockClientInstance.getApiWsdlStream.mockRejectedValueOnce(new Error('Unexpected WSDL error'));

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(500);
      expect(response.text).toBe('Unexpected WSDL error');
    });
  });

  describe('GET /services routes', () => {
    it('should getServices list successfully', async () => {
      const mockResult = { list: [] };
      mockClientInstance.getServices.mockResolvedValueOnce(mockResult);

      const response = await request(app)
        .get('/services')
        .query({ limit: 5, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.getServices).toHaveBeenCalledWith({
        limit: 5,
        offset: 0,
        token: undefined,
      });
    });

    it('should handle getServices error', async () => {
      mockClientInstance.getServices.mockRejectedValueOnce(new Error('fetch services error'));

      const response = await request(app).get('/services');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('fetch services error');
    });

    it('should getServiceUsage successfully', async () => {
      const mockResult = { usage: [] };
      mockClientInstance.getServiceUsage.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/services/svc-1/usage');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.getServiceUsage).toHaveBeenCalledWith('svc-1', undefined);
    });

    it('should handle getServiceUsage error', async () => {
      mockClientInstance.getServiceUsage.mockRejectedValueOnce(new Error('fetch usage error'));

      const response = await request(app).get('/services/svc-1/usage');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('fetch usage error');
    });

    it('should getServiceDefinition successfully', async () => {
      mockClientInstance.getServiceDefinition.mockResolvedValueOnce('definition-text');

      const response = await request(app).get('/services/svc-1/definition');

      expect(response.status).toBe(200);
      expect(response.text).toBe('definition-text');
      expect(mockClientInstance.getServiceDefinition).toHaveBeenCalledWith('svc-1', undefined);
    });

    it('should handle getServiceDefinition error', async () => {
      mockClientInstance.getServiceDefinition.mockRejectedValueOnce(new Error('fetch def error'));

      const response = await request(app).get('/services/svc-1/definition');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('fetch def error');
    });
  });

  describe('Error handling across other routes', () => {
    it('POST /refresh should return 500 on failure', async () => {
      mockHttpAuth.credentials.mockRejectedValueOnce(new Error('Auth failed'));

      const response = await request(app).post('/refresh');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Auth failed');
    });

    it('GET /gateways should return 500 on general failure', async () => {
      mockClientInstance.getSettings.mockRejectedValueOnce(new Error('Settings failed'));
      // Cause settings failed & config check fails
      mockClientInstance.getConfig.mockImplementationOnce(() => {
        throw new Error('Config failed');
      });

      const response = await request(app).get('/gateways');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Config failed');
    });

    it('POST /apis/:apiId/generate-key should return 500 on failure', async () => {
      mockClientInstance.generateApiKey.mockRejectedValueOnce(new Error('Key failed'));

      const response = await request(app).post('/apis/api-123/generate-key');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Key failed');
    });

    it('GET /apis/:apiId/revisions should return 500 on failure', async () => {
      mockClientInstance.getRevisions.mockRejectedValueOnce(new Error('Revisions failed'));

      const response = await request(app).get('/apis/api-123/revisions');
      expect(response.status).toBe(500);
      expect(response.body.message).toBe('Revisions failed');
    });

    it('should test normalizeGatewayType branches via health check route', async () => {
      mockClientInstance.getSettings.mockResolvedValueOnce({ environment: [] });
      mockClientInstance.getConfig.mockReturnValueOnce({
        selfHostedGateways: [
          { name: 'gw-1', environmentType: 'synapse' },
          { name: 'gw-2', environmentType: 'wso2/synapse' },
          { name: 'gw-3', environmentType: 'regular' },
          { name: 'gw-4', environmentType: 'wso2' },
          { name: 'gw-5', environmentType: 'KONG' },
          { name: 'gw-6', environmentType: '' },
        ]
      });

      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.platform).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ name: 'gw-1', type: 'wso2' }),
          expect.objectContaining({ name: 'gw-2', type: 'wso2' }),
          expect.objectContaining({ name: 'gw-3', type: 'wso2' }),
          expect.objectContaining({ name: 'gw-4', type: 'wso2' }),
          expect.objectContaining({ name: 'gw-5', type: 'kong' }),
          expect.objectContaining({ name: 'gw-6', type: 'wso2' }),
        ])
      );
    });

    it('should test getGateways list mapping defaults and fallbacks', async () => {
      mockClientInstance.getSettings.mockResolvedValueOnce({
        environment: [
          {
            name: 'Env1',
            gatewayType: 'synapse',
            // Missing description, missing endpoints
          },
          {
            name: 'Env2',
            gatewayType: 'kong',
            description: 'Custom description',
            endpoints: [
              { url: '' }, // empty url
              { endpointURL: 'https://kong.gw.com' }
            ]
          },
          {
            name: 'Env3',
            endpoints: [
              { url: 'https://synapse.url.com' },
              { url: '', endpointURL: '' } // missing ep
            ]
          }
        ]
      });
      mockClientInstance.getConfig.mockReturnValueOnce({ selfHostedGateways: [] });

      const response = await request(app).get('/gateways');
      expect(response.status).toBe(200);
      expect(response.body).toEqual([
        {
          name: 'Env1',
          type: 'wso2',
          gatewayType: 'wso2',
          description: 'APIM Environment: Env1',
          source: 'APIM',
          urls: [],
          status: 'Online',
        },
        {
          name: 'Env2',
          type: 'kong',
          gatewayType: 'kong',
          description: 'Custom description',
          source: 'APIM',
          urls: ['https://kong.gw.com'],
          status: 'Online',
        },
        {
          name: 'Env3',
          type: 'wso2',
          gatewayType: 'wso2',
          description: 'APIM Environment: Env3',
          source: 'APIM',
          urls: ['https://synapse.url.com'],
          status: 'Online',
        }
      ]);
    });

    it('should handle document JSON responses without inlineContent field', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'application/json';
          return null;
        }),
      };

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: {} as any,
        json: jest.fn().mockResolvedValueOnce({ rawKey: 'RAW_VALUE' }),
      } as any);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(200);
      expect(response.text).toContain('RAW_VALUE');
    });

    it('should fallback to markdown content on 404 for inline documents with URL source type', async () => {
      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as any);

      // Document details returns URL source type (should NOT match inline/markdown check)
      mockClientInstance.getDocument.mockResolvedValueOnce({
        name: 'My Document',
        sourceType: 'URL',
      });

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(404);
    });

    it('should handle stream reading errors for document content stream', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation((name: string) => {
          if (name === 'content-type') return 'text/plain';
          return null;
        }),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('Partial stream chunk'));
          controller.error(new Error('Mock stream breakdown'));
        },
      });

      mockClientInstance.getDocumentContentStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/documents/doc-123/content');
      expect(response.status).toBe(500);
    });

    it('should pipe WSDL stream successfully when headers are missing', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation(() => null),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('WSDL Content'));
          controller.close();
        },
      });

      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('application/xml');
    });

    it('should handle stream reading errors for WSDL content stream', async () => {
      const mockHeaders = {
        get: jest.fn().mockImplementation(() => null),
      };

      const mockBody = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('WSDL Content chunk'));
          controller.error(new Error('WSDL stream broke'));
        },
      });

      mockClientInstance.getApiWsdlStream.mockResolvedValueOnce({
        ok: true,
        headers: mockHeaders,
        body: mockBody,
      } as any);

      const response = await request(app).get('/apis/api-123/wsdl');
      expect(response.status).toBe(500);
    });

    it('should getServices list successfully without query parameters', async () => {
      const mockResult = { list: [] };
      mockClientInstance.getServices.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/services');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.getServices).toHaveBeenCalledWith({
        limit: undefined,
        offset: undefined,
        token: undefined,
      });
    });

    it('should getRevisions successfully without query string', async () => {
      const mockResult = { list: [] };
      mockClientInstance.getRevisions.mockResolvedValueOnce(mockResult);

      const response = await request(app).get('/apis/api-123/revisions');

      expect(response.status).toBe(200);
      expect(response.body).toEqual(mockResult);
      expect(mockClientInstance.getRevisions).toHaveBeenCalledWith('api-123', {
        query: undefined,
        token: undefined,
      });
    });
  });
});
