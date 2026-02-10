import { createRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'wso2-api-manager',
});

export const publisherRouteRef = createRouteRef({
  id: 'wso2-api-manager-publisher',
});
