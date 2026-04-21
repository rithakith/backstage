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

  router.all('/proxy', async (req, res) => {
    const targetUrl = req.headers['x-target-url'] as string;
    if (!targetUrl) {
      res.status(400).json({ message: 'Missing x-target-url header' });
      return;
    }

    try {
      // Re-use the agent from config to handle rejectUnauthorized
      const dispatcher = new Agent({
        connect: { rejectUnauthorized: wso2Config.tls.rejectUnauthorized === false ? false : true },
      });

      // Filter headers to pass to the target
      const headers: Record<string, string> = {};
      const sensitiveHeaders = ['authorization', 'internal-key', 'content-type', 'accept'];
      
      Object.keys(req.headers).forEach(key => {
        if (sensitiveHeaders.includes(key.toLowerCase()) || key.toLowerCase().startsWith('x-')) {
          if (key.toLowerCase() !== 'x-target-url' && key.toLowerCase() !== 'host' && key.toLowerCase() !== 'origin') {
            headers[key] = req.headers[key] as string;
          }
        }
      });

      const response = await undiciFetch(targetUrl, {
        method: req.method,
        headers,
        body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body),
        dispatcher,
      });

      const data = await response.text();
      
      // Copy response headers back
      const responseHeaders = ['content-type', 'cache-control', 'expires', 'pragma'];
      responseHeaders.forEach(h => {
        const val = response.headers.get(h);
        if (val) res.setHeader(h, val);
      });

      res.status(response.status).send(data);
    } catch (e: any) {
      logger.error(`Proxy request to ${targetUrl} failed: ${e.message}`);
      res.status(500).json({ message: `Proxy error: ${e.message}` });
    }
  });

  logger.info('WSO2 API Manager backend router initialized with Proxy capabilities');
  return router;
}

