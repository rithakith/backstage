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
    getEntitySourceLocation,
    entityRouteRef,
} from '@backstage/plugin-catalog-react';
import { useApi, useRouteRef } from '@backstage/core-plugin-api';
import { scmIntegrationsApiRef, ScmIntegrationIcon } from '@backstage/integration-react';
import Grid from '@material-ui/core/Grid';
import DescriptionIcon from '@material-ui/icons/Description';

/**
 * A custom About card for WSO2 APIs that shows WSO2 specific metadata.
 */
export const EntityWso2AboutCard = () => {
    const { entity } = useEntity();
    const scmIntegrationsApi = useApi(scmIntegrationsApiRef);

    const entitySourceLocation = getEntitySourceLocation(entity, scmIntegrationsApi);

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
