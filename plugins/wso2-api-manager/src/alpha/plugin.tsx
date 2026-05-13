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

import CloudIcon from '@material-ui/icons/Cloud';
import {
  createFrontendPlugin,
  PageBlueprint,
} from '@backstage/frontend-plugin-api';
import {
  EntityCardBlueprint,
} from '@backstage/plugin-catalog-react/alpha';
import {
  rootRouteRef,
} from '../routes';
/** @alpha */
export const wso2ApiManagerPage = PageBlueprint.make({
  params: {
    path: '/wso2-api-manager',
    routeRef: rootRouteRef,
    title: 'WSO2 API Manager',
    icon: <CloudIcon />,
    loader: () =>
      import('../components/Wso2ApiManagerPage').then(m => <m.Wso2ApiManagerPage />),
  },
});

/** @alpha */
export const entityWso2ApiOverviewCard = EntityCardBlueprint.make({
  name: 'overview',
  params: {
    filter: { kind: 'component' },
    loader: () =>
      import('../components/EntityWso2ApiOverviewCard').then(m => (
        <m.EntityWso2ApiOverviewCard />
      )),
  },
});

/** @alpha */
export const entityWso2ApiDefinitionCard = EntityCardBlueprint.make({
  name: 'definition',
  params: {
    filter: { kind: 'api' },
    loader: () =>
      import('../components/EntityWso2ApiDefinitionCard').then(m => (
        <m.EntityWso2ApiDefinitionCard />
      )),
  },
});

/** @alpha */
export const entityWso2ApiDocumentsCard = EntityCardBlueprint.make({
  name: 'documents',
  params: {
    filter: { kind: 'api' },
    loader: () =>
      import('../components/EntityWso2ApiDocumentsCard').then(m => (
        <m.EntityWso2ApiDocumentsCard />
      )),
  },
});

/** @alpha */
export const entityWso2AboutCard = EntityCardBlueprint.make({
  name: 'about',
  params: {
    filter: { kind: 'api' },
    loader: () =>
      import('../components/EntityWso2AboutCard').then(m => (
        <m.EntityWso2AboutCard />
      )),
  },
});

/** @alpha */
export const entityWso2McpToolsCard = EntityCardBlueprint.make({
  name: 'mcp-tools',
  params: {
    filter: { kind: 'api' },
    loader: () =>
      import('../components/EntityWso2McpToolsCard').then(m => (
        <m.EntityWso2McpToolsCard />
      )),
  },
});

/** @alpha */
export const entityWso2ApiProductResourcesCard = EntityCardBlueprint.make({
  name: 'product-resources',
  params: {
    filter: { kind: 'api' },
    loader: () =>
      import('../components/EntityWso2ApiProductResourcesCard').then(m => (
        <m.EntityWso2ApiProductResourcesCard />
      )),
  },
});

const extensions = [
  wso2ApiManagerPage as any,
  entityWso2ApiOverviewCard as any,
  entityWso2ApiDefinitionCard as any,
  entityWso2ApiDocumentsCard as any,
  entityWso2AboutCard as any,
  entityWso2McpToolsCard as any,
  entityWso2ApiProductResourcesCard as any,
];

/** @alpha */
export default createFrontendPlugin({
  pluginId: 'wso2-api-manager',
  extensions,
});
