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

import { DiscoveryApi, FetchApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiRevisionsResponse,
  Wso2ApiManagerApi,
} from './types';

/**
 * Client for interacting with the WSO2 API Manager backend.
 */
export class Wso2ApiManagerClient implements Wso2ApiManagerApi {
  private readonly discoveryApi: DiscoveryApi;
  private readonly fetchApi: FetchApi;

  constructor(options: { discoveryApi: DiscoveryApi; fetchApi: FetchApi }) {
    this.discoveryApi = options.discoveryApi;
    this.fetchApi = options.fetchApi;
  }

  private async getBaseUrl(): Promise<string> {
    return await this.discoveryApi.getBaseUrl('wso2-api-manager');
  }

  /**
   * Helper to perform requests to the WSO2 API Manager backend.
   */
  private async request<T>(
    path: string,
    options?: {
      method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
      body?: any;
      token?: string;
      query?: URLSearchParams;
    },
  ): Promise<T> {
    const baseUrl = await this.getBaseUrl();
    const url = new URL(`${baseUrl}${path}`);
    if (options?.query) {
      options.query.forEach((value, key) => {
        url.searchParams.append(key, value);
      });
    }

    const headers: Record<string, string> = {
      Accept: 'application/json',
    };

    if (options?.token) {
      headers['X-WSO2-Access-Token'] = options.token;
    }

    if (options?.method === 'POST' || options?.method === 'PUT') {
      headers['Content-Type'] = 'application/json';
    }

    const response = await this.fetchApi.fetch(url.toString(), {
      method: options?.method || 'GET',
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      throw new Error(`WSO2 API request failed [${response.status}]: ${errorText}`);
    }

    const text = await response.text();
    if (!text || text.trim() === '') {
      return {} as T;
    }

    try {
      return JSON.parse(text) as T;
    } catch (e) {
      throw new Error(`Failed to parse WSO2 API response: ${text}`);
    }
  }

  async generateApiKey(apiId: string, token?: string): Promise<any> {
    return this.request<any>(`/apis/${apiId}/generate-key`, {
      method: 'POST',
      token,
    });
  }

  async getRevisions(
    apiId: string,
    options?: { query?: string; token?: string },
  ): Promise<Wso2ApiRevisionsResponse> {
    const query = options?.query ? new URLSearchParams({ query: options.query }) : undefined;
    return this.request<Wso2ApiRevisionsResponse>(`/apis/${apiId}/revisions`, {
      token: options?.token,
      query,
    });
  }

  async getGateways(token?: string): Promise<any[]> {
    const result = await this.request<any[]>('/gateways', { token });
    return Array.isArray(result) ? result : [];
  }

  async getHealth(token?: string): Promise<any> {
    return this.request<any>('/health', { token });
  }

  async refreshCatalog(token?: string): Promise<{ message: string }> {
    return this.request<{ message: string }>('/refresh', {
      method: 'POST',
      token,
    });
  }
}
