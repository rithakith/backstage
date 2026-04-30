import express from 'express';
import Router from 'express-promise-router';
import { fetch as undiciFetch, Agent } from 'undici';
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
  if (t === 'wso2/synapse' || t === 'synapse' || t === 'regular' || t === 'wso2') return 'wso2';
  if (!t || t === 'self-hosted'  || t === 'apiplatform') return 'apiplatform';
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

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/gateways', async (req, res) => {
    try {
      const token = await ensureAuthenticated(req);
      
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
      const selfHosted = await Promise.all(client.getConfig().selfHostedGateways.map(async gw => {
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

      res.json([...apimGateways, ...selfHosted]);
    } catch (e: any) {
      logger.error(`Failed to fetch gateways: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/apis/:apiId/definition', async (req, res) => {
    const { apiId } = req.params;
    const discoveredFrom = req.query.discoveredFrom as string;

    if (!discoveredFrom) {
      res.status(400).json({ message: 'Missing discoveredFrom parameter' });
      return;
    }

    try {
      const gw = wso2Config.selfHostedGateways.find(g => g.name === discoveredFrom);
      if (!gw || !gw.discoveryUrl) {
        res.status(404).json({ message: `Discovery URL not found for gateway ${discoveredFrom}` });
        return;
      }

      logger.info(`[WSO2-Backend] Fetching fallback definition for ${apiId} from ${gw.discoveryUrl}`);
      
      const data = await client.getApiDefinition(`${gw.discoveryUrl}/${apiId}`, gw.discoveryAuth);
      logger.info(`[WSO2-Backend] Raw gateway response keys: ${Object.keys(data).join(', ')}`);
      
      const apiData = data.api || data;
      logger.info(`[WSO2-Backend] apiData keys: ${Object.keys(apiData).join(', ')}`);
      
      let definition = apiData.configuration?.spec?.definition || apiData.spec?.definition || apiData.definition;
      
      if (!definition) {
          // Return just the spec portion so operations are at the top level
          const gwSpec = apiData.configuration?.spec || apiData.spec || apiData;
          logger.info(`[WSO2-Backend] No raw definition found for ${apiId} — returning gateway spec (has operations: ${Array.isArray(gwSpec?.operations)})`)
          res.json(gwSpec);
          return;
      }

      if (definition && typeof definition === 'string' && definition.trim().startsWith('{')) {
        try {
          definition = JSON.parse(definition);
        } catch (e) {
          logger.warn(`[WSO2-Backend] Failed to parse definition string for ${apiId}`);
        }
      }

      if (!definition) {
        throw new Error('Definition not found in gateway response');
      }

      res.json(definition);
    } catch (e: any) {
      logger.error(`[WSO2-Backend] Failed to fetch API definition from gateway: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/apis/:apiId/generate-key', async (req, res) => {
    try {
      const token = await ensureAuthenticated(req);
      const apiId = req.params.apiId;
      const result = await client.generateApiKey(apiId, token);
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

