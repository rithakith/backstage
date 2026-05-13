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

import {
    AboutField,
} from '@backstage/plugin-catalog';
import {
    InfoCard,
    HeaderIconLinkRow,
    IconLinkVerticalProps,
} from '@backstage/core-components';
import {
    useEntity,
    entityRouteRef,
} from '@backstage/plugin-catalog-react';
import { useRouteRef } from '@backstage/core-plugin-api';
import Grid from '@material-ui/core/Grid';
import DescriptionIcon from '@material-ui/icons/Description';

/**
 * A custom About card for WSO2 APIs that shows WSO2 specific metadata.
 */
export const EntityWso2AboutCard = () => {
    const { entity } = useEntity();

    const entityRoute = useRouteRef(entityRouteRef);
    const wso2TabUrl = `${entityRoute({
        namespace: entity.metadata.namespace || 'default',
        kind: entity.kind.toLowerCase(),
        name: entity.metadata.name,
    })}/wso2`;

    const links: IconLinkVerticalProps[] = [];



    links.push({
        label: 'View TechDocs',
        icon: <DescriptionIcon />,
        href: wso2TabUrl,
    });

    const annotations = entity.metadata.annotations || {};
    const gridSizes = { xs: 12, sm: 6, lg: 4 };

    // Helper to get annotation value with fallback prefix
    const getAnnotation = (key: string) => annotations[`wso2.com/${key}`] || annotations[`wso2-gateway.com/${key}`];

    const lifecycle = getAnnotation('api-lifecycle-status');
    const context = getAnnotation('api-context');
    const version = getAnnotation('api-version');
    const endpointsRaw = getAnnotation('api-endpoints');

    return (
        <InfoCard
            variant="gridItem"
            subheader={<HeaderIconLinkRow links={links} />}
        >
            <Grid container>
                <AboutField label="Name" value={entity.metadata.name} gridSizes={gridSizes} />
                <AboutField label="Display Name" value={entity.metadata.title || entity.metadata.name} gridSizes={gridSizes} />
                {lifecycle && (
                    <AboutField label="Lifecycle" value={lifecycle} gridSizes={gridSizes} />
                )}
                {context && (
                    <AboutField label="Context" value={context} gridSizes={gridSizes} />
                )}
                {version && (
                    <AboutField label="Version" value={version} gridSizes={gridSizes} />
                )}
                {endpointsRaw && (
                    <AboutField 
                        label="Gateway" 
                        value={(() => {
                            try {
                                const endpoints = JSON.parse(endpointsRaw);
                                if (Array.isArray(endpoints) && endpoints.length > 0) {
                                    const ep = endpoints[0];
                                    const url = Array.isArray(ep.urls) ? ep.urls[0] : ep.urls;
                                    return `${ep.environmentName}${url ? ` (${url})` : ''}`;
                                }
                            } catch (e) {
                                return 'Unknown';
                            }
                            return 'None';
                        })()}
                        gridSizes={gridSizes} 
                    />
                )}
                {getAnnotation('business-owner') && (
                    <AboutField 
                        label="Business Owner" 
                        value={`${getAnnotation('business-owner')}${getAnnotation('business-owner-email') ? ` (${getAnnotation('business-owner-email')})` : ''}`} 
                        gridSizes={gridSizes} 
                    />
                )}
                {getAnnotation('technical-owner') && (
                    <AboutField 
                        label="Technical Owner" 
                        value={`${getAnnotation('technical-owner')}${getAnnotation('technical-owner-email') ? ` (${getAnnotation('technical-owner-email')})` : ''}`} 
                        gridSizes={gridSizes} 
                    />
                )}
                {getAnnotation('api-visibility') && (
                    <AboutField label="Visibility" value={getAnnotation('api-visibility')} gridSizes={gridSizes} />
                )}
               
                {entity.metadata.description && (
                    <Grid item xs={12}>
                        <AboutField label="Description" value={entity.metadata.description} />
                    </Grid>
                )}
            </Grid>
        </InfoCard>
    );
};
