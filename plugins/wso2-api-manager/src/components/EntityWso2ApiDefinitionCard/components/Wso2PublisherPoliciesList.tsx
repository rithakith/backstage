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

import React, { useState, useMemo } from 'react';
import { 
  Box, 
  Typography, 
  useTheme, 
  Accordion, 
  AccordionSummary, 
  AccordionDetails,
  Divider,
  makeStyles,
  Tooltip,
  Button
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';
import InfoIcon from '@material-ui/icons/InfoOutlined';
import { Wso2PolicyDetailsViewer, getPolicyFriendlyName } from './Wso2PolicyDetailsViewer';

const useStyles = makeStyles(theme => ({
  policyAccordion: {
    marginBottom: theme.spacing(1),
    boxShadow: 'none',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '4px !important',
    backgroundColor: theme.palette.type === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
    '&:before': {
      display: 'none',
    },
    '&.Mui-expanded': {
      backgroundColor: theme.palette.type === 'dark' ? 'rgba(255,255,255,0.04)' : 'white',
    }
  },
  policyTitle: {
    fontWeight: 700,
    fontSize: '1rem',
    color: theme.palette.type === 'dark' ? '#e0e0e0' : '#333333',
    letterSpacing: '0.2px',
  }
}));

// Shared mini pagination control
const PolicyPagination = ({ 
  currentPage, 
  totalPages, 
  onPageChange 
}: { 
  currentPage: number; 
  totalPages: number; 
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;
  return (
    <Box display="flex" alignItems="center" justifyContent="center" mt={2} mb={1} style={{ gap: '12px' }}>
      <Button
        size="small"
        variant="outlined"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
        style={{ textTransform: 'none', minWidth: '70px' }}
      >
        &lt; Prev
      </Button>
      <Typography variant="caption" color="textSecondary" style={{ fontWeight: 600 }}>
        Page {currentPage} of {totalPages}
      </Typography>
      <Button
        size="small"
        variant="outlined"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
        style={{ textTransform: 'none', minWidth: '70px' }}
      >
        Next &gt;
      </Button>
    </Box>
  );
};

// Stateful sub-component for paginated flow-level policies
const Wso2PolicyFlowList = ({ 
  flowType, 
  policies, 
  classes 
}: { 
  flowType: string; 
  policies: any[]; 
  classes: any; 
}) => {
  const [page, setPage] = useState(1);
  const itemsPerPage = 5;

  if (!policies || policies.length === 0) return null;

  const totalPages = Math.ceil(policies.length / itemsPerPage);
  const paginatedPolicies = policies.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <Box mb={2} width="100%">
      <Typography variant="caption" style={{ fontWeight: 'bold', display: 'block', marginBottom: '12px', opacity: 0.6 }}>
        {flowType.toUpperCase()} FLOW ({policies.length} {policies.length === 1 ? 'policy' : 'policies'})
      </Typography>
      <Box>
        {paginatedPolicies.map((policy: any, idx: number) => {
          const hasParams = (policy.parameters && Object.keys(policy.parameters).length > 0) || (policy.params && Object.keys(policy.params).length > 0);
          const policyName = policy.policyName || policy.name || 'Unknown';
          const version = policy.policyVersion || policy.version || 'N/A';

          return (
            <Accordion key={`${flowType}-${idx}`} className={classes.policyAccordion} elevation={0}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Box>
                  <Typography className={classes.policyTitle}>
                    {getPolicyFriendlyName(policyName)} 
                    <span style={{ fontWeight: 400, opacity: 0.5, fontSize: '0.75rem', marginLeft: '8px' }}>
                       ({version})
                     </span>
                  </Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails style={{ display: 'block', padding: 0 }}>
                {hasParams ? (
                  <Wso2PolicyDetailsViewer 
                    parameters={policy.parameters || policy.params} 
                  />
                ) : (
                  <Box p={2}>
                    <Typography variant="body2" color="textSecondary">
                      This policy has no configurable parameters.
                    </Typography>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          );
        })}
      </Box>
      <PolicyPagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
    </Box>
  );
};

export const Wso2PublisherPoliciesList = ({ 
  details,
  gatewayOperations = [],
  gatewayApiPolicies = {}
}: { 
  details?: any,
  gatewayOperations?: any[],
  gatewayApiPolicies?: any
}) => {
  const theme = useTheme();
  const classes = useStyles();

  const [opPage, setOpPage] = useState(1);
  const opsPerPage = 5;

  const getMethodColors = (method: string) => {
    const m = (method || '').toUpperCase();
    if (m === 'GET') return { main: '#61affe', light: 'rgba(97, 175, 254, 0.1)' };
    if (m === 'POST') return { main: '#49cc90', light: 'rgba(73, 204, 144, 0.1)' };
    if (m === 'PUT') return { main: '#fca130', light: 'rgba(252, 161, 48, 0.1)' };
    if (m === 'DELETE') return { main: '#f93e3e', light: 'rgba(249, 62, 62, 0.1)' };
    if (m === 'PATCH') return { main: '#50e3c2', light: 'rgba(80, 227, 194, 0.1)' };
    return { main: '#9012fe', light: 'rgba(144, 18, 254, 0.1)' };
  };

  // Merge Publisher details with Gateway data if needed
  const rawApiPolicies = gatewayApiPolicies && Object.keys(gatewayApiPolicies).length > 0 
    ? gatewayApiPolicies 
    : (details?.apiPolicies || {});
    
  const apiPolicies = useMemo(() => {
    if (Array.isArray(rawApiPolicies)) {
      return { request: rawApiPolicies, response: [], fault: [] };
    }
    return {
      request: rawApiPolicies.request || [],
      response: rawApiPolicies.response || [],
      fault: rawApiPolicies.fault || [],
    };
  }, [rawApiPolicies]);

  const operations = gatewayOperations && gatewayOperations.length > 0 
    ? gatewayOperations 
    : (details?.operations || []);

  const hasApiPolicies = (apiPolicies.request?.length > 0) || (apiPolicies.response?.length > 0) || (apiPolicies.fault?.length > 0);

  const totalOpPages = Math.ceil(operations.length / opsPerPage);
  const paginatedOperations = operations.slice((opPage - 1) * opsPerPage, opPage * opsPerPage);

  return (
    <Box p={2}>
      {hasApiPolicies && (
        <Box mb={4}>
          <Box display="flex" alignItems="center" mb={1}>
            <Typography
              variant="subtitle1"
              style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              Global API Policies
            </Typography>
            <Tooltip title="Policies applied globally across all resources and operations of this API." arrow>
              <InfoIcon style={{ fontSize: '1rem', marginLeft: '8px', cursor: 'pointer', opacity: 0.6 }} />
            </Tooltip>
          </Box>
          <Box p={0.5}>
            <Wso2PolicyFlowList flowType="Request" policies={apiPolicies.request} classes={classes} />
            <Wso2PolicyFlowList flowType="Response" policies={apiPolicies.response} classes={classes} />
            <Wso2PolicyFlowList flowType="Fault" policies={apiPolicies.fault} classes={classes} />
          </Box>
        </Box>
      )}

      {operations && operations.length > 0 && (
        <>
          <Box display="flex" alignItems="center" mb={1}>
            <Typography
              variant="subtitle1"
              style={{ fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '1px' }}
            >
              Operation Level Policies
            </Typography>
            <Tooltip title="Policies applied specifically to individual HTTP verbs and sub-paths of this API." arrow>
              <InfoIcon style={{ fontSize: '1rem', marginLeft: '8px', cursor: 'pointer', opacity: 0.6 }} />
            </Tooltip>
          </Box>

          <Box>
            {paginatedOperations.map((op: any, idx: number) => {
              const rawOpPolicies = op.operationPolicies || op.policies || {};
              const opPolicies = Array.isArray(rawOpPolicies) 
                ? { request: rawOpPolicies, response: [], fault: [] }
                : {
                    request: rawOpPolicies.request || [],
                    response: rawOpPolicies.response || [],
                    fault: rawOpPolicies.fault || [],
                  };
              
              const hasOpPolicies = (opPolicies.request?.length > 0) || (opPolicies.response?.length > 0) || (opPolicies.fault?.length > 0);
              const colors = getMethodColors(op.verb || op.method);
              
              return (
                <Accordion 
                  key={idx} 
                  elevation={0} 
                  style={{ 
                    marginBottom: '8px', 
                    border: `1px solid ${colors.main}`, 
                    borderRadius: '4px',
                    backgroundColor: colors.light
                  }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box display="flex" alignItems="center">
                      <Box
                        px={1.5}
                        py={0.5}
                        mr={2}
                        borderRadius={4}
                        style={{
                          backgroundColor: colors.main,
                          color: 'white',
                          fontWeight: 'bold',
                          minWidth: '80px',
                          textAlign: 'center',
                          fontSize: '0.75rem',
                        }}
                      >
                        {(op.verb || op.method || 'UNKNOWN').toUpperCase()}
                      </Box>
                      <Typography
                        variant="body2"
                        style={{
                          fontFamily: '"Roboto Mono", monospace',
                          fontWeight: 600,
                          color: theme.palette.text.primary,
                        }}
                      >
                        {op.target || op.path}
                      </Typography>
                      {!hasOpPolicies && (
                        <Typography variant="caption" style={{ marginLeft: '16px', opacity: 0.5 }}>
                          (No policies)
                        </Typography>
                      )}
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails style={{ display: 'block', padding: theme.spacing(2) }}>
                    <Box width="100%">
                      {hasOpPolicies ? (
                        <>
                          <Wso2PolicyFlowList flowType="Request" policies={opPolicies.request} classes={classes} />
                          {opPolicies.response?.length > 0 && (
                            <>
                              <Divider style={{ margin: '16px 0' }} />
                              <Wso2PolicyFlowList flowType="Response" policies={opPolicies.response} classes={classes} />
                            </>
                          )}
                          {opPolicies.fault?.length > 0 && (
                            <>
                              <Divider style={{ margin: '16px 0' }} />
                              <Wso2PolicyFlowList flowType="Fault" policies={opPolicies.fault} classes={classes} />
                            </>
                          )}
                        </>
                      ) : (
                        <Typography variant="body2" color="textSecondary">
                          No operation-level policies configured for this resource.
                        </Typography>
                      )}
                    </Box>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
          <PolicyPagination currentPage={opPage} totalPages={totalOpPages} onPageChange={setOpPage} />
        </>
      )}
    </Box>
  );
};
