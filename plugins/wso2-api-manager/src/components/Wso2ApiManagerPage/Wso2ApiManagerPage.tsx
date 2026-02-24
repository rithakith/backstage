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
import { useApi } from '@backstage/core-plugin-api';
import {
  Wso2ApiDetail,
  Wso2ApiDocument,
  Wso2ApiSummary,
  wso2ApiManagerApiRef,
  wso2AuthApiRef,
} from '../../api';

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
  const [selectedApiId, setSelectedApiId] = useState<string | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  const hasPublisherAccess = (_tokenStr: string) => {
    // NOTE: Asgardeo issues opaque (non-JWT) access tokens, so we cannot
    // decode them client-side. Authorization is enforced by WSO2 APIM itself
    // when we make the request — it will return 401/403 if the user lacks the
    // publisher role. We surface that as a friendly error in the UI.
    return true;
  };

  // Try to silently get the token on mount to synchronize login
  useAsync(async () => {
    try {
      const t = await oauthApi.getAccessToken(['openid', 'profile', 'email', 'apim:api_create', 'apim:api_publish'], { optional: true });
      if (t) {
        setToken(t);
      }
    } catch (e) {
      // Ignore silent failures
    }
  }, [oauthApi]);

  const handleSignIn = async () => {
    try {
      const t = await oauthApi.getAccessToken(['openid', 'profile', 'email', 'apim:api_create', 'apim:api_publish']);
      if (t) {
        setToken(t);
      }
    } catch (e) {
      setCreateError('Authentication failed: ' + e);
    }
  };

  const handleCreateLogin = async () => {
    try {
      const t = await oauthApi.getAccessToken(['openid', 'profile', 'email', 'apim:api_create', 'apim:api_publish']);
      if (t) {
        setToken(t);
        setDialogOpen(true);  // Let WSO2 APIM enforce the role on submission
      }
    } catch (e) {
      setCreateError('Authentication failed: ' + e);
    }
  };

  const handleCreateButtonClick = () => {
    if (token) {
      setDialogOpen(true);
    } else {
      handleCreateLogin();
    }
  };

  const apiListState = useAsyncRetry(async () => {
    return apiClient.listApis({
      limit: 50,
      offset: 0,
      token: token
    });
  }, [apiClient, token]);

  const apiDetailState = useAsync(async () => {
    if (!selectedApiId) {
      return undefined;
    }
    return apiClient.getApi(selectedApiId, token);
  }, [apiClient, selectedApiId, token]);

  const apiDocumentsState = useAsync(async () => {
    if (!selectedApiId) {
      return undefined;
    }
    return apiClient.listDocuments(selectedApiId, token);
  }, [apiClient, selectedApiId, token]);

  const handleCreate = async (input: CreateApiInput) => {
    setCreateError(undefined);
    if (!token) {
      setCreateError("Not authenticated");
      return;
    }

    try {
      await apiClient.createPublisherApi({
        ...input,
        token: token,
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
          <Box mr={2} display="inline">
            <Button
              variant="contained"
              color="primary"
              onClick={handleSignIn}
              disabled={!!token}
            >
              {token ? 'Signed In ✓' : 'SIGN IN'}
            </Button>
          </Box>
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
                  <DocumentsTable documents={documents} />
                )}
            </InfoCard>
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

const DocumentsTable = ({ documents }: { documents: Wso2ApiDocument[] }) => {
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
        { title: 'Name', field: 'name' },
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
