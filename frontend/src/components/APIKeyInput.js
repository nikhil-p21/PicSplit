// src/components/APIKeyInput.js
import React, { useState } from 'react';
import { Box, TextField, InputAdornment, IconButton, Link, Typography, Paper } from '@mui/material';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import InfoIcon from '@mui/icons-material/Info';

const APIKeyInput = ({ apiKey, onApiKeyChange }) => {
  const [showApiKey, setShowApiKey] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  return (
    <Box sx={{ mb: 3 }}>
      <TextField
        fullWidth
        label="Gemini API Key"
        variant="outlined"
        value={apiKey}
        onChange={(e) => onApiKeyChange(e.target.value)}
        type={showApiKey ? 'text' : 'password'}
        placeholder="Enter your Gemini API key"
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                onClick={() => setShowApiKey(!showApiKey)}
                edge="end"
              >
                {showApiKey ? <VisibilityOff /> : <Visibility />}
              </IconButton>
              <IconButton
                onClick={() => setShowHelp(!showHelp)}
                edge="end"
              >
                <InfoIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
      
      {showHelp && (
        <Paper sx={{ mt: 2, p: 2, bgcolor: '#f5f5f5' }}>
          <Typography variant="body2" paragraph>
            To use this app, you need a Gemini API key from Google.
          </Typography>
          <Typography variant="body2">
            You can get an API key by visiting the{' '}
            <Link href="https://ai.google.dev/" target="_blank" rel="noopener noreferrer">
              Google AI Developer Platform
            </Link>.
          </Typography>
        </Paper>
      )}
    </Box>
  );
};

export default APIKeyInput;