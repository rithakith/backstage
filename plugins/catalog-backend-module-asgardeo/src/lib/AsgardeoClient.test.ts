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

import { ConfigReader } from '@backstage/config';
import { mockServices } from '@backstage/backend-test-utils';
import fetch from 'node-fetch';
import { AsgardeoClient } from './AsgardeoClient';

jest.mock('node-fetch', () => jest.fn());

const mockFetch = jest.mocked(fetch); 

const logger = mockServices.logger.mock();

const okJson = (body: unknown) =>
  ({
    ok: true,
    status: 200,
    json: jest.fn().mockResolvedValue(body),
  } as any);

const errorResponse = (status: number, statusText: string, body = '') =>
  ({
    ok: false,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(body),
  } as any);

describe('AsgardeoClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // 1. constructor(options)
  // ===========================================================================
  describe('constructor', () => {
    it('sets default retry attempts to 2 when retries config is omitted', async () => {
      // Mock setTimeout to run instantly
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return {} as any;
      });

      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'provider-client',
                clientSecret: 'provider-secret',
              },
            },
          },
        }),
        logger,
      });

      // Mock 2 failures followed by 1 success. If retries = 2, it should succeed on the 3rd attempt.
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, 'Server Error'))
        .mockResolvedValueOnce(errorResponse(500, 'Server Error'))
        .mockResolvedValueOnce(okJson({ access_token: 'success-token' }));

      const token = await client.getAccessToken('acme');
      expect(token).toBe('success-token');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // ===========================================================================
  // 2. getAccessToken(organization)
  // ===========================================================================
  describe('getAccessToken', () => {
    it('uses catalog provider credentials and caches tokens until expiry', async () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'provider-client',
                clientSecret: 'provider-secret',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      mockFetch.mockResolvedValue(okJson({ access_token: 'token-1', expires_in: 3600 }));

      await expect(client.getAccessToken('acme')).resolves.toBe('token-1');
      await expect(client.getAccessToken('acme')).resolves.toBe('token-1');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.asgardeo.io/t/acme/oauth2/token',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: `Basic ${Buffer.from(
              'provider-client:provider-secret',
            ).toString('base64')}`,
          }),
        }),
      );
    });

    it('throws detailed token errors on non-OK response', async () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'id',
                clientSecret: 'secret',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      mockFetch.mockResolvedValue(
        errorResponse(400, 'Bad Request', '{"detail":"invalid client"}'),
      );

      await expect(client.getAccessToken('acme')).rejects.toThrow(
        'Failed to get Asgardeo token: invalid client',
      );
    });

    it('throws an error if the token response is missing access_token', async () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'id',
                clientSecret: 'secret',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      mockFetch.mockResolvedValue(okJson({}));

      await expect(client.getAccessToken('acme')).rejects.toThrow(
        'Failed to get Asgardeo token: missing access_token',
      );
    });
  });

  // ===========================================================================
  // 3. invalidateAccessToken(organization)
  // ===========================================================================
  describe('invalidateAccessToken', () => {
    it('clears the cached token for the organization', async () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'id',
                clientSecret: 'secret',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      mockFetch.mockResolvedValue(okJson({ access_token: 'token-1' }));

      // Fetch once (adds to cache)
      await expect(client.getAccessToken('acme')).resolves.toBe('token-1');

      // Invalidate the cache
      client.invalidateAccessToken('acme');

      // Fetch again (must request from server again)
      await expect(client.getAccessToken('acme')).resolves.toBe('token-1');

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  // ===========================================================================
  // 4. getBaseUrl(organization)
  // ===========================================================================
  describe('getBaseUrl', () => {
    it('returns default Asgardeo URL when baseUrl is not configured', () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: { providers: { asgardeo: { retries: 0 } } },
        }),
        logger,
      });
      expect(client.getBaseUrl('my-org')).toBe('https://api.asgardeo.io/t/my-org');
    });

    it('returns configured baseUrl (without trailing slash)', () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                baseUrl: 'https://id.example.com/t/acme/',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      expect(client.getBaseUrl('ignored-org')).toBe('https://id.example.com/t/acme');
    });
  });

  // ===========================================================================
  // 5. fetchScimPage(organization, resourcePath, startIndex, count)
  // ===========================================================================
  describe('fetchScimPage', () => {
    it('uses configured baseUrl for token and SCIM requests', async () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                baseUrl: 'https://id.example.com/t/acme/',
                clientId: 'id',
                clientSecret: 'secret',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      mockFetch
        .mockResolvedValueOnce(okJson({ access_token: 'token-1' }))
        .mockResolvedValueOnce(
          okJson({
            totalResults: 0,
            startIndex: 1,
            itemsPerPage: 100,
            Resources: [],
          }),
        );

      await client.fetchScimPage('ignored-org', 'Users', 1, 100);

      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        'https://id.example.com/t/acme/oauth2/token',
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        'https://id.example.com/t/acme/scim2/Users?startIndex=1&count=100',
        expect.any(Object),
      );
    });

    it('refreshes the token and retries a SCIM page once after 401', async () => {
      // reasons to be expiered: administrator has revoked that token, or it expired ahead of schedule on the Asgardeo serve
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'id',
                clientSecret: 'secret',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      mockFetch
        .mockResolvedValueOnce(okJson({ access_token: 'expired-token' }))
        .mockResolvedValueOnce(errorResponse(401, 'Unauthorized'))
        .mockResolvedValueOnce(okJson({ access_token: 'fresh-token' }))
        .mockResolvedValueOnce(
          okJson({
            totalResults: 1,
            startIndex: 1,
            itemsPerPage: 100,
            Resources: [{ id: 'u1', userName: 'user@example.com' }],
          }),
        );

      await expect(client.fetchScimPage('acme', 'Users', 1, 100)).resolves.toEqual({
        totalResults: 1,
        startIndex: 1,
        itemsPerPage: 100,
        Resources: [{ id: 'u1', userName: 'user@example.com' }],
      });

      expect(mockFetch).toHaveBeenCalledTimes(4);
      expect(mockFetch.mock.calls[1][1]?.headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer expired-token' }),
      );
      expect(mockFetch.mock.calls[3][1]?.headers).toEqual(
        expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
      );
    });

    it('throws detailed fetch errors when SCIM request fails', async () => {
      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'id',
                clientSecret: 'secret',
                retries: 0,
              },
            },
          },
        }),
        logger,
      });
      mockFetch
        .mockResolvedValueOnce(okJson({ access_token: 'token-1' }))
        .mockResolvedValueOnce(errorResponse(500, 'Internal Server Error'));

      await expect(client.fetchScimPage('acme', 'Users', 1, 100)).rejects.toThrow(
        'Failed to fetch Asgardeo Users: Internal Server Error',
      );
    });
  });

  // ===========================================================================
  // 8. fetchWithRetry (Retry logic)
  // ===========================================================================
  describe('fetchWithRetry (retry behavior)', () => {
    it('retries on status 429 and >= 500 status codes up to the configured limit', async () => {
      // Mock setTimeout to run instantly
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return {} as any;
      });

      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'id',
                clientSecret: 'secret',
                retries: 2, // 2 retries means 3 total attempts
              },
            },
          },
        }),
        logger,
      });

      // 1st attempt: 500, 2nd attempt: 429, 3rd attempt: success
      mockFetch
        .mockResolvedValueOnce(errorResponse(500, 'Server Error'))
        .mockResolvedValueOnce(errorResponse(429, 'Too Many Requests'))
        .mockResolvedValueOnce(okJson({ access_token: 'token-ok' }));

      const token = await client.getAccessToken('acme');
      expect(token).toBe('token-ok');
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('does not retry on 4xx client errors (other than 429)', async () => {
      // Mock setTimeout to run instantly
      jest.spyOn(global, 'setTimeout').mockImplementation((cb: any) => {
        cb();
        return {} as any;
      });

      const client = new AsgardeoClient({
        config: new ConfigReader({
          catalog: {
            providers: {
              asgardeo: {
                clientId: 'id',
                clientSecret: 'secret',
                retries: 2,
              },
            },
          },
        }),
        logger,
      });

      mockFetch.mockResolvedValue(errorResponse(400, 'Bad Request'));

      await expect(client.getAccessToken('acme')).rejects.toThrow(
        'Failed to get Asgardeo token: Bad Request',
      );

      // Should fail immediately after 1 attempt
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});
