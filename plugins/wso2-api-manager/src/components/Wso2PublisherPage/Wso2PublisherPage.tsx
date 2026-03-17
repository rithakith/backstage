import { useMemo, useState } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import {
  Grid,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  makeStyles,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  Header,
  Page,
  Progress,
  Table,
  TableColumn,
  WarningPanel,
  SupportButton,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { Wso2ApiSummary, wso2ApiManagerApiRef, wso2AuthApiRef } from '../../api';

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
  },
}));

export const Wso2PublisherPage = () => {
  const classes = useStyles();
  const apiClient = useApi(wso2ApiManagerApiRef);
  const oauthApi = useApi(wso2AuthApiRef);
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();
  const [token, setToken] = useState<string | undefined>();
  const [tokenLoading, setTokenLoading] = useState(true);

  // Get the user's Asgardeo OAuth access token from the existing login session
  useAsync(async () => {
    console.log('🔑 [WSO2-Publisher] Attempting to retrieve Asgardeo OAuth token from session...');
    try {
      const t = await oauthApi.getAccessToken(
        ['openid', 'profile', 'email', 'apim:api_create', 'apim:api_publish', 'apim:subscribe', 'apim:api_view'],
        { optional: true },
      );
      if (t) {
        console.log('✅ [WSO2-Publisher] Asgardeo OAuth token retrieved from session');
        console.log(`📊 [WSO2-Publisher] Token length: ${t.length} characters`);
        setToken(t);
      } else {
        console.warn('⚠️ [WSO2-Publisher] No OAuth token in session');
      }
    } catch (error) {
      console.error('❌ [WSO2-Publisher] Failed to get Asgardeo OAuth token:', error);
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
      console.log('⏳ [WSO2-Publisher] Waiting for Asgardeo OAuth token to load...');
      return { apis: [], pagination: { total: 0, offset: 0, limit: 50 } };
    }

    // Pass the user's Asgardeo OAuth token for jwt-bearer grant
    console.log(`📡 [WSO2-Publisher] Calling listPublisherApis with Asgardeo OAuth token: ${token ? 'YES' : 'NO'}`);
    return apiClient.listPublisherApis({
      limit: 50,
      offset: 0,
      token,
    });
  }, [apiClient, token, tokenLoading]);

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

  return (
    <Page themeId="tool" className={classes.root}>
      <Header
        title="WSO2 Publisher"
        subtitle="Manage APIs in WSO2 API Manager"
      />
      <Content>
        <ContentHeader title="Publisher APIs">
          <SupportButton>
            List and create APIs using the WSO2 Publisher API.
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
            title="Failed to load publisher APIs"
            message={apiListState.error.message}
          />
        )}
        {apiListState.value?.apis && (
          <Table
            options={{ paging: false, search: true }}
            columns={columns}
            data={apiListState.value.apis}
          />
        )}
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
