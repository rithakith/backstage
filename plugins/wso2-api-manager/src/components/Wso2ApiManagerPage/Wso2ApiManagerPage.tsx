import { useMemo, useState } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import Grid from '@material-ui/core/Grid';
import TextField from '@material-ui/core/TextField';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogTitle from '@material-ui/core/DialogTitle';
import Box from '@material-ui/core/Box';
import Typography from '@material-ui/core/Typography';
import { makeStyles } from '@material-ui/core/styles';
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
  const [selectedApiId, setSelectedApiId] = useState<string | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  const [authCreds, setAuthCreds] = useState<{ token: string } | undefined>(undefined);

  const getAccessToken = async () => {
    // Request a token for the 'wso2' provider
    const token = await oauthApi.getAccessToken(['openid', 'profile', 'email']);
    return token;
  };

  const handleCreateLogin = async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        setAuthCreds({ token });
        setDialogOpen(true);
      }
    } catch (e) {
      setCreateError('Authentication failed: ' + e);
    }
  };

  const apiListState = useAsyncRetry(async () => {
    // For listing, we try to fetch without user credentials first (public/configured credentials in backend)
    // If that fails, or if we want user-specific APIs, we'd need auth.
    // Assuming retrieving all APIs from DevPortal is public or uses system creds.
    return apiClient.listApis({ limit: 50, offset: 0 });
  }, [apiClient]);

  const apiDetailState = useAsync(async () => {
    if (!selectedApiId) {
      return undefined;
    }
    return apiClient.getApi(selectedApiId);
  }, [apiClient, selectedApiId]);

  const apiDocumentsState = useAsync(async () => {
    if (!selectedApiId) {
      return undefined;
    }
    return apiClient.listDocuments(selectedApiId);
  }, [apiClient, selectedApiId]);

  const handleCreate = async (input: CreateApiInput) => {
    setCreateError(undefined);
    if (!authCreds?.token) {
      setCreateError("Not authenticated");
      return;
    }

    try {
      await apiClient.createPublisherApi({
        ...input,
        token: authCreds.token,
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
        <ContentHeader title="DevPortal APIs">
          <SupportButton>
            This view lists APIs from WSO2 API Manager.
          </SupportButton>
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateLogin}
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
