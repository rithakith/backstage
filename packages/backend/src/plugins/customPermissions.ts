import { createPermission } from '@backstage/plugin-permission-common';

/**
 * Custom permission for reading APIs.
 * This maps to the 'read' role in Asgardeo.
 */
export const apiReadPermission = createPermission({
    name: 'api.read',
    attributes: { action: 'read' },
});

/**
 * Custom permission for writing APIs.
 * This maps to the 'write' role in Asgardeo.
 */
export const apiWritePermission = createPermission({
    name: 'api.write',
    attributes: { action: 'create' },
});

export const customPermissions = [
    apiReadPermission,
    apiWritePermission,
];
