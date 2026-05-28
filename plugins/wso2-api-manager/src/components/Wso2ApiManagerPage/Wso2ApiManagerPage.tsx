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

import { useMemo, useState, useEffect } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
  makeStyles,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Typography,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Card,
  CardContent,
  Divider,
  Chip,
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import LinkIcon from '@material-ui/icons/Link';
import PowerSettingsNewIcon from '@material-ui/icons/PowerSettingsNew';
import SyncIcon from '@material-ui/icons/Sync';
import {
  Content,
  ContentHeader,
  Header,
  Page,
  Table,
  TableColumn,
  WarningPanel,
  StatusError,
  StatusOK,
  StatusPending,
  InfoCard,
  Link,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import {
  Wso2ApiSummary,
  Wso2ApiProductSummary,
  Wso2McpSummary,
  wso2AuthApiRef,
  wso2ApiManagerApiRef,
} from '../../api';

// Write permissions are currently disabled and hardcoded to false


// ─── Styles ────────────────────────────────────────────────────────────────
const useStyles = makeStyles(_theme => ({
  root: {
    '& .MuiButton-containedPrimary': {
      backgroundColor: '#ff5000',
      color: '#fff',
      '&:hover': {
        backgroundColor: '#e04600',
      },
    },
  },
  healthCard: {
    height: '100%',
    transition: 'all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    '&:hover': {
      transform: 'translateY(-10px) scale(1.02)',
      boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
    },
    background: 'linear-gradient(135deg, #ffffff 0%, #f5f7fa 100%)',
    border: '1px solid #d1d9e6',
    borderRadius: '24px',
    boxShadow: '8px 8px 16px #d1d9e6, -8px -8px 16px #ffffff',
    overflow: 'hidden',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      bottom: 0,
      width: '6px',
      background: 'linear-gradient(180deg, #ff5000, #ff8c00)',
    },
  },
  healthHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: _theme.spacing(3),
    '& h6': {
      fontWeight: 800,
      color: '#000000', // Solid black
      letterSpacing: '-0.02em',
      fontSize: '1.25rem',
    },
  },
  cardLabel: {
    color: '#4a5568', // Dark gray
    fontWeight: 600,
    fontSize: '0.9rem',
    marginBottom: '4px',
  },
  statusOnline: {
    color: '#ffffff',
    backgroundColor: '#1b5e20', // Even darker green
    padding: '6px 16px',
    borderRadius: '16px',
    fontWeight: 900,
    textTransform: 'uppercase',
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
    display: 'inline-flex',
    alignItems: 'center',
    boxShadow: '0 6px 12px rgba(27, 94, 32, 0.4)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
  },
  statusOffline: {
    color: '#ffffff',
    backgroundColor: '#b71c1c', // Even darker red
    padding: '6px 16px',
    borderRadius: '16px',
    fontWeight: 900,
    textTransform: 'uppercase',
    fontSize: '0.8rem',
    letterSpacing: '0.1em',
    display: 'inline-flex',
    alignItems: 'center',
    boxShadow: '0 6px 12px rgba(183, 28, 28, 0.4)',
    border: '2px solid rgba(255, 255, 255, 0.2)',
  },
  configUrl: {
    fontFamily: '"Fira Code", "Source Code Pro", monospace',
    fontSize: '0.85rem',
    wordBreak: 'break-all',
    color: '#1a202c', 
    backgroundColor: '#f1f5f9', 
    padding: '14px 18px',
    borderRadius: '14px',
    marginTop: '10px',
    border: '2px solid #cbd5e0',
    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.08)',
    fontWeight: 600,
  },
  refetchButton: {
    background: 'linear-gradient(90deg, #ff5000 0%, #ff8c00 100%)',
    color: 'white',
    '&:hover': {
      background: 'linear-gradient(90deg, #e04600 0%, #e07b00 100%)',
      boxShadow: '0 10px 20px rgba(255, 80, 0, 0.4)',
    },
    borderRadius: '40px',
    padding: '12px 40px',
    fontWeight: 800,
    textTransform: 'none',
    fontSize: '1.1rem',
    boxShadow: '0 6px 15px rgba(255, 80, 0, 0.3)',
    transition: 'all 0.3s ease',
  },
  infoCardRoot: {
    borderRadius: '24px',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    border: '1px solid #e2e8f0',
    overflow: 'hidden',
    '& .MuiCardHeader-root': {
      background: '#2d3748', // Dark background for header
      borderBottom: '1px solid #e2e8f0',
      padding: '20px 24px',
      '& .MuiCardHeader-title': {
        fontWeight: 800,
        color: '#ffffff', // White text for header
      }
    },
  },
  debugInfo: {
     fontSize: '0.75rem',
     color: '#718096',
     marginTop: '8px',
     fontStyle: 'italic',
  }
}));

// ─── Health Tab Component ──────────────────────────────────────────────────
const HealthTab = () => {
  const classes = useStyles();
  const wso2Api = useApi(wso2ApiManagerApiRef);
  const oauthApi = useApi(wso2AuthApiRef);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);

  const healthState = useAsync(async () => {
    try {
      const token = await oauthApi.getAccessToken(['openid', 'profile', 'email', 'apim:api_view'], { optional: true });
      return await wso2Api.getHealth(token);
    } catch (error) {
      console.error('❌ [WSO2-Health] Failed to fetch health:', error);
      throw error;
    }
  }, [wso2Api, oauthApi]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const token = await oauthApi.getAccessToken(['openid', 'profile', 'email', 'apim:api_view'], { optional: true });
      const result = await wso2Api.refreshCatalog(token);
      setRefreshMessage(result.message);
    } catch (error: any) {
      setRefreshMessage(`Error: ${error.message}`);
    } finally {
      setRefreshing(false);
    }
  };

  if (healthState.loading) {
    return (
      <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10}>
        <CircularProgress size={50} thickness={4} style={{ color: '#ff5000' }} />
        <Box mt={2}>
          <Typography variant="h6" color="textSecondary">Checking system health...</Typography>
        </Box>
      </Box>
    );
  }

  if (healthState.error) {
    return <WarningPanel title="Health Check Failed" message={healthState.error.message} />;
  }

  const { 
    apim = { status: 'Offline', baseUrl: '' }, 
    platform = [], 
    configs = [] 
  } = (healthState.value || {}) as any;

  return (
    <Box mt={4} p={4} borderRadius={24} style={{ backgroundColor: '#edf2f7', border: '1px solid #e2e8f0' }}>
      <Grid container spacing={4}>
        {/* APIM Gateway Card */}
        <Grid item xs={12} md={6}>
          <Card className={classes.healthCard}>
            <CardContent>
              <Box className={classes.healthHeader}>
                <Typography variant="h6">WSO2 APIM Gateway</Typography>
                {apim?.status === 'Online' ? <StatusOK /> : <StatusError />}
              </Box>
              <Divider />
              <Box mt={3}>
                <Typography className={classes.cardLabel}>Base URL:</Typography>
                <Typography className={classes.configUrl}>{apim?.baseUrl}</Typography>
              </Box>
              <Box mt={3} display="flex" alignItems="center">
                <Typography className={classes.cardLabel} style={{ marginBottom: 0, marginRight: 12 }}>System Status:</Typography>
                <Typography className={apim?.status === 'Online' ? classes.statusOnline : classes.statusOffline}>
                  {apim?.status}
                </Typography>
              </Box>
              {apim?.status === 'Online' && (
                <Box mt={4} display="flex" flexDirection="column" alignItems="center">
                  <Button
                    variant="contained"
                    className={classes.refetchButton}
                    startIcon={refreshing ? <CircularProgress size={20} color="inherit" /> : <SyncIcon />}
                    onClick={handleRefresh}
                    disabled={refreshing}
                  >
                    {refreshing ? 'Refetching...' : 'Refetch Catalog'}
                  </Button>
                  {refreshMessage && (
                    <Box mt={2}>
                      <Typography variant="body2" color="primary" style={{ fontWeight: 600 }}>{refreshMessage}</Typography>
                    </Box>
                  )}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* API Platform Gateways */}
        <Grid item xs={12} md={6}>
          <Card className={classes.healthCard}>
            <CardContent>
              <Box className={classes.healthHeader}>
                <Typography variant="h6">API Platform Gateways</Typography>
                <PowerSettingsNewIcon style={{ color: platform.length > 0 && platform.every((p: any) => p?.status === 'Online') ? '#2e7d32' : '#ed8936', fontSize: 28 }} />
              </Box>
              <Divider />
              <Box mt={3}>
                {platform.length === 0 ? (
                  <Typography variant="body1" style={{ color: '#718096' }}>No self-hosted gateways configured in app-config.</Typography>
                ) : (
                  platform.map((p: any, i: number) => (
                    <Box key={i} mb={3} p={2} bgcolor="#f7fafc" borderRadius={16} border="1px solid #e2e8f0">
                      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <Typography variant="subtitle1" style={{ fontWeight: 700, color: '#2d3748' }}>{p?.name} <span style={{ fontSize: '0.8rem', opacity: 0.7 }}>({p?.type})</span></Typography>
                        {p?.status === 'Online' ? <StatusOK /> : <StatusError />}
                      </Box>
                      <Typography className={classes.configUrl}>{p?.urls?.join(', ')}</Typography>
                      <Box mt={2} display="flex" alignItems="center">
                         <Chip 
                            size="small" 
                            label={p?.discoveryAuthPresent ? "Auth Configured" : "No Auth"} 
                            style={{ 
                                backgroundColor: p?.discoveryAuthPresent ? '#e6fffa' : '#fff5f5',
                                color: p?.discoveryAuthPresent ? '#234e52' : '#c53030',
                                fontWeight: 700,
                                fontSize: '0.7rem'
                            }} 
                         />
                         <Typography className={classes.debugInfo} style={{ marginLeft: 12, marginTop: 0 }}>
                            Status: {p?.status}
                         </Typography>
                      </Box>
                    </Box>
                  ))
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Configuration Endpoints */}
        <Grid item xs={12}>
          <InfoCard title="Infrastructure Configuration Status" className={classes.infoCardRoot}>
            <Box p={3}>
              <Grid container spacing={3}>
                {configs.map((c: any, i: number) => (
                  <Grid item xs={12} md={4} key={i}>
                    <Box p={2} border="1px solid #e2e8f0" borderRadius={16} display="flex" flexDirection="column" height="100%" bgcolor="#ffffff">
                      <Box display="flex" alignItems="center" mb={2}>
                        <LinkIcon style={{ marginRight: 12, color: '#ff5000', fontSize: 20 }} />
                        <Typography variant="subtitle2" style={{ fontWeight: 700, color: '#2d3748' }}>{c?.name}</Typography>
                        <Box flexGrow={1} />
                        <Chip 
                          size="small" 
                          label={c?.status} 
                          style={{ 
                            backgroundColor: c?.status === 'Online' ? '#e8f5e9' : '#ffebee',
                            color: c?.status === 'Online' ? '#2e7d32' : '#c62828',
                            fontWeight: 800,
                            fontSize: '0.7rem'
                          }} 
                        />
                      </Box>
                      <Typography className={classes.cardLabel}>Endpoint URL:</Typography>
                      <Typography className={classes.configUrl} style={{ fontSize: '0.75rem' }}>{c?.url}</Typography>
                    </Box>
                  </Grid>
                ))}
              </Grid>
            </Box>
          </InfoCard>
        </Grid>
      </Grid>
    </Box>
  );
};

/**
 * Normalizes a name for use as a Backstage entity name.
 * Matches the logic in Wso2ApiEntityProvider.ts
 */
function normalizeEntityName(name?: string): string {
  return (name || '').replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

/**
 * Normalizes gateway types for consistent display.
 */
function normalizeGatewayType(type?: string): string {
  const t = (type || '').toLowerCase().trim();
  if (t === 'wso2/synapse' || t === 'synapse' || t === 'wso2' || t === 'regular') return 'WSO2';
  if (!t || t === 'api-platform' || t === 'apiplatform') return 'Apiplatform';
  // Capitalize first letter (e.g., kong -> Kong, apigee -> Apigee)
  return t.charAt(0).toUpperCase() + t.slice(1);
}

interface Wso2GatewayInfo {
  name: string;
  displayName: string;
  gatewayType: string;
}

/**
 * Extracts gateway information from annotations.
 */
function extractGateways(annotations: Record<string, string>): Wso2GatewayInfo[] {
  const result: Wso2GatewayInfo[] = [];
  const processedNames = new Set<string>();

  const addGateway = (name: string, displayName: string, type: string) => {
    if (processedNames.has(name)) return;
    result.push({
      name,
      displayName: displayName || name || 'Unknown',
      gatewayType: normalizeGatewayType(type)
    });
    processedNames.add(name);
  };

  // 1. Check raw JSON for gateway info (High priority source)
  const rawJsonStr = annotations['wso2.com/api-raw-json'];
  if (rawJsonStr) {
    try {
      const raw = JSON.parse(rawJsonStr);
      // If the raw JSON has gateway info, use it
      if (raw.gatewayType || raw.gatewayVendor) {
        addGateway('publisher-gateway', 'Default', raw.gatewayType || raw.gatewayVendor);
      }
    } catch (e) {
      console.error('Failed to parse api-raw-json in extractGateways:', e);
    }
  }

  // 2. Check standard and gateway-discovered endpoints
  const endpointsStr = annotations['wso2.com/api-endpoints'] || annotations['wso2-gateway.com/api-endpoints'];
  if (endpointsStr && endpointsStr !== '[]') {
    try {
      const endpoints = JSON.parse(endpointsStr);
      if (Array.isArray(endpoints)) {
        endpoints.forEach((ep: any) => {
          addGateway(ep.environmentName || ep.name, ep.displayName || ep.environmentName || ep.name, ep.gatewayType);
        });
      }
    } catch (e) {
      console.error('Failed to parse api-endpoints:', e);
    }
  }

  // 3. Check api platform gateway endpoints
  const gwEndpointsStr = annotations['wso2.com/gateway-endpoints'];
  if (gwEndpointsStr && gwEndpointsStr !== '[]') {
    try {
      const endpoints = JSON.parse(gwEndpointsStr);
      if (Array.isArray(endpoints)) {
        endpoints.forEach((ep: any) => {
          addGateway(ep.environmentName || ep.name, ep.displayName || ep.environmentName || ep.name, ep.gatewayType);
        });
      }
    } catch (e) {
      console.error('Failed to parse gateway-endpoints:', e);
    }
  }

  // 4. Fallback for older discovered APIs
  const discoveredFrom = annotations['wso2-gateway.com/discovered-from'];
  if (discoveredFrom) {
    addGateway(discoveredFrom, discoveredFrom, 'api-platform');
  }

  // 5. Ultimate Fallback: if we have a vendor label but no specific endpoints/gateways found yet
  if (result.length === 0) {
    const vendor = annotations['wso2.com/api-gateway-vendor'];
    if (vendor) {
      addGateway('default', 'Default', vendor);
    }
  }

  return result;
}

// ─── Main Page ────────────────────────────────────────────────────────────
export const Wso2ApiManagerPage = () => {
  const classes = useStyles();
  const oauthApi = useApi(wso2AuthApiRef);
  const catalogApi = useApi(catalogApiRef);
  const wso2Api = useApi(wso2ApiManagerApiRef);
  const configApi = useApi(configApiRef);
  const syncTimeout = configApi.getOptionalNumber('wso2ApiManager.catalogSyncTimeoutSeconds') || 60;
  // Write permissions are currently disabled

  const [tabValue, setTabValue] = useState(0);
  const [selectedGateway, setSelectedGateway] = useState('all');
  const [syncStartTime, setSyncStartTime] = useState(Date.now());
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isTimedOut, setIsTimedOut] = useState(false);

  const gatewaysState = useAsyncRetry(async () => {
    try {
      const token = await oauthApi.getAccessToken(
        ['openid', 'profile', 'email', 'apim:api_view'],
        { optional: true },
        // todo ritz
      );
      return await wso2Api.getGateways(token);
    } catch (error) {
      console.error('❌ [WSO2-Frontend] Failed to fetch gateways:', error);
      throw error;
    }
  }, [wso2Api, oauthApi]);



  const catalogState = useAsyncRetry(async () => {
    // Fetch all API entities from the catalog (increase limit to ensure we get everything)
    // Only retrieve necessary metadata and annotations to avoid loading large specs (like OpenAPI definitions)
    const response = await catalogApi.getEntities({
      filter: { kind: 'API' },
      fields: ['metadata.name', 'metadata.namespace', 'metadata.annotations'],
    });

    const allEntities = response.items;

    // Filter to regular APIs (those with wso2-id but NOT products/mcps)
    const apis = allEntities.filter(e => {
      const ann = e.metadata.annotations || {};
      return (ann['wso2.com/api-id'] || ann['wso2-gateway.com/api-id']) &&
        ann['wso2.com/is-api-product'] !== 'true' &&
        ann['wso2.com/is-mcp-server'] !== 'true';
    }).map(e => {
      const ann = e.metadata.annotations || {};
      const displayName = ann['wso2.com/api-name'] || ann['wso2-gateway.com/api-name'] || e.metadata.name;
      const isGatewayDiscovered = !!ann['wso2-gateway.com/api-id'] || ann['wso2.com/api-discovery-type'] === 'api-platform';
      return {
        id: (ann['wso2.com/api-id'] || ann['wso2-gateway.com/api-id']) as string,
        name: displayName,
        displayName,
        entityName: e.metadata.name,
        namespace: e.metadata.namespace,
        version: (ann['wso2.com/api-version'] || ann['wso2-gateway.com/api-version']) as string,
        context: (ann['wso2.com/api-context'] || ann['wso2-gateway.com/api-context']) as string,
        provider: (ann['wso2.com/api-provider'] || 'Gateway') as string,
        lifeCycleStatus: (ann['wso2.com/api-lifecycle-status'] || 'Published') as string,
        type: (ann['wso2.com/api-type'] || 'HTTP') as string,
        isDiscovered: ann['wso2.com/is-discovered'] === 'true' || isGatewayDiscovered,
        source: isGatewayDiscovered ? 'Gateway' : 'Publisher',
        gatewayVendor: ann['wso2.com/api-gateway-vendor'],
        _rawAnnotations: ann, // Store for debug column
        gateways: extractGateways(ann),
      };
    });

    // Filter to API Products
    const apiProducts = allEntities.filter(e =>
      e.metadata.annotations?.['wso2.com/is-api-product'] === 'true'
    ).map(e => ({
      id: e.metadata.annotations?.['wso2.com/api-id'] as string,
      name: e.metadata.annotations?.['wso2.com/api-name'] || e.metadata.name,
      namespace: e.metadata.namespace,
      version: e.metadata.annotations?.['wso2.com/api-version'] as string,
      context: e.metadata.annotations?.['wso2.com/api-context'] as string,
      provider: e.metadata.annotations?.['wso2.com/api-provider'] as string,
      lifeCycleStatus: e.metadata.annotations?.['wso2.com/api-lifecycle-status'] as string,
      type: 'API_PRODUCT',
      isDiscovered: e.metadata.annotations?.['wso2.com/is-discovered'] === 'true',
      gateways: extractGateways(e.metadata.annotations || {}),
      _rawAnnotations: e.metadata.annotations || {},
    }));

    // Filter to MCP Servers
    const mcpServers = allEntities.filter(e =>
      e.metadata.annotations?.['wso2.com/is-mcp-server'] === 'true'
    ).map(e => ({
      id: e.metadata.annotations?.['wso2.com/api-id'] as string,
      name: e.metadata.annotations?.['wso2.com/api-name'] || e.metadata.name,
      namespace: e.metadata.namespace,
      version: e.metadata.annotations?.['wso2.com/api-version'] as string,
      context: e.metadata.annotations?.['wso2.com/api-context'] as string,
      provider: e.metadata.annotations?.['wso2.com/api-provider'] as string,
      lifeCycleStatus: e.metadata.annotations?.['wso2.com/api-lifecycle-status'] as string,
      isDiscovered: e.metadata.annotations?.['wso2.com/is-discovered'] === 'true',
    }));

    return { apis, apiProducts, mcpServers };
  }, [catalogApi, tabValue]);

  // Derive offline gateways
  const offlineGateways = useMemo(() => {
    return gatewaysState.value?.filter((gw: any) => gw.status === 'Offline') || [];
  }, [gatewaysState.value]);

  const apiListState = {
    // Only block on catalog loading — gateway failures should not prevent APIM APIs from showing.
    // Gateway errors are surfaced separately via the offlineGateways warning panel.
    loading: catalogState.loading,
    value: useMemo(() => {
      if (!catalogState.value?.apis) return undefined;

      // Start with Catalog APIs (always available, independent of gateway state)
      const combinedApis = [...catalogState.value.apis];
      const apiMap = new Map(combinedApis.map(a => [a.id, a]));

      let liveCount = 0;
      let mergedCount = 0;

      // Merge in Live Discovery APIs from online gateways (best-effort — skip offline ones)
      if (gatewaysState.value) {
        gatewaysState.value.forEach((gw: any) => {
          if (gw.discoveredApis && gw.status !== 'Offline') {
            gw.discoveredApis.forEach((liveApi: any) => {
              liveCount++;
              const existing = apiMap.get(liveApi.id);
              if (existing) {
                mergedCount++;
                // Update existing with gateway info if missing
                if (!existing.gateways.some((g: any) => g.name === gw.name)) {
                  existing.gateways.push({
                    name: gw.name,
                    displayName: gw.displayName || gw.name,
                    gatewayType: normalizeGatewayType(gw.gatewayType || gw.type)
                  });
                }
                if (existing.source !== 'Gateway' && existing.source !== 'Both') {
                  existing.source = 'Both';
                }
              } else {
                // Add new live-only API
                const apiName = liveApi.displayName || liveApi.name || liveApi.id || 'unknown';
                const newApi = {
                  id: liveApi.id,
                  name: apiName,
                  displayName: apiName,
                  entityName: `${normalizeEntityName(apiName)}-${normalizeEntityName(gw.name)}`,
                  namespace: 'wso2-gateways',
                  version: liveApi.version || '1.0.0',
                  context: liveApi.context || '/',
                  type: liveApi.type || 'HTTP',
                  lifeCycleStatus: 'Discovered',
                  // ritz check if this is used.
                  isDiscovered: true,
                  source: 'Gateway (Live)',
                  gateways: [{
                    name: gw.name,
                    displayName: gw.displayName || gw.name,
                    gatewayType: normalizeGatewayType(gw.gatewayType || gw.type)
                  }],
                  provider: 'Gateway',
                };
                combinedApis.push(newApi as any);
                apiMap.set(newApi.id, newApi as any);
              }
            });
          }
        });
      }

      console.log(`📊 [WSO2-Frontend] API Merge: Catalog=${catalogState.value.apis.length}, LiveFound=${liveCount}, LiveMerged=${mergedCount}, Total=${combinedApis.length}`);

      return { apis: combinedApis };
    }, [catalogState.value, gatewaysState.value]),
    // Gateway errors are surfaced as warnings (offlineGateways panel), not as blocking errors.
    // Only treat catalog errors as blocking — gateways are supplemental.
    error: catalogState.error,
    retry: () => { catalogState.retry(); gatewaysState.retry(); }
  };

  const apiProductListState = {
    loading: catalogState.loading,
    value: catalogState.value ? { apiProducts: catalogState.value.apiProducts, pagination: { total: catalogState.value.apiProducts.length, offset: 0, limit: 1000 } } : undefined,
    error: catalogState.error,
    retry: catalogState.retry
  };

  const mcpListState = {
    loading: catalogState.loading,
    value: catalogState.value ? { mcpServers: catalogState.value.mcpServers, pagination: { total: catalogState.value.mcpServers.length, offset: 0, limit: 1000 } } : undefined,
    error: catalogState.error,
    retry: catalogState.retry
  };

  // Derive all unique gateway names for the filter dropdown
  const availableGateways = useMemo(() => {
    const gateways = new Set<string>();

    // 1. Add types from APIs in the current list
    apiListState.value?.apis.forEach(api => {
      api.gateways?.forEach((gw: any) => {
        gateways.add(gw.gatewayType);
      });
    });

    // 2. Add types from all discovered gateways (even if they have no APIs)
    gatewaysState.value?.forEach((gw: any) => {
      gateways.add(normalizeGatewayType(gw.gatewayType || gw.type));
    });

    return Array.from(gateways).sort();
  }, [apiListState.value?.apis, gatewaysState.value]);

  // Filter APIs based on selected gateway
  const filteredApis = useMemo(() => {
    const apis = apiListState.value?.apis || [];
    if (selectedGateway === 'all') return apis;
    return apis.filter(api =>
      api.gateways?.some((gw: any) => gw.gatewayType === selectedGateway)
    );
  }, [apiListState.value?.apis, selectedGateway]);

  // Filter API Products based on selected gateway
  const filteredApiProducts = useMemo(() => {
    return apiProductListState.value?.apiProducts || [];
  }, [apiProductListState.value?.apiProducts]);



  const columns = useMemo<TableColumn<Wso2ApiSummary>[]>(
    () => [
      {
        title: 'Name',
        field: 'name',
        render: rowData => {
          const ns = rowData.namespace || 'default';
          const name = rowData.entityName || normalizeEntityName(rowData.name);
          return (
            <Link
              to={`/catalog/${ns}/api/${name}`}
              style={{ fontWeight: 'bold', color: '#007acc' }}
            >
              {rowData.name}
            </Link>
          );
        },
      },
      { title: 'Version', field: 'version' },
      { title: 'Type', field: 'type' },
      {
        title: 'Gateways',
        field: 'gateways',
        render: rowData => {
          const gws = (rowData as any).gateways || [];
          if (gws.length > 0) {
            const types = Array.from(new Set(gws.map((g: any) => normalizeGatewayType(g.gatewayType))));
            return types[0];
          }
          return 'WSO2';
        }
      },
      { title: 'Lifecycle', field: 'lifeCycleStatus' },
      { title: 'Context', field: 'context' },
    ],
    [],
  );

  const productColumns = useMemo<TableColumn<Wso2ApiProductSummary>[]>(
    () => [
      {
        title: 'Name',
        field: 'name',
        render: rowData => {
          const ns = rowData.namespace || 'default';
          // API Products use the same normalization as APIs
          const name = (rowData as any).entityName || normalizeEntityName(rowData.name);
          return (
            <Link
              to={`/catalog/${ns}/api/${name}`}
              style={{ fontWeight: 'bold', color: '#007acc' }}
            >
              {rowData.name}
            </Link>
          );
        },
      },
      { title: 'Version', field: 'version' },
      { title: 'Type', field: 'type' },
      { title: 'Provided By', field: 'provider' },
      {
        title: 'Gateways',
        field: 'gateways',
        render: rowData => {
          const gws = rowData.gateways || [];
          if (gws.length > 0) {
            const types = Array.from(new Set(gws.map((g: any) => normalizeGatewayType(g.gatewayType))));
            return types[0];
          }
          return 'WSO2';
        }
      },
      {
        title: 'Debug: Raw Endpoints',
        render: rowData => {
          const ann = (rowData as any)._rawAnnotations || {};
          const val = ann['wso2.com/api-endpoints'] || ann['wso2-gateway.com/api-endpoints'];
          return <div style={{ maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={val}>{val || 'Missing'}</div>;
        }
      },
      { title: 'Lifecycle', field: 'lifeCycleStatus' },
      { title: 'Context', field: 'context' },
    ],
    [],
  );

  // Real-time progress bar ticker for catalog synchronization
  useEffect(() => {
    const hasApis = apiListState.value?.apis && apiListState.value.apis.length > 0;
    if (hasApis || isTimedOut) {
      setElapsedSeconds(0);
      return;
    }

    const timer = setInterval(() => {
      const sec = Math.round((Date.now() - syncStartTime) / 1000);
      setElapsedSeconds(sec);
      if (sec > syncTimeout) {
        setIsTimedOut(true);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [syncStartTime, syncTimeout, isTimedOut, apiListState.value?.apis?.length]);

  const progressPercent = Math.min(100, Math.round((elapsedSeconds / syncTimeout) * 100));

  // Automatically retry fetching if the list is empty (polling every 15 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const hasApis = apiListState.value?.apis && apiListState.value.apis.length > 0;
    const hasOfflineGateways = offlineGateways.length > 0;

    // Only poll if there's no error, no APIs found yet, no offline gateways, and we haven't timed out
    // If a gateway is offline, we should stop the infinite polling and show the current APIM APIs or error state.
    if (!apiListState.loading && !apiListState.error && !hasApis && !isTimedOut && !hasOfflineGateways) {
      interval = setInterval(() => {
        const elapsed = (Date.now() - syncStartTime) / 1000;
        if (elapsed > syncTimeout) {
          console.warn(`🛑 [WSO2-Frontend] Catalog sync timed out after ${syncTimeout}s`);
          setIsTimedOut(true);
        } else {
          console.log(`🔄 [WSO2-Frontend] Auto-retrying catalog fetch (${Math.round(elapsed)}s elapsed)...`);
          apiListState.retry();
        }
      }, 15000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [apiListState.loading, apiListState.error, apiListState.value?.apis?.length, isTimedOut, syncTimeout, syncStartTime, offlineGateways.length]);

  const mcpColumns = useMemo<TableColumn<Wso2McpSummary>[]>(
    () => [
      {
        title: 'Name',
        field: 'name',
        render: rowData => {
          const ns = rowData.namespace || 'default';
          const name = (rowData as any).entityName || normalizeEntityName(rowData.name);
          return (
            <Link
              to={`/catalog/${ns}/api/${name}`}
              style={{ fontWeight: 'bold', color: '#007acc' }}
            >
              {rowData.name}
            </Link>
          );
        },
      },
      { title: 'Version', field: 'version' },
      { title: 'Provided By', field: 'provider' },
      { title: 'Lifecycle', field: 'lifeCycleStatus' },
      { title: 'Context', field: 'context' },
    ],
    [],
  );


  return (
    <Page themeId="tool" className={classes.root}>
      <Header title="WSO2 API Manager" subtitle="Browse APIs and details" />
      <Content>
        <ContentHeader title="">

          <Box ml={2} minWidth={200}>
            <FormControl fullWidth variant="outlined" size="small">
              <InputLabel id="gateway-select-label">Select Gateway</InputLabel>
              <Select
                labelId="gateway-select-label"
                id="gateway-select"
                value={selectedGateway}
                label="Select Gateway"
                onChange={(e) => setSelectedGateway(e.target.value as string)}
              >
                <MenuItem value="all">
                  <span>All Gateways</span>
                </MenuItem>
                {availableGateways.map(gw => (
                  <MenuItem key={gw} value={gw}>
                    {gw}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </ContentHeader>



        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs
            value={tabValue}
            onChange={(_e, newValue) => setTabValue(newValue)}
            indicatorColor="primary"
            textColor="primary"
          >
            <Tab label="APIs" />
            <Tab label="API Products" />
            <Tab label="MCPs" />
            <Tab label="Health" />
          </Tabs>
        </Box>

        {tabValue === 0 && (
          <>
            {offlineGateways.length > 0 && (
              <Box mb={2}>
                <WarningPanel
                  title="Gateway Discovery Warning"
                  message={`Error during discovery for the following gateways: ${offlineGateways.map((g: any) => g.name).join(', ')}. They may be unreachable or offline. Displaying available APIM APIs instead.`}
                />
              </Box>
            )}
            {apiListState.loading && (!apiListState.value?.apis || apiListState.value.apis.length === 0) && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10}>
                <CircularProgress size={50} thickness={4} style={{ color: '#ff5000' }} />
                <Box mt={2}>
                  <Typography variant="h6" color="textSecondary">
                    Fetching APIs from WSO2...
                  </Typography>
                </Box>
              </Box>
            )}
            {apiListState.loading && apiListState.value?.apis && apiListState.value.apis.length > 0 && (
              <Box mb={2}>
                <LinearProgress color="primary" style={{ height: 3, borderRadius: 2 }} />
              </Box>
            )}
            {apiListState.error && (
              <WarningPanel
                title="Failed to load APIs"
                message={apiListState.error.message}
              />
            )}
            {isTimedOut && !apiListState.error && (
              <WarningPanel
                title="Sync Timed Out"
                message={`The catalog synchronization took longer than the configured timeout (${syncTimeout}s). We couldn't find any APIs in the catalog. Please check your WSO2 backend logs or verify your provider configuration.`}
              >
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    setSyncStartTime(Date.now());
                    setElapsedSeconds(0);
                    setIsTimedOut(false);
                    apiListState.retry();
                  }}
                  style={{ marginTop: '16px' }}
                >
                  Retry Now
                </Button>
              </WarningPanel>
            )}
            {!apiListState.loading && !isTimedOut && offlineGateways.length === 0 && (!apiListState.value?.apis || apiListState.value.apis.length === 0) && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10} textAlign="center">
                <CircularProgress size={60} thickness={2} style={{ color: '#ff5000', opacity: 0.6, marginBottom: '24px' }} />
                <Box mt={3} maxWidth={500} width="100%" px={3}>
                  <Typography variant="h5" gutterBottom style={{ fontWeight: 600, color: '#1a202c' }}>
                    Synchronizing Catalog...
                  </Typography>
                  <Box my={3}>
                    <LinearProgress 
                      variant="determinate" 
                      value={progressPercent} 
                      style={{ 
                        height: 8, 
                        borderRadius: 4, 
                        backgroundColor: '#e2e8f0',
                      }} 
                    />
                    <Box display="flex" justifyContent="space-between" mt={1}>
                      <Typography variant="caption" color="textSecondary">
                        {elapsedSeconds}s elapsed
                      </Typography>
                      <Typography variant="caption" color="textSecondary" style={{ fontWeight: 'bold' }}>
                        Timeout: {syncTimeout}s
                      </Typography>
                    </Box>
                  </Box>
                  <Typography variant="body1" color="textSecondary" style={{ marginBottom: '16px' }}>
                    We're currently discovering APIs from your WSO2 environments and populating the Backstage Catalog.
                    This page will update automatically once the catalog sync completes.
                  </Typography>
                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => apiListState.retry()}
                      startIcon={<RefreshIcon />}
                      disabled={apiListState.loading}
                    >
                      Refresh Now
                    </Button>
                  </Box>
                  <Box mt={2}>
                    <Typography variant="caption" color="textSecondary" style={{ fontStyle: 'italic' }}>
                      Tip: You can monitor the progress in your backend logs for "[WSO2-DISCOVERY]" messages.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
            {!apiListState.loading && !isTimedOut && offlineGateways.length > 0 && (!apiListState.value?.apis || apiListState.value.apis.length === 0) && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10} textAlign="center">
                <Box mt={3} maxWidth={600}>
                  <Typography variant="h5" gutterBottom style={{ fontWeight: 500 }}>
                    No APIs Available
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    We could not find any APIs in your catalog, and gateway discovery failed. 
                    Please check your backend logs or gateway configuration.
                  </Typography>
                  <Box mt={2}>
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => apiListState.retry()}
                      startIcon={<RefreshIcon />}
                      disabled={apiListState.loading}
                    >
                      Refresh Now
                    </Button>
                  </Box>
                  <Box mt={2}>
                    <Typography variant="caption" color="textSecondary" style={{ fontStyle: 'italic' }}>
                      Tip: You can monitor the progress in your backend logs for "[WSO2-DISCOVERY]" messages.
                    </Typography>
                  </Box>
                </Box>
              </Box>
            )}
            {apiListState.value?.apis && apiListState.value.apis.length > 0 && (
              <Table
                options={{ paging: false, search: true }}
                columns={columns}
                data={filteredApis}
              />
            )}
          </>
        )}

        {tabValue === 1 && (
          <>
            {apiProductListState.loading && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10}>
                <CircularProgress size={50} thickness={4} style={{ color: '#ff5000' }} />
                <Box mt={2}>
                  <Typography variant="h6" color="textSecondary">
                    Fetching API Products...
                  </Typography>
                </Box>
              </Box>
            )}
            {apiProductListState.error && (
              <WarningPanel
                title="Failed to load API Products"
                message={apiProductListState.error.message}
              />
            )}
            {!apiProductListState.loading && (!apiProductListState.value?.apiProducts || apiProductListState.value.apiProducts.length === 0) && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10} textAlign="center">
                <CircularProgress size={60} thickness={2} style={{ color: '#ff5000', opacity: 0.6 }} />
                <Box mt={3} maxWidth={600}>
                  <Typography variant="h5" gutterBottom style={{ fontWeight: 500 }}>
                    Discovering API Products...
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    Searching for API Products in your WSO2 environments.
                  </Typography>
                </Box>
              </Box>
            )}
            {apiProductListState.value?.apiProducts && apiProductListState.value.apiProducts.length > 0 && (
              <Table
                options={{ paging: false, search: true }}
                columns={productColumns}
                data={filteredApiProducts}
              />
            )}
          </>
        )}

        {tabValue === 2 && (
          <>
            {mcpListState.loading && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10}>
                <CircularProgress size={50} thickness={4} style={{ color: '#ff5000' }} />
                <Box mt={2}>
                  <Typography variant="h6" color="textSecondary">
                    Fetching MCP Servers...
                  </Typography>
                </Box>
              </Box>
            )}
            {mcpListState.error && (
              <WarningPanel
                title="Failed to load MCP Servers"
                message={mcpListState.error.message}
              />
            )}
            {!mcpListState.loading && (!mcpListState.value?.mcpServers || mcpListState.value.mcpServers.length === 0) && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10} textAlign="center">
                <CircularProgress size={60} thickness={2} style={{ color: '#ff5000', opacity: 0.6 }} />
                <Box mt={3} maxWidth={600}>
                  <Typography variant="h5" gutterBottom style={{ fontWeight: 500 }}>
                    Scanning for MCP Servers...
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    Syncing Model Control Plane servers from the WSO2 ecosystem.
                  </Typography>
                </Box>
              </Box>
            )}
            {mcpListState.value?.mcpServers && mcpListState.value.mcpServers.length > 0 && (
              <Table
                options={{ paging: false, search: true }}
                columns={mcpColumns}
                data={mcpListState.value.mcpServers}
              />
            )}
          </>
        )}

        {tabValue === 3 && <HealthTab />}

      </Content>


    </Page>
  );
};
