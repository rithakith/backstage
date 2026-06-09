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
import fetch, { RequestInit, Response } from 'node-fetch';
import { ScimGroup, ScimUser, fetchScimGroups, fetchScimUsers } from './scim';

type CachedAccessToken = {
  token: string;
  expiresAt: number;
};

/**
 * Client for interacting with the Asgardeo SCIM 2.0 API.
 */
export class AsgardeoClient {
  private readonly config: Config;
  private readonly logger: LoggerService;
  private readonly accessTokens = new Map<string, CachedAccessToken>();
  private readonly requestTimeoutMs: number;
  private readonly maxRetries: number;

  constructor(options: { config: Config; logger: LoggerService }) {
    this.config = options.config;
    this.logger = options.logger;
    this.requestTimeoutMs =
      options.config.getOptionalNumber(
        'catalog.providers.asgardeo.requestTimeoutMs',
      ) ?? 15000;
    this.maxRetries =
      options.config.getOptionalNumber('catalog.providers.asgardeo.retries') ??
      2;
  }

  /**
   * Gets an access token using Client Credentials grant.
   */
  async getAccessToken(organization: string): Promise<string> {
    const cached = this.accessTokens.get(organization);
    if (cached && Date.now() < cached.expiresAt - 60000) {
      return cached.token;
    }

    const { clientId, clientSecret } = this.getClientCredentials();

    const response = await this.fetchWithRetry(
      `${this.getBaseUrl(organization)}/oauth2/token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${Buffer.from(
            `${clientId}:${clientSecret}`,
          ).toString('base64')}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: 'internal_user_mgt_list internal_group_mgt_view',
        }),
      },
      'Asgardeo token request',
    );

    if (!response.ok) {
      throw new Error(
        `Failed to get Asgardeo token: ${await this.getErrorMessage(
          response,
        )}`,
      );
    }

    const data = (await response.json()) as {
      access_token?: string;
      expires_in?: number;
    };
    if (!data.access_token) {
      throw new Error('Failed to get Asgardeo token: missing access_token');
    }

    this.accessTokens.set(organization, {
      token: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    });
    return data.access_token;
  }

  invalidateAccessToken(organization: string): void {
    this.accessTokens.delete(organization);
  }

  getBaseUrl(organization: string): string {
    const configuredBaseUrl = this.config.getOptionalString(
      'catalog.providers.asgardeo.baseUrl',
    );
    if (configuredBaseUrl) {
      return configuredBaseUrl.replace(/\/$/, '');
    }
    return `https://api.asgardeo.io/t/${organization}`;
  }

  /**
   * Fetches groups from Asgardeo SCIM 2.0 API.
   */
  async fetchGroups(organization: string): Promise<ScimGroup[]> {
    return fetchScimGroups(this, organization, this.logger);
  }

  /**
   * Fetches users from Asgardeo SCIM 2.0 API.
   */
  async fetchUsers(organization: string): Promise<ScimUser[]> {
    return fetchScimUsers(this, organization, this.logger);
  }

  async fetchScimPage<T>(
    organization: string,
    resourcePath: 'Groups' | 'Users',
    startIndex: number,
    count: number,
  ): Promise<T> {
    const url = new URL(`${this.getBaseUrl(organization)}/scim2/${resourcePath}`);
    url.searchParams.set('startIndex', String(startIndex));
    url.searchParams.set('count', String(count));

    const performRequest = async (currentToken: string, suffix = '') => {
      return this.fetchWithRetry(
        url.toString(),
        {
          headers: {
            Authorization: `Bearer ${currentToken}`,
            Accept: 'application/scim+json',
          },
        },
        `Asgardeo SCIM ${resourcePath} request${suffix}`,
      );
    };

    let token = await this.getAccessToken(organization);
    let response = await performRequest(token);

    if (response.status === 401) {
      this.invalidateAccessToken(organization);
      token = await this.getAccessToken(organization);
      response = await performRequest(token, ' after token refresh');
    }

    if (!response.ok) {
      throw new Error(
        `Failed to fetch Asgardeo ${resourcePath}: ${await this.getErrorMessage(
          response,
        )}`,
      );
    }

    return (await response.json()) as T;
  }

  private getClientCredentials(): { clientId: string; clientSecret: string } {
    return {
      clientId: this.config.getString('catalog.providers.asgardeo.clientId'),
      clientSecret: this.config.getString(
        'catalog.providers.asgardeo.clientSecret',
      ),
    };
  }

  private async fetchWithRetry(
    url: string,
    options: RequestInit,
    context: string,
  ): Promise<Response> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        this.requestTimeoutMs,
      );

      try {
        const response = await fetch(url, {
          ...options,
          signal: controller.signal,
        });
        if (!this.shouldRetry(response.status) || attempt === this.maxRetries) {
          return response;
        }
        lastError = new Error(
          `${context} failed with status ${response.status}`,
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt === this.maxRetries) {
          throw lastError;
        }
      } finally {
        clearTimeout(timeout);
      }

      const delayMs = 250 * Math.pow(2, attempt);
      this.logger.warn(
        `${context} failed. Retrying in ${delayMs}ms (${attempt + 1}/${
          this.maxRetries
        })`,
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }

    throw lastError ?? new Error(`${context} failed`);
  }

  private shouldRetry(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private async getErrorMessage(response: Response): Promise<string> {
    try {
      const body = await response.text();
      if (!body) {
        return response.statusText || `status ${response.status}`;
      }
      try {
        const json = JSON.parse(body) as { detail?: string; message?: string };
        return json.detail || json.message || body;
      } catch {
        return body;
      }
    } catch {
      return response.statusText || `status ${response.status}`;
    }
  }
}
