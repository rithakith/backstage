/*
 * Copyright 2024 The Backstage Authors
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

import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Permission to read APIs from the WSO2 API Manager Developer Portal.
 * This is a basic permission that most users should have.
 * @public
 */
export const wso2ApiReadPermission = createPermission({
  name: 'wso2.api.read',
  attributes: { action: 'read' },
});

/**
 * Permission to read APIs from the WSO2 API Manager Publisher Portal.
 * This permission is for users who manage APIs (publishers/admins).
 * @public
 */
export const wso2PublisherReadPermission = createPermission({
  name: 'wso2.publisher.read',
  attributes: { action: 'read' },
});

/**
 * Permission to create APIs in the WSO2 API Manager Publisher Portal.
 * This is an admin-level permission that should be restricted.
 * @public
 */
export const wso2PublisherCreatePermission = createPermission({
  name: 'wso2.publisher.create',
  attributes: { action: 'create' },
});

/**
 * All WSO2 API Manager permissions for export.
 * @public
 */
export const wso2ApiManagerPermissions = [
  wso2ApiReadPermission,
  wso2PublisherReadPermission,
  wso2PublisherCreatePermission,
];
