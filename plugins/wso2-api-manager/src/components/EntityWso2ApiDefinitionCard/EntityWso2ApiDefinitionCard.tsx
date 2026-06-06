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
import { useApi } from '@backstage/core-plugin-api';
import {
  Box,
  Tabs,
  Tab,
  Button,
  TextField,
  Typography,
  CircularProgress,
  IconButton,
  LinearProgress,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import { SwaggerEditorPanel } from '../SwaggerEditorPanel';

import { wso2ApiManagerApiRef, wso2AuthApiRef } from '../../api';
import { useStyles } from './styles';
import { isAsyncType } from '../../utils';
import { useWso2ApiAuth } from './hooks/useWso2ApiAuth';
import { useWso2ApiDefinition } from './hooks/useWso2ApiDefinition';
import { DisabledTryItOutButton } from './components/DisabledTryItOutButton';
import { Wso2OperationsList } from './components/Wso2OperationsList';
import { Wso2PublisherPoliciesList } from './components/Wso2PublisherPoliciesList';
import { Wso2ApiAuthSection } from './components/Wso2ApiAuthSection';

import { Wso2GatewayUrlDisplay } from './components/Wso2GatewayUrlDisplay';
import { Wso2SwaggerConsole } from './components/Wso2SwaggerConsole';
import { Wso2GraphQLConsole } from './components/Wso2GraphQLConsole';
import { Wso2WebSocketConsole } from './components/Wso2WebSocketConsole';

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
  const apiClient = useApi(wso2ApiManagerApiRef);

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
    apiKeyRef,
    expiresIn,
    lastUpdated,
    isKeyLoading,
    generateKeyError,
    refreshKey,
    applyManualKey,
    customKeyName,
    setCustomKeyName,
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
  const hasWsdlTab = details?.type === 'SOAP';
  const hasConsoleTab =
    hasOperationsOnly &&
    swaggerSpec &&
    typeof swaggerSpec === 'object' &&
    (swaggerSpec as any).openapi;

  const showGatewayUrlDisplay = useMemo(() => {
    const type = (details?.type || '').toUpperCase();
    return !type.includes('HTTP');
  }, [details?.type]);

  const [activeTab, setActiveTab] = useState<number | string>('swagger');
  const [manualKeyInput, setManualKeyInput] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [externalApiKey, setExternalApiKey] = useState('');
  const [isWsdlDownloading, setIsWsdlDownloading] = useState(false);

  const handleDownloadWsdl = async () => {
    setIsWsdlDownloading(true);
    try {
      const blob = await apiClient.getApiWsdl(apiId!, token || undefined);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${apiId}-wsdl.zip`);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Failed to download WSDL:', err);
    } finally {
      setIsWsdlDownloading(false);
    }
  };

  const hasApiKeyHeader = useMemo(() => {
    if (!details) return true;
    
    // Check the official WSO2 securityScheme array if present
    const securityScheme = (details as any).securityScheme;
    if (Array.isArray(securityScheme) && securityScheme.length > 0) {
      return securityScheme.includes('api_key');
    }
    
    // Fallback to CORS headers
    const headers = details.corsConfiguration?.accessControlAllowHeaders || details.accessControlAllowHeaders;
    if (!headers || !Array.isArray(headers)) return true;
    return headers.some(h => h.toLowerCase() === 'apikey');
  }, [details]);



  const hasSubscriptionlessPolicies = useMemo(() => {
    if (!details || !Array.isArray(details.policies)) return false;
    return details.policies.some((p: string) => {
      const lower = p.toLowerCase().trim();
      return lower === 'defaultsubscriptionless' || lower === 'asyncdefaultsubscriptionless';
    });
  }, [details]);

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

    // Fallback for subscriptionless API with an API key header
    if (hasSubscriptionlessPolicies && hasApiKeyHeader) {
      return { name: 'API Key', params: { in: 'header', key: 'apikey' } };
    }

    return null;
  }, [gatewayApiPolicies, gatewayOperations, hasSubscriptionlessPolicies, hasApiKeyHeader]);

  // Sync display content when definition loads
  useEffect(() => {
    if (details?.type === 'GRAPHQL') {
      setActiveTab('graphql');
    } else if (details?.type === 'WS') {
      setActiveTab('websocket');
    } else if (!hasSwaggerTab) {
      if (showPublisherPoliciesTab) {
        setActiveTab('policies');
      } else if (hasSourceTab) {
        setActiveTab('source');
      } else if (hasWsdlTab) {
        setActiveTab('wsdl');
      }
    }
  }, [details, hasSwaggerTab, showPublisherPoliciesTab, hasSourceTab, hasWsdlTab]);
  const tryItOutPlugin = useMemo(() => {
    const type = (details?.type || '').toUpperCase();
    const isSoap = type === 'SOAP';
    const isAsync = isAsyncType(type);

    const isWso2Api = !isDiscovered && !skipKeyGeneration;

    const canTry =
      isDeployed && 
      !isSoap && 
      (!isWso2Api || hasSubscriptionlessPolicies) && 
      (!isDiscovered || skipKeyGeneration);
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
  }, [isDeployed, isApiPlatform, details, isDiscovered, hasSubscriptionlessPolicies, skipKeyGeneration]);

  if (!apiId) return null;

  const isLoading = isDefinitionLoading;

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
      {/* Progressive loading bar for background API requests */}
      {!isLoading && !isPlaceholder && (isTokenLoading || isRevisionsLoading) && (
        <Box style={{ position: 'relative', marginTop: '-8px', marginBottom: '8px' }}>
          <LinearProgress style={{ height: 2 }} color="primary" />
        </Box>
      )}

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
              {details?.type === 'GRAPHQL' && (
                <Tab
                  id="tab-graphql-console"
                  label="GraphQL Console"
                  value="graphql"
                  className={classes.tabRoot}
                />
              )}
              {details?.type === 'WS' && (
                <Tab
                  id="tab-websocket-console"
                  label="WebSocket Console"
                  value="websocket"
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
              {hasWsdlTab && (
                <Tab
                  id="tab-wsdl"
                  label="WSDL"
                  value="wsdl"
                  className={classes.tabRoot}
                />
              )}
            </Tabs>
          </Box>

          {/* Tab Content: SwaggerUI or Operations List */}
          {activeTab === 'swagger' && hasSwaggerTab && (
            <div className={classes.root}>
              <Box style={{ paddingLeft: '20px', paddingRight: '20px' }}>
                {/* API Key Display and Regeneration */}
                {isDeployed && !isDiscovered && !skipKeyGeneration && hasSubscriptionlessPolicies && hasApiKeyHeader && (
                  <Wso2ApiAuthSection
                    manualKeyInput={manualKeyInput}
                    setManualKeyInput={setManualKeyInput}
                    applyManualKey={applyManualKey}
                    isModalOpen={isModalOpen}
                    setIsModalOpen={setIsModalOpen}
                    customKeyName={customKeyName}
                    setCustomKeyName={setCustomKeyName}
                    generatedKey={generatedKey}
                    setGeneratedKey={setGeneratedKey}
                    apiClient={apiClient}
                    apiId={apiId!}
                    isKeyLoading={isKeyLoading}
                  />
                )}



                {/* Gateway Server URL Display (hidden for HTTP/HTTP_AI since Swagger UI displays it) */}
                {showGatewayUrlDisplay && (
                  <Wso2GatewayUrlDisplay gatewayUrls={gatewayUrls} />
                )}
              </Box>

              {hasOperationsOnly ? (
                <Wso2OperationsList
                  operations={gatewayOperations}
                  apiKey={apiKey ?? undefined}
                  externalApiKey={externalApiKey}
                  apiKeyAuthPolicy={apiKeyAuthPolicy}
                  serverUrl={gatewayUrls[0]?.url}
                />
              ) : (
                <Box p={2}>
                  <Wso2SwaggerConsole
                    key={`swagger-ui-${lastUpdated}-${isDeployed}`}
                    swaggerSpec={swaggerSpec}
                    tryItOutPlugin={tryItOutPlugin}
                    apiKeyRef={apiKeyRef}
                    externalApiKey={externalApiKey}
                    apiKeyAuthPolicy={apiKeyAuthPolicy}
                  />
                </Box>
              )}
            </div>
          )}

          {/* Tab Content: GraphQL Console */}
          {activeTab === 'graphql' && details?.type === 'GRAPHQL' && (
            <div className={classes.root}>
              <Box style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                {/* API Key Display and Regeneration */}
                {isDeployed && !isDiscovered && !skipKeyGeneration && hasSubscriptionlessPolicies && hasApiKeyHeader && (
                  <Wso2ApiAuthSection
                    manualKeyInput={manualKeyInput}
                    setManualKeyInput={setManualKeyInput}
                    applyManualKey={applyManualKey}
                    isModalOpen={isModalOpen}
                    setIsModalOpen={setIsModalOpen}
                    customKeyName={customKeyName}
                    setCustomKeyName={setCustomKeyName}
                    generatedKey={generatedKey}
                    setGeneratedKey={setGeneratedKey}
                    apiClient={apiClient}
                    apiId={apiId!}
                    isKeyLoading={isKeyLoading}
                  />
                )}


              </Box>

              <Wso2GraphQLConsole
                definition={definition}
                gatewayUrls={gatewayUrls}
                apiKeyRef={apiKeyRef}
                externalApiKey={externalApiKey}
                apiKeyAuthPolicy={apiKeyAuthPolicy}
                isDeployed={isDeployed}
              />
            </div>
          )}

          {/* Tab Content: WebSocket Console */}
          {activeTab === 'websocket' && details?.type === 'WS' && (
            <div className={classes.root}>
              <Box style={{ paddingLeft: '8px', paddingRight: '8px' }}>
                {/* API Key Display and Regeneration */}
                {isDeployed && !isDiscovered && !skipKeyGeneration && hasSubscriptionlessPolicies && hasApiKeyHeader && (
                  <Wso2ApiAuthSection
                    manualKeyInput={manualKeyInput}
                    setManualKeyInput={setManualKeyInput}
                    applyManualKey={applyManualKey}
                    isModalOpen={isModalOpen}
                    setIsModalOpen={setIsModalOpen}
                    customKeyName={customKeyName}
                    setCustomKeyName={setCustomKeyName}
                    generatedKey={generatedKey}
                    setGeneratedKey={setGeneratedKey}
                    apiClient={apiClient}
                    apiId={apiId!}
                    isKeyLoading={isKeyLoading}
                  />
                )}


              </Box>

              <Wso2WebSocketConsole
                operations={gatewayOperations}
                gatewayUrls={gatewayUrls}
                apiKeyRef={apiKeyRef}
                externalApiKey={externalApiKey}
                apiKeyAuthPolicy={apiKeyAuthPolicy}
                isDeployed={isDeployed}
              />
            </div>
          )}

          {/* Tab Content: Console (Try it out for Operations-only APIs) */}
          {activeTab === 'console' && hasConsoleTab && (
            <div className={classes.root}>
              <div style={{ padding: '16px', borderRadius: '4px' }}>
                <Wso2SwaggerConsole
                  key={`swagger-console-${lastUpdated}-${isDeployed}`}
                  swaggerSpec={swaggerSpec}
                  tryItOutPlugin={tryItOutPlugin}
                  apiKeyRef={apiKeyRef}
                  externalApiKey={externalApiKey}
                  apiKeyAuthPolicy={apiKeyAuthPolicy}
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

          {/* Tab Content: WSDL View */}
          {activeTab === 'wsdl' && hasWsdlTab && (
            <Box p={4} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
              <Typography variant="h6" gutterBottom>
                WSDL Definition
              </Typography>
              <Typography variant="body2" color="textSecondary" paragraph align="center">
                Download the WSDL definition for this SOAP API. The downloaded file may be a single WSDL file or a ZIP archive containing multiple schema files.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={handleDownloadWsdl}
                disabled={isWsdlDownloading}
                startIcon={isWsdlDownloading ? <CircularProgress size={20} /> : undefined}
              >
                {isWsdlDownloading ? 'Downloading...' : 'Download WSDL'}
              </Button>
            </Box>
          )}
        </>
      )}
    </InfoCard>
  );
};
