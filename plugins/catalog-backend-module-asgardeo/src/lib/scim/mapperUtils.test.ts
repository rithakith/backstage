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

import { mapScimGroupToEntity, mapScimUserToEntity } from './mapperUtils';
import { ScimGroup, ScimUser } from './types';

describe('mapperUtils', () => {
  const formatTestCaseDoc = (details: string) => {
    return `\n================================================================================\nTEST CASE: ${expect.getState().currentTestName}\n================================================================================\n${details.trim()}\n================================================================================\n`;
  };

  const organization = 'wso2';

  describe('mapScimGroupToEntity', () => {
    it('should map standard SCIM group correctly', () => {
      const group: ScimGroup = {
        id: 'group-id-123',
        displayName: 'admin-group',
      };

      const entity = mapScimGroupToEntity(group, { organization });

      expect(entity).toEqual({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'Group',
        metadata: {
          name: 'admin-group',
          description: 'Asgardeo group: admin-group',
          annotations: {
            'backstage.io/managed-by-location': 'asgardeo:wso2',
            'backstage.io/managed-by-origin-location': 'asgardeo:wso2',
            'asgardeo.io/group-id': 'group-id-123',
          },
        },
        spec: {
          type: 'team',
          children: [],
        },
      });

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: Group Mapping (Standard)] ===
Input SCIM Group:
${JSON.stringify(group, null, 2)}

Mapped Backstage Entity:
${JSON.stringify(entity, null, 2)}
`));
    });

    it('should strip roles/group prefix from displayName', () => {
      const group: ScimGroup = {
        id: 'group-id-456',
        displayName: 'Internal/everyone',
      };

      const entity = mapScimGroupToEntity(group, { organization });
      expect(entity.metadata.name).toBe('internal-everyone');
      expect(entity.metadata.description).toBe('Asgardeo group: Internal/everyone');

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: Group Mapping (Prefix Stripping)] ===
Input SCIM Group:
${JSON.stringify(group, null, 2)}

Resulting Name: "${entity.metadata.name}"
`));
    });

    it('should fallback to id if displayName is missing', () => {
      const group: ScimGroup = {
        id: 'group-id-789',
        displayName: '',
      };

      const entity = mapScimGroupToEntity(group, { organization });
      expect(entity.metadata.name).toBe('group-id-789');

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: Group Mapping (Fallback to ID)] ===
Input SCIM Group:
${JSON.stringify(group, null, 2)}

Resulting Name: "${entity.metadata.name}"
`));
    });
  });

  describe('mapScimUserToEntity', () => {
    const groupIdToName = new Map<string, string>([
      ['group-1', 'admin-team'],
    ]);

    it('should map standard user with email object array and resolved groups', () => {
      const user: ScimUser = {
        id: 'user-id-111',
        userName: 'DEFAULT/john_doe',
        emails: [{ value: 'john.doe@wso2.com', primary: true }],
        name: {
          formatted: 'John Doe',
          givenName: 'John',
          familyName: 'Doe',
        },
        groups: [
          { value: 'group-1', display: 'Internal/admin-team' },
        ],
      };

      const entity = mapScimUserToEntity(user, { organization, groupIdToName });

      expect(entity).toEqual({
        apiVersion: 'backstage.io/v1alpha1',
        kind: 'User',
        metadata: {
            name: 'john-doe-wso2-com',
          annotations: {
            'backstage.io/managed-by-location': 'asgardeo:wso2',
            'backstage.io/managed-by-origin-location': 'asgardeo:wso2',
            'asgardeo.io/user-id': 'user-id-111',
          },
        },
        spec: {
          profile: {
            displayName: 'John Doe',
            email: 'john.doe@wso2.com',
          },
          memberOf: ['admin-team'],
        },
      });

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: User Mapping (Standard with Group Resolution)] ===
Input SCIM User:
${JSON.stringify(user, null, 2)}

Mapped Backstage Entity:
${JSON.stringify(entity, null, 2)}
`));
    });

    it('should handle email as string list', () => {
      const user: ScimUser = {
        id: 'user-id-222',
        userName: 'DEFAULT/jane_doe',
        emails: ['jane.doe@wso2.com'],
      };

      const entity = mapScimUserToEntity(user, { organization, groupIdToName });
      expect(entity.spec.profile?.email).toBe('jane.doe@wso2.com');

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: User Mapping (Email String Array)] ===
Input SCIM User:
${JSON.stringify(user, null, 2)}

Mapped Email Result: "${entity.spec.profile?.email}"
`));
    });

    it('should fallback to userName if emails array is empty or missing', () => {
      const user: ScimUser = {
        id: 'user-id-333',
        userName: 'DEFAULT/alice@wso2.com',
      };

      const entity = mapScimUserToEntity(user, { organization, groupIdToName });
      expect(entity.spec.profile?.email).toBe('DEFAULT/alice@wso2.com');
      expect(entity.metadata.name).toBe('default-alice-wso2-com');

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: User Mapping (Email Fallback to Username)] ===
Input SCIM User:
${JSON.stringify(user, null, 2)}

Mapped Email Result: "${entity.spec.profile?.email}"
Mapped Name Result: "${entity.metadata.name}"
`));
    });

    it('should resolve unmapped group by normalized display name', () => {
      const user: ScimUser = {
        id: 'user-id-444',
        userName: 'bob',
        groups: [
          { value: 'group-unmapped', display: 'Internal/custom-viewers' },
          { value: 'group-no-display' },
        ],
      };

      const entity = mapScimUserToEntity(user, { organization, groupIdToName });
      expect(entity.spec.memberOf).toEqual(['internal-custom-viewers']);

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: User Mapping (Group Fallback Resolution)] ===
Input SCIM User:
${JSON.stringify(user, null, 2)}

Resolved memberOf: ${JSON.stringify(entity.spec.memberOf)}
`));
    });

    it('should fallback to givenName or userName in profile display name', () => {
      const userWithoutFormatted: ScimUser = {
        id: 'user-5',
        userName: 'charlie',
        name: { givenName: 'Charlie' },
      };

      const entity = mapScimUserToEntity(userWithoutFormatted, { organization, groupIdToName });
      expect(entity.spec.profile?.displayName).toBe('Charlie');

      const userSimple: ScimUser = {
        id: 'user-6',
        userName: 'david',
      };

      const entitySimple = mapScimUserToEntity(userSimple, { organization, groupIdToName });
      expect(entitySimple.spec.profile?.displayName).toBe('david');

      console.log(formatTestCaseDoc(`
=== [Mapper Utility: User Mapping (Display Name Fallbacks)] ===
Case 1: User with givenName ("Charlie") -> Resolved Display Name: "${entity.spec.profile?.displayName}"
Case 2: User with simple username ("david") -> Resolved Display Name: "${entitySimple.spec.profile?.displayName}"
`));
    });
  });
});
