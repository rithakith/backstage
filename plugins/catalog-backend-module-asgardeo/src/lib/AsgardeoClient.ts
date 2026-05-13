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
import fetch from 'node-fetch';
import { ScimGroup, ScimUser, fetchScimGroups, fetchScimUsers } from './scim';

/**
 * Client for interacting with the Asgardeo SCIM 2.0 API.
 */
export class AsgardeoClient {
  private readonly config: Config;
  private readonly logger: LoggerService;
  private accessToken?: string;

  constructor(options: { config: Config; logger: LoggerService }) {
    this.config = options.config;
    this.logger = options.logger;
  }

  /**
   * Gets an access token using Client Credentials grant.
   */
  async getAccessToken(organization: string): Promise<string> {
    if (this.accessToken) {
      return this.accessToken;
    }

    const clientId = this.config.getString(
      'auth.providers.oidc.development.clientId',
    );
    const clientSecret = this.config.getString(
      'auth.providers.oidc.development.clientSecret',
    );

    const response = await fetch(
      `https://api.asgardeo.io/t/${organization}/oauth2/token`,
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
    );

    if (!response.ok) {
      throw new Error(`Failed to get Asgardeo token: ${response.statusText}`);
    }

    const data = (await response.json()) as { access_token: string };
    this.accessToken = data.access_token;
    return this.accessToken;
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
}
