import { Box, TextField, Typography } from '@material-ui/core';

interface Wso2ExternalApiAuthSectionProps {
  apiKeyAuthPolicy: any;
  externalApiKey: string;
  setExternalApiKey: (val: string) => void;
}

export const Wso2ExternalApiAuthSection = ({
  apiKeyAuthPolicy,
  externalApiKey,
  setExternalApiKey,
}: Wso2ExternalApiAuthSectionProps) => {
  if (!apiKeyAuthPolicy) return null;

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
      <TextField
        label={`${apiKeyAuthPolicy.name || 'API Key'} (${apiKeyAuthPolicy.params?.in || 'header'})`}
        placeholder={`Enter ${apiKeyAuthPolicy.name || 'API Key'}...`}
        value={externalApiKey}
        onChange={e => setExternalApiKey(e.target.value)}
        variant="outlined"
        fullWidth
        size="small"
      />
      <Typography variant="caption" color="textSecondary" style={{ marginTop: '8px', display: 'block' }}>
        This key will be automatically added to your "Try it out" requests as specified by the API policy.
      </Typography>
    </Box>
  );
};
