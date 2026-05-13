import { createRouteRef, createExternalRouteRef } from '@backstage/core-plugin-api';

export const rootRouteRef = createRouteRef({
  id: 'wso2-api-manager',
});

export const viewTechDocRouteRef = createExternalRouteRef({
  id: 'view-techdoc',
  optional: true,
  params: ['namespace', 'kind', 'name'],
});
