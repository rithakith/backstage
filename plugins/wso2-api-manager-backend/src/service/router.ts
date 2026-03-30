import express from 'express';
import Router from 'express-promise-router';
import {
  HttpAuthService,
  LoggerService,
  PermissionsService,
  RootConfigService,
  UserInfoService,
} from '@backstage/backend-plugin-api';
import { InputError, NotAllowedError } from '@backstage/errors';
import { AuthorizeResult, BasicPermission } from '@backstage/plugin-permission-common';
import {
  Wso2ApiManagerClient,
  readWso2ApiManagerConfig,
  Wso2ApiDocumentCreate,
} from './wso2Client';
import {
  wso2ApiReadPermission,
  wso2PublisherReadPermission,
  wso2PublisherCreatePermission,
  wso2PublisherUpdatePermission,
} from '../permissions';

export interface RouterOptions {
  logger: LoggerService;
  httpAuth: HttpAuthService;
  config: RootConfigService;
  permissions: PermissionsService;
  userInfo: UserInfoService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, httpAuth, config, permissions } = options;
  const wso2Config = readWso2ApiManagerConfig(config);
  const client = new Wso2ApiManagerClient({
    config: wso2Config,
    logger,
  });

  /**
   * Helper to check if the user has a required permission.
   * Throws NotAllowedError if the permission check fails.
   */
  async function requirePermission(
    req: express.Request,
    permission: BasicPermission,
  ): Promise<string | undefined> {
    const credentials = await httpAuth.credentials(req, { allow: ['user'] });
    const decision = await permissions.authorize(
      [{ permission }],
      { credentials },
    );

    if (decision[0].result !== AuthorizeResult.ALLOW) {
      throw new NotAllowedError(
        `User is not authorized for permission: ${permission.name}`,
      );
    }
    
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

  router.get('/apis', async (req, res) => {
    try {
      await requirePermission(req, wso2ApiReadPermission);
      const limit = readNumber(req.query.limit, 50);
      const offset = readNumber(req.query.offset, 0);
      const query = readString(req.query.query);
      const result = await client.listApis({ limit, offset, query });
      res.json(result);
    } catch (error: any) {
      logger.error(`Failed to fetch APIs from WSO2: ${error.stack}`);
      res.status(500).json({
        error: error.message,
      });
    }
  });

  router.get('/api-products', async (req, res) => {
    try {
      await requirePermission(req, wso2ApiReadPermission);
      const limit = readNumber(req.query.limit, 50);
      const offset = readNumber(req.query.offset, 0);
      const query = readString(req.query.query);
      const result = await client.listApiProducts({ limit, offset, query });
      res.json(result);
    } catch (error: any) {
      logger.error(`Failed to fetch API Products from WSO2: ${error.stack}`);
      res.status(500).json({
        error: error.message,
      });
    }
  });

  router.get('/mcp-servers', async (req, res) => {
    try {
      await requirePermission(req, wso2ApiReadPermission);
      const limit = readNumber(req.query.limit, 50);
      const offset = readNumber(req.query.offset, 0);
      const query = readString(req.query.query);

      const result = await client.listMcps({ limit, offset, query });
      res.json(result);
    } catch (error: any) {
      logger.error(`Failed to fetch MCP servers from WSO2: ${error.stack}`);
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/apis/:apiId', async (req, res) => {
    try {
      await requirePermission(req, wso2ApiReadPermission);
      const apiId = req.params.apiId;
      const result = await client.getApi(apiId);
      res.json(result);
    } catch (e: any) {
      logger.error(`Failed to fetch API ${req.params.apiId}: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  router.post('/apis/:apiId/generate-key', async (req, res) => {
    try {
      await requirePermission(req, wso2ApiReadPermission);
      const apiId = req.params.apiId;
      const result = await client.generateApiKey(apiId);
      res.json(result);
    } catch (e: any) {
      logger.error(`Failed to generate API key for ${req.params.apiId}: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/apis/:apiId/documents', async (req, res) => {
    const apiId = req.params.apiId;
    try {
      await requirePermission(req, wso2ApiReadPermission);
      const result = await client.listDocuments(apiId);
      res.json(result);
    } catch (e: any) {
      logger.error(`Failed to list documents for ${apiId}: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/apis/:apiId/swagger', async (req, res) => {
    const apiId = req.params.apiId;
    try {
      await requirePermission(req, wso2ApiReadPermission);
      const result = await client.getApiDefinition(apiId);
      res.json(result);
    } catch (error: any) {
      if (error.message && error.message.includes('404')) {
        res.status(404).json({ message: 'Definition not found' });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  router.get('/apis/:apiId/graphql-schema', async (req, res) => {
    const apiId = req.params.apiId;
    try {
      await requirePermission(req, wso2ApiReadPermission);
      logger.info(`[WSO2-Router] GET /apis/${apiId}/graphql-schema`);
      const result = await client.getGraphqlSchema(apiId);
      res.setHeader('Content-Type', 'text/plain');
      res.send(result);
    } catch (error: any) {
      logger.error(`[WSO2-Router] Failed to fetch GraphQL schema for ${apiId}: ${error.stack}`);
      if (error.message && error.message.includes('404')) {
        res.status(404).json({ message: 'GraphQL Schema not found' });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  router.get('/apis/:apiId/asyncapi', async (req, res) => {
    const apiId = req.params.apiId;
    try {
      await requirePermission(req, wso2ApiReadPermission);
      logger.info(`[WSO2-Router] GET /apis/${apiId}/asyncapi`);
      const result = await client.getAsyncApiDefinition(apiId);
      res.setHeader('Content-Type', 'text/plain');
      res.send(result);
    } catch (error: any) {
      logger.error(`[WSO2-Router] Failed to fetch AsyncAPI definition for ${apiId}: ${error.stack}`);
      if (error.message && error.message.includes('404')) {
        res.status(404).json({ message: 'AsyncAPI definition not found' });
      } else {
        res.status(500).json({ message: error.message });
      }
    }
  });

  router.put('/apis/:apiId/graphql-schema', async (req, res) => {
    await requirePermission(req, wso2PublisherUpdatePermission);
    const apiId = req.params.apiId;
    const { schema } = req.body;
    logger.info(`[WSO2-Router] PUT /apis/${apiId}/graphql-schema`);
    try {
      await client.updateGraphqlSchema(apiId, schema);
      res.json({ status: 'ok' });
    } catch (error: any) {
      logger.error(`[WSO2-Router] Failed to update GraphQL schema for ${apiId}: ${error.stack}`);
      res.status(500).json({ message: error.message });
    }
  });

  router.put('/apis/:apiId/asyncapi', async (req, res) => {
    await requirePermission(req, wso2PublisherUpdatePermission);
    const apiId = req.params.apiId;
    const { definition } = req.body;
    logger.info(`[WSO2-Router] PUT /apis/${apiId}/asyncapi`);
    try {
      await client.updateAsyncApiDefinition(apiId, definition);
      res.json({ status: 'ok' });
    } catch (error: any) {
      logger.error(`[WSO2-Router] Failed to update AsyncAPI definition for ${apiId}: ${error.stack}`);
      res.status(500).json({ message: error.message });
    }
  });

  router.get('/apis/:apiId/revisions', async (req, res) => {
    await requirePermission(req, wso2ApiReadPermission);
    const apiId = req.params.apiId;
    const query = readString(req.query.query);
    try {
      const result = await client.getRevisions(apiId, { query });
      res.json(result);
    } catch (e: any) {
      res.status(500).json({ message: e.message });
    }
  });

  router.get('/apis/:apiId/documents/:documentId/content', async (req, res) => {
    const { apiId, documentId } = req.params;
    try {
      const response = await client.getDocumentContentStream(apiId, documentId);

      if (!response.ok) {
        // If content stream returned 404, WSO2 might be reporting no streaming file content.
        // It might be an INLINE document stored under `inlineContent`.
        if (response.status === 404) {
          const docData = await client.getDocument(apiId, documentId);

          if (docData && docData.sourceType === 'INLINE') {
            const inlineText = docData.inlineContent || '';
            res.setHeader('Content-Type', 'text/plain');
            res.setHeader('Content-Disposition', `attachment; filename="${docData.name || 'document'}.txt"`);
            res.send(inlineText);
            return;
          }
        }

        // Proxy upstream errors
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

      // If document content is natively returned as JSON, parse it as text
      if (contentType.includes('application/json')) {
        const json = await response.json() as any;
        const content = json.inlineContent || JSON.stringify(json, null, 2);
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Content-Disposition', disposition || `attachment; filename="document-${documentId}.txt"`);
        res.send(content);
        return;
      }

      // Standard file stream
      if (contentType) res.setHeader('Content-Type', contentType);
      if (disposition) res.setHeader('Content-Disposition', disposition);
      else res.setHeader('Content-Disposition', `attachment; filename="document-${documentId}"`);

      // response.body is a stream containing binary data (like word docs)
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

  // Admin/Publisher endpoint - requires elevated permissions
  router.get('/publisher/apis', async (req, res) => {
    try {
      await requirePermission(req, wso2PublisherReadPermission);
      const limit = readNumber(req.query.limit, 50);
      const offset = readNumber(req.query.offset, 0);
      const query = readString(req.query.query);
      const result = await client.listPublisherApis({ limit, offset, query });
      res.json(result);
    } catch (e: any) {
      logger.error(`Failed to fetch publisher APIs: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  // Admin-only endpoint - requires create permission (admin role)
  router.post('/publisher/apis', async (req, res) => {
    try {
      await requirePermission(req, wso2PublisherCreatePermission);
      const payload = readCreatePublisherApiRequest(req.body);
      const result = await client.createPublisherApi({ ...payload });
      res.json(result);
    } catch (e: any) {
      logger.error(`Failed to create API: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  // Update swagger/OpenAPI definition for a specific API
  // Requires write/update permission - write group members only
  router.put('/publisher/apis/:apiId/swagger', async (req, res) => {
    await requirePermission(req, wso2PublisherUpdatePermission);
    const { apiId } = req.params;
    const { definition } = req.body as { definition?: string };

    if (!definition || typeof definition !== 'string') {
      throw new InputError('Missing or invalid "definition" field in request body');
    }
    try {
      await client.updateApiDefinition(apiId, definition);
      res.json({ message: 'API definition updated successfully' });
    } catch (e: any) {
      logger.error(`Failed to update API definition for ${apiId}: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  // Create a new document for an API
  router.post('/publisher/apis/:apiId/documents', async (req, res) => {
    await requirePermission(req, wso2PublisherUpdatePermission);
    const { apiId } = req.params;
    const document = req.body as Wso2ApiDocumentCreate;

    try {
      const result = await client.addDocument(apiId, document);
      res.json(result);
    } catch (e: any) {
      logger.error(`Failed to add document for ${apiId}: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  // Validate document name
  router.post('/publisher/apis/:apiId/documents/validate', async (req, res) => {
    await requirePermission(req, wso2PublisherUpdatePermission);
    const { apiId } = req.params;
    const { name } = req.query as { name: string };

    if (!name) {
      res.status(400).json({ message: 'Missing "name" query parameter' });
      return;
    }

    try {
      const isValid = await client.validateDocumentName(apiId, name);
      res.json({ isValid });
    } catch (e: any) {
      logger.error(`Failed to validate document name "${name}" for ${apiId}: ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  // Upload document content (supports raw text or base64 file)
  router.post('/publisher/apis/:apiId/documents/:documentId/content', async (req, res) => {
    await requirePermission(req, wso2PublisherUpdatePermission);
    const { apiId, documentId } = req.params;
    const { content, filename } = req.body as { 
      content: string; 
      filename?: string;
    };

    try {
      let buffer: Buffer | string = content;
      // If filename is present, assume content is base64 encoded file
      if (filename && content.includes(';base64,')) {
         const base64Data = content.split(';base64,').pop() || '';
         buffer = Buffer.from(base64Data, 'base64');
      } else if (filename) {
         // Fallback if no data URI prefix but filename is provided
         buffer = Buffer.from(content, 'base64');
      }

      await client.addDocumentContent(apiId, documentId, buffer, filename);
      res.json({ status: 'ok' });
    } catch (e: any) {
      logger.error(`Failed to upload content for document ${documentId} (API: ${apiId}): ${e.message}`);
      res.status(500).json({ message: e.message });
    }
  });

  // SCIM2 endpoint - Get user attributes including custom claims like asgardeo_role
  router.get('/users/:username/attributes', async (req, res) => {
    await requirePermission(req, wso2ApiReadPermission);
    const username = req.params.username;
    const result = await client.getUserAttributesFromScim(username);
    res.json(result);
  });

  // SCIM2 endpoint - Get role permissions
  router.get('/roles/:roleName/permissions', async (req, res) => {
    await requirePermission(req, wso2ApiReadPermission);
    const roleName = req.params.roleName;
    const result = await client.getRolePermissions(roleName);
    res.json(result);
  });

  // SCIM2 endpoint - Get all user permissions (aggregated from all roles)
  router.get('/users/:username/permissions', async (req, res) => {
    await requirePermission(req, wso2ApiReadPermission);
    const username = req.params.username;
    const result = await client.getUserPermissions(username);
    res.json(result);
  });

  logger.info('WSO2 API Manager backend router initialized');
  return router;
}

function readNumber(value: unknown, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  if (typeof value !== 'string') {
    throw new InputError('Query parameter must be a string');
  }
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) {
    throw new InputError('Query parameter must be a number');
  }
  return parsed;
}

function readString(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new InputError('Query parameter must be a string');
  }
  return value.trim() || undefined;
}

function readCreatePublisherApiRequest(value: unknown): {
  name: string;
  context: string;
  version: string;
  endpointUrl: string;
  description?: string;
} {
  const payload = value as Record<string, unknown> | undefined;
  if (!payload) {
    throw new InputError('Missing request body');
  }

  const name = readRequiredString(payload.name, 'name');
  const context = readRequiredString(payload.context, 'context');
  const version = readRequiredString(payload.version, 'version');
  const endpointUrl = readRequiredString(payload.endpointUrl, 'endpointUrl');
  const description = readOptionalString(payload.description, 'description');

  return {
    name,
    context,
    version,
    endpointUrl,
    description,
  };
}

function readRequiredString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new InputError(`Missing or invalid ${field}`);
  }
  return value.trim();
}

function readOptionalString(
  value: unknown,
  field: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string') {
    throw new InputError(`Invalid ${field}`);
  }
  return value.trim() || undefined;
}
