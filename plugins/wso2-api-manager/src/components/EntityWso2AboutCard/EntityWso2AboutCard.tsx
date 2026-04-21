import React, { useCallback } from 'react';
import { Entity, stringifyEntityRef, ANNOTATION_EDIT_URL, ANNOTATION_LOCATION } from '@backstage/catalog-model';
import {
    AboutContent,
    AboutField,
} from '@backstage/plugin-catalog';
import {
    InfoCard,
    HeaderIconLinkRow,
    Link,
    IconLinkVerticalProps,
} from '@backstage/core-components';
import {
    useEntity,
    getEntitySourceLocation,
    catalogApiRef,
    entityRouteRef,
} from '@backstage/plugin-catalog-react';
import { useApi, useRouteRef, alertApiRef, errorApiRef } from '@backstage/core-plugin-api';
import { scmIntegrationsApiRef, ScmIntegrationIcon } from '@backstage/integration-react';
import Grid from '@material-ui/core/Grid';
import Divider from '@material-ui/core/Divider';
import IconButton from '@material-ui/core/IconButton';
import EditIcon from '@material-ui/icons/Edit';
import CachedIcon from '@material-ui/icons/Cached';
import DescriptionIcon from '@material-ui/icons/Description';
import { buildTechDocsURL } from '@backstage/plugin-techdocs-react';
import { TECHDOCS_ANNOTATION, TECHDOCS_EXTERNAL_ANNOTATION } from '@backstage/plugin-techdocs-common';
import { viewTechDocRouteRef } from '../../routes';

/**
 * A custom About card for WSO2 APIs that shows WSO2 specific metadata.
 */
export const EntityWso2AboutCard = () => {
    const { entity } = useEntity();
    const scmIntegrationsApi = useApi(scmIntegrationsApiRef);
    const catalogApi = useApi(catalogApiRef);
    const alertApi = useApi(alertApiRef);
    const errorApi = useApi(errorApiRef);

    // Use the route ref defined in the plugin's routes
    const viewTechdocLink = useRouteRef(viewTechDocRouteRef);

    const entitySourceLocation = getEntitySourceLocation(entity, scmIntegrationsApi);
    const techDocsUrl = viewTechdocLink ? buildTechDocsURL(entity, viewTechdocLink) : null;

    const entityMetadataEditUrl = entity.metadata.annotations?.[ANNOTATION_EDIT_URL];
    const entityLocation = entity.metadata.annotations?.[ANNOTATION_LOCATION];
    const managedBy = entity.metadata.annotations?.['backstage.io/managed-by-location'];

    // Allow refresh if it's a typical location or if it's managed by WSO2 provider
    const allowRefresh = entityLocation?.startsWith('url:') ||
        entityLocation?.startsWith('file:') ||
        managedBy?.startsWith('wso2-apim:');

    const refreshEntity = useCallback(async () => {
        try {
            await catalogApi.refreshEntity(stringifyEntityRef(entity));
            alertApi.post({
                message: 'Refresh scheduled',
                severity: 'info',
                display: 'transient',
            });
        } catch (e: any) {
            errorApi.post(e);
        }
    }, [catalogApi, entity, alertApi, errorApi]);

    const entityRoute = useRouteRef(entityRouteRef);
    const wso2TabUrl = `${entityRoute({
        namespace: entity.metadata.namespace || 'default',
        kind: entity.kind.toLowerCase(),
        name: entity.metadata.name,
    })}/wso2`;

    const links: IconLinkVerticalProps[] = [];

    if (entitySourceLocation) {
        links.push({
            label: 'View Source',
            icon: <ScmIntegrationIcon type={entitySourceLocation?.integrationType} />,
            href: entitySourceLocation?.locationTargetUrl ?? '#',
        });
    }

    links.push({
        label: 'View TechDocs',
        icon: <DescriptionIcon />,
        href: wso2TabUrl,
    });

    const annotations = entity.metadata.annotations || {};
    const gridSizes = { xs: 12, sm: 6, lg: 4 };

    return (
        <InfoCard
            title="About"
            variant="gridItem"
            subheader={<HeaderIconLinkRow links={links} />}
            action={
                <>
                    {allowRefresh && (
                        <IconButton
                            aria-label="Refresh"
                            title="Schedule Refresh"
                            onClick={refreshEntity}
                        >
                            <CachedIcon />
                        </IconButton>
                    )}
                    <IconButton
                        component={Link}
                        aria-label="Edit"
                        disabled={!entityMetadataEditUrl}
                        title="Edit Metadata"
                        to={entityMetadataEditUrl ?? '#'}
                    >
                        <EditIcon />
                    </IconButton>
                </>
            }
        >
            <Grid container>
                <AboutField label="Name" value={entity.metadata.name} gridSizes={gridSizes} />
                <AboutField label="Display Name" value={entity.metadata.title || entity.metadata.name} gridSizes={gridSizes} />
                {annotations['wso2.com/api-lifecycle-status'] && (
                    <AboutField label="Lifecycle" value={annotations['wso2.com/api-lifecycle-status']} gridSizes={gridSizes} />
                )}
                {annotations['wso2.com/api-context'] && (
                    <AboutField label="Context" value={annotations['wso2.com/api-context']} gridSizes={gridSizes} />
                )}
                {annotations['wso2.com/api-version'] && (
                    <AboutField label="Version" value={annotations['wso2.com/api-version']} gridSizes={gridSizes} />
                )}
                {annotations['wso2.com/technical-owner'] && (
                    <AboutField label="Technical Owner" value={annotations['wso2.com/technical-owner']} gridSizes={gridSizes} />
                )}
                {annotations['wso2.com/business-owner'] && (
                    <AboutField label="Business Owner" value={annotations['wso2.com/business-owner']} gridSizes={gridSizes} />
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
