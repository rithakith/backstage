import { useEffect, useMemo, useState } from 'react';
import { useAsync, useAsyncRetry } from 'react-use';
import { createPermission } from '@backstage/plugin-permission-common';
import {
  Grid,
  TextField,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  makeStyles,
} from '@material-ui/core';
import {
  Content,
  ContentHeader,
  Header,
  Page,
  Progress,
  SupportButton,
  Table,
  TableColumn,
  WarningPanel,
} from '@backstage/core-components';
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import { usePermission } from '@backstage/plugin-permission-react';
import Link from '@material-ui/core/Link';
import {
  Wso2ApiSummary,
  wso2ApiManagerApiRef,
  wso2AuthApiRef,
} from '../../api';

// Inline permission definitions (must match names in backend customPermissions.ts / packages/app/src/customPermissions.ts)
const apiWritePermission = createPermission({
  name: 'api.write',
  attributes: { action: 'create' },
});

// Removed DisableTryItOutPlugin to enable "Try it out"

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

// ─── Main Page ────────────────────────────────────────────────────────────
export const Wso2ApiManagerPage = () => {
  const classes = useStyles();
  const apiClient = useApi(wso2ApiManagerApiRef);
  const oauthApi = useApi(wso2AuthApiRef);
  const [token, setToken] = useState<string | undefined>();
  const [tokenLoading, setTokenLoading] = useState(true);
  // Permission check
  const { allowed: hasWritePermission } = usePermission({ permission: apiWritePermission });

  // Get the user's Asgardeo OAuth access token from the existing login session
  useAsync(async () => {
    console.log('🔑 [WSO2-Frontend] Attempting to retrieve Asgardeo OAuth token from session...');
    try {
      const t = await oauthApi.getAccessToken(
        ['openid', 'profile', 'email', 'apim:api_create', 'apim:api_publish', 'apim:subscribe', 'apim:api_view'],
        { optional: true },
      );
      if (t) {
        console.log('✅ [WSO2-Frontend] Asgardeo OAuth token retrieved from session');
        setToken(t);
      } else {
        console.warn('⚠️ [WSO2-Frontend] No OAuth token in session');
      }
    } catch (error) {
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

  const [isDialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  const apiListState = useAsyncRetry(async () => {
    if (tokenLoading) return { apis: [], pagination: { total: 0, offset: 0, limit: 50 } };
    return apiClient.listApis({ limit: 50, offset: 0, token });
  }, [apiClient, token, tokenLoading]);

  const handleCreate = async (input: CreateApiInput) => {
    setCreateError(undefined);
    if (!token) {
      setCreateError('Not authenticated');
      return;
    }
    try {
      await apiClient.createPublisherApi({ ...input, token });
      setDialogOpen(false);
      apiListState.retry();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setCreateError(message);
    }
  };

  const columns = useMemo<TableColumn<Wso2ApiSummary>[]>(
    () => [
      {
        title: 'Name',
        field: 'name',
        render: rowData => (
          <Link
            href={`/catalog/default/api/${rowData.name.toLowerCase()}`}
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
          {/* 
          <Button
            variant="contained"
            color="primary"
            onClick={handleCreateButtonClick}
          >
            Create API
          </Button>
          */}
        </ContentHeader>

        {createError && (
          <WarningPanel
            title="Action Failed"
            message={createError}
          />
        )}

        {apiListState.loading && <Progress />}
        {apiListState.error && (
          <WarningPanel
            title="Failed to load APIs"
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

      {/* 
      <CreateApiDialog
        open={isDialogOpen}
        errorMessage={createError}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
      />
      */}
    </Page>
  );
};


// ─── CreateApiDialog ───────────────────────────────────────────────────────
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
