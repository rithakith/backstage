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
  Box,
  Typography,
  Tabs,
  Tab,
  Tooltip,
  CircularProgress,
  makeStyles,
} from '@material-ui/core';
import EditIcon from '@material-ui/icons/Edit';
import SaveIcon from '@material-ui/icons/Save';
import CancelIcon from '@material-ui/icons/Cancel';
import CheckCircleOutlineIcon from '@material-ui/icons/CheckCircleOutline';
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
import { usePermission } from '@backstage/plugin-permission-react';
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

// Inline permission definitions (must match names in backend customPermissions.ts / packages/app/src/customPermissions.ts)
const apiWritePermission = createPermission({
  name: 'api.write',
  attributes: { action: 'create' },
});

// Removes the "Try it out" button entirely from the render tree
const DisableTryItOutPlugin = () => ({
  components: {
    TryItOutButton: () => null,
  },
});

// ─── Styles ────────────────────────────────────────────────────────────────
const useStyles = makeStyles(theme => ({
  root: {
    '& .MuiButton-containedPrimary': {
      backgroundColor: '#ff5000',
      color: '#fff',
      '&:hover': {
        backgroundColor: '#e04600',
      },
    },
  },
  editorContainer: {
    position: 'relative',
    borderRadius: 6,
    overflow: 'hidden',
    border: '1px solid #3c3c3c',
    backgroundColor: '#1e1e1e',
  },
  editorHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '6px 12px',
    backgroundColor: '#2d2d2d',
    borderBottom: '1px solid #3c3c3c',
  },
  editorLang: {
    color: '#9d9d9d',
    fontSize: 11,
    fontFamily: '"Consolas", "SF Mono", "Menlo", monospace',
    letterSpacing: 1,
  },
  editorActions: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  monacoTextarea: {
    width: '100%',
    minHeight: 500,
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    fontFamily: '"Consolas", "SF Mono", "Menlo", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.6,
    padding: '16px',
    border: 'none',
    outline: 'none',
    resize: 'vertical',
    boxSizing: 'border-box',
    tabSize: 2,
    '&:read-only': {
      cursor: 'default',
      opacity: 0.85,
    },
  },
  lineNumbers: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 40,
    backgroundColor: '#1e1e1e',
    color: '#858585',
    fontFamily: '"Consolas", "SF Mono", monospace',
    fontSize: 13,
    lineHeight: 1.6,
    textAlign: 'right',
    padding: '16px 6px 16px 0',
    pointerEvents: 'none',
    userSelect: 'none',
    borderRight: '1px solid #333',
  },
  editBtn: {
    backgroundColor: '#0e639c',
    color: '#fff',
    textTransform: 'none',
    fontWeight: 600,
    '&:hover': {
      backgroundColor: '#1177bb',
    },
  },
  saveBtn: {
    backgroundColor: '#28a745',
    color: '#fff',
    textTransform: 'none',
    fontWeight: 600,
    '&:hover': {
      backgroundColor: '#22863a',
    },
  },
  cancelBtn: {
    textTransform: 'none',
    color: '#9d9d9d',
    borderColor: '#555',
    '&:hover': {
      borderColor: '#888',
    },
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '2px 8px',
    borderRadius: 3,
    fontSize: 11,
    fontFamily: 'monospace',
    fontWeight: 600,
    letterSpacing: 0.5,
  },
  readOnlyBadge: {
    backgroundColor: '#2a2a2a',
    color: '#858585',
    border: '1px solid #444',
  },
  editingBadge: {
    backgroundColor: '#0e639c22',
    color: '#4dc3f7',
    border: '1px solid #0e639c66',
  },
  savedBadge: {
    backgroundColor: '#28a74522',
    color: '#85e89d',
    border: '1px solid #28a74566',
  },
  tabRoot: {
    minWidth: 120,
    textTransform: 'none',
    fontWeight: 600,
  },
  successAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 4,
    backgroundColor: '#1a3a2a',
    border: '1px solid #28a745',
    color: '#85e89d',
    marginBottom: theme.spacing(1),
    fontSize: 13,
  },
  errorAlert: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderRadius: 4,
    backgroundColor: '#3a1a1a',
    border: '1px solid #e74c3c',
    color: '#f97171',
    marginBottom: theme.spacing(1),
    fontSize: 13,
  },
}));

// ─── VSCode-like JSON/YAML Editor ──────────────────────────────────────────
interface SwaggerEditorProps {
  value: string;
  readOnly: boolean;
  onChange?: (val: string) => void;
  isEditing: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  saveError?: string;
  hasWritePermission: boolean;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
}

const SwaggerEditorPanel = ({
  value,
  readOnly,
  onChange,
  isEditing,
  isSaving,
  saveSuccess,
  saveError,
  hasWritePermission,
  onEdit,
  onSave,
  onCancel,
}: SwaggerEditorProps) => {
  const classes = useStyles();

  // Detect if content looks like YAML or JSON
  const lang = value.trimStart().startsWith('{') ? 'JSON' : 'YAML';

  // Status badge
  const badge = saveSuccess
    ? <span className={`${classes.badge} ${classes.savedBadge}`}>✓ Saved</span>
    : isEditing
      ? <span className={`${classes.badge} ${classes.editingBadge}`}>● EDITING</span>
      : <span className={`${classes.badge} ${classes.readOnlyBadge}`}>READ ONLY</span>;

  return (
    <div className={classes.editorContainer}>
      {/* VS Code-style title bar */}
      <div className={classes.editorHeader}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Typography className={classes.editorLang}>
            swagger.{lang.toLowerCase()}
          </Typography>
          {badge}
        </div>
        <div className={classes.editorActions}>
          {/* Save success/error feedback */}
          {saveSuccess && !isEditing && (
            <span style={{ color: '#85e89d', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckCircleOutlineIcon style={{ fontSize: 14 }} /> Definition updated
            </span>
          )}

          {/* Edit mode buttons */}
          {isEditing && (
            <>
              <Button
                id="swagger-cancel-btn"
                size="small"
                variant="outlined"
                startIcon={<CancelIcon />}
                onClick={onCancel}
                className={classes.cancelBtn}
                disabled={isSaving}
              >
                Cancel
              </Button>
              <Button
                id="swagger-save-btn"
                size="small"
                variant="contained"
                startIcon={isSaving ? <CircularProgress size={14} style={{ color: '#fff' }} /> : <SaveIcon />}
                onClick={onSave}
                className={classes.saveBtn}
                disabled={isSaving}
              >
                {isSaving ? 'Saving…' : 'Save Changes'}
              </Button>
            </>
          )}

          {/* Edit button — only for write users in read-only mode */}
          {!isEditing && hasWritePermission && (
            <Tooltip title="Edit swagger definition and update in WSO2 Publisher">
              <Button
                id="swagger-edit-btn"
                size="small"
                variant="contained"
                startIcon={<EditIcon />}
                onClick={onEdit}
                className={classes.editBtn}
              >
                Edit
              </Button>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Error alert below header */}
      {saveError && (
        <div className={classes.errorAlert}>
          <span>⚠</span> {saveError}
        </div>
      )}

      {/* The editor itself */}
      <textarea
        id="swagger-editor-textarea"
        className={classes.monacoTextarea}
        value={value}
        readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        spellCheck={false}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        style={{
          cursor: readOnly ? 'default' : 'text',
          opacity: readOnly ? 0.85 : 1,
        }}
      />

      {/* Bottom status bar like VS Code */}
      <div style={{
        backgroundColor: isEditing ? '#0e639c' : '#007acc',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        padding: '2px 12px',
        fontSize: 11,
        fontFamily: 'monospace',
      }}>
        <span>{lang} · OpenAPI · {value.split('\n').length} lines</span>
        <span>{isEditing ? 'Editing — changes not yet saved' : hasWritePermission ? 'Click Edit to modify' : 'Read-only access'}</span>
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────
export const Wso2ApiManagerPage = () => {
  const classes = useStyles();
  const apiClient = useApi(wso2ApiManagerApiRef);
  const oauthApi = useApi(wso2AuthApiRef);
  const [token, setToken] = useState<string | undefined>();
  const [tokenLoading, setTokenLoading] = useState(true);
  const [selectedApiId, setSelectedApiId] = useState<string | undefined>();
  const [isDialogOpen, setDialogOpen] = useState(false);
  const [createError, setCreateError] = useState<string | undefined>();

  // Editor state
  const [activeTab, setActiveTab] = useState(0); // 0=Swagger UI, 1=Source
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | undefined>();
  const [saveSuccess, setSaveSuccess] = useState(false);

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

  const apiListState = useAsyncRetry(async () => {
    if (tokenLoading) return { apis: [], pagination: { total: 0, offset: 0, limit: 50 } };
    return apiClient.listApis({ limit: 50, offset: 0, token });
  }, [apiClient, token, tokenLoading]);

  const apiDetailState = useAsync(async () => {
    if (!selectedApiId || !token) return undefined;
    return apiClient.getApi(selectedApiId, token);
  }, [apiClient, selectedApiId, token]);

  const apiDocumentsState = useAsync(async () => {
    if (!selectedApiId || !token) return undefined;
    return apiClient.listDocuments(selectedApiId, token);
  }, [apiClient, selectedApiId, token]);

  const apiDefinitionState = useAsyncRetry(async () => {
    if (!selectedApiId || !token) return undefined;
    try {
      return await apiClient.getApiDefinition(selectedApiId, token);
    } catch (e: any) {
      if (e.message && e.message.includes('404')) {
        return null;
      }
      throw e;
    }
  }, [apiClient, selectedApiId, token]);

  // Sync editor content when definition loads or API changes
  useEffect(() => {
    if (apiDefinitionState.value) {
      const content = JSON.stringify(apiDefinitionState.value, null, 2);
      setEditContent(content);
      setIsEditing(false);
      setSaveError(undefined);
      setSaveSuccess(false);
    }
  }, [apiDefinitionState.value]);

  // Reset editor state when selecting a different API
  useEffect(() => {
    setIsEditing(false);
    setSaveError(undefined);
    setSaveSuccess(false);
    setActiveTab(0);
  }, [selectedApiId]);

  const handleEdit = () => {
    setSaveSuccess(false);
    setSaveError(undefined);
    setIsEditing(true);
  };

  const handleCancel = () => {
    // Revert to the original definition
    if (apiDefinitionState.value) {
      setEditContent(JSON.stringify(apiDefinitionState.value, null, 2));
    }
    setIsEditing(false);
    setSaveError(undefined);
  };

  const handleSave = async () => {
    if (!selectedApiId) return;
    setIsSaving(true);
    setSaveError(undefined);
    try {
      await apiClient.updateApiDefinition(selectedApiId, editContent, token);
      setIsEditing(false);
      setSaveSuccess(true);
      // Refresh the definition
      apiDefinitionState.retry();
    } catch (e: any) {
      setSaveError(e.message || 'Failed to update definition');
    } finally {
      setIsSaving(false);
    }
  };

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

          {/* ── API Definition Card ─────────────────────────────────────── */}
          <Grid item xs={12}>
            {selectedApiId && (
              <InfoCard
                title="API Definition (OpenAPI / Swagger)"
                subheader={
                  hasWritePermission
                    ? 'You have write access — use the Edit button in the editor to modify this definition'
                    : 'You have read-only access to this API definition'
                }
              >
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
                  <>
                    {/* Tab bar: Swagger UI / Source */}
                    <Box borderBottom={1} borderColor="divider" mb={2}>
                      <Tabs
                        value={activeTab}
                        onChange={(_, v) => setActiveTab(v)}
                        indicatorColor="primary"
                        textColor="primary"
                      >
                        <Tab id="tab-swagger-ui" label="Swagger UI" className={classes.tabRoot} />
                        <Tab id="tab-source" label="Source Editor" className={classes.tabRoot} />
                      </Tabs>
                    </Box>

                    {/* Tab 0: SwaggerUI rendered view */}
                    {activeTab === 0 && (
                      <div style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '4px' }}>
                        <SwaggerUI
                          spec={apiDefinitionState.value}
                          supportedSubmitMethods={[]}
                          plugins={[DisableTryItOutPlugin]}
                        />
                      </div>
                    )}

                    {/* Tab 1: VSCode-like editor */}
                    {activeTab === 1 && (
                      <SwaggerEditorPanel
                        value={editContent}
                        readOnly={!isEditing}
                        onChange={setEditContent}
                        isEditing={isEditing}
                        isSaving={isSaving}
                        saveSuccess={saveSuccess}
                        saveError={saveError}
                        hasWritePermission={hasWritePermission}
                        onEdit={handleEdit}
                        onSave={handleSave}
                        onCancel={handleCancel}
                      />
                    )}
                  </>
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

// ─── ApiDetails ────────────────────────────────────────────────────────────
const ApiDetails = ({ details }: { details: Wso2ApiDetail }) => {
  const metadata: Record<string, string> = {
    Name: details.name,
  };

  if (details.version) metadata.Version = details.version;
  if (details.provider) metadata.Provider = details.provider;
  if (details.context) metadata.Context = details.context;
  if (details.lifeCycleStatus) metadata.Status = details.lifeCycleStatus;
  if (details.type) metadata.Type = details.type;
  if (details.description) metadata.Description = details.description;

  return <StructuredMetadataTable metadata={metadata} />;
};

// ─── DocumentsTable ────────────────────────────────────────────────────────
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
        if (sourceType === 'MARKDOWN') filename = `${name}.md`;
        else if (sourceType === 'INLINE') filename = `${name}.txt`;
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
