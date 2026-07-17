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

import React, { useState, useMemo, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  TextField,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import { GraphiQL } from 'graphiql';
import { buildSchema } from 'graphql';
import 'graphiql/graphiql.css';
import { Wso2ApiDetail } from '../../../api';

interface Wso2GraphQLConsoleProps {
  definition: string;
  gatewayUrls: Array<{ environmentName: string; url: string; environmentType?: string; description?: string }>;
  apiKeyRef: React.MutableRefObject<string | null>;
  externalApiKey: string;
  apiKeyAuthPolicy: any;
  isDeployed?: boolean;
  details?: Wso2ApiDetail;
}

export const Wso2GraphQLConsole = ({
  definition,
  gatewayUrls,
  apiKeyRef,
  externalApiKey,
  apiKeyAuthPolicy,
  isDeployed = true,
  details,
}: Wso2GraphQLConsoleProps) => {
  const [selectedUrl, setSelectedUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  // Initialize selected URL
  useEffect(() => {
    if (gatewayUrls && gatewayUrls.length > 0) {
      setSelectedUrl(gatewayUrls[0].url);
    }
  }, [gatewayUrls]);

  const activeUrl = selectedUrl === 'custom' ? customUrl : selectedUrl;

  const fetcher = useMemo(() => {
    if (!activeUrl) return null;
    return async (graphQLParams: any) => {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const currentKey = apiKeyRef.current;
      if (currentKey !== null) {
        const headerName = details?.apiKeyHeader || 'apikey';
        headers[headerName] = currentKey;
      }

      if (externalApiKey && apiKeyAuthPolicy) {
        const { in: location, key } = apiKeyAuthPolicy.params || {};
        if (location === 'header') {
          headers[key || 'x-api-key'] = externalApiKey;
        }
      }

      const response = await fetch(activeUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(graphQLParams),
      });
      return response.json();
    };
  }, [activeUrl, apiKeyRef, externalApiKey, apiKeyAuthPolicy]);

  const schema = useMemo(() => {
    try {
      if (definition) {
        return buildSchema(definition);
      }
    } catch (e) {
      console.error('Error parsing GraphQL schema:', e);
    }
    return undefined;
  }, [definition]);

  return (
    <Box p={3}>
      <Typography variant="h5" style={{ fontWeight: 600, marginBottom: '8px' }}>
        GraphQL Console (GraphiQL View)
      </Typography>
      <Typography variant="body2" color="textSecondary" style={{ marginBottom: '24px' }}>
        Author your GraphQL commands and test them dynamically against your current gateway environments.
      </Typography>

      {!isDeployed && (
        <Box mb={3}>
          <Alert severity="info">
            <strong>Not Deployed:</strong> This API is not deployed to any gateway. Try it out functionality is disabled.
          </Alert>
        </Box>
      )}

      {isDeployed && (
        <>
          <Card style={{ marginBottom: '16px' }}>
            <CardContent>
              <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: '12px' }}>
                Gateway Endpoint
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={selectedUrl === 'custom' ? 6 : 12}>
                  <FormControl variant="outlined" fullWidth size="small">
                    <InputLabel id="graphql-endpoint-label">Select Gateway Environment</InputLabel>
                    <Select
                      labelId="graphql-endpoint-label"
                      value={selectedUrl}
                      onChange={e => setSelectedUrl(e.target.value as string)}
                      label="Select Gateway Environment"
                    >
                      {gatewayUrls && gatewayUrls.map(urlObj => (
                        <MenuItem key={urlObj.url} value={urlObj.url}>
                          {urlObj.description || urlObj.environmentName || urlObj.url} ({urlObj.url})
                        </MenuItem>
                      ))}
                      <MenuItem value="custom">Custom Endpoint URL...</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {selectedUrl === 'custom' && (
                  <Grid item xs={12} sm={6}>
                    <TextField
                      label="Custom Endpoint URL"
                      variant="outlined"
                      size="small"
                      fullWidth
                      value={customUrl}
                      onChange={e => setCustomUrl(e.target.value)}
                      placeholder="https://mygateway.com/graphql"
                    />
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>

          {fetcher && (
            <Card>
              <CardContent style={{ padding: 0, height: '600px', display: 'flex' }}>
                <Box style={{ flex: 1, minHeight: '600px' }}>
                  <GraphiQL 
                    fetcher={fetcher} 
                    schema={schema}
                    defaultQuery="# Write your GraphQL Query or Mutation here\nquery MyQuery {\n  __typename\n}"
                  />
                </Box>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </Box>
  );
};
