import { useMemo, useState } from 'react';
import { useAsync } from 'react-use';
import Grid from '@material-ui/core/Grid';
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
} from '../../api';

export const Wso2ApiManagerPage = () => {
  const apiClient = useApi(wso2ApiManagerApiRef);
  const [selectedApiId, setSelectedApiId] = useState<string | undefined>();

  const apiListState = useAsync(async () => {
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
    <Page themeId="tool">
      <Header title="WSO2 API Manager" subtitle="Browse APIs and details" />
      <Content>
        <ContentHeader title="APIs">
          <SupportButton>
            This view lists APIs from WSO2 API Manager.
          </SupportButton>
        </ContentHeader>

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
