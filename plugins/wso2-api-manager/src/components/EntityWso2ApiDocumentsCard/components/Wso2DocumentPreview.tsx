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
import {
  Box,
  Typography,
  Divider,
  Button,
  IconButton,
  Chip,
  Paper,
} from '@material-ui/core';
import ArrowBackIcon from '@material-ui/icons/ArrowBack';
import GetAppIcon from '@material-ui/icons/GetApp';
import {
  Progress,
  MarkdownContent,
} from '@backstage/core-components';
import { Wso2ApiDocument } from '../../../api';

export const Wso2DocumentPreview = (options: {
  previewDoc: Wso2ApiDocument | null;
  previewContent: string | null;
  loadingPreview: boolean;
  showBackButton: boolean;
  onBack: () => void;
  onDownload: (doc: Wso2ApiDocument) => void;
}) => {
  const {
    previewDoc,
    previewContent,
    loadingPreview,
    showBackButton,
    onBack,
    onDownload,
  } = options;

  if (!previewDoc) return null;

  return (
    <Box>
      <Box
        display="flex"
        alignItems="center"
        mb={2}
        justifyContent="space-between"
      >
        <Box display="flex" alignItems="center">
          {showBackButton && (
            <IconButton onClick={onBack} style={{ marginRight: 8 }}>
              <ArrowBackIcon />
            </IconButton>
          )}
        </Box>
        {previewDoc.sourceType !== 'INLINE' &&
          previewDoc.sourceType !== 'MARKDOWN' && (
            <Button
              startIcon={<GetAppIcon />}
              onClick={() => onDownload(previewDoc)}
              variant="outlined"
              size="small"
            >
              Download
            </Button>
          )}
      </Box>
      <Divider />
      <Box mt={2}>
        {loadingPreview ? (
          <Progress />
        ) : (
          <Paper
            elevation={3}
            style={{
              backgroundColor: '#fff',
              color: '#000',
              padding: '40px',
              maxHeight: 'calc(100vh - 300px)',
              overflowY: 'auto',
              minHeight: '500px',
              border: '1px solid #eee',
            }}
          >
            <Typography
              variant="h4"
              style={{ fontWeight: 700, marginBottom: 16 }}
            >
              {previewDoc.name}
            </Typography>
            <Box mb={4} display="flex" style={{ gap: '12px' }}>
              <Chip size="small" label={previewDoc.type} />
              <Chip
                size="small"
                label={previewDoc.sourceType}
                variant="outlined"
              />
            </Box>
            <Divider style={{ marginBottom: 32 }} />

            {previewDoc.sourceType === 'MARKDOWN' ||
            previewDoc.sourceType === 'INLINE' ? (
              <MarkdownContent content={previewContent || ''} />
            ) : (
              <pre
                style={{
                  whiteSpace: 'pre-wrap',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  lineHeight: 1.6,
                }}
              >
                {previewContent}
              </pre>
            )}
          </Paper>
        )}
      </Box>
    </Box>
  );
};
