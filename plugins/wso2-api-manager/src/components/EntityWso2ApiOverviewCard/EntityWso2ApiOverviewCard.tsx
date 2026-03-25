/**
 * EntityWso2ApiOverviewCard
 * 
 * A UI component for Backstage API entities that are managed by WSO2 API Manager.
 * It displays:
 * 1. Core API metadata (version, provider, context, lifecycle status) from WSO2.
 * 2. Associated documentation (PDFs, Markdown, links) with download support via the backend proxy.
 */
import { useAsync } from 'react-use';
import Grid from '@material-ui/core/Grid';
import {
    EmptyState,
    InfoCard,
    Progress,
    StructuredMetadataTable,
    Table,
    WarningPanel,
} from '@backstage/core-components';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import Link from '@material-ui/core/Link';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
    Wso2ApiDetail,
    Wso2ApiDocument,
    wso2ApiManagerApiRef,
    wso2AuthApiRef,
} from '../../api';
import { EntityWso2ApiDocumentsCard } from '../EntityWso2ApiDocumentsCard';


const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

export const EntityWso2ApiOverviewCard = () => {
    // entity: { metadata: { name: 'pizza-shack', annotations: { 'wso2.com/api-id': '...' } }, kind: 'API', ... }
    const { entity } = useEntity();

    // apiClient: Interface providing getApi(id), listDocuments(id), etc.
    const apiClient = useApi(wso2ApiManagerApiRef);

    // oauthApi: Interface showing getAccessToken(['scope1', 'scope2'], { optional: true })
    const oauthApi = useApi(wso2AuthApiRef);

    // apiId: A string ID from the entity annotations (e.g., '7a9b3c4d-...')
    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];

    // config: Access to app-config.yaml settings
    const config = useApi(configApiRef);

    // fetch: A wrapper around the browser fetch API with built-in auth for Backstage backends
    const { fetch } = useApi(fetchApiRef);

    // backendUrl: The root URL of the Backstage backend (e.g., 'http://localhost:7007')
    const backendUrl = config.getString('backend.baseUrl');

    // Get the user's Asgardeo OAuth token from existing session
    const tokenState = useAsync(async () => {
        console.log('🔑 [WSO2-EntityCard] Attempting to retrieve Asgardeo OAuth token from session...');
        try {
            const token = await oauthApi.getAccessToken(
                ['openid', 'profile', 'email', 'apim:api_view', 'apim:subscribe'],
                { optional: true },
            );
            if (token) {
                console.log('✅ [WSO2-EntityCard] Asgardeo OAuth token retrieved from session');
                console.log(`📊 [WSO2-EntityCard] Token length: ${token.length} characters`);
            } else {
                console.warn('⚠️ [WSO2-EntityCard] No OAuth token in session');
            }
            return token;
        } catch (error) {
            console.error('❌ [WSO2-EntityCard] Failed to get Asgardeo OAuth token:', error);
            return undefined;
        }
    }, [oauthApi]);

    const apiDetailState = useAsync(async () => {
        if (!apiId) {
            return undefined;
        }
        return apiClient.getApi(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value]);

    const apiDocumentsState = useAsync(async () => {
        if (!apiId) {
            return undefined;
        }
        return apiClient.listDocuments(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value]);

    if (!apiId) {
        return (
            <EmptyState
                title="Missing WSO2 API annotation"
                missing="info"
                description={`Add ${WSO2_API_ID_ANNOTATION} to the entity annotations.`}
            />
        );
    }

    if (apiDetailState.loading) {
        return <Progress />;
    }

    if (apiDetailState.error) {
        return (
            <WarningPanel
                title="Failed to load WSO2 API"
                message={apiDetailState.error.message}
            />
        );
    }

    const details = apiDetailState.value;

    if (!details) {
        return (
            <EmptyState
                title="API not found"
                missing="info"
                description="The API could not be loaded from WSO2 API Manager."
            />
        );
    }

    return (
        <Grid container spacing={3} alignItems="stretch">
            <Grid item xs={12} md={6}>
                <InfoCard title="WSO2 API details">
                    <ApiDetails details={details} />
                </InfoCard>
            </Grid>
            <Grid item xs={12} md={6}>
                <EntityWso2ApiDocumentsCard
                    title="WSO2 documents"
                    documents={apiDocumentsState.value?.documents}
                    loading={apiDocumentsState.loading}
                    error={apiDocumentsState.error}
                />
            </Grid>
        </Grid>
    );
};

const ApiDetails = ({ details }: { details: Wso2ApiDetail }) => {
    const metadata: Record<string, string> = {
        Name: details.name,
    };

    if (details.version) {
        metadata.Version = details.version;
    }
    if (details.provider) {
        metadata.Provider = details.provider;
    }
    if (details.context) {
        metadata.Context = details.context;
    }
    if (details.lifeCycleStatus) {
        metadata.Status = details.lifeCycleStatus;
    }
    if (details.type) {
        metadata.Type = details.type;
    }
    if (details.description) {
        metadata.Description = details.description;
    }

    return <StructuredMetadataTable metadata={metadata} />;
};
