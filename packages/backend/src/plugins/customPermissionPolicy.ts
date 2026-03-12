import { createBackendModule } from '@backstage/backend-plugin-api';
import {
    PolicyDecision,
    AuthorizeResult,
} from '@backstage/plugin-permission-common';
import {
    PermissionPolicy,
    PolicyQuery,
    PolicyQueryUser,
} from '@backstage/plugin-permission-node';
import { policyExtensionPoint } from '@backstage/plugin-permission-node/alpha';
import { isPermission } from '@backstage/plugin-permission-common';
import { apiReadPermission, apiWritePermission } from './customPermissions';
import {
    wso2PublisherUpdatePermission,
} from '@internal/plugin-wso2-api-manager-backend';

class CustomPermissionPolicy implements PermissionPolicy {
    async handle(
        request: PolicyQuery,
        user?: PolicyQueryUser,
    ): Promise<PolicyDecision> {
        // 1. Allow everyone to read all catalog entities (including APIs)
        // This satisfies the requirement to display all APIs for all users.
        if (request.permission.name === 'catalog.entity.read') {
            return { result: AuthorizeResult.ALLOW };
        }

        // 2. Role-based checks for our custom permissions mapped to Asgardeo roles
        if (isPermission(request.permission, apiReadPermission)) {
            if (
                user?.info.ownershipEntityRefs.includes('group:default/read') ||
                user?.info.ownershipEntityRefs.includes('group:default/write')
            ) {
                return { result: AuthorizeResult.ALLOW };
            }
            return { result: AuthorizeResult.DENY };
        }

        if (isPermission(request.permission, apiWritePermission)) {
            if (user?.info.ownershipEntityRefs.includes('group:default/write')) {
                return { result: AuthorizeResult.ALLOW };
            }
            return { result: AuthorizeResult.DENY };
        }

        // 3. Allow write group to update API definitions in WSO2 Publisher
        if (isPermission(request.permission, wso2PublisherUpdatePermission)) {
            if (user?.info.ownershipEntityRefs.includes('group:default/write')) {
                return { result: AuthorizeResult.ALLOW };
            }
            return { result: AuthorizeResult.DENY };
        }

        // Fallback: allow all other permissions by default
        return { result: AuthorizeResult.ALLOW };
    }
}

export default createBackendModule({
    pluginId: 'permission',
    moduleId: 'custom-policy',
    register(reg) {
        reg.registerInit({
            deps: { policy: policyExtensionPoint },
            async init({ policy }) {
                policy.setPolicy(new CustomPermissionPolicy());
            },
        });
    },
});
