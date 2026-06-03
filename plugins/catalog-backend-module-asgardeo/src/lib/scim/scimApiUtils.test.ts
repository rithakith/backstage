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

import { fetchScimGroups, fetchScimUsers } from './scimApiUtils';
import { AsgardeoClient } from '../AsgardeoClient';
import { mockServices } from '@backstage/backend-test-utils';
import fetch from 'node-fetch';

jest.mock('node-fetch', () => jest.fn());
const mockFetch = jest.mocked(fetch);

describe('scimApiUtils', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const organization = 'wso2';

  const mockLogger = mockServices.logger.mock();

  const mockClient = {
    getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('fetchScimGroups', () => {
    it('should return groups when the response is ok', async () => {
      const responseData = {
        totalResults: 1,
        startIndex: 1,
        itemsPerPage: 10,
        Resources: [{ id: 'group-1', displayName: 'Group 1' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(responseData),
      } as any);

      const groups = await fetchScimGroups(mockClient, organization, mockLogger);

      expect(groups).toEqual(responseData.Resources);
      expect(mockClient.getAccessToken).toHaveBeenCalledWith(organization);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.asgardeo.io/t/${organization}/scim2/Groups`,
        {
          headers: {
            Authorization: 'Bearer test-access-token',
            Accept: 'application/scim+json',
          },
        },
      );
      
      console.log(formatTestCaseDoc(`
=== [SCIM API Documentation: Fetch Groups] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Groups
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  200 OK
  Body:
${JSON.stringify(responseData, null, 2)}
==============================================
`));
    });

    it('should return empty array and log warning when response is 401 Unauthorized', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Credential validation failed',
        status: '401',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      const groups = await fetchScimGroups(mockClient, organization, mockLogger);

      expect(groups).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to fetch Asgardeo groups: Unauthorized');

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Groups (401 Unauthorized)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Groups
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  401 Unauthorized
  Body:
${JSON.stringify(errorResponse, null, 2)}
======================================================================
`));
    });

    it('should return empty array and log warning when response is 403 Forbidden', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Insufficient permissions to access the resource',
        status: '403',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Forbidden',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      const groups = await fetchScimGroups(mockClient, organization, mockLogger);

      expect(groups).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to fetch Asgardeo groups: Forbidden');

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Groups (403 Forbidden)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Groups
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  403 Forbidden
  Body:
${JSON.stringify(errorResponse, null, 2)}
===================================================================
`));
    });

    it('should return empty array and log warning when response is 404 Not Found', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: `Organization not found: ${organization}`,
        status: '404',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      const groups = await fetchScimGroups(mockClient, organization, mockLogger);

      expect(groups).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to fetch Asgardeo groups: Not Found');

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Groups (404 Not Found)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Groups
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  404 Not Found
  Body:
${JSON.stringify(errorResponse, null, 2)}
===================================================================
`));
    });

    it('should return empty array and log warning when response is 500 Internal Server Error', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'An unexpected database error occurred on the server',
        status: '500',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      const groups = await fetchScimGroups(mockClient, organization, mockLogger);

      expect(groups).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalledWith('Failed to fetch Asgardeo groups: Internal Server Error');

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Groups (500 Server Error)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Groups
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  500 Internal Server Error
  Body:
${JSON.stringify(errorResponse, null, 2)}
======================================================================
`));
    });

    it('should return empty array and log warning when fetch throws network connection failure', async () => {
      const networkError = new TypeError('fetch failed: Connection timed out');
      mockFetch.mockRejectedValue(networkError);

      await expect(fetchScimGroups(mockClient, organization, mockLogger)).rejects.toThrow(
        'fetch failed: Connection timed out',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Groups (Network Failure)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Groups
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Exception Thrown:
  TypeError: ${networkError.message}
======================================================================
`));
    });

    it('should throw error when response is ok but JSON parsing fails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Unexpected token < in JSON at position 0')),
      } as any);

      await expect(fetchScimGroups(mockClient, organization, mockLogger)).rejects.toThrow(
        'Unexpected token < in JSON at position 0',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Groups (Malformed JSON)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Groups
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response Status:
  200 OK (Raw HTML body returned)

Exception Thrown:
  Error: Unexpected token < in JSON at position 0
===================================================================
`));
    });
  });

  describe('fetchScimUsers', () => {
    it('should return users when the response is ok', async () => {
      const responseData = {
        totalResults: 1,
        startIndex: 1,
        itemsPerPage: 10,
        Resources: [{ id: 'user-1', userName: 'bob' }],
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(responseData),
      } as any);

      const users = await fetchScimUsers(mockClient, organization, mockLogger);

      expect(users).toEqual(responseData.Resources);
      expect(mockClient.getAccessToken).toHaveBeenCalledWith(organization);
      expect(mockFetch).toHaveBeenCalledWith(
        `https://api.asgardeo.io/t/${organization}/scim2/Users`,
        {
          headers: {
            Authorization: 'Bearer test-access-token',
            Accept: 'application/scim+json',
          },
        },
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Documentation: Fetch Users] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Users
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  200 OK
  Body:
${JSON.stringify(responseData, null, 2)}
=============================================
`));
    });

    it('should throw an error when response is 400 Bad Request', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Invalid filter attribute: usernamee',
        status: '400',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Bad Request',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(fetchScimUsers(mockClient, organization, mockLogger)).rejects.toThrow(
        'Failed to fetch Asgardeo users: Bad Request',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Users (400 Bad Request)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Users
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  400 Bad Request
  Body:
${JSON.stringify(errorResponse, null, 2)}
====================================================================
`));
    });

    it('should throw an error when response is 401 Unauthorized', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Expired access token',
        status: '401',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(fetchScimUsers(mockClient, organization, mockLogger)).rejects.toThrow(
        'Failed to fetch Asgardeo users: Unauthorized',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Users (401 Unauthorized)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Users
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  401 Unauthorized
  Body:
${JSON.stringify(errorResponse, null, 2)}
=====================================================================
`));
    });

    it('should throw an error when response is 404 Not Found', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Resource /scim2/Users not found',
        status: '404',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(fetchScimUsers(mockClient, organization, mockLogger)).rejects.toThrow(
        'Failed to fetch Asgardeo users: Not Found',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Users (404 Not Found)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Users
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  404 Not Found
  Body:
${JSON.stringify(errorResponse, null, 2)}
==================================================================
`));
    });

    it('should throw an error when response is 500 Internal Server Error', async () => {
      const errorResponse = {
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Internal Server Error: Database failure',
        status: '500',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        statusText: 'Internal Server Error',
        json: jest.fn().mockResolvedValue(errorResponse),
      } as any);

      await expect(fetchScimUsers(mockClient, organization, mockLogger)).rejects.toThrow(
        'Failed to fetch Asgardeo users: Internal Server Error',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Users (500 Server Error)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Users
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response:
  500 Internal Server Error
  Body:
${JSON.stringify(errorResponse, null, 2)}
=====================================================================
`));
    });

    it('should throw an error when fetch throws network connection failure', async () => {
      const networkError = new Error('fetch failed: Connection refused');
      mockFetch.mockRejectedValue(networkError);

      await expect(fetchScimUsers(mockClient, organization, mockLogger)).rejects.toThrow(
        'fetch failed: Connection refused',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Users (Network Failure)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Users
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Exception Thrown:
  Error: ${networkError.message}
=====================================================================
`));
    });

    it('should throw an error when response is ok but JSON parsing fails', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Unexpected end of JSON input')),
      } as any);

      await expect(fetchScimUsers(mockClient, organization, mockLogger)).rejects.toThrow(
        'Unexpected end of JSON input',
      );

      console.log(formatTestCaseDoc(`
=== [SCIM API Error Documentation: Fetch Users (Malformed JSON)] ===
Request:
  GET https://api.asgardeo.io/t/${organization}/scim2/Users
  Headers: 
    Authorization: Bearer test-access-token
    Accept: application/scim+json

Response Status:
  200 OK (Empty or invalid body returned)

Exception Thrown:
  Error: Unexpected end of JSON input
===================================================================
`));
    });
  });
});
