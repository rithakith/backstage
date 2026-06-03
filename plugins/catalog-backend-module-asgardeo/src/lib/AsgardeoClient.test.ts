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

import { AsgardeoClient } from './AsgardeoClient';
import { ConfigReader } from '@backstage/config';
import { LoggerService } from '@backstage/backend-plugin-api';
import fetch from 'node-fetch';
import { mockServices } from '@backstage/backend-test-utils';
import { fetchScimGroups, fetchScimUsers } from './scim';

jest.mock('node-fetch', () => jest.fn());
jest.mock('./scim', () => ({
  fetchScimGroups: jest.fn(),
  fetchScimUsers: jest.fn(),
}));

const mockFetch = jest.mocked(fetch);
const mockFetchScimGroups = jest.mocked(fetchScimGroups);
const mockFetchScimUsers = jest.mocked(fetchScimUsers);

describe('AsgardeoClient', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const organization = 'wso2-org';
  const config = new ConfigReader({
    auth: {
      providers: {
        oidc: {
          development: {
            clientId: 'client-id-123',
            clientSecret: 'client-secret-456',
          },
        },
      },
    },
  });

  const logger = mockServices.logger.mock();

  let client: AsgardeoClient;

  beforeEach(() => {
    jest.clearAllMocks();
    client = new AsgardeoClient({ config, logger });
  });

  describe('getAccessToken', () => {
    it('should fetch, cache and return access token on success', async () => {
      const responseData = { access_token: 'token-abc' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(responseData),
      } as any);

      // First call (fetches token)
      const token1 = await client.getAccessToken(organization);
      expect(token1).toBe('token-abc');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      
      const expectedAuthHeader = `Basic ${Buffer.from('client-id-123:client-secret-456').toString('base64')}`;
      expect(mockFetch).toHaveBeenLastCalledWith(
        `https://api.asgardeo.io/t/${organization}/oauth2/token`,
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: expectedAuthHeader,
          }),
        }),
      );

      console.log(formatTestCaseDoc(`
=== [Asgardeo OAuth2 Documentation: Token Exchange] ===
Request:
  POST https://api.asgardeo.io/t/${organization}/oauth2/token
  Headers: 
    Authorization: Basic <base64-encoded-credentials>

Response:
  200 OK
  Body:
${JSON.stringify(responseData, null, 2)}
=======================================================
`));

      // Second call (uses cache, no fetch call)
      const token2 = await client.getAccessToken(organization);
      expect(token2).toBe('token-abc');
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should throw an error if the oauth token endpoint returns 400 Bad Request', async () => {
      const errorResponse = {
        error: 'invalid_client',
        error_description: 'Client authentication failed (e.g., unknown client, no client authentication included, or unsupported authentication method)',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(client.getAccessToken(organization)).rejects.toThrow(
        'Failed to get Asgardeo token: Bad Request',
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);

      console.log(formatTestCaseDoc(`
=== [Asgardeo OAuth2 Error Documentation: Token Exchange (400 Bad Request)] ===
Request:
  POST https://api.asgardeo.io/t/${organization}/oauth2/token
  Headers: 
    Authorization: Basic <base64-encoded-credentials>

Response:
  400 Bad Request
  Body:
${JSON.stringify(errorResponse, null, 2)}
==============================================================================
`));
    });

    it('should throw an error if the oauth token endpoint returns 401 Unauthorized', async () => {
      const errorResponse = {
        error: 'unauthorized_client',
        error_description: 'The client is not authorized to request an access token using this method',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(client.getAccessToken(organization)).rejects.toThrow(
        'Failed to get Asgardeo token: Unauthorized',
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);

      console.log(formatTestCaseDoc(`
=== [Asgardeo OAuth2 Error Documentation: Token Exchange (401 Unauthorized)] ===
Request:
  POST https://api.asgardeo.io/t/${organization}/oauth2/token
  Headers: 
    Authorization: Basic <base64-encoded-credentials>

Response:
  401 Unauthorized
  Body:
${JSON.stringify(errorResponse, null, 2)}
===============================================================================
`));
    });

    it('should throw an error if the oauth token endpoint returns 500 Internal Server Error', async () => {
      const errorResponse = {
        error: 'server_error',
        error_description: 'The authorization server encountered an unexpected condition that prevented it from fulfilling the request',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(client.getAccessToken(organization)).rejects.toThrow(
        'Failed to get Asgardeo token: Internal Server Error',
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);

      console.log(formatTestCaseDoc(`
=== [Asgardeo OAuth2 Error Documentation: Token Exchange (500 Server Error)] ===
Request:
  POST https://api.asgardeo.io/t/${organization}/oauth2/token
  Headers: 
    Authorization: Basic <base64-encoded-credentials>

Response:
  500 Internal Server Error
  Body:
${JSON.stringify(errorResponse, null, 2)}
===============================================================================
`));
    });

    it('should throw an error if the oauth token exchange throws a network connection failure', async () => {
      const networkError = new Error('fetch failed: Connection timed out');
      mockFetch.mockRejectedValue(networkError);

      await expect(client.getAccessToken(organization)).rejects.toThrow(
        'fetch failed: Connection timed out',
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);

      console.log(formatTestCaseDoc(`
=== [Asgardeo OAuth2 Error Documentation: Token Exchange (Network Failure)] ===
Request:
  POST https://api.asgardeo.io/t/${organization}/oauth2/token
  Headers: 
    Authorization: Basic <base64-encoded-credentials>

Exception Thrown:
  Error: ${networkError.message}
================================================================================
`));
    });

    it('should throw an error if the oauth token endpoint is ok but JSON parsing fails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Unexpected token T in JSON at position 0')),
      } as any);

      await expect(client.getAccessToken(organization)).rejects.toThrow(
        'Unexpected token T in JSON at position 0',
      );
      expect(mockFetch).toHaveBeenCalledTimes(1);

      console.log(formatTestCaseDoc(`
=== [Asgardeo OAuth2 Error Documentation: Token Exchange (Malformed JSON)] ===
Request:
  POST https://api.asgardeo.io/t/${organization}/oauth2/token
  Headers: 
    Authorization: Basic <base64-encoded-credentials>

Response Status:
  200 OK (Raw text or HTML body returned)

Exception Thrown:
  Error: Unexpected token T in JSON at position 0
===============================================================================
`));
    });
  });

  describe('fetchGroups', () => {
    it('should delegate to fetchScimGroups utility function', async () => {
      const mockGroups = [{ id: 'g-1', displayName: 'Group 1' }];
      mockFetchScimGroups.mockResolvedValue(mockGroups);

      const result = await client.fetchGroups(organization);
      expect(result).toBe(mockGroups);
      expect(mockFetchScimGroups).toHaveBeenCalledWith(client, organization, logger);

      console.log(formatTestCaseDoc(`
=== [Asgardeo Client Documentation: Fetch Groups Delegation] ===
Input:
  Organization: ${organization}

Delegated To:
  fetchScimGroups(client, "${organization}", logger)

Result:
  Groups fetched successfully:
${JSON.stringify(mockGroups, null, 2)}
`));
    });
  });

  describe('fetchUsers', () => {
    it('should delegate to fetchScimUsers utility function', async () => {
      const mockUsers = [{ id: 'u-1', userName: 'User 1' }];
      mockFetchScimUsers.mockResolvedValue(mockUsers);

      const result = await client.fetchUsers(organization);
      expect(result).toBe(mockUsers);
      expect(mockFetchScimUsers).toHaveBeenCalledWith(client, organization, logger);

      console.log(formatTestCaseDoc(`
=== [Asgardeo Client Documentation: Fetch Users Delegation] ===
Input:
  Organization: ${organization}

Delegated To:
  fetchScimUsers(client, "${organization}", logger)

Result:
  Users fetched successfully:
${JSON.stringify(mockUsers, null, 2)}
`));
    });
  });
});
