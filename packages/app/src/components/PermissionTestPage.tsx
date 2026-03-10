import React from 'react';
import { usePermission } from '@backstage/plugin-permission-react';
import { apiReadPermission, apiWritePermission } from '../customPermissions';
import { Page, Header, Content, InfoCard } from '@backstage/core-components';

export const PermissionTestPage = () => {
    const { loading: readLoading, allowed: readAllowed } = usePermission({
        permission: apiReadPermission,
    });

    const { loading: writeLoading, allowed: writeAllowed } = usePermission({
        permission: apiWritePermission,
    });

    return (
        <Page themeId="home">
            <Header title="Permission Verification" subtitle="Check asgardeo.io/role custom mappings" />
            <Content>
                <InfoCard title="Your Current Permissions">
                    <div>
                        <h3>API Read Permission (Mapped to 'read' role)</h3>
                        <p>
                            Status: {readLoading ? 'Loading...' : (readAllowed ? '✅ ALLOWED' : '❌ DENIED')}
                        </p>
                    </div>
                    <div style={{ marginTop: '20px' }}>
                        <h3>API Write Permission (Mapped to 'write' role)</h3>
                        <p>
                            Status: {writeLoading ? 'Loading...' : (writeAllowed ? '✅ ALLOWED' : '❌ DENIED')}
                        </p>
                    </div>
                </InfoCard>
            </Content>
        </Page>
    );
};
