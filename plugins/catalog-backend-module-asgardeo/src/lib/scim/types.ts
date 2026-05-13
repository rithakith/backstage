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

export interface ScimResource {
  id: string;
  meta?: {
    resourceType: string;
    created: string;
    lastModified: string;
    location: string;
  };
}

export interface ScimUser extends ScimResource {
  userName: string;
  name?: {
    formatted?: string;
    familyName?: string;
    givenName?: string;
  };
  emails?: (string | { value: string; type?: string; primary?: boolean })[];
  groups?: {
    value: string;
    display?: string;
    $ref?: string;
  }[];
  active?: boolean;
  [key: string]: any; // For extensions
}

export interface ScimGroup extends ScimResource {
  displayName: string;
  members?: {
    value: string;
    display?: string;
    $ref?: string;
  }[];
}

export interface ScimListResponse<T> {
  totalResults: number;
  startIndex: number;
  itemsPerPage: number;
  Resources?: T[];
}
