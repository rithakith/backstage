import { createPermission } from '@backstage/plugin-permission-common';

export const wso2PublisherUpdatePermission = createPermission({
  name: 'wso2.publisher.update',
  attributes: { action: 'update' },
});
