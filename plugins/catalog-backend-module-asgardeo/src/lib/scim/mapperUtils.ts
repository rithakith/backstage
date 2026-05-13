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

import { GroupEntity, UserEntity } from '@backstage/catalog-model';
import { ScimGroup, ScimUser } from './types';
import { normalizeEntityName } from '../utils';

/**
 * Maps an Asgardeo SCIM Group to a Backstage Group Entity.
 */
export function mapScimGroupToEntity(
  group: ScimGroup,
  options: { organization: string },
): GroupEntity {
  const { organization } = options;
  const displayName = group.displayName || group.id;

  // Extract just the role name after any prefix (e.g. "Internal/admin" -> "admin")
  const baseName = displayName.includes('/')
    ? displayName.split('/').pop()!
    : displayName;

  const normalizedName = normalizeEntityName(baseName);

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'Group',
    metadata: {
      name: normalizedName,
      description: `Asgardeo group: ${displayName}`,
      annotations: {
        'backstage.io/managed-by-location': `asgardeo:${organization}`,
        'backstage.io/managed-by-origin-location': `asgardeo:${organization}`,
        'asgardeo.io/group-id': group.id,
      },
    },
    spec: {
      type: 'team',
      children: [],
    },
  };
}

/**
 * Maps an Asgardeo SCIM User to a Backstage User Entity.
 */
export function mapScimUserToEntity(
  user: ScimUser,
  options: {
    organization: string;
    groupIdToName: Map<string, string>;
  },
): UserEntity {
  const { organization, groupIdToName } = options;

  // Determine the email - Asgardeo SCIM returns emails as plain strings or objects
  const rawEmail =
    user.emails && user.emails.length > 0
      ? typeof user.emails[0] === 'string'
        ? user.emails[0]
        : user.emails[0].value
      : user.userName;
  const email = rawEmail || user.userName;

  // Strip the Asgardeo userstore prefix (e.g. "DEFAULT/") from userName
  const rawUserName = (user.userName || email) as string;
  const cleanUserName = rawUserName.includes('/')
    ? rawUserName.split('/').pop()!
    : rawUserName;

  // Backstage names must be alphanumeric/dashes
  const name = cleanUserName
    .split('@')[0]
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .toLowerCase();

  // Extract group memberships from SCIM groups attribute
  const memberOf: string[] = [];
  if (Array.isArray(user.groups)) {
    for (const grp of user.groups) {
      const groupId = grp.value || grp.$ref?.split('/').pop();
      if (groupId && groupIdToName.has(groupId)) {
        memberOf.push(groupIdToName.get(groupId)!);
      } else if (grp.display) {
        // Fallback: use display name and normalize it
        const baseName = grp.display.includes('/')
          ? grp.display.split('/').pop()!
          : grp.display;
        memberOf.push(normalizeEntityName(baseName));
      }
    }
  }

  return {
    apiVersion: 'backstage.io/v1alpha1',
    kind: 'User',
    metadata: {
      name: name,
      annotations: {
        'backstage.io/managed-by-location': `asgardeo:${organization}`,
        'backstage.io/managed-by-origin-location': `asgardeo:${organization}`,
        'asgardeo.io/user-id': user.id,
      },
    },
    spec: {
      profile: {
        displayName:
          user.name?.formatted || user.name?.givenName || cleanUserName,
        email: email,
      },
      memberOf: memberOf,
    },
  };
}
