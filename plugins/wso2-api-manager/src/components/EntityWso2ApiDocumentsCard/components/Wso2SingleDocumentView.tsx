/*
 * Copyright 2026 WSO2 LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import React from 'react';
import { Box, Typography, Chip, Button } from '@material-ui/core';
import GetAppIcon from '@material-ui/icons/GetApp';
import { Wso2ApiDocument } from '../../../api';

export const Wso2SingleDocumentView = (options: {
  document: Wso2ApiDocument;
  onDownload: (doc: Wso2ApiDocument) => void;
  renderPreview: () => React.ReactNode;
}) => {
  const { document: doc, onDownload, renderPreview } = options;
  const isPreviewable =
    doc.sourceType === 'MARKDOWN' || doc.sourceType === 'INLINE';

  if (isPreviewable) {
    return <>{renderPreview()}</>;
  }

  return (
    <Box
      p={2}
      textAlign="center"
      border={1}
      borderColor="divider"
      borderRadius={4}
    >
      <Typography variant="h5" gutterBottom>
        {doc.name}
      </Typography>
      <Box mb={2}>
        <Chip
          label={doc.type}
          color="primary"
          variant="outlined"
          style={{ marginRight: 8 }}
        />
        <Chip label={doc.sourceType} variant="outlined" />
      </Box>
      <Typography variant="body1" color="textSecondary" paragraph>
        {doc.summary || 'This API has a single documentation resource available.'}
      </Typography>
      <Box mt={2}>
        {doc.sourceType !== 'INLINE' && doc.sourceType !== 'MARKDOWN' && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<GetAppIcon />}
            onClick={() => onDownload(doc)}
          >
            Download Document
          </Button>
        )}
      </Box>
    </Box>
  );
};
