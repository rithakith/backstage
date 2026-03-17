import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
    InfoCard,
    Progress,
    WarningPanel,
    EmptyState,
    Link,
} from '@backstage/core-components';
import { useApi, alertApiRef } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import { usePermission } from '@backstage/plugin-permission-react';
import { createPermission } from '@backstage/plugin-permission-common';
import {
    Box,
    Tabs,
    Tab,
    Button,
    TextField,
} from '@material-ui/core';
import {
    wso2ApiManagerApiRef,
    wso2AuthApiRef,
} from '../../api';
// @ts-ignore
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { SwaggerEditorPanel } from '../SwaggerEditorPanel';

import { makeStyles } from '@material-ui/core/styles';

const apiWritePermission = createPermission({
    name: 'api.write',
    attributes: { action: 'create' },
});

const useStyles = makeStyles(theme => ({
    root: {
        '& .swagger-ui': {
            fontFamily: theme.typography.fontFamily,
            color: theme.palette.text.primary,

            ['& .btn-clear']: {
                color: theme.palette.text.primary,
            },
            [`& .scheme-container`]: {
                backgroundColor: theme.palette.background.default,
            },
            [`& .opblock-tag,
          .opblock-tag small,
          table thead tr td,
          table thead tr th,
          table tbody tr td,
          table tbody tr th`]: {
                fontFamily: theme.typography.fontFamily,
                color: theme.palette.text.primary,
                borderColor: theme.palette.divider,
            },
            [`& section.models,
          section.models.is-open h4`]: {
                borderColor: theme.palette.divider,
            },
            [`& .model-title,
          .model .renderedMarkdown,
          .model .description`]: {
                fontFamily: theme.typography.fontFamily,
                fontWeight: theme.typography.fontWeightRegular,
            },
            [`& h1, h2, h3, h4, h5, h6,
          .errors h4, .error h4, .opblock h4, section.models h4,
          .response-control-media-type__accept-message,
          .opblock-summary-description,
          .opblock-summary-operation-id,
          .opblock-summary-path,
          .opblock-summary-path__deprecated,
          .opblock-description-wrapper,
          .opblock-external-docs-wrapper,
          .opblock-section-header .btn,
          .opblock-section-header>label,
          .scheme-container .schemes>label,a.nostyle,
          .parameter__name,
          .response-col_status,
          .response-col_links,
          .error .btn,
          .info .title,
          .info .base-url`]: {
                fontFamily: theme.typography.fontFamily,
                color: theme.palette.text.primary,
            },
            [`& .opblock .opblock-section-header,
          .model-box,
          section.models .model-container`]: {
                background: theme.palette.background.default,
            },
            [`& .prop-format,
          .parameter__in`]: {
                color: theme.palette.text.disabled,
            },
            [`& table.model,
          .parameter__type,
          .model.model-title,
          .model-title,
          .model span,
          .model .brace-open,
          .model .brace-close,
          .model .property.primitive,
          .model .renderedMarkdown,
          .model .description,
          .errors small`]: {
                color: theme.palette.text.secondary,
            },
            [`& .parameter__name.required:after,
        .parameter__name.required span`]: {
                color: theme.palette.warning.dark,
            },
            [`& table.model,
          table.model .model,
          .opblock-external-docs-wrapper`]: {
                fontSize: theme.typography.fontSize,
            },
            [`& table.headers td`]: {
                color: theme.palette.text.primary,
                fontWeight: theme.typography.fontWeightRegular,
            },
            [`& .model-hint`]: {
                color: theme.palette.text.secondary,
                backgroundColor: theme.palette.background.paper,
            },
            [`& .opblock-summary-method,
          .info a`]: {
                fontFamily: theme.typography.fontFamily,
            },
            [`& .info, .opblock, .tab`]: {
                [`& li, p`]: {
                    fontFamily: theme.typography.fontFamily,
                    color: theme.palette.text.primary,
                },
            },
            [`& a`]: {
                color: theme.palette.primary.main,
            },
            [`& .renderedMarkdown code`]: {
                color: theme.palette.secondary.light,
            },
            [`& .property-row td:first-child`]: {
                color: theme.palette.text.primary,
            },
            [`& span.prop-type`]: {
                color: theme.palette.success.light,
            },
            [`& .opblock-control-arrow svg, .authorization__btn .unlocked`]: {
                fill: theme.palette.text.primary,
            },

            [`& .json-schema-2020-12__title,
          .json-schema-2020-12-keyword__name,
          .json-schema-2020-12-property .json-schema-2020-12__title,
          .json-schema-2020-12-keyword--description`]: {
                color: theme.palette.text.primary,
            },
            [`.json-schema-2020-12-accordion__icon svg`]: {
                fill: theme.palette.text.primary,
            },
            [`& .json-schema-2020-12-accordion,
          .json-schema-2020-12-expand-deep-button`]: {
                background: 'none',
                appearance: 'none',
            },
            [`& .json-schema-2020-12-expand-deep-button,
          .json-schema-2020-12-keyword__name--secondary,
          .json-schema-2020-12-keyword__value--secondary,
          .json-schema-2020-12__attribute--muted,
          .json-schema-2020-12-keyword__value--const,
          .json-schema-2020-12-keyword__value--warning`]: {
                color: theme.palette.text.secondary,
            },
            [`& .json-schema-2020-12-body,
          .json-schema-2020-12-keyword__value--const,
          .json-schema-2020-12-keyword__value--warning`]: {
                borderColor: theme.palette.text.secondary,
            },
            [`.json-schema-2020-12__constraint--string`]: {
                backgroundColor: theme.palette.primary.main,
            },
            [`& .json-schema-2020-12__attribute--primary`]: {
                color: theme.palette.primary.main,
            },
            [`& .json-schema-2020-12-property--required>.json-schema-2020-12:first-of-type>.json-schema-2020-12-head .json-schema-2020-12__title:after`]:
            {
                color: theme.palette.warning.dark,
            },
        },
    },
    tabRoot: {
        minWidth: 120,
        textTransform: 'none',
        fontWeight: 600,
    },
}));

const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

/**
 * A specialized API Definition card for WSO2 APIs that enables Try it out 
 * and targets the WSO2 Gateway (port 8247) with automatic auth.
 */
export const EntityWso2ApiDefinitionCard = () => {
    const classes = useStyles();
    const { entity } = useEntity();
    const apiClient = useApi(wso2ApiManagerApiRef);
    const oauthApi = useApi(wso2AuthApiRef);
    const alertApi = useApi(alertApiRef);
    const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
    const apiKeyRef = useRef<string | null>(null);
    const [apiKey, setApiKey] = useState<string | null>(null);
    const [expiresIn, setExpiresIn] = useState<number | null>(null);
    const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

    // Get the user's Asgardeo OAuth token from existing session
    // Get the user's Asgardeo OAuth token from existing session
    const tokenState = useAsyncRetry(async () => {
        try {
            const t = await oauthApi.getAccessToken(
                ['openid', 'profile', 'email', 'apim:api_view', 'apim:subscribe'],
                { optional: true },
            );
            return t;
        } catch (error: any) {
            console.error('[WSO2-DefinitionCard] Token retrieval failed:', error);
            return undefined;
        }
    }, [oauthApi]);

    // Get API Details (to get context and version for URL rewriting)
    const apiDetailState = useAsync(async () => {
        if (!apiId || tokenState.loading) {
            return undefined;
        }
        return apiClient.getApi(apiId, tokenState.value);
    }, [apiClient, apiId, tokenState.value, tokenState.loading]);

    // Get the actual OpenAPI definition
    const apiDefinitionState = useAsyncRetry(async () => {
        if (!apiId || tokenState.loading) return undefined;
        try {
            return await apiClient.getApiDefinition(apiId, tokenState.value);
        } catch (e: any) {
            if (e.message && e.message.includes('404')) {
                return null;
            }
            throw e;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading]);

    // Editor state
    const [activeTab, setActiveTab] = useState(0); // 0=Swagger UI, 1=Source
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState<string | undefined>();
    const [saveSuccess, setSaveSuccess] = useState(false);

    // Permission check
    const { allowed: hasWritePermission } = usePermission({ permission: apiWritePermission });

    // Sync editor content when definition loads
    useEffect(() => {
        if (apiDefinitionState.value && !isEditing) {
            const content = typeof apiDefinitionState.value === 'string'
                ? apiDefinitionState.value
                : JSON.stringify(apiDefinitionState.value, null, 2);
            setEditContent(content);
        }
    }, [apiDefinitionState.value, isEditing]);

    const handleEdit = () => {
        setIsEditing(true);
        setSaveSuccess(false);
    };

    const handleCancel = () => {
        setIsEditing(false);
        if (apiDefinitionState.value) {
            const content = typeof apiDefinitionState.value === 'string'
                ? apiDefinitionState.value
                : JSON.stringify(apiDefinitionState.value, null, 2);
            setEditContent(content);
        }
    };

    const handleSave = async () => {
        if (!tokenState.value || !apiId) return;
        setIsSaving(true);
        setSaveError(undefined);
        try {
            await apiClient.updateApiDefinition(apiId, editContent, tokenState.value);
            setSaveSuccess(true);
            setIsEditing(false);
            apiDefinitionState.retry(); // Reload UI
        } catch (e: any) {
            setSaveError(e.message || 'Failed to update API definition');
        } finally {
            setIsSaving(false);
        }
    };

    // Generate an API test key for the Try it out functionality
    // Generate an API test key for the Try it out functionality
    const generateKeyState = useAsyncRetry(async () => {
        // We need the user token to request an Internal Key from WSO2
        if (!apiId || tokenState.loading || !tokenState.value) {
            return undefined;
        }
        try {
            const result = await apiClient.generateApiKey(apiId, tokenState.value);
            return result;
        } catch (e: any) {
            console.error('[WSO2-DefinitionCard] Failed to generate API Key:', e.message);
            return null;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading]);

    // Update the ref and state whenever the key changes
    useEffect(() => {
        if (generateKeyState.value) {
            const keyData = generateKeyState.value;
            const key = keyData.token
                || keyData.InternalKey
                || keyData.internalKey
                || keyData.apikey
                || keyData.apiKey
                || (keyData.token && typeof keyData.token === 'object' ? keyData.token.accessToken : undefined)
                || (typeof keyData === 'string' ? keyData : '');

            const isInitial = apiKeyRef.current === null;
            apiKeyRef.current = key || null;
            setApiKey(key || null);
            setLastUpdated(Date.now());

            const validity = keyData.validityPeriod || keyData.expires_in;
            if (validity) {
                setExpiresIn(Number(validity));
            }

            if (!isInitial && key) {
                alertApi.post({ message: 'Internal API Key refreshed', severity: 'success' });
            }
            console.log('🗝️ [WSO2-Auth] API Key Ref and State updated:', key ? 'READY' : 'EMPTY');
        } else if (generateKeyState.error) {
            apiKeyRef.current = null;
            setApiKey(null);
        }
    }, [generateKeyState.value, generateKeyState.error, alertApi]);

    // Calculate the Gateway URL base
    const gatewayUrlBase = useMemo(() => {
        const details = apiDetailState.value;
        if (!details) return '';

        let context = details.context || '';
        if (details.version && !context.endsWith(details.version)) {
            context = `${context.replace(/\/$/, '')}/${details.version}`;
        }
        const hostname = window.location.hostname || 'localhost';
        return `https://${hostname}:8247${context}`;
    }, [apiDetailState.value]);

    // Check if API is deployed
    const revisionsState = useAsync(async () => {
        if (!apiId || tokenState.loading) return undefined;
        try {
            return await apiClient.getRevisions(apiId, { query: 'deployed:true', token: tokenState.value });
        } catch (e: any) {
            console.error('[WSO2-DefinitionCard] Failed to fetch revisions:', e.message);
            return null;
        }
    }, [apiClient, apiId, tokenState.value, tokenState.loading]);

    const isDeployed = useMemo(() => {
        return (revisionsState.value?.list?.length ?? 0) > 0;
    }, [revisionsState.value]);

    // Dynamically rewrite the Swagger/OpenAPI spec URL to hit the API Gateway directly (e.g. 8247)
    const swaggerSpec = useMemo(() => {
        if (!apiDefinitionState.value || !gatewayUrlBase) return apiDefinitionState.value;

        try {
            const spec = JSON.parse(JSON.stringify(apiDefinitionState.value));
            const gatewayUrl = gatewayUrlBase;

            if (spec.openapi) { // OpenAPI 3 Support
                spec.servers = [{
                    url: gatewayUrl,
                    description: 'API Gateway'
                }];
                // Clear overlapping servers in paths
                if (spec.paths) {
                    for (const pathKey of Object.keys(spec.paths)) {
                        if (spec.paths[pathKey].servers) {
                            delete spec.paths[pathKey].servers;
                        }
                    }
                }
            } else if (spec.swagger) { // Swagger 2 Support
                const urlObj = new URL(gatewayUrl);
                spec.host = urlObj.host;
                spec.schemes = [urlObj.protocol.replace(':', '')];
                spec.basePath = urlObj.pathname !== '/' ? urlObj.pathname : '/';
            }

            return spec;
        } catch (e) {
            console.warn('[WSO2-DefinitionCard] Failed to rewrite Swagger spec URLs', e);
            return apiDefinitionState.value;
        }
    }, [apiDefinitionState.value, apiDetailState.value]);

    if (!apiId) {
        return null; // Not a WSO2 API
    }

    return (
        <InfoCard title="API Definition" >
            {(apiDefinitionState.loading || apiDetailState.loading) && <Progress />}

            {apiDefinitionState.error && (
                <WarningPanel
                    title="Failed to load API Definition"
                    message={apiDefinitionState.error.message}
                />
            )}

            {!apiDefinitionState.loading && apiDefinitionState.value === null && (
                <EmptyState
                    title="No Definition"
                    missing="info"
                    description="This API does not have an OpenAPI/Swagger definition available."
                />
            )}

            {apiDefinitionState.value && (
                <>
                    {/* Authentication Status for 'Try it out' */}
                    {!tokenState.loading && !tokenState.value && (
                        <Box mb={2}>
                            <WarningPanel
                                title="Authentication Required"
                                message="Sign in with your Asgardeo account to enable 'Try it out' functionality."
                            />
                        </Box>
                    )}

                    {/* Gateway Error for 'Try it out' */}
                    {generateKeyState.value === null && (
                        <Box mb={2}>
                            <WarningPanel
                                title="Gateway Access Failed"
                                message="Failed to generate a temporary access key for the WSO2 Gateway. Please try refreshing the page or checking your connectivity."
                            />
                        </Box>
                    )}

                    {/* Tab bar: Swagger UI / Source */}
                    <Box borderBottom={1} borderColor="divider" mb={2}>
                        <Tabs
                            value={activeTab}
                            onChange={(_, v) => setActiveTab(v)}
                            indicatorColor="primary"
                            textColor="primary"
                        >
                            <Tab id="tab-swagger-ui" label="Swagger UI" className={classes.tabRoot} />
                            <Tab id="tab-source" label="Source Editor" className={classes.tabRoot} />
                        </Tabs>
                    </Box>

                    {/* Tab 0: SwaggerUI rendered view */}
                    {activeTab === 0 && (
                        <div className={classes.root}>
                            {/* Discreet SSL troubleshooting link */}
                            <Box display="flex" justifyContent="flex-end" px={2} pt={1}>
                                <Link
                                    href={gatewayUrlBase}
                                    target="_blank"
                                    style={{ fontSize: '0.75rem', opacity: 0.7 }}
                                >
                                    Troubleshoot Gateway Connection (SSL)
                                </Link>
                            </Box>

                            {/* Internal API Key Display and Regeneration */}
                            {isDeployed && (
                                <Box mx={2} my={1} p={2} border={1} borderColor="divider" borderRadius={4} bgcolor="background.paper">
                                    <Box display="flex" alignItems="center" justifyContent="space-between">
                                        <TextField
                                            label="Internal API Key"
                                            value={generateKeyState.loading ? 'Generating...' : (apiKey || 'No key available')}
                                            variant="outlined"
                                            size="small"
                                            InputProps={{
                                                readOnly: true,
                                                style: { fontFamily: 'monospace', fontSize: '0.875rem' }
                                            }}
                                            fullWidth
                                        />
                                        <Box ml={2}>
                                            <Button
                                                variant="contained"
                                                color="primary"
                                                onClick={() => generateKeyState.retry()}
                                                disabled={generateKeyState.loading}
                                                size="small"
                                            >
                                                {generateKeyState.loading ? 'Generating...' : 'Generate'}
                                            </Button>
                                        </Box>
                                    </Box>
                                    <Box mt={1}>
                                        <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                                            Expires in {expiresIn ? Math.round(expiresIn / 3600) : 1} hour(s)
                                        </span>
                                    </Box>
                                </Box>
                            )}

                            <div style={{ padding: '16px', borderRadius: '4px' }}>
                                <SwaggerUI
                                    key={`swagger-ui-${lastUpdated}`}
                                    spec={swaggerSpec}
                                    supportedSubmitMethods={isDeployed ? ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] : []}
                                    requestInterceptor={(req: any) => {
                                        // Set credentials to 'omit' to avoid CORS issues with wildcard origins
                                        req.credentials = 'omit';

                                        if (apiKey) {
                                            console.log('🚀 [WSO2-Auth] Injecting Internal-Key into request:', req.url);
                                            // WSO2 Gateway expects testing keys in 'Internal-Key' header
                                            req.headers['Internal-Key'] = apiKey;
                                        } else {
                                            // Diagnostic log for debugging missing tokens
                                            console.warn('[WSO2-Auth] No Internal-Key in state at request time.');
                                        }
                                        return req;
                                    }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Tab 1: VSCode-like editor */}
                    {activeTab === 1 && (
                        <SwaggerEditorPanel
                            value={editContent}
                            readOnly={!isEditing}
                            onChange={setEditContent}
                            isEditing={isEditing}
                            isSaving={isSaving}
                            saveSuccess={saveSuccess}
                            saveError={saveError}
                            hasWritePermission={hasWritePermission}
                            onEdit={handleEdit}
                            onSave={handleSave}
                            onCancel={handleCancel}
                        />
                    )}
                </>
            )}
        </InfoCard>
    );
};
