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
import { AsgardeoClient } from '../AsgardeoClient';
import { ScimGroup, ScimUser, ScimListResponse } from './types';

const DEFAULT_PAGE_SIZE = 100;

/**
 * Fetches groups from Asgardeo SCIM 2.0 API.
 */
export async function fetchScimGroups(
  client: AsgardeoClient,
  organization: string,
  logger: LoggerService,
): Promise<ScimGroup[]> {
  const groups = await fetchAllScimResources<ScimGroup>(
    client,
    organization,
    'Groups',
  );
  logger.info(`Fetched ${groups.length} groups from Asgardeo SCIM API`);
  return groups;
}

/**
 * Fetches users from Asgardeo SCIM 2.0 API.
 */
export async function fetchScimUsers(
  client: AsgardeoClient,
  organization: string,
  logger: LoggerService,
): Promise<ScimUser[]> {
  const users = await fetchAllScimResources<ScimUser>(
    client,
    organization,
    'Users',
  );
  logger.info(`Fetched ${users.length} users from Asgardeo SCIM API`);
  return users;
}

async function fetchAllScimResources<T>(
  client: AsgardeoClient,
  organization: string,
  resourcePath: 'Groups' | 'Users',
): Promise<T[]> {
  const resources: T[] = [];
  let startIndex = 1;
  let totalResults: number | undefined;

  do {
    const page = await client.fetchScimPage<ScimListResponse<T>>(
      organization,
      resourcePath,
      startIndex,
      DEFAULT_PAGE_SIZE,
    );

    const pageResources = page.Resources ?? [];
    resources.push(...pageResources);
    totalResults = page.totalResults ?? resources.length;

    if (pageResources.length === 0) {
      break;
    }

    startIndex += pageResources.length;
  } while (resources.length < totalResults);

  return resources;
}
