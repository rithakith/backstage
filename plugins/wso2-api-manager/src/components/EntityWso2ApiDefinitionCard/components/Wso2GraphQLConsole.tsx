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
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
} from '@material-ui/core';
import { Alert } from '@material-ui/lab';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import CheckIcon from '@material-ui/icons/Check';
import AddIcon from '@material-ui/icons/Add';
import DeleteIcon from '@material-ui/icons/Delete';
import { formatGraphQL } from '../../../utils';

interface Wso2GraphQLConsoleProps {
  definition: string;
  gatewayUrls: Array<{ environmentName: string; url: string; environmentType?: string; description?: string }>;
  apiKeyRef: React.MutableRefObject<string | null>;
  externalApiKey: string;
  apiKeyAuthPolicy: any;
  isDeployed?: boolean;
}

export const Wso2GraphQLConsole = ({
  definition,
  gatewayUrls,
  apiKeyRef,
  externalApiKey,
  apiKeyAuthPolicy,
  isDeployed = true,
}: Wso2GraphQLConsoleProps) => {
  const [selectedUrl, setSelectedUrl] = useState('');
  const [customUrl, setCustomUrl] = useState('');
  const [query, setQuery] = useState(
    '# Write your GraphQL Query or Mutation here\nquery MyQuery {\n  __typename\n}'
  );
  const [variables, setVariables] = useState('{\n  \n}');
  const [copied, setCopied] = useState(false);

  // Custom Headers list state
  const [customHeaders, setCustomHeaders] = useState<Array<{ key: string; value: string }>>([]);

  // Initialize selected URL
  useEffect(() => {
    if (gatewayUrls && gatewayUrls.length > 0) {
      setSelectedUrl(gatewayUrls[0].url);
    }
  }, [gatewayUrls]);

  const activeUrl = selectedUrl === 'custom' ? customUrl : selectedUrl;

  // Compile active auto-injected headers
  const authHeaders = useMemo(() => {
    const headers: Record<string, string> = {};

    const currentKey = apiKeyRef.current;
    if (currentKey !== null) {
      headers['ApiKey'] = currentKey;
    }

    if (externalApiKey && apiKeyAuthPolicy) {
      const { in: location, key } = apiKeyAuthPolicy.params || {};
      if (location === 'header') {
        headers[key || 'x-api-key'] = externalApiKey;
      }
    }

    return headers;
  }, [apiKeyRef, externalApiKey, apiKeyAuthPolicy]);

  // Combine auth and user-defined custom headers
  const allHeaders = useMemo(() => {
    const combined = { ...authHeaders };
    customHeaders.forEach(({ key, value }) => {
      const trimmedKey = key.trim();
      const trimmedValue = value.trim();
      if (trimmedKey) {
        combined[trimmedKey] = trimmedValue;
      }
    });
    return combined;
  }, [authHeaders, customHeaders]);

  // Generate curl command
  const generatedCurl = useMemo(() => {
    const endpoint = activeUrl || 'https://gateway.wso2.com/graphql';

    let variablesObj = {};
    if (variables.trim()) {
      try {
        variablesObj = JSON.parse(variables.trim());
      } catch (e) {
        // Safe fallback in case of syntax error while typing
      }
    }

    const payload = {
      query: query,
      variables: variablesObj,
    };

    const headerLines = Object.entries(allHeaders)
      .filter(([_, val]) => !!val)
      .map(([key, val]) => `  -H "${key}: ${val}"`)
      .join(' \\\n');

    const jsonPayload = JSON.stringify(payload, null, 2);
    // Escape single quotes for standard bash execution
    const escapedPayload = jsonPayload.replace(/'/g, "'\\''");

    return `curl -X POST "${endpoint}" \\\n  -H "Content-Type: application/json" \\\n${
      headerLines ? headerLines + ' \\\n' : ''
    }  -d '${escapedPayload}'`;
  }, [activeUrl, query, variables, allHeaders]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedCurl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddHeader = () => {
    setCustomHeaders([...customHeaders, { key: '', value: '' }]);
  };

  const handleUpdateHeader = (index: number, field: 'key' | 'value', value: string) => {
    const updated = [...customHeaders];
    updated[index][field] = value;
    setCustomHeaders(updated);
  };

  const handleRemoveHeader = (index: number) => {
    const updated = [...customHeaders];
    updated.splice(index, 1);
    setCustomHeaders(updated);
  };

  // Format definition using formatGraphQL
  const formattedSdl = useMemo(() => {
    return formatGraphQL(definition || '');
  }, [definition]);

  return (
    <Box p={3}>
      <Typography variant="h5" style={{ fontWeight: 600, marginBottom: '8px' }}>
        GraphQL Console (GraphiQL View)
      </Typography>
      <Typography variant="body2" color="textSecondary" style={{ marginBottom: '24px' }}>
        Author your GraphQL commands and dynamically compile the exact `curl` statement, complete with your current gateway environments and credentials.
      </Typography>

      {!isDeployed && (
        <Box mb={3}>
          <Alert severity="info">
            <strong>Not Deployed:</strong> This API is not deployed to any gateway. Try it out functionality is disabled.
          </Alert>
        </Box>
      )}

      <Grid container spacing={3}>
        {/* Left Side: Editors and Custom Headers */}
        {isDeployed && (
        <Grid item xs={12} md={6}>
          {/* Endpoint/Gateway Selector */}
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
                      {gatewayUrls.map(urlObj => (
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

          {/* GraphQL Query Editor */}
          <Card style={{ marginBottom: '16px' }}>
            <CardContent>
              <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: '12px' }}>
                Query / Mutation
              </Typography>
              <TextField
                multiline
                rows={12}
                fullWidth
                variant="outlined"
                value={query}
                onChange={e => setQuery(e.target.value)}
                inputProps={{
                  style: {
                    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
                    fontSize: '13px',
                  },
                }}
              />
            </CardContent>
          </Card>

          {/* Variables Accordion */}
          <Accordion style={{ marginBottom: '16px' }} defaultExpanded={false}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                Query Variables (JSON)
              </Typography>
            </AccordionSummary>
            <AccordionDetails style={{ flexDirection: 'column' }}>
              <TextField
                multiline
                rows={4}
                fullWidth
                variant="outlined"
                value={variables}
                onChange={e => setVariables(e.target.value)}
                placeholder={"{\n  \"id\": \"1\"\n}"}
                inputProps={{
                  style: {
                    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
                    fontSize: '13px',
                  },
                }}
              />
            </AccordionDetails>
          </Accordion>

          {/* Headers Accordion */}
          <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                Authentication & Headers
              </Typography>
            </AccordionSummary>
            <AccordionDetails style={{ flexDirection: 'column' }}>
              {/* Auto-injected Gateway headers */}
              <Box mb={2}>
                <Typography variant="caption" color="textSecondary" style={{ fontWeight: 'bold', display: 'block', marginBottom: '8px' }}>
                  Auto-Injected Authentication Keys
                </Typography>
                {Object.keys(authHeaders).length === 0 ? (
                  <Typography variant="body2" color="textSecondary" style={{ fontStyle: 'italic' }}>
                    No keys generated yet. Use the Auth panel above to configure.
                  </Typography>
                ) : (
                  Object.entries(authHeaders).map(([key, val]) => (
                    <Box
                      key={key}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      bgcolor="action.hover"
                      p={1}
                      borderRadius={4}
                      mb={1}
                    >
                      <Typography variant="body2" style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {key}
                      </Typography>
                      <Typography variant="body2" style={{ fontFamily: 'monospace', color: '#ff5000' }}>
                        ●●●●●●●●●●●●● (Auto)
                      </Typography>
                    </Box>
                  ))
                )}
              </Box>

              {/* User Custom headers */}
              <Box mt={1}>
                <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                  <Typography variant="caption" color="textSecondary" style={{ fontWeight: 'bold' }}>
                    Custom Headers
                  </Typography>
                  <Button
                    size="small"
                    color="primary"
                    startIcon={<AddIcon />}
                    onClick={handleAddHeader}
                    style={{ textTransform: 'none' }}
                  >
                    Add Header
                  </Button>
                </Box>

                {customHeaders.length === 0 ? (
                  <Typography variant="body2" color="textSecondary" style={{ fontStyle: 'italic', padding: '8px 0' }}>
                    No custom headers configured.
                  </Typography>
                ) : (
                  customHeaders.map((hdr, idx) => (
                    <Box key={idx} display="flex" alignItems="center" mb={1}>
                      <TextField
                        size="small"
                        label="Header Name"
                        variant="outlined"
                        value={hdr.key}
                        onChange={e => handleUpdateHeader(idx, 'key', e.target.value)}
                        style={{ marginRight: '8px', flex: 1 }}
                        placeholder="Authorization"
                      />
                      <TextField
                        size="small"
                        label="Value"
                        variant="outlined"
                        value={hdr.value}
                        onChange={e => handleUpdateHeader(idx, 'value', e.target.value)}
                        style={{ marginRight: '8px', flex: 1.5 }}
                        placeholder="Bearer token..."
                      />
                      <IconButton size="small" onClick={() => handleRemoveHeader(idx)} color="secondary">
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  ))
                )}
              </Box>
            </AccordionDetails>
          </Accordion>
        </Grid>
        )}

        {/* Right Side: Compiled Curl & SDL explorer */}
        <Grid item xs={12} md={isDeployed ? 6 : 12}>
          {/* Curl Command Display */}
          {isDeployed && (
          <Card style={{ marginBottom: '16px' }}>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="subtitle2" style={{ fontWeight: 600 }}>
                  Generated Curl Statement
                </Typography>
                <Button
                  variant="outlined"
                  size="small"
                  color={copied ? 'secondary' : 'default'}
                  onClick={handleCopy}
                  startIcon={copied ? <CheckIcon /> : <FileCopyIcon />}
                  style={{ textTransform: 'none' }}
                >
                  {copied ? 'Copied' : 'Copy curl'}
                </Button>
              </Box>
              <Box
                bgcolor="code.background"
                color="code.color"
                p={2}
                borderRadius={4}
                style={{
                  backgroundColor: '#1E1E1E',
                  color: '#D4D4D4',
                  overflowX: 'auto',
                  border: '1px solid #333',
                  borderRadius: '6px',
                }}
              >
                <pre
                  style={{
                    margin: 0,
                    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
                    fontSize: '12px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    lineHeight: '1.5',
                  }}
                >
                  {generatedCurl}
                </pre>
              </Box>
            </CardContent>
          </Card>
          )}

          {/* GraphQL SDL Schema Viewer */}
          <Card>
            <CardContent>
              <Typography variant="subtitle2" style={{ fontWeight: 600, marginBottom: '12px' }}>
                GraphQL Schema (SDL) Reference
              </Typography>
              <Box
                p={2}
                style={{
                  backgroundColor: '#0F172A',
                  color: '#94A3B8',
                  borderRadius: '6px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  border: '1px solid #1E293B',
                }}
              >
                {formattedSdl ? (
                  <pre
                    style={{
                      margin: 0,
                      fontFamily: '"Fira Code", "Courier New", Courier, monospace',
                      fontSize: '12.5px',
                      whiteSpace: 'pre-wrap',
                      lineHeight: '1.6',
                    }}
                  >
                    {formattedSdl}
                  </pre>
                ) : (
                  <Typography variant="body2" color="textSecondary" style={{ fontStyle: 'italic' }}>
                    No GraphQL Schema definition content available.
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};
