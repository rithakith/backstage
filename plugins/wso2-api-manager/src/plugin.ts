import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { publisherRouteRef, rootRouteRef } from './routes';

export const wso2ApiManagerPlugin = createPlugin({
  id: 'wso2-api-manager',
  routes: {
    root: rootRouteRef,
    publisher: publisherRouteRef,
  },
});

export const Wso2ApiManagerPage = wso2ApiManagerPlugin.provide(
  createRoutableExtension({
    name: 'Wso2ApiManagerPage',
    component: () =>
      import('./components/Wso2ApiManagerPage').then(
        m => m.Wso2ApiManagerPage,
      ),
    mountPoint: rootRouteRef,
  }),
);

export const Wso2PublisherPage = wso2ApiManagerPlugin.provide(
  createRoutableExtension({
    name: 'Wso2PublisherPage',
    component: () =>
      import('./components/Wso2PublisherPage').then(
        m => m.Wso2PublisherPage,
      ),
    mountPoint: publisherRouteRef,
  }),
);
