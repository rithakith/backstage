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
import { useApi } from '@backstage/core-plugin-api';
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
function normalizeEntityName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

// ─── Main Page ────────────────────────────────────────────────────────────
export const Wso2ApiManagerPage = () => {
  const classes = useStyles();
  const oauthApi = useApi(wso2AuthApiRef);
  const catalogApi = useApi(catalogApiRef);
  const wso2Api = useApi(wso2ApiManagerApiRef);
  // Write permissions are currently disabled

  const [tabValue, setTabValue] = useState(0);

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
        gateways: (() => {
            const endpointsStr = ann['wso2.com/api-endpoints'] || ann['wso2-gateway.com/api-endpoints'];
            if (endpointsStr && endpointsStr !== '[]') {
                try {
                    const endpoints = JSON.parse(endpointsStr);
                    if (Array.isArray(endpoints)) {
                        return endpoints.map((ep: any) => ({
                            name: ep.environmentName || ep.name,
                            displayName: ep.displayName || ep.environmentName || ep.name || 'Unknown',
                            gatewayType: ep.gatewayType || 'WSO2'
                        }));
                    }
                } catch (e) {
                    console.error('Failed to parse api-endpoints:', e);
                }
            }
            
            // Fallback for older discovered APIs
            const discoveredFrom = ann['wso2-gateway.com/discovered-from'];
            if (discoveredFrom) {
                return [{ name: discoveredFrom, displayName: discoveredFrom, gatewayType: 'Self-hosted' }];
            }
            
            return [];
        })(),
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
                                    gatewayType: gw.gatewayType || 'WSO2'
                                });
                            }
                            if (existing.source !== 'Gateway' && existing.source !== 'Both') {
                                existing.source = 'Both';
                            }
                        } else {
                            // Add new live-only API
                            const newApi = {
                                id: liveApi.id,
                                name: liveApi.displayName || liveApi.name,
                                displayName: liveApi.displayName || liveApi.name,
                                version: liveApi.version || '1.0.0',
                                context: liveApi.context || '/',
                                type: liveApi.type || 'HTTP',
                                lifeCycleStatus: 'Discovered',
                                isDiscovered: true,
                                source: 'Gateway (Live)',
                                gateways: [{
                                    name: gw.name,
                                    displayName: gw.displayName || gw.name,
                                    gatewayType: gw.gatewayType || 'WSO2'
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
            const vendor = (rowData as any).gatewayVendor;
            if (vendor) return vendor.toUpperCase();

            const gws = (rowData as any).gateways || [];
            if (gws.length === 0) return 'WSO2';
            
            // Fallback for older or discovered APIs
            const types = Array.from(new Set(gws.map((g: any) => g.gatewayType || 'WSO2')));
            return types.join(', ');
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
            if (gws.length === 0) return 'WSO2';
            return gws.map((g: any) => {
                const label = g.displayName || g.name;
                const type = g.gatewayType || 'WSO2';
                return `${label} - ${type}`;
            }).join(', ');
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
    if (!apiListState.loading && (!apiListState.value?.apis || apiListState.value.apis.length === 0)) {
        interval = setInterval(() => {
            console.log('🔄 [WSO2-Frontend] Auto-retrying catalog fetch...');
            apiListState.retry();
        }, 15000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [apiListState.loading, apiListState.value?.apis?.length]);
  
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
            {!apiListState.loading && (!apiListState.value?.apis || apiListState.value.apis.length === 0) && (
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
                data={apiListState.value.apis}
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
                data={apiProductListState.value.apiProducts}
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
