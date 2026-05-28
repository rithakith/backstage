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

import React, { useState } from 'react';
import { Box, Typography, Tooltip, IconButton } from '@material-ui/core';
import FileCopyIcon from '@material-ui/icons/FileCopy';
import CheckIcon from '@material-ui/icons/Check';

interface Wso2GatewayUrlDisplayProps {
  gatewayUrls: Array<{ url?: string }>;
}

export const Wso2GatewayUrlDisplay = ({ gatewayUrls }: Wso2GatewayUrlDisplayProps) => {
  const [copied, setCopied] = useState(false);

  if (!gatewayUrls || gatewayUrls.length === 0 || !gatewayUrls[0].url) return null;

  const url = gatewayUrls[0].url;

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Box
      mx={2}
      my={1}
      p={2}
      border={1}
      borderColor="divider"
      borderRadius={4}
      bgcolor="background.paper"
    >
      <Typography 
        variant="caption" 
        style={{ 
          fontWeight: 'bold', 
          textTransform: 'uppercase', 
          letterSpacing: '0.5px',
          color: '#718096', // Standard gray label
          display: 'block',
          marginBottom: '8px'
        }}
      >
        Server URL
      </Typography>
      <Box
        display="flex"
        alignItems="center"
        p={1.5}
        borderRadius={4}
        style={{
          backgroundColor: 'rgba(128, 128, 128, 0.06)', // Transparent gray matching dark/light mode
          border: '1px solid rgba(128, 128, 128, 0.15)',
        }}
      >
        <Typography
          variant="body2"
          style={{
            flexGrow: 1,
            wordBreak: 'break-all',
            fontFamily: '"Fira Code", "Source Code Pro", monospace',
            fontSize: '0.85rem',
          }}
        >
          {url}
        </Typography>
        <Box ml={1}>
          <Tooltip title={copied ? "Copied!" : "Copy Server URL"}>
            <IconButton 
              size="small" 
              onClick={handleCopy}
              style={{ color: copied ? '#49cc90' : 'inherit' }}
            >
              {copied ? <CheckIcon fontSize="small" /> : <FileCopyIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  );
};
