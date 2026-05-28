import {
  Box,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
  InputAdornment,
  Tooltip,
  IconButton,
  CircularProgress,
} from '@material-ui/core';
import ContentCopyIcon from '@material-ui/icons/FileCopy';

interface Wso2ApiAuthSectionProps {
  manualKeyInput: string;
  setManualKeyInput: (val: string) => void;
  applyManualKey: (val: string) => void;
  isModalOpen: boolean;
  setIsModalOpen: (val: boolean) => void;
  customKeyName: string;
  setCustomKeyName: (val: string) => void;
  generatedKey: string | null;
  setGeneratedKey: (val: string | null) => void;
  apiClient: any;
  apiId: string;
  isKeyLoading: boolean;
}

export const Wso2ApiAuthSection = ({
  manualKeyInput,
  setManualKeyInput,
  applyManualKey,
  isModalOpen,
  setIsModalOpen,
  customKeyName,
  setCustomKeyName,
  generatedKey,
  setGeneratedKey,
  apiClient,
  apiId,
  isKeyLoading,
}: Wso2ApiAuthSectionProps) => {
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
      <Box display="flex" mt={1} alignItems="center">
        <TextField
          label="API Key"
          placeholder="Paste your API key here..."
          value={manualKeyInput}
          onChange={(e) => {
            const val = e.target.value;
            setManualKeyInput(val);
            applyManualKey(val); // Apply even if blank
          }}
          variant="outlined"
          size="small"
          style={{ width: '400px', marginRight: '32px' }}
          InputProps={{
            style: { fontFamily: '"Roboto Mono", monospace', fontSize: '0.8125rem' },
          }}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={() => {
            setGeneratedKey(null);
            setIsModalOpen(true);
          }}
          style={{ textTransform: 'none', height: '40px', minWidth: '160px' }}
        >
          Create New Key
        </Button>
      </Box>

      {/* Generation Modal */}
      <Dialog 
        open={isModalOpen} 
        onClose={() => setIsModalOpen(false)}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Generate New API Key</DialogTitle>
        <DialogContent>
          {!generatedKey ? (
            <Box py={2}>
              <Typography variant="body2" gutterBottom>
                Provide a name for your new API key. This key will be generated using the service account.
              </Typography>
              <TextField
                autoFocus
                label="Key Name"
                placeholder="e.g. My_Dev_Key"
                value={customKeyName}
                onChange={(e) => setCustomKeyName(e.target.value)}
                variant="outlined"
                fullWidth
                margin="normal"
              />
            </Box>
          ) : (
            <Box py={2}>
              <Typography variant="body2" gutterBottom color="textSecondary">
                Your new API key has been generated. Please copy it now, as it will not be shown again.
              </Typography>
              <TextField
                label="New API Key"
                value={generatedKey}
                variant="outlined"
                fullWidth
                margin="normal"
                InputProps={{
                  readOnly: true,
                  style: { fontFamily: '"Roboto Mono", monospace', fontSize: '0.8125rem' },
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Copy Key">
                        <IconButton size="small" onClick={() => navigator.clipboard.writeText(generatedKey)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  )
                }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions style={{ padding: '16px 24px' }}>
          <Button onClick={() => setIsModalOpen(false)} color="default">
            {generatedKey ? 'Close' : 'Cancel'}
          </Button>
          {!generatedKey && (
            <Button
              onClick={async () => {
                const result = await apiClient.generateApiKey(apiId, { keyName: customKeyName });
                if (result && (result.apikey || result.internalKey)) {
                  setGeneratedKey(result.apikey || result.internalKey);
                }
              }}
              color="primary"
              variant="contained"
              disabled={isKeyLoading}
            >
              {isKeyLoading ? <CircularProgress size={24} color="inherit" /> : 'Generate'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};
