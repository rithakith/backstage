import { useMemo, useState } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
  Grid,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Box,
  Typography,
  makeStyles,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  EmptyState,
  Header,
  InfoCard,
  Page,
  Progress,
  StructuredMetadataTable,
  SupportButton,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import Link from '@material-ui/core/Link';
import {
  Wso2ApiDetail,
  Wso2ApiDocument,
  Wso2ApiSummary,
  wso2ApiManagerApiRef,
  wso2AuthApiRef,
} from '../../api';

// @ts-ignore
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';

// WSO2 Theme Colors
const useStyles = makeStyles(theme => ({
  root: {
    '& .MuiButton-containedPrimary': {
      backgroundColor: '#ff5000', // WSO2 Orange
      color: '#fff',
      '&:hover': {
        backgroundColor: '#e04600',
      },
    },
    '& .MuiTypography-h4': {
      color: '#222',
    },
  },
  headerBox: {
    backgroundColor: '#1d2127', // WSO2 Dark Header
    color: '#fff',
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
}));

export const Wso2ApiManagerPage = () => {
  const classes = useStyles();
  const apiClient = useApi(wso2ApiManagerApiRef);
  const oauthApi = useApi(wso2AuthApiRef);
  const [token, setToken] = useState<string | undefined>();
  const [tokenLoading, setTokenLoading] = useState(true);
  const [selectedApiId, setSelectedApiId] = useState<string | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  // Get the user's Asgardeo OAuth access token from the existing login session
  // This token contains the user's identity and WSO2 APIM scopes
  // The backend will use jwt-bearer grant to exchange it for a WSO2 APIM token
  useAsync(async () => {
    console.log('🔑 [WSO2-Frontend] Attempting to retrieve Asgardeo OAuth token from session...');
    try {
      // Get token from existing OIDC session (no popup if already authenticated)
      // Must include WSO2 APIM scopes that were requested during login
      const t = await oauthApi.getAccessToken(
        ['openid', 'profile', 'email', 'apim:api_create', 'apim:api_publish', 'apim:subscribe', 'apim:api_view'],
        { optional: true }, // Don't prompt - use existing session
      );
      if (t) {
        console.log('✅ [WSO2-Frontend] Asgardeo OAuth token retrieved from session');
        console.log(`📊 [WSO2-Frontend] Token length: ${t.length} characters`);
        console.log(`🔍 [WSO2-Frontend] Token preview: ${t.substring(0, 50)}...`);
        setToken(t);
      } else {
        console.warn('⚠️ [WSO2-Frontend] No OAuth token in session - user may need to re-authenticate');
      }
    } catch (error) {
      // Token unavailable - backend will fall back to client_credentials grant
      console.error('❌ [WSO2-Frontend] Failed to get Asgardeo OAuth token:', error);
    } finally {
      setTokenLoading(false);
    }
  }, [oauthApi]);

  const handleCreateButtonClick = () => {
    if (!token) {
      setCreateError('Not authenticated — please sign in to Backstage first.');
      return;
    }
    setDialogOpen(true);
  };

  const apiListState = useAsyncRetry(async () => {
    // Wait for token loading to complete before making API calls
    if (tokenLoading) {
      console.log('⏳ [WSO2-Frontend] Waiting for Asgardeo OAuth token to load...');
      return { apis: [], pagination: { total: 0, offset: 0, limit: 50 } };
    }

    // Pass the user's Asgardeo OAuth token so the backend can use jwt-bearer grant
    // This ensures WSO2 APIM filters APIs based on the user's actual roles
    console.log(`📡 [WSO2-Frontend] Calling listApis with Asgardeo OAuth token: ${token ? 'YES' : 'NO'}`);
    if (token) {
      console.log(`🎫 [WSO2-Frontend] Token will be sent in X-WSO2-Access-Token header`);
    } else {
      console.warn('⚠️ [WSO2-Frontend] No OAuth token available - backend will fallback to client_credentials');
    }
    return apiClient.listApis({
      limit: 50,
      offset: 0,
      token, // User's Asgardeo token from Backstage authentication session
    });
  }, [apiClient, token, tokenLoading]);

  const apiDetailState = useAsync(async () => {
    if (!selectedApiId || !token) return undefined;
    return apiClient.getApi(selectedApiId, token);
  }, [apiClient, selectedApiId, token]);

  const apiDocumentsState = useAsync(async () => {
    if (!selectedApiId || !token) return undefined;
    return apiClient.listDocuments(selectedApiId, token);
  }, [apiClient, selectedApiId, token]);

  const apiDefinitionState = useAsync(async () => {
    if (!selectedApiId || !token) return undefined;
    try {
      return await apiClient.getApiDefinition(selectedApiId, token);
    } catch (e: any) {
      if (e.message && e.message.includes('404')) {
        return null; // Handle 404 gracefully
      }
      throw e;
    }
  }, [apiClient, selectedApiId, token]);

  const handleCreate = async (input: CreateApiInput) => {
    setCreateError(undefined);
    if (!token) {
      setCreateError('Not authenticated');
      return;
    }

    try {
      await apiClient.createPublisherApi({
        ...input,
        token,
      });
      setDialogOpen(false);
      apiListState.retry();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCreateError(message);
    }
  };

  const columns = useMemo<TableColumn<Wso2ApiSummary>[]>(
    () => [
      { title: 'Name', field: 'name' },
      { title: 'Version', field: 'version' },
      { title: 'Provider', field: 'provider' },
      { title: 'Lifecycle', field: 'lifeCycleStatus' },
      { title: 'Context', field: 'context' },
    ],
    [],
  );

  const details = apiDetailState.value;
  const documents = apiDocumentsState.value?.documents ?? [];

  return (
    <Page themeId="tool" className={classes.root}>
      <Header title="WSO2 API Manager" subtitle="Browse APIs and details" />
      <Content>
        <ContentHeader title="">
          <SupportButton>
            This view lists APIs from WSO2 API Manager.
          </SupportButton>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateButtonClick}
          >
            Create API
          </Button>
        </ContentHeader>

        {createError && (
          <WarningPanel
            title="Action Failed"
            message={createError}
            severity="error" // Ensure red color
          />
        )}

        {apiListState.loading && <Progress />}
        {apiListState.error && (
          <WarningPanel
            title="Failed to load APIs"
            message={apiListState.error.message}
          />
        )}
        {apiListState.value && (
          <Table
            options={{ paging: false, search: true }}
            columns={columns}
            data={apiListState.value.apis}
            onRowClick={(_, row) => setSelectedApiId(row?.id)}
          />
        )}

        <ContentHeader title="Details" />
        <Grid container spacing={3} alignItems="stretch">
          <Grid item xs={12} md={6}>
            <InfoCard title="API details">
              {selectedApiId && apiDetailState.loading && <Progress />}
              {selectedApiId && apiDetailState.error && (
                <WarningPanel
                  title="Failed to load API"
                  message={apiDetailState.error.message}
                />
              )}
              {!selectedApiId && (
                <EmptyState
                  title="Select an API"
                  missing="info"
                  description="Choose an API from the list to see details."
                />
              )}
              {details && <ApiDetails details={details} />}
            </InfoCard>
          </Grid>
          <Grid item xs={12} md={6}>
            <InfoCard title="Documents">
              {selectedApiId && apiDocumentsState.loading && <Progress />}
              {selectedApiId && apiDocumentsState.error && (
                <WarningPanel
                  title="Failed to load documents"
                  message={apiDocumentsState.error.message}
                />
              )}
              {!selectedApiId && (
                <EmptyState
                  title="Select an API"
                  missing="info"
                  description="Choose an API to view its documents."
                />
              )}
              {selectedApiId &&
                !apiDocumentsState.loading &&
                !apiDocumentsState.error && (
                  <DocumentsTable documents={documents} apiId={selectedApiId} />
                )}
            </InfoCard>
          </Grid>
          <Grid item xs={12}>
            {selectedApiId && (
              <InfoCard title="API Definition (Swagger)">
                {apiDefinitionState.loading && <Progress />}
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
                  <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '4px' }}>
                    <SwaggerUI spec={apiDefinitionState.value} />
                  </div>
                )}
              </InfoCard>
            )}
          </Grid>
        </Grid>
      </Content>

      <CreateApiDialog
        open={isDialogOpen}
        errorMessage={createError}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />
    </Page>
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

const DocumentsTable = ({ documents, apiId }: { documents: Wso2ApiDocument[], apiId: string }) => {
  const config = useApi(configApiRef);
  const { fetch } = useApi(fetchApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const handleDownload = async (rowData: any) => {
    const { documentId, name, sourceType, sourceUrl } = rowData;
    const docId = documentId || rowData.id;

    if (sourceType === 'URL') {
      window.open(sourceUrl || '#', '_blank', 'noopener,noreferrer');
      return;
    }

    try {
      const url = `${backendUrl}/api/wso2-api-manager/apis/${apiId}/documents/${docId}/content`;
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        throw new Error(`Failed to download: ${response.statusText}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      let filename = name;
      let extensionAdded = false;

      const disposition = response.headers.get('content-disposition');
      if (disposition && disposition.indexOf('attachment') !== -1) {
        const filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/;
        const matches = filenameRegex.exec(disposition);
        if (matches != null && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
          extensionAdded = true;
        }
      }

      if (!extensionAdded) {
        if (sourceType === 'MARKDOWN') {
          filename = `${name}.md`;
        } else if (sourceType === 'INLINE') {
          filename = `${name}.txt`;
        }
      }

      link.setAttribute('download', filename);

      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      console.error('Failed to download document content', e);
      alert('Failed to download document content. Check console for details.');
    }
  };

  if (!documents.length) {
    return (
      <EmptyState
        title="No documents"
        missing="info"
        description="This API has no documents in WSO2 API Manager."
      />
    );
  }

  return (
    <Table
      options={{ paging: false, search: false }}
      columns={[
        {
          title: 'Name',
          field: 'name',
          render: (rowData: any) => (
            <Link
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                handleDownload(rowData);
              }}
              style={{ color: '#0A66C2', textDecoration: 'underline', cursor: 'pointer' }}
            >
              {rowData.name}
            </Link>
          )
        },
        { title: 'Type', field: 'type' },
        { title: 'Source', field: 'sourceType' },
        { title: 'Summary', field: 'summary' },
      ]}
      data={documents}
    />
  );
};

type CreateApiInput = {
  name: string;
  context: string;
  version: string;
  endpointUrl: string;
  description?: string;
};

const CreateApiDialog = (props: {
  open: boolean;
  errorMessage?: string;
  onClose: () => void;
  onSubmit: (input: CreateApiInput) => void;
}) => {
  const [formState, setFormState] = useState<CreateApiInput>({
    name: '',
    context: '',
    version: '1.0.0',
    endpointUrl: '',
    description: '',
  });

  const updateField = (field: keyof CreateApiInput, value: string) => {
    setFormState(current => ({ ...current, [field]: value }));
  };

  const isValid =
    formState.name.trim() &&
    formState.context.trim() &&
    formState.version.trim() &&
    formState.endpointUrl.trim();

  return (
    <Dialog open={props.open} onClose={props.onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create API</DialogTitle>
      <DialogContent>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              label="Name"
              value={formState.name}
              onChange={event => updateField('name', event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Context"
              value={formState.context}
              onChange={event => updateField('context', event.target.value)}
              fullWidth
              helperText="Example: /order-service"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Version"
              value={formState.version}
              onChange={event => updateField('version', event.target.value)}
              fullWidth
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Endpoint URL"
              value={formState.endpointUrl}
              onChange={event => updateField('endpointUrl', event.target.value)}
              fullWidth
              helperText="Example: https://api.example.com"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              label="Description"
              value={formState.description}
              onChange={event => updateField('description', event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Grid>
          {props.errorMessage && (
            <Grid item xs={12}>
              <WarningPanel
                title="Create API failed"
                message={props.errorMessage}
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={props.onClose}>Cancel</Button>
        <Button
          color="primary"
          variant="contained"
          onClick={() => props.onSubmit(formState)}
          disabled={!isValid}
        >
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
};
