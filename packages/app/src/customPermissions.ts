import { createPermission } from '@backstage/plugin-permission-common';

export const apiReadPermission = createPermission({
    name: 'api.read',
    attributes: { action: 'read' },
});

export const apiWritePermission = createPermission({
    name: 'api.write',
    attributes: { action: 'create' },
});
