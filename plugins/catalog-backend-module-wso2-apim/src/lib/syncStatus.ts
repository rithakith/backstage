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

export type Wso2ApimSyncPhase =
  | 'idle'
  | 'fetching'
  | 'mapping'
  | 'applying'
  | 'complete'
  | 'failed';

export type Wso2ApimSyncStatus = {
  providerId?: string;
  phase: Wso2ApimSyncPhase;
  message: string;
  startedAt?: string;
  updatedAt?: string;
  completedAt?: string;
  error?: string;
  publisherApis: {
    loaded: number;
    total?: number;
  };
  totals: {
    catalogEntities?: number;
    apiProducts?: number;
    mcpServers?: number;
    services?: number;
    gatewayApis?: number;
  };
};

type MutableSyncStatus = Wso2ApimSyncStatus;

const STORE_KEY = '__wso2ApimCatalogSyncStatus';

function defaultStatus(): MutableSyncStatus {
  return {
    phase: 'idle',
    message: 'Catalog sync has not started yet.',
    publisherApis: { loaded: 0 },
    totals: {},
  };
}

function getStore(): MutableSyncStatus {
  const globalWithStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: MutableSyncStatus;
  };

  if (!globalWithStore[STORE_KEY]) {
    globalWithStore[STORE_KEY] = defaultStatus();
  }

  return globalWithStore[STORE_KEY];
}

export function getWso2ApimSyncStatus(): Wso2ApimSyncStatus {
  return JSON.parse(JSON.stringify(getStore())) as Wso2ApimSyncStatus;
}

export function updateWso2ApimSyncStatus(
  patch: Partial<Wso2ApimSyncStatus>,
): Wso2ApimSyncStatus {
  const current = getStore();
  const updated: MutableSyncStatus = {
    ...current,
    ...patch,
    publisherApis: {
      ...current.publisherApis,
      ...patch.publisherApis,
    },
    totals: {
      ...current.totals,
      ...patch.totals,
    },
    updatedAt: new Date().toISOString(),
  };

  const globalWithStore = globalThis as typeof globalThis & {
    [STORE_KEY]?: MutableSyncStatus;
  };
  globalWithStore[STORE_KEY] = updated;
  return getWso2ApimSyncStatus();
}
