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

import React, { useMemo, useState, useEffect } from 'react';
import {
  InfoCard,
  WarningPanel,
  EmptyState,
  Link,
} from '@backstage/core-components';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Box,
  Tabs,
  Tab,
  Button,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
} from '@material-ui/core';
import ContentCopyIcon from '@material-ui/icons/FileCopy';
import RefreshIcon from '@material-ui/icons/Refresh';
// @ts-ignore
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { SwaggerEditorPanel } from '../SwaggerEditorPanel';

import { useStyles } from './styles';
import { isAsyncType } from '../../utils';
import { useWso2ApiAuth } from './hooks/useWso2ApiAuth';
import { useWso2ApiDefinition } from './hooks/useWso2ApiDefinition';
import { DisabledTryItOutButton } from './components/DisabledTryItOutButton';
import { Wso2OperationsList } from './components/Wso2OperationsList';
import { Wso2PublisherPoliciesList } from './components/Wso2PublisherPoliciesList';

const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';
const DISCOVERY_TYPE_ANNOTATION = 'wso2.com/api-discovery-type';
const WSO2_GATEWAY_API_ID_ANNOTATION = 'wso2-gateway.com/api-id';

/**
 * A specialized API Definition card for WSO2 APIs that enables Try it out
 * and targets the WSO2 Gateway with automatic auth.
 */
export const EntityWso2ApiDefinitionCard = () => {
  const classes = useStyles();
  const { entity } = useEntity();

  const apiId =
    entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION] ||
    entity.metadata.annotations?.[WSO2_GATEWAY_API_ID_ANNOTATION];

  const isApiPlatform =
    entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION] === 'apiplatform';
  const isSelfHostedGateway = 
    entity.metadata.annotations?.[DISCOVERY_TYPE_ANNOTATION] === 'self-hosted-gateway';
  
  const isDiscovered =
    entity.metadata.annotations?.['wso2.com/is-discovered'] === 'true';

  const skipKeyGeneration = isApiPlatform || isSelfHostedGateway;

  // 1. Auth Hook
  const {
    token,
    isTokenLoading,
    apiKey,
    expiresIn,
    lastUpdated,
    isKeyLoading,
    generateKeyError,
    refreshKey,
  } = useWso2ApiAuth({ apiId, isApiPlatform: skipKeyGeneration });

  // 2. Definition Hook
  const {
    details,
    definition,
    isDefinitionLoading,
    hasOperationsOnly,
    gatewayOperations,
    gatewayApiPolicies,
    formattedSource,
    gatewayUrls,
    isDeployed,
    swaggerSpec,
    isPlaceholder,
    isRevisionsLoading,
  } = useWso2ApiDefinition({
    entity,
    apiId,
    token,
    isTokenLoading,
    isApiPlatform: skipKeyGeneration,
  });



  const isPublisherApi = !skipKeyGeneration;
  const showPublisherPoliciesTab =
    (isPublisherApi || skipKeyGeneration) &&
    (details?.apiPolicies ||
      (details?.operations && details.operations.length > 0) ||
      (gatewayApiPolicies && (gatewayApiPolicies as any).request?.length > 0) ||
      (gatewayOperations && gatewayOperations.length > 0));

  const hasSwaggerTab = details?.type !== 'GRAPHQL' && !isAsyncType(details?.type);
  const hasSourceTab = !hasOperationsOnly;
  const hasConsoleTab =
    hasOperationsOnly &&
    swaggerSpec &&
    typeof swaggerSpec === 'object' &&
    (swaggerSpec as any).openapi;

  const [activeTab, setActiveTab] = useState<number | string>('swagger');
  const [externalApiKey, setExternalApiKey] = useState('');

  const apiKeyAuthPolicy = useMemo(() => {
    // Check API level
    const globalOps = Array.isArray(gatewayApiPolicies) ? gatewayApiPolicies : [];
    const global = globalOps.find((p: any) => p.name === 'api-key-auth');
    if (global) return global;

    // Check operation level
    const localOps = Array.isArray(gatewayOperations) ? gatewayOperations : [];
    for (const op of localOps) {
      const local = (op.policies || []).find(
        (p: any) => p.name === 'api-key-auth',
      );
      if (local) return local;
    }
    return null;
  }, [gatewayApiPolicies, gatewayOperations]);

  // Sync display content when definition loads
  useEffect(() => {
    if (!hasSwaggerTab) {
      if (showPublisherPoliciesTab) {
        setActiveTab('policies');
      } else if (hasSourceTab) {
        setActiveTab('source');
      }
    }
  }, [details, hasSwaggerTab, showPublisherPoliciesTab, hasSourceTab]);
  // Swagger UI Plugin to replace the 'Try It Out' button based on deployment and discovery type
  const tryItOutPlugin = useMemo(() => {
    const type = (details?.type || '').toUpperCase();
    const isSoap = type === 'SOAP';
    const isAsync = isAsyncType(type);

    const canTry =
      isDeployed && !isSoap && !isAsync && (!isDiscovered || skipKeyGeneration);
    if (canTry) return {};

    let message = 'Try it out is not available for this API';
    if (isSoap) message = 'Try it out is not supported for SOAP APIs';
    else if (isAsync) message = 'Try it out is not supported for Async APIs';
    else if (isDiscovered && !skipKeyGeneration)
      message = 'Try it out is not enabled for discovered APIs';
    else if (!isDeployed) message = 'API is not deployed to any gateway';

    return {
      components: {
        TryItOutButton: () => <DisabledTryItOutButton message={message} />,
      },
    };
  }, [isDeployed, isApiPlatform, details, isDiscovered]);

  if (!apiId) return null;

  const isLoading =
    isDefinitionLoading ||
    isTokenLoading ||
    isRevisionsLoading ||
    (isDeployed && isKeyLoading && !apiKey);

  return (
    <InfoCard
      title={
        <Box display="flex" alignItems="center">
          {isDiscovered && (
            <Box
              ml={2}
              px={1}
              py={0.5}
              bgcolor="#e6f7ff"
              border={1}
              borderColor="#91d5ff"
              borderRadius={4}
            >
              <Typography
                variant="caption"
                style={{
                  color: '#0050b3',
                  fontWeight: 'bold',
                  textTransform: 'uppercase',
                }}
              >
                Discovered API
              </Typography>
            </Box>
          )}
        </Box>
      }
    >
      {(isLoading || isPlaceholder) && (
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          height={200}
          flexDirection="column"
        >
          <CircularProgress
            size={40}
            thickness={4}
            style={{ color: '#ff5000' }}
          />
          <Box mt={2}>
            <Typography variant="body2" color="textSecondary">
              {isPlaceholder
                ? 'Syncing with WSO2 Gateway...'
                : 'Loading API Definition...'}
            </Typography>
          </Box>
        </Box>
      )}

      {!isLoading && !isPlaceholder && definition === null && (
        <EmptyState
          title="No Definition"
          missing="info"
          description="This API does not have a definition available in the catalog."
        />
      )}

      {definition && !isPlaceholder && (
        <>
          {/* Authentication Status for 'Try it out' */}
          {!skipKeyGeneration && !isTokenLoading && !token && (
            <Box mb={2}>
              <WarningPanel
                title="Authentication Required"
                message="Sign in with your Asgardeo account to enable 'Try it out' functionality."
              />
            </Box>
          )}

          {/* Gateway Error for 'Try it out' - Only for non-discovered APIs */}
          {!isDiscovered && generateKeyError && (
            <Box mb={2}>
              <WarningPanel
                title="Gateway Access Failed"
                message="Failed to generate a temporary access key for the WSO2 Gateway. Please try refreshing the page or checking your connectivity."
              />
            </Box>
          )}

          {/* Tab bar: Swagger UI / Source / Policies */}
          <Box borderBottom={1} borderColor="divider" mb={2}>
            <Tabs
              value={activeTab}
              onChange={(_, v) => setActiveTab(v)}
              indicatorColor="primary"
              textColor="primary"
            >
              {hasSwaggerTab && (
                <Tab
                  id="tab-swagger-ui"
                  label={hasOperationsOnly ? 'Operations' : 'Swagger UI'}
                  value="swagger"
                  className={classes.tabRoot}
                />
              )}
              {showPublisherPoliciesTab && (
                <Tab
                  id="tab-policies"
                  label="Policies"
                  value="policies"
                  className={classes.tabRoot}
                />
              )}
              {hasConsoleTab && !hasOperationsOnly && (
                <Tab
                  id="tab-console"
                  label="Try it out"
                  value="console"
                  className={classes.tabRoot}
                />
              )}
              {hasSourceTab && (
                <Tab
                  id="tab-source"
                  label="View Source"
                  value="source"
                  className={classes.tabRoot}
                />
              )}
            </Tabs>
          </Box>

          {/* Tab Content: SwaggerUI or Operations List */}
          {activeTab === 'swagger' && hasSwaggerTab && (
            <div className={classes.root}>
              {/* Internal API Key Display and Regeneration */}
              {isDeployed && !isDiscovered && !skipKeyGeneration && (
                <Box
                  mx={2}
                  my={1}
                  p={2}
                  border={1}
                  borderColor="divider"
                  borderRadius={4}
                  bgcolor="background.paper"
                >
                  <Box
                    display="flex"
                    alignItems="center"
                    justifyContent="space-between"
                  >
                    <TextField
                      label="Internal API Key"
                      value={
                        isKeyLoading
                          ? 'Generating...'
                          : apiKey || 'No key available'
                      }
                      variant="outlined"
                      fullWidth
                      size="small"
                      InputProps={{
                        readOnly: true,
                        style: { fontFamily: '"Roboto Mono", monospace' },
                      }}
                    />
                    <Box display="flex">
                      <Box mr={1}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            navigator.clipboard.writeText(apiKey || '');
                          }}
                          title="Copy Key"
                        >
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={refreshKey}
                        title="Regenerate Key"
                        disabled={isKeyLoading}
                      >
                        <RefreshIcon
                          fontSize="small"
                          className={isKeyLoading ? classes.refreshIconSpin : ''}
                        />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box mt={1}>
                    <span style={{ fontSize: '0.75rem', opacity: 0.7 }}>
                      Expires in{' '}
                      {expiresIn ? Math.round(expiresIn / 3600) : 1} hour(s)
                    </span>
                  </Box>
                </Box>
              )}

              {/* External API Key Input (if api-key-auth policy is present) */}
              {apiKeyAuthPolicy && (
                <Box
                  mx={2}
                  my={1}
                  p={2}
                  border={1}
                  borderColor="divider"
                  borderRadius={4}
                  bgcolor="background.paper"
                >
                  <TextField
                    label={`${apiKeyAuthPolicy.name || 'API Key'} (${apiKeyAuthPolicy.params?.in || 'header'})`}
                    placeholder={`Enter ${apiKeyAuthPolicy.name || 'API Key'}...`}
                    value={externalApiKey}
                    onChange={e => setExternalApiKey(e.target.value)}
                    variant="outlined"
                    fullWidth
                    size="small"
                  />
                  <Typography variant="caption" color="textSecondary" style={{ marginTop: '8px', display: 'block' }}>
                    This key will be automatically added to your "Try it out" requests as specified by the API policy.
                  </Typography>
                </Box>
              )}

              {/* Gateway Server URL Display */}
              {gatewayUrls.length > 0 && (
                <Box
                  mx={2}
                  my={1}
                  p={2}
                  border={1}
                  borderColor="divider"
                  borderRadius={4}
                  bgcolor="background.paper"
                >
                  <TextField
                    label="Server"
                    value={gatewayUrls[0].url}
                    variant="outlined"
                    size="small"
                    InputProps={{
                      readOnly: true,
                      style: {
                        fontFamily: 'monospace',
                        fontSize: '0.875rem',
                      },
                    }}
                    fullWidth
                  />
                </Box>
              )}

              <Wso2OperationsList
                operations={hasOperationsOnly ? gatewayOperations : 
                  Object.entries(swaggerSpec?.paths || {}).flatMap(([path, methods]: [string, any]) => 
                    Object.keys(methods).map(method => ({ method, path }))
                  )
                }
                apiKey={apiKey ?? undefined}
                externalApiKey={externalApiKey}
                apiKeyAuthPolicy={apiKeyAuthPolicy}
                serverUrl={gatewayUrls[0]?.url}
              />
            </div>
          )}

          {/* Tab Content: Console (Try it out for Operations-only APIs) */}
          {activeTab === 'console' && hasConsoleTab && (
            <div className={classes.root}>
              <div style={{ padding: '16px', borderRadius: '4px' }}>
                <SwaggerUI
                  key={`swagger-console-${lastUpdated}`}
                  spec={swaggerSpec}
                  plugins={[tryItOutPlugin]}
                  supportedSubmitMethods={[
                    'get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace',
                  ]}
                  requestInterceptor={(req: any) => {
                    if (apiKey) {
                      req.headers['Internal-Key'] = apiKey;
                    }
                    if (externalApiKey && apiKeyAuthPolicy) {
                      const { in: location, key } = apiKeyAuthPolicy.params || {};
                      if (location === 'header') {
                        req.headers[key || 'x-api-key'] = externalApiKey;
                      } else if (location === 'query') {
                        const separator = req.url.includes('?') ? '&' : '?';
                        req.url = `${req.url}${separator}${key || 'api-key'}=${encodeURIComponent(externalApiKey)}`;
                      }
                    }
                    return req;
                  }}
                />
              </div>
            </div>
          )}

          {/* Tab Content: Policies (for Publisher and Discovered APIs) */}
          {activeTab === 'policies' && showPublisherPoliciesTab && (
            <Wso2PublisherPoliciesList 
              details={details} 
              gatewayOperations={gatewayOperations}
              gatewayApiPolicies={gatewayApiPolicies}
            />
          )}

          {/* Tab Content: Source View */}
          {activeTab === 'source' && hasSourceTab && (
            <SwaggerEditorPanel value={formattedSource} readOnly />
          )}
        </>
      )}
    </InfoCard>
  );
};
