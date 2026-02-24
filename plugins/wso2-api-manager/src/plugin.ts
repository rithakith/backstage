import {
  createPlugin,
  createRoutableExtension,
} from '@backstage/core-plugin-api';

import { rootRouteRef } from './routes';

export const wso2ApiManagerPlugin = createPlugin({
  id: 'wso2-api-manager',
  routes: {
    root: rootRouteRef,
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


