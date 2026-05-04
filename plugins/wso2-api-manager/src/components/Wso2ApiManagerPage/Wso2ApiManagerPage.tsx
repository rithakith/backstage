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
} from '@material-ui/core';
import RefreshIcon from '@material-ui/icons/Refresh';
import {
  Content,
  ContentHeader,
  EmptyState,
  Header,
  Page,
  SupportButton,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import { useApi, configApiRef } from '@backstage/core-plugin-api';
import { catalogApiRef } from '@backstage/plugin-catalog-react';
import Link from '@material-ui/core/Link';
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
}));

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
  if (!t || t === 'self-hosted' || t === 'apiplatform') return 'Apiplatform';
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

  // 3. Check self-hosted gateway endpoints
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
    addGateway(discoveredFrom, discoveredFrom, 'Self-hosted');
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
  const [syncStartTime] = useState(Date.now());
  const [isTimedOut, setIsTimedOut] = useState(false);

  // Get the user's Asgardeo OAuth access token from the existing login session
  useAsync(async () => {
    console.log('🔑 [WSO2-Frontend] Attempting to retrieve Asgardeo OAuth token from session...');
    try {
      const t = await oauthApi.getAccessToken(
        ['openid', 'profile', 'email', 'apim:api_view'],
        { optional: true },
      );
      if (t) {
        console.log('✅ [WSO2-Frontend] Asgardeo OAuth token retrieved from session');
      } else {
        console.warn('⚠️ [WSO2-Frontend] No OAuth token in session');
      }
    } catch (error) {
      console.error('❌ [WSO2-Frontend] Failed to get Asgardeo OAuth token:', error);
    }
  }, [oauthApi]);

  const gatewaysState = useAsyncRetry(async () => {
    try {
      const token = await oauthApi.getAccessToken(
        ['openid', 'profile', 'email', 'apim:api_view'],
        { optional: true },
      );
      return await wso2Api.getGateways(token);
    } catch (error) {
      console.error('❌ [WSO2-Frontend] Failed to fetch gateways:', error);
      throw error;
    }
  }, [wso2Api, oauthApi]);



  const catalogState = useAsyncRetry(async () => {
    // Fetch all API entities from the catalog (increase limit to ensure we get everything)
    const response = await catalogApi.getEntities({
      filter: { kind: 'API' },
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
      const isGatewayDiscovered = !!ann['wso2-gateway.com/api-id'] || ann['wso2.com/api-discovery-type'] === 'self-hosted-gateway';
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

  // Map the single catalog state to the three expected list states
  const apiListState = {
    loading: catalogState.loading || gatewaysState.loading,
    value: useMemo(() => {
      if (!catalogState.value?.apis) return undefined;

      // Start with Catalog APIs
      const combinedApis = [...catalogState.value.apis];
      const apiMap = new Map(combinedApis.map(a => [a.id, a]));

      let liveCount = 0;
      let mergedCount = 0;

      // Merge in Live Discovery APIs from gateways
      if (gatewaysState.value) {
        gatewaysState.value.forEach((gw: any) => {
          if (gw.discoveredApis) {
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
    error: catalogState.error || gatewaysState.error,
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
              href={`/catalog/${ns}/api/${name}`}
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
              href={`/catalog/${ns}/api/${name}`}
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

  // Automatically retry fetching if the list is empty (polling every 15 seconds)
  useEffect(() => {
    let interval: NodeJS.Timeout;
    const hasApis = apiListState.value?.apis && apiListState.value.apis.length > 0;

    // Only poll if there's no error, no APIs found yet, and we haven't timed out
    if (!apiListState.loading && !apiListState.error && !hasApis && !isTimedOut) {
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
  }, [apiListState.loading, apiListState.error, apiListState.value?.apis?.length, isTimedOut, syncTimeout, syncStartTime]);

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
              href={`/catalog/${ns}/api/${name}`}
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
          <SupportButton>
            This view lists APIs from WSO2 API Manager.
          </SupportButton>

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
          </Tabs>
        </Box>

        {tabValue === 0 && (
          <>
            {apiListState.loading && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10}>
                <CircularProgress size={50} thickness={4} style={{ color: '#ff5000' }} />
                <Box mt={2}>
                  <Typography variant="h6" color="textSecondary">
                    Fetching APIs from WSO2...
                  </Typography>
                </Box>
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
                    setIsTimedOut(false);
                    apiListState.retry();
                  }}
                  style={{ marginTop: '16px' }}
                >
                  Retry Now
                </Button>
              </WarningPanel>
            )}
            {!apiListState.loading && !isTimedOut && (!apiListState.value?.apis || apiListState.value.apis.length === 0) && (
              <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" my={10} textAlign="center">
                <CircularProgress size={60} thickness={2} style={{ color: '#ff5000', opacity: 0.6 }} />
                <Box mt={3} maxWidth={600}>
                  <Typography variant="h5" gutterBottom style={{ fontWeight: 500 }}>
                    Synchronizing Catalog...
                  </Typography>
                  <Typography variant="body1" color="textSecondary">
                    We're currently discovering APIs from your WSO2 environments.
                    If you've just configured the provider, this may take a few moments to populate.
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

      </Content>


    </Page>
  );
};
