import express from 'express';
import Router from 'express-promise-router';
import {
  HttpAuthService,
  LoggerService,
  RootConfigService,
} from '@backstage/backend-plugin-api';
import { InputError } from '@backstage/errors';
import {
  Wso2ApiManagerClient,
  readWso2ApiManagerConfig,
} from './wso2Client';

export interface RouterOptions {
  logger: LoggerService;
  httpAuth: HttpAuthService;
  config: RootConfigService;
}

export async function createRouter(
  options: RouterOptions,
): Promise<express.Router> {
  const { logger, httpAuth, config } = options;
  const wso2Config = readWso2ApiManagerConfig(config);
  const client = new Wso2ApiManagerClient({
    config: wso2Config,
    logger,
  });

  const router = Router();
  router.use(express.json());

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const getCredentials = (req: express.Request) => {
    const token = req.headers['x-wso2-access-token'] as string | undefined;
    const username = req.headers['x-wso2-username'] as string | undefined;
    const password = req.headers['x-wso2-password'] as string | undefined;
    return { token, username, password };
  };

  router.get('/apis', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const limit = readNumber(req.query.limit, 50);
    const offset = readNumber(req.query.offset, 0);
    const query = readString(req.query.query);
    const credentials = getCredentials(req);
    const result = await client.listApis({ limit, offset, query, credentials });
    res.json(result);
  });

  router.get('/apis/:apiId', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const apiId = req.params.apiId;
    const credentials = getCredentials(req);
    const result = await client.getApi(apiId, credentials);
    res.json(result);
  });

  router.get('/apis/:apiId/documents', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const apiId = req.params.apiId;
    const credentials = getCredentials(req);
    const result = await client.listDocuments(apiId, credentials);
    res.json(result);
  });

  router.get('/publisher/apis', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const limit = readNumber(req.query.limit, 50);
    const offset = readNumber(req.query.offset, 0);
    const query = readString(req.query.query);
    const credentials = getCredentials(req);
    const result = await client.listPublisherApis({ limit, offset, query, credentials });
    res.json(result);
  });

  router.post('/publisher/apis', async (req, res) => {
    await httpAuth.credentials(req, { allow: ['user'] });
    const payload = readCreatePublisherApiRequest(req.body);
    const credentials = getCredentials(req);
    const result = await client.createPublisherApi({ ...payload, credentials });
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
