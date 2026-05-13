import React from 'react';
import { 
  Box, 
  Typography, 
  TextField, 
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  makeStyles
} from '@material-ui/core';
import ExpandMoreIcon from '@material-ui/icons/ExpandMore';

const useStyles = makeStyles(theme => ({
  root: {
    padding: theme.spacing(2),
    backgroundColor: 'transparent',
  },
  simpleFieldsContainer: {
    marginBottom: theme.spacing(3),
    padding: theme.spacing(2),
    borderRadius: '8px',
    border: `1px solid ${theme.palette.divider}`,
    backgroundColor: theme.palette.type === 'dark' ? 'rgba(255,255,255,0.02)' : 'white',
  },
  fieldBox: {
    marginBottom: theme.spacing(1),
  },
  label: {
    fontWeight: 600,
    fontSize: '0.75rem',
    color: theme.palette.text.secondary,
    textTransform: 'uppercase',
    letterSpacing: '1px',
    marginBottom: theme.spacing(0.5),
  },
  readOnlyField: {
    '& .MuiOutlinedInput-root': {
      backgroundColor: theme.palette.type === 'dark' ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
      fontSize: '0.875rem',
      '& fieldset': {
        borderColor: theme.palette.divider,
      },
    },
  },
  subAccordion: {
    marginBottom: theme.spacing(1.5),
    boxShadow: 'none',
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: '8px !important',
    overflow: 'hidden',
    '&:before': {
      display: 'none',
    },
    '&.Mui-expanded': {
      border: `1px solid ${theme.palette.divider}`,
    }
  },
  subAccordionSummary: {
    backgroundColor: theme.palette.type === 'dark' ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
    minHeight: '48px !important',
    '& .MuiAccordionSummary-content': {
      margin: '12px 0 !important',
    }
  },
  subAccordionTitle: {
    fontWeight: 700,
    fontSize: '0.8125rem',
    color: theme.palette.text.primary,
  },
  codeBlock: {
    backgroundColor: '#1e1e1e',
    color: '#d4d4d4',
    padding: theme.spacing(2),
    borderRadius: '4px',
    fontFamily: '"Roboto Mono", monospace',
    fontSize: '0.8125rem',
    overflowX: 'auto',
    margin: 0,
    lineHeight: 1.6,
  }
}));

export const humanize = (str: string): string => {
  if (!str) return '';
  let result = str.replace(/[-_]/g, ' ');
  result = result.replace(/([A-Z])/g, ' $1');
  return result
    .trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
};

const SimpleField = ({ label, value, classes }: any) => (
  <Grid item xs={12} sm={6} md={4}>
    <Box className={classes.fieldBox}>
      <Typography className={classes.label}>{humanize(label)}</Typography>
      <TextField
        value={String(value ?? '—')}
        variant="outlined"
        fullWidth
        size="small"
        className={classes.readOnlyField}
        InputProps={{ readOnly: true }}
      />
    </Box>
  </Grid>
);

const SubSectionTile = ({ label, value, classes }: any) => (
  <Accordion className={classes.subAccordion} elevation={0}>
    <AccordionSummary expandIcon={<ExpandMoreIcon />} className={classes.subAccordionSummary}>
      <Typography className={classes.subAccordionTitle}>
        {humanize(label)} CONFIGURATION
      </Typography>
    </AccordionSummary>
    <AccordionDetails style={{ display: 'block', padding: 0 }}>
      <Box component="pre" className={classes.codeBlock}>
        {JSON.stringify(value, null, 2)}
      </Box>
    </AccordionDetails>
  </Accordion>
);

export const Wso2PolicyDetailsViewer = ({ parameters }: { parameters: any }) => {
  const classes = useStyles();

  if (!parameters || Object.keys(parameters).length === 0) {
    return (
      <Box p={3} textAlign="center">
        <Typography variant="body2" color="textSecondary">
          No configuration parameters found for this policy.
        </Typography>
      </Box>
    );
  }

  const entries = Object.entries(parameters);
  const simpleFields = entries.filter(([_, v]) => typeof v !== 'object' || v === null);
  const complexFields = entries.filter(([_, v]) => typeof v === 'object' && v !== null);

  return (
    <Box className={classes.root}>
      {/* Simple Fields Grid */}
      {simpleFields.length > 0 && (
        <Box className={classes.simpleFieldsContainer}>
          <Typography variant="caption" style={{ fontWeight: 800, color: '#666', display: 'block', marginBottom: '16px' }}>
            BASIC PARAMETERS
          </Typography>
          <Grid container spacing={2}>
            {simpleFields.map(([key, value]) => (
              <SimpleField key={key} label={key} value={value} classes={classes} />
            ))}
          </Grid>
        </Box>
      )}

      {/* Complex Fields (Tiles) */}
      {complexFields.map(([key, value]) => (
        <SubSectionTile key={key} label={key} value={value} classes={classes} />
      ))}
    </Box>
  );
};

export { humanize as getPolicyFriendlyName };
