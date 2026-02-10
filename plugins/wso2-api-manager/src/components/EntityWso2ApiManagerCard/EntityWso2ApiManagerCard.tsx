import { useAsync } from 'react-use';
import Grid from '@material-ui/core/Grid';
import {
  EmptyState,
  InfoCard,
  Progress,
  StructuredMetadataTable,
  Table,
  WarningPanel,
} from '@backstage/core-components';
import { useApi } from '@backstage/core-plugin-api';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Wso2ApiDetail,
  Wso2ApiDocument,
  wso2ApiManagerApiRef,
} from '../../api';

const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

export const EntityWso2ApiManagerCard = () => {
  const { entity } = useEntity();
  const apiClient = useApi(wso2ApiManagerApiRef);
  const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];

  const apiDetailState = useAsync(async () => {
    if (!apiId) {
      return undefined;
    }
    return apiClient.getApi(apiId);
  }, [apiClient, apiId]);

  const apiDocumentsState = useAsync(async () => {
    if (!apiId) {
      return undefined;
    }
    return apiClient.listDocuments(apiId);
  }, [apiClient, apiId]);

  if (!apiId) {
    return (
      <EmptyState
        title="Missing WSO2 API annotation"
        missing="info"
        description={`Add ${WSO2_API_ID_ANNOTATION} to the entity annotations.`}
      />
    );
  }

  if (apiDetailState.loading) {
    return <Progress />;
  }

  if (apiDetailState.error) {
    return (
      <WarningPanel
        title="Failed to load WSO2 API"
        message={apiDetailState.error.message}
      />
    );
  }

  const details = apiDetailState.value;
  const documents = apiDocumentsState.value?.documents ?? [];

  if (!details) {
    return (
      <EmptyState
        title="API not found"
        missing="info"
        description="The API could not be loaded from WSO2 API Manager."
      />
    );
  }

  return (
    <Grid container spacing={3} alignItems="stretch">
      <Grid item xs={12} md={6}>
        <InfoCard title="WSO2 API details">
          <ApiDetails details={details} />
        </InfoCard>
      </Grid>
      <Grid item xs={12} md={6}>
        <InfoCard title="WSO2 documents">
          {apiDocumentsState.loading && <Progress />}
          {apiDocumentsState.error && (
            <WarningPanel
              title="Failed to load documents"
              message={apiDocumentsState.error.message}
            />
          )}
          {!apiDocumentsState.loading && !apiDocumentsState.error && (
            <DocumentsTable documents={documents} />
          )}
        </InfoCard>
      </Grid>
    </Grid>
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
