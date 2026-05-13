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

import { LoggerService } from '@backstage/backend-plugin-api';
import fetch from 'node-fetch';
import { AsgardeoClient } from '../AsgardeoClient';
import { ScimGroup, ScimUser, ScimListResponse } from './types';

/**
 * Fetches groups from Asgardeo SCIM 2.0 API.
 */
export async function fetchScimGroups(
  client: AsgardeoClient,
  organization: string,
  logger: LoggerService,
): Promise<ScimGroup[]> {
  const token = await client.getAccessToken(organization);
  const response = await fetch(
    `https://api.asgardeo.io/t/${organization}/scim2/Groups`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/scim+json',
      },
    },
  );

  if (!response.ok) {
    logger.warn(`Failed to fetch Asgardeo groups: ${response.statusText}`);
    return [];
  }

  const data = (await response.json()) as ScimListResponse<ScimGroup>;
  return data.Resources || [];
}

/**
 * Fetches users from Asgardeo SCIM 2.0 API.
 */
export async function fetchScimUsers(
  client: AsgardeoClient,
  organization: string,
  _logger: LoggerService,
): Promise<ScimUser[]> {
  const token = await client.getAccessToken(organization);
  const response = await fetch(
    `https://api.asgardeo.io/t/${organization}/scim2/Users`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/scim+json',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch Asgardeo users: ${response.statusText}`);
  }

  const data = (await response.json()) as ScimListResponse<ScimUser>;
  return data.Resources || [];
}
