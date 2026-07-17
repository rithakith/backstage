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

import { ApiEntity } from '@backstage/catalog-model';
import { LoggerService } from '@backstage/backend-plugin-api';
import { Wso2Api } from './types';
import { GlobalSettings } from '../settings/types';
import { PlatformGateway } from '../gateway/types';

/**
 * Normalizes a name for use as a Backstage entity name.
 */
export function normalizeEntityName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLocaleLowerCase('en-US') || 'unknown';
}

/**
 * Normalizes gateway types for consistent display.
 */
export function normalizeGatewayType(type?: string): string {
  const t = (type || '').toLocaleLowerCase('en-US').trim();
  if (!t || t === 'wso2/synapse' || t === 'synapse' || t === 'regular' || t === 'wso2')
    return 'wso2';
  return t;
}

/**
 * Maps a WSO2 API object to a Backstage ApiEntity.
 */
export function mapWso2ApiToEntity(
  api: Wso2Api,
  namespace: string,
  providerId: string,
  globalSettings: GlobalSettings | undefined,
  platformGateways: PlatformGateway[],
  logger: LoggerService,
): ApiEntity {
  const normalizedName = normalizeEntityName(api.name);
  const apiDetails = api as Wso2Api & {
    authorizationHeader?: string;
    apiKeyHeader?: string;
    maxTps?: unknown;
    policies?: unknown[];
    securityScheme?: string[] | string;
    throttlingPolicy?: string;
  };

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'API',
    metadata: {
      name: normalizedName,
      namespace,
      title: api.displayName || api.name,
      description: api.description || `WSO2 API: ${api.name}`,
      tags: (api.tags || []).map(normalizeEntityName).filter(Boolean),
      annotations: {
        'backstage.io/managed-by-location': `wso2-apim:${providerId}`,
        'backstage.io/managed-by-origin-location': `wso2-apim:${providerId}`,
        'wso2.com/api-id': api.id || '',
        'wso2.com/api-name': api.name || '',
        'wso2.com/api-version': api.version || '',
        'wso2.com/api-context': api.context || '',
        'wso2.com/api-provider': api.provider || '',
        'wso2.com/api-type': api.type || '',
        'wso2.com/api-lifecycle-status': api.lifeCycleStatus || '',
        'wso2.com/api-gateway': api.gatewayType || api.gatewayVendor || '',
        'wso2.com/is-discovered': api.initiatedFromGateway === true ? 'true' : 'false',
        'wso2.com/api-documents': api.documents ? JSON.stringify(api.documents) : '[]',
        'wso2.com/api-endpoints': api.endpointURLs ? JSON.stringify(api.endpointURLs) : '[]',
        'wso2.com/gateway-endpoints': reconstructGatewayEndpoints(api, globalSettings, logger),
        'wso2.com/raw-endpoint-urls': api.endpointURLs ? JSON.stringify(api.endpointURLs) : '[]',
        'wso2.com/api-wsdl': api.wsdlDefinition || '',
        ...(platformGateways.length > 0 ? {
          'wso2.com/platform-gateway-endpoints': JSON.stringify(
            platformGateways.map(gw => ({
              environmentName: gw.environmentName,
              environmentType: gw.environmentType || 'wso2',
              gatewayType: normalizeGatewayType('Self-hosted'),
              displayName: gw.environmentName,
              urls: gw.urls.map(u => {
                const base = u.replace(/\/$/, '');
                const ctx = api.context.startsWith('/') ? api.context : `/${api.context}`;
                return `${base}${ctx.replace(/\/$/, '')}`;
              }),
            })),
          ),
        } : {}),
        'wso2.com/api-throttling-policy': api.apiThrottlingPolicy || '',
        'wso2.com/api-transports': Array.isArray(api.transport) ? JSON.stringify(api.transport) : '[]',
        'wso2.com/api-visibility': api.visibility || '',
        'wso2.com/api-security-scheme': apiDetails.securityScheme ? JSON.stringify(apiDetails.securityScheme) : '',
        'wso2.com/api-authorization-header': apiDetails.authorizationHeader || '',
        'wso2.com/api-key-header': apiDetails.apiKeyHeader || '',
        'wso2.com/api-max-tps': apiDetails.maxTps !== undefined ? String(apiDetails.maxTps) : '',
        'wso2.com/api-policies': Array.isArray(apiDetails.policies) ? JSON.stringify(apiDetails.policies) : '[]',
      },
    },
    spec: {
      type: getApiSpecType(api.type),
      lifecycle: 'production',
      owner: normalizeEntityName(api.provider || 'unknown'),
      definition: api.definition || '',
    },
  } as ApiEntity;
}

/**
 * Helper to reconstruct gateway endpoints based on deployment status.
 */
export function reconstructGatewayEndpoints(api: any, globalSettings: GlobalSettings | undefined, logger: LoggerService): string {
  if (!globalSettings || !globalSettings.environment) return '[]';

  const deployedGateways = [
    ...(Array.isArray(api.deployedGatewayNames) ? api.deployedGatewayNames : []),
    ...(Array.isArray(api.deploymentEnvironments) ? api.deploymentEnvironments : []),
    ...(Array.isArray(api.deployments) ? api.deployments.map((d: any) => d.name || d) : []),
  ].map(g => String(g).toLocaleUpperCase('en-US'));

  const apiGatewayType = normalizeGatewayType(api.gatewayType || api.gatewayVendor || 'wso2').toLocaleUpperCase('en-US');

  const matchedEnvs = globalSettings.environment.filter((env: any) => {
    const envName = env.name.toLocaleUpperCase('en-US');
    const envDisplayName = env.displayName?.toLocaleUpperCase('en-US');
    const envType = normalizeGatewayType(env.gatewayType || env.type || '').toLocaleUpperCase('en-US');

    return deployedGateways.includes(envName) || 
           deployedGateways.includes(envDisplayName) || 
           (apiGatewayType === envType);
  });

  if (matchedEnvs.length === 0) return '[]';

  const enrichedEndpoints = matchedEnvs.map((env: any) => {
    if (Array.isArray(env.endpoints) && env.endpoints.length > 0) {
      const urls = env.endpoints.map((ep: any) => ep.url || ep.endpointURL).filter(Boolean);
      if (urls.length > 0) {
        return { environmentName: env.name, environmentType: env.type, urls };
      }
    }

    const vhost = env.vhosts?.[0];
    if (!vhost) return undefined;

    let host = vhost.host;
    if (host.includes('{apiId}')) host = host.replace('{apiId}', api.id);
    if (env.additionalProperties) {
      env.additionalProperties.forEach((prop: any) => {
        const placeholder = `{${prop.key}}`;
        if (host.includes(placeholder)) host = host.replace(placeholder, prop.value);
      });
    }

    let context = api.context || '';
    if (!context.startsWith('/')) context = `/${context}`;
    const basePath = vhost.basePath || '';
    let fullPath = context;
    if (basePath && !fullPath.startsWith(basePath)) {
      fullPath = `${basePath.replace(/\/$/, '')}/${fullPath.replace(/^\//, '')}`;
    }
    if (api.version && !fullPath.endsWith(api.version) && !fullPath.includes(`/${api.version}/`)) {
      fullPath = `${fullPath.replace(/\/$/, '')}/${api.version}`;
    }

    const urls: string[] = [];
    if (vhost.httpsPort) {
      const port = vhost.httpsPort === 443 ? '' : `:${vhost.httpsPort}`;
      urls.push(`https://${host}${port}${fullPath}`);
    }
    if (vhost.httpPort) {
      const port = vhost.httpPort === 80 ? '' : `:${vhost.httpPort}`;
      urls.push(`http://${host}${port}${fullPath}`);
    }

    return {
      environmentName: env.name,
      environmentType: env.type,
      gatewayType: normalizeGatewayType(env.gatewayType),
      displayName: env.displayName || env.name,
      urls,
    };
  }).filter(Boolean);

  return JSON.stringify(enrichedEndpoints);
}

function getApiSpecType(type: string): string {
  return (type || 'api').toLocaleLowerCase('en-US');
}
