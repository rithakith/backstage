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

export interface Wso2Api {
  id: string;
  name: string;
  displayName?: string;
  description?: string;
  version: string;
  context: string;
  provider: string;
  type: string;
  lifeCycleStatus: string;
  gatewayType?: string;
  gatewayVendor?: string;
  apiThrottlingPolicy?: string;
  transport?: string[];
  documents?: any[];
  definition?: string;
  deployedGatewayNames?: string[];
  deploymentEnvironments?: string[];
  deployments?: any[];
  tags?: string[];
  endpointURLs?: Array<{
    environmentName?: string;
    environmentType?: string;
    urls?: string[];
  }>;
  visibility?: string;
  initiatedFromGateway?: boolean;
}
