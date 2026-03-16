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
import { useApi, configApiRef, fetchApiRef } from '@backstage/core-plugin-api';
import Link from '@material-ui/core/Link';
import { useEntity } from '@backstage/plugin-catalog-react';
import {
  Wso2ApiDetail,
  Wso2ApiDocument,
  wso2ApiManagerApiRef,
  wso2AuthApiRef,
} from '../../api';

import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles(_theme => ({
}));

const WSO2_API_ID_ANNOTATION = 'wso2.com/api-id';

export const EntityWso2ApiManagerCard = () => {
  const classes = useStyles();
  const { entity } = useEntity();
  const apiClient = useApi(wso2ApiManagerApiRef);
  const oauthApi = useApi(wso2AuthApiRef);
  const apiId = entity.metadata.annotations?.[WSO2_API_ID_ANNOTATION];
  const config = useApi(configApiRef);
  const { fetch } = useApi(fetchApiRef);
  const backendUrl = config.getString('backend.baseUrl');

  const handleDownload = async (rowData: Wso2ApiDocument) => {
    const { name, sourceType, sourceUrl, id: docId } = rowData;

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

      // Attempt to extract real filename from content-disposition
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

  // Get the user's Asgardeo OAuth token from existing session
  const tokenState = useAsync(async () => {
    console.log('🔑 [WSO2-EntityCard] Attempting to retrieve Asgardeo OAuth token from session...');
    try {
      const token = await oauthApi.getAccessToken(
        ['openid', 'profile', 'email', 'apim:api_view', 'apim:subscribe'],
        { optional: true },
      );
      if (token) {
        console.log('✅ [WSO2-EntityCard] Asgardeo OAuth token retrieved from session');
        console.log(`📊 [WSO2-EntityCard] Token length: ${token.length} characters`);
      } else {
        console.warn('⚠️ [WSO2-EntityCard] No OAuth token in session');
      }
      return token;
    } catch (error) {
      console.error('❌ [WSO2-EntityCard] Failed to get Asgardeo OAuth token:', error);
      return undefined;
    }
  }, [oauthApi]);

  const apiDetailState = useAsync(async () => {
    if (!apiId) {
      return undefined;
    }
    return apiClient.getApi(apiId, tokenState.value);
  }, [apiClient, apiId, tokenState.value]);

  const apiDocumentsState = useAsync(async () => {
    if (!apiId) {
      return undefined;
    }
    return apiClient.listDocuments(apiId, tokenState.value);
  }, [apiClient, apiId, tokenState.value]);

  const documents = apiDocumentsState.value?.documents ?? [];

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
            <DocumentsTable documents={documents} onDownload={handleDownload} />
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

const DocumentsTable = ({
  documents,
  onDownload
}: {
  documents: Wso2ApiDocument[];
  onDownload: (doc: Wso2ApiDocument) => void;
}) => {
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
          render: (rowData: Wso2ApiDocument) => (
            <Link
              href="#"
              onClick={(e: React.MouseEvent) => {
                e.preventDefault();
                onDownload(rowData);
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
