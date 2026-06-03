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
  private readonly scopes: string;
  private accessToken?: string;
  private tokenExpiresAt?: number;
  private readonly tokenUrl: string;
  private readonly grantType: string; // e.g., client_credentials or jwt-bearer

  constructor(options: { config: Config; logger: LoggerService }) {
    this.baseUrl = options.config.getString('wso2ApiManager.baseUrl');

    this.clientId = options.config.getString('wso2ApiManager.auth.clientId');
    this.clientSecret = options.config.getString(
      'wso2ApiManager.auth.clientSecret',
    );
    this.logger = options.logger;

    // optional grant type, defaults to client_credentials
    this.grantType = options.config.getOptionalString('wso2ApiManager.auth.grantType') ?? 'client_credentials';

    const rejectUnauthorized = options.config.getOptionalBoolean('wso2ApiManager.tls.rejectUnauthorized') ?? true;
    this.dispatcher = new Agent({ connect: { rejectUnauthorized } });

    this.publisherBasePath = options.config.getString(
      'wso2ApiManager.publisherBasePath',
    );
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

  private async request<T>(
    method: string,
    path: string,
    body?: any,
  ): Promise<T> {
    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[Wso2Client DEBUG] Attempting to fetch URL: ${url}`);
        const token = await this.getAccessToken();
        this.logger.info(`[Wso2Client] Using token starting with: ${token.substring(0, 10)}... for ${method} ${url}`);
        const response = await undiciFetch(url, {
          method,
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: body ? JSON.stringify(body) : undefined,
          dispatcher: this.dispatcher,
        });

        if (!response.ok) {
          throw await ResponseError.fromResponse(response);
        }

        return (await response.json()) as T;
      } catch (error: any) {
        console.error('DEBUG: Request Error:', error);
        lastError = error;

        const status = error.status ?? error.statusCode;

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
    console.log('DEBUG: Entering getAccessToken');
    if (this.accessToken && this.tokenExpiresAt && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }
    // Clear stale token
    this.accessToken = undefined;
    this.tokenExpiresAt = undefined;

    this.logger.info(
      `[Wso2Client] Fetching token from ${this.baseUrl}/oauth2/token`,
    );

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString(
      'base64',
    );

    const params = new URLSearchParams();
    // Always use client_credentials grant type as JWT bearer is not needed
    params.append('grant_type', 'client_credentials');
    params.append('scope', this.scopes);

    const tokenUrl = this.tokenUrl;
    console.log(`[Wso2Client DEBUG] Attempting to fetch token URL: ${tokenUrl}`);
    const response = await undiciFetch(tokenUrl, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      dispatcher: this.dispatcher,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(`[Wso2Client] Token request failed with status ${response.status}: ${errorBody}`);
      throw await ResponseError.fromResponse(response);
    }

    const data = (await response.json()) as { access_token: string };
    this.logger.info(`[Wso2Client] Successfully obtained access token`);
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + 50 * 60 * 1000; // Expire 50 min from now
    return this.accessToken;
  }
}
