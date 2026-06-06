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
import Router from 'express-promise-router';
import {
  HttpAuthService,
  LoggerService,
  RootConfigService,
  UserInfoService,
} from '@backstage/backend-plugin-api';

import {
  Wso2ApiManagerClient,
  readWso2ApiManagerConfig
} from './wso2Client';

export interface RouterOptions {
  logger: LoggerService;
  httpAuth: HttpAuthService;
  config: RootConfigService;
  userInfo: UserInfoService;
}

/**
 * Normalizes gateway types for consistent display.
 */
function normalizeGatewayType(type?: string): string {
  const t = (type || '').toLowerCase().trim();
  if (!t || t === 'wso2/synapse' || t === 'synapse' || t === 'regular' || t === 'wso2') return 'wso2';
  return t;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, httpAuth, config, userInfo: _userInfo } = options;
  const wso2Config = readWso2ApiManagerConfig(config);
  const client = new Wso2ApiManagerClient({
    config: wso2Config,
    logger,
  });

  /**
   * Helper to ensure the user is authenticated.
   */
  async function ensureAuthenticated(
    req: express.Request,
  ): Promise<string | undefined> {
    await httpAuth.credentials(req, { allow: ['user'] });
    
    // ONLY return the WSO2-specific access token if it's explicitly provided.
    // Do NOT return the Backstage Authorization header token, as it is a
    // Backstage Identity Token and will be rejected by WSO2 with a 401.
    return req.headers['x-wso2-access-token'] as string | undefined;
  }

  const router = Router();
  router.use(express.json({ limit: '10mb' }));

  

  router.post('/refresh', async (req, res) => {
    try {
      await ensureAuthenticated(req);
      logger.info('WSO2 Catalog Refresh requested via manual trigger');
      
      // Since we can't easily trigger the provider from here, 
      // we'll just log it and return a message. 
      // In a real scenario, we might use an event bus or a shared service.
      res.json({ message: 'Catalog refresh triggered. This may take a few moments to reflect in the catalog.' });
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/gateways', async (req, res) => {
    try {
      await ensureAuthenticated(req);
      
      // 1. Get APIM environments from settings
      let apimGateways: any[] = [];
      try {
        // Use service account directly for settings to avoid 401 user token retries
        const settings = await client.getSettings();
        apimGateways = (settings?.environment || []).map((env: any) => ({
          name: env.name,
          type: normalizeGatewayType(env.gatewayType || env.type),
          gatewayType: normalizeGatewayType(env.gatewayType || env.type),
          description: env.description || `APIM Environment: ${env.name}`,
          source: 'APIM',
          urls: (env.endpoints || []).map((ep: any) => ep.url || ep.endpointURL).filter(Boolean),
          status: 'Online', // APIM settings usually implies online
        }));
      } catch (err) {
        logger.warn(`Failed to fetch APIM settings: ${err}`);
      }

      // 2. Get self-hosted gateways from config
      const apiplatform = await Promise.all(client.getConfig().selfHostedGateways.map(async gw => {
        let discoveredApis: any[] = [];
        let status = 'Online';
        if (gw.discoveryUrl) {
          try {
            discoveredApis = await client.getGatewayApis(gw.discoveryUrl, gw.discoveryAuth);
          } catch (err) {
            logger.warn(`Failed to discover APIs from gateway ${gw.name}: ${err}`);
            status = 'Offline';
          }
        }
        return {
          name: gw.name,
          type: normalizeGatewayType(gw.environmentType),
          gatewayType: normalizeGatewayType(gw.environmentType),
          description: gw.description || `Self-hosted Gateway: ${gw.name}`,
          source: 'Config',
          urls: gw.urls,
          status,
          discoveredApis,
        };
      }));

      res.json([...apimGateways, ...apiplatform]);
    } catch (e: any) {
      logger.error(`Failed to fetch gateways: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/apis/:apiId/generate-key', async (req, res) => {
    logger.info(`Generating API key for API: ${req.params.apiId}`);
    try {
      const token = await ensureAuthenticated(req);
      const apiId = req.params.apiId;
      const keyName = req.body.keyName;
      const result = await client.generateApiKey(apiId, { keyName });
      res.json(result);
    } catch (e: any) {
      logger.error(`Failed to generate API key for ${req.params.apiId}: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/apis/:apiId/revisions', async (req, res) => {
    const apiId = req.params.apiId;
    const query = (req.query.query as string) || undefined;
    try {
      const token = await ensureAuthenticated(req);
      const result = await client.getRevisions(apiId, { query, token });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/services', async (req, res) => {
    try {
      const token = await ensureAuthenticated(req);
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : undefined;
      const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : undefined;
      const result = await client.getServices({ limit, offset, token });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/services/:serviceId/usage', async (req, res) => {
    try {
      const token = await ensureAuthenticated(req);
      const result = await client.getServiceUsage(req.params.serviceId, token);
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/services/:serviceId/definition', async (req, res) => {
    try {
      const token = await ensureAuthenticated(req);
      const definition = await client.getServiceDefinition(req.params.serviceId, token);
      res.send(definition);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/apis/:apiId/wsdl', async (req, res) => {
    const { apiId } = req.params;
    try {
      const token = await ensureAuthenticated(req);
      const response = await client.getApiWsdlStream(apiId, token);

      if (!response.ok) {
        let errBody = '';
        try {
          errBody = await response.text();
        } catch {
          errBody = response.statusText;
        }
        res.status(response.status).send(errBody);
        return;
      }

      const contentType = response.headers.get('content-type') || 'application/xml';
      const disposition = response.headers.get('content-disposition') || `attachment; filename="${apiId}-wsdl"`;

      if (contentType) res.setHeader('Content-Type', contentType);
      if (disposition) res.setHeader('Content-Disposition', disposition);

      if (!response.body) {
        res.status(204).send();
        return;
      }

      const { Readable } = require('stream');
      const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);

      nodeStream.on('error', (err: any) => {
        logger.error(`Stream reading error: ${err.message}`, err);
        if (!res.headersSent) {
          res.status(500).send('Error streaming WSDL content');
        }
      });
      nodeStream.pipe(res);
    } catch (e: any) {
      logger.error(`Failed to stream WSDL content: ${e.message}`, e);
      res.status(500).send(e.message);
    }
  });

  router.get('/apis/:apiId/documents/:documentId/content', async (req, res) => {
    const { apiId, documentId } = req.params;
    try {
      const token = await ensureAuthenticated(req);
      const response = await client.getDocumentContentStream(apiId, documentId, token);

      if (!response.ok) {
        if (response.status === 404) {
          const docData = await client.getDocument(apiId, documentId, token);
          if (docData && (docData.sourceType === 'INLINE' || docData.sourceType === 'MARKDOWN')) {
            const inlineText = docData.inlineContent || '';
            const isMarkdown = docData.sourceType === 'MARKDOWN';
            res.setHeader('Content-Type', isMarkdown ? 'text/markdown' : 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${docData.name || 'document'}.${isMarkdown ? 'md' : 'txt'}"`);
            res.send(inlineText);
            return;
          }
        }
        let errBody = '';
        try {
          errBody = await response.text();
        } catch {
          errBody = response.statusText;
        }
        res.status(response.status).send(errBody);
        return;
      }

      const contentType = response.headers.get('content-type') || '';
      const disposition = response.headers.get('content-disposition');

      if (!response.body) {
        res.status(204).send();
        return;
      }

      if (contentType.includes('application/json')) {
        const json = await response.json() as any;
        const content = json.inlineContent || JSON.stringify(json, null, 2);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', disposition || `attachment; filename="document-${documentId}.txt"`);
        res.send(content);
        return;
      }

      if (contentType) res.setHeader('Content-Type', contentType);
      if (disposition) res.setHeader('Content-Disposition', disposition);
      const { Readable } = require('stream');
      const nodeStream = Readable.fromWeb(response.body as import('stream/web').ReadableStream);

      nodeStream.on('error', (err: any) => {
        logger.error(`Stream reading error: ${err.message}`, err);
        if (!res.headersSent) {
          res.status(500).send('Error streaming document content');
        }
      });
      nodeStream.pipe(res);
    } catch (e: any) {
      logger.error(`Failed to stream document content: ${e.message}`, e);
      res.status(500).send(e.message);
    }
  });

  logger.info('WSO2 API Manager backend router initialized');
  return router;
}

