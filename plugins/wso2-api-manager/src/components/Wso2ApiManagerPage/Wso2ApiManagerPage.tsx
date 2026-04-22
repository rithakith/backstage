import { useMemo, useState } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
  makeStyles,
  Tabs,
  Tab,
  Box,
  CircularProgress,
  Typography,
} from '@material-ui/core';
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



  const catalogState = useAsyncRetry(async () => {
    // Fetch all API entities from the catalog (increase limit to ensure we get everything)
    const response = await catalogApi.getEntities({
      filter: { kind: 'API' },
    });

    const allEntities = response.items;

    // Filter to regular APIs (those with wso2-id but NOT products/mcps)
    const apis = allEntities.filter(e => {
      const ann = e.metadata.annotations || {};
      return ann['wso2.com/api-id'] && 
             ann['wso2.com/is-api-product'] !== 'true' && 
             ann['wso2.com/is-mcp-server'] !== 'true';
    }).map(e => ({
      id: e.metadata.annotations?.['wso2.com/api-id'] as string,
      name: e.metadata.annotations?.['wso2.com/api-name'] || e.metadata.name,
      namespace: e.metadata.namespace,
      version: e.metadata.annotations?.['wso2.com/api-version'] as string,
      context: e.metadata.annotations?.['wso2.com/api-context'] as string,
      provider: e.metadata.annotations?.['wso2.com/api-provider'] as string,
      lifeCycleStatus: e.metadata.annotations?.['wso2.com/api-lifecycle-status'] as string,
      type: e.metadata.annotations?.['wso2.com/api-type'] as string,
    }));

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
    }));

    return { apis, apiProducts, mcpServers };
  }, [catalogApi, tabValue]);

  // Map the single catalog state to the three expected list states
  const apiListState = { 
    loading: catalogState.loading, 
    value: catalogState.value ? { apis: catalogState.value.apis, pagination: { total: catalogState.value.apis.length, offset: 0, limit: 1000 } } : undefined,
    error: catalogState.error, 
    retry: catalogState.retry 
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
        render: rowData => (
          <Link
            href={`/catalog/${rowData.namespace || 'default'}/api/${normalizeEntityName(rowData.name)}`}
            style={{ fontWeight: 'bold', color: '#007acc' }}
          >
            {rowData.name}
          </Link>
        ),
      },
      { title: 'Version', field: 'version' },
      { title: 'Type', field: 'type' },
      { title: 'Provider', field: 'provider' },
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
        render: rowData => (
          <Link
            href={`/catalog/${rowData.namespace || 'default'}/api/${normalizeEntityName(rowData.name)}`}
            style={{ fontWeight: 'bold', color: '#007acc' }}
          >
            {rowData.name}
          </Link>
        ),
      },
      { title: 'Version', field: 'version' },
      { title: 'Type', field: 'type' },
      { title: 'Provider', field: 'provider' },
      { title: 'Lifecycle', field: 'lifeCycleStatus' },
      { title: 'Context', field: 'context' },
    ],
    [],
  );

  const mcpColumns = useMemo<TableColumn<Wso2McpSummary>[]>(
    () => [
      {
        title: 'Name',
        field: 'name',
        render: rowData => (
          <Link
            href={`/catalog/${rowData.namespace || 'default'}/api/${normalizeEntityName(rowData.name)}`}
            style={{ fontWeight: 'bold', color: '#007acc' }}
          >
            {rowData.name}
          </Link>
        ),
      },
      { title: 'Version', field: 'version' },
      { title: 'Provider', field: 'provider' },
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
              <EmptyState
                missing="content"
                title="No APIs Found"
                description="If you have recently configured the WSO2 provider, the catalog might still be synchronizing. Please wait a few moments or check your backend logs for [WSO2-DISCOVERY] messages."
              />
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
              <EmptyState
                missing="content"
                title="No API Products Found"
                description="No API Products were discovered in the catalog."
              />
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
              <EmptyState
                missing="content"
                title="No MCP Servers Found"
                description="No MCP Servers were discovered in the catalog."
              />
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
