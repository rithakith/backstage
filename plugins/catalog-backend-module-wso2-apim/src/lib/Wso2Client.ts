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

import { Config } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import { fetch as undiciFetch, Agent } from 'undici';
import { ResponseError } from '@backstage/errors';

/**
 * A resilient client for interacting with the WSO2 API Manager.
 */
export class Wso2Client {
  private readonly baseUrl: string;

  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly logger: LoggerService;
  private readonly dispatcher: Agent;
  private readonly publisherBasePath: string;
  private readonly serviceCatalogBasePath: string;
  private readonly scopes: string;
  private readonly requestTimeoutMs: number;
  private accessToken?: string;
  private tokenExpiresAt?: number;
  private readonly tokenUrl: string;

  constructor(options: { config: Config; logger: LoggerService }) {
    this.baseUrl = options.config.getString('wso2ApiManager.baseUrl');

    this.clientId = options.config.getString('wso2ApiManager.auth.clientId');
    this.clientSecret = options.config.getString(
      'wso2ApiManager.auth.clientSecret',
    );
    this.logger = options.logger;

    const rejectUnauthorized = options.config.getOptionalBoolean('wso2ApiManager.tls.rejectUnauthorized') ?? true;
    this.dispatcher = new Agent({ connect: { rejectUnauthorized } });

    this.publisherBasePath = options.config.getString(
      'wso2ApiManager.publisherBasePath',
    );
    this.serviceCatalogBasePath = options.config.getOptionalString(
      'wso2ApiManager.serviceCatalogBasePath'
    ) ?? '/api/am/service-catalog/v1';
    this.requestTimeoutMs =
      (options.config.getOptionalNumber(
        'wso2ApiManager.requestTimeoutSeconds',
      ) ?? 30) * 1000;
    const additionalScopes = options.config.getOptionalStringArray('wso2ApiManager.auth.additionalScopes') || [];
    const baseScopes = [
      'apim:api_view',
      'apim:publisher_settings',
      'apim:api_create',
      'apim:api_publish',
      'apim:api_import_export',
      // MCP server related scopes required for catalog sync
      'apim:mcp_server_view',
      'apim:mcp_server_create',
      'apim:mcp_server_publish',
      'apim:mcp_server_generate_key',
      'apim:mcp_server_import_export',
      'apim:mcp_server_list_view',
      'apim:llm_provider_read',
    ];
    this.scopes = Array.from(new Set([...baseScopes, ...additionalScopes])).join(' ');

    // Token URL configuration: use explicit tokenUrl if provided, otherwise default to baseUrl/oauth2/token
    this.tokenUrl = options.config.getOptionalString('wso2ApiManager.auth.tokenUrl') ?? `${this.baseUrl}/oauth2/token`;
  }

  /**
   * Performs a resilient GET request.
   */
  async get<T>(path: string): Promise<T> {
    return this.request<T>('GET', path);
  }

  /**
   * Performs a resilient GET request returning text.
   */
  async getText(path: string): Promise<string> {
    return this.requestText('GET', path);
  }

  /**
   * Returns the dispatcher for manual fetch calls (e.g. gateway discovery).
   */
  getDispatcher(): Agent {
    return this.dispatcher;
  }

  /**
   * Returns the base path for the publisher API.
   */
  getPublisherBasePath(): string {
    return this.publisherBasePath;
  }

  /**
   * Returns the base path for the service catalog API.
   */
  getServiceCatalogBasePath(): string {
    return this.serviceCatalogBasePath;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.logger.debug(`[Wso2Client] ${method} ${url}`);
        const token = await this.getAccessToken();
        const response = await undiciFetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          dispatcher: this.dispatcher,
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        if (!response.ok) {
          throw await ResponseError.fromResponse(response);
        }

        return (await response.json()) as T;
      } catch (error: any) {
        lastError = error;

        const status = error.status ?? error.statusCode;
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          throw new Error(
            `[Wso2Client] ${method} ${url} timed out after ${
              this.requestTimeoutMs / 1000
            }s`,
          );
        }

        // Don't retry on 4xx errors (except 401/429)
        if (
          status &&
          status >= 400 &&
          status < 500 &&
          status !== 401 &&
          status !== 429
        ) {
          throw error;
        }

        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          const cause = error.cause ? ` (Cause: ${error.cause})` : '';
          this.logger.warn(
            `[Wso2Client] Request failed (${error.message}${cause}). Retrying in ${delay}ms... (Attempt ${attempt}/3)`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));

          if (status === 401) {
            this.accessToken = undefined; // Force token refresh on next attempt
          }
        }
      }
    }

    throw lastError || new Error(`Request to ${url} failed after 3 attempts`);
  }

  private async requestText(
    method: string,
    path: string,
    body?: any,
  ): Promise<string> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        this.logger.debug(`[Wso2Client] ${method} ${url}`);
        const token = await this.getAccessToken();
        const response = await undiciFetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/wsdl+xml, text/xml, application/xml, text/plain, */*',
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          dispatcher: this.dispatcher,
          signal: AbortSignal.timeout(this.requestTimeoutMs),
        });

        if (!response.ok) {
          throw await ResponseError.fromResponse(response);
        }

        return await response.text();
      } catch (error: any) {
        lastError = error;

        const status = error.status ?? error.statusCode;
        if (error.name === 'TimeoutError' || error.name === 'AbortError') {
          throw new Error(
            `[Wso2Client] ${method} ${url} timed out after ${
              this.requestTimeoutMs / 1000
            }s`,
          );
        }

        // Don't retry on 4xx errors (except 401/429)
        if (
          status &&
          status >= 400 &&
          status < 500 &&
          status !== 401 &&
          status !== 429
        ) {
          throw error;
        }

        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          const cause = error.cause ? ` (Cause: ${error.cause})` : '';
          this.logger.warn(
            `[Wso2Client] Request failed (${error.message}${cause}). Retrying in ${delay}ms... (Attempt ${attempt}/3)`,
          );
          await new Promise(resolve => setTimeout(resolve, delay));

          if (status === 401) {
            this.accessToken = undefined; // Force token refresh on next attempt
          }
        }
      }
    }

    throw lastError || new Error(`Request to ${url} failed after 3 attempts`);
  }

  private async getAccessToken(): Promise<string> {
    if (
      this.accessToken &&
      this.tokenExpiresAt &&
      Date.now() < this.tokenExpiresAt - 60000
    ) {
      return this.accessToken;
    }
    // Clear stale token
    this.accessToken = undefined;
    this.tokenExpiresAt = undefined;

    this.logger.debug(`[Wso2Client] Fetching access token`);

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );

    const params = new URLSearchParams();
    // Always use client_credentials grant type as JWT bearer is not needed
    params.append('grant_type', 'client_credentials');
    params.append('scope', this.scopes);

    const response = await undiciFetch(this.tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      dispatcher: this.dispatcher,
      signal: AbortSignal.timeout(this.requestTimeoutMs),
    });

    if (!response.ok) {
      this.logger.error(
        `[Wso2Client] Token request failed with status ${response.status}`,
      );
      throw await ResponseError.fromResponse(response);
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
      scope?: string;
      token_type?: string;
    };
    if (!data.access_token) {
      throw new Error('WSO2 token grant: no access_token in response');
    }

    this.logger.info(
      `[Wso2Client] Successfully obtained ${data.token_type ?? 'Bearer'} access token with scopes: ${data.scope ?? this.scopes}`,
    );
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000;
    return this.accessToken;
  }
}
