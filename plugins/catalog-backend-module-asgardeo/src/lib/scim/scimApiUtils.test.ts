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

import { mockServices } from '@backstage/backend-test-utils';
import { fetchScimGroups, fetchScimUsers } from './scimApiUtils';

const logger = mockServices.logger.mock();

describe('scimApiUtils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('fetches all group pages until totalResults is reached', async () => {
    const client = {
      fetchScimPage: jest
        .fn()
        .mockResolvedValueOnce({
          totalResults: 3,
          startIndex: 1,
          itemsPerPage: 2,
          Resources: [
            { id: 'group-1', displayName: 'Internal/admin' },
            { id: 'group-2', displayName: 'Internal/dev' },
          ],
        })
        .mockResolvedValueOnce({
          totalResults: 3,
          startIndex: 3,
          itemsPerPage: 2,
          Resources: [{ id: 'group-3', displayName: 'Internal/viewer' }],
        }),
    } as any;

    await expect(fetchScimGroups(client, 'acme', logger)).resolves.toEqual([
      { id: 'group-1', displayName: 'Internal/admin' },
      { id: 'group-2', displayName: 'Internal/dev' },
      { id: 'group-3', displayName: 'Internal/viewer' },
    ]);

    expect(client.fetchScimPage).toHaveBeenNthCalledWith(
      1,
      'acme',
      'Groups',
      1,
      100,
    );
    expect(client.fetchScimPage).toHaveBeenNthCalledWith(
      2,
      'acme',
      'Groups',
      3,
      100,
    );
  });

  it('fetches all user pages until totalResults is reached', async () => {
    const client = {
      fetchScimPage: jest
        .fn()
        .mockResolvedValueOnce({
          totalResults: 2,
          startIndex: 1,
          itemsPerPage: 1,
          Resources: [{ id: 'user-1', userName: 'a@example.com' }],
        })
        .mockResolvedValueOnce({
          totalResults: 2,
          startIndex: 2,
          itemsPerPage: 1,
          Resources: [{ id: 'user-2', userName: 'b@example.com' }],
        }),
    } as any;

    await expect(fetchScimUsers(client, 'acme', logger)).resolves.toEqual([
      { id: 'user-1', userName: 'a@example.com' },
      { id: 'user-2', userName: 'b@example.com' },
    ]);
  });

  it('stops pagination if Asgardeo returns an empty page', async () => {
    const client = {
      fetchScimPage: jest.fn().mockResolvedValueOnce({
        totalResults: 10,
        startIndex: 1,
        itemsPerPage: 100,
        Resources: [],
      }),
    } as any;

    await expect(fetchScimGroups(client, 'acme', logger)).resolves.toEqual([]);
    expect(client.fetchScimPage).toHaveBeenCalledTimes(1);
  });

  it('propagates group fetch failures so callers do not publish partial data', async () => {
    const client = {
      fetchScimPage: jest
        .fn()
        .mockRejectedValue(new Error('Failed to fetch Asgardeo Groups: 500')),
    } as any;

    await expect(fetchScimGroups(client, 'acme', logger)).rejects.toThrow(
      'Failed to fetch Asgardeo Groups: 500',
    );
  });
});
