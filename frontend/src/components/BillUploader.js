// src/components/BillUploader.js
import React from 'react';
import { Box, Typography, Button, Paper, CircularProgress } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PhotoCameraIcon from '@mui/icons-material/PhotoCamera';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import APIKeyInput from './APIKeyInput';

const BillUploader = ({ 
  apiKey, 
  onApiKeyChange, 
  onImageUpload, 
  selectedImage, 
  onProcessBill, 
  isProcessing,
  onBack 
}) => {
  const handleImageChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      onImageUpload(e.target.files[0]);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Upload Your Bill
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Take a clear photo of your Japanese receipt or select an existing photo.
      </Typography>
      
      <APIKeyInput apiKey={apiKey} onApiKeyChange={onApiKeyChange} />
      
      <Paper
        sx={{
          border: '2px dashed #e0e0e0',
          p: 4,
          textAlign: 'center',
          mb: 3,
          bgcolor: selectedImage ? 'rgba(3, 169, 244, 0.05)' : 'transparent',
        }}
      >
        {selectedImage ? (
          <Box>
            <Box
              component="img"
              src={URL.createObjectURL(selectedImage)}
              alt="Bill preview"
              sx={{
                maxWidth: '100%',
                maxHeight: 300,
                mb: 2,
                borderRadius: 1,
              }}
            />
            <Typography variant="body2" color="text.secondary">
              {selectedImage.name}
            </Typography>
          </Box>
        ) : (
          <Box>
            {/* Regular file input without capture attribute */}
            <input
              accept="image/*"
              style={{ display: 'none' }}
              id="bill-image-upload"
              type="file"
              onChange={handleImageChange}
            />
            <label htmlFor="bill-image-upload">
              <Button
                variant="outlined"
                component="span"
                startIcon={<PhotoLibraryIcon />}
                sx={{ mb: 2, mr: 2 }}
              >
                Choose from Gallery
              </Button>
            </label>
            
            {/* Camera-specific input with capture attribute */}
            <input
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              id="bill-image-capture"
              type="file"
              onChange={handleImageChange}
            />
            <label htmlFor="bill-image-capture">
              <Button
                variant="outlined"
                component="span"
                startIcon={<PhotoCameraIcon />}
                sx={{ mb: 2 }}
              >
                Take Photo
              </Button>
            </label>
            
            <Typography variant="body2" color="text.secondary">
              Support for JPG, JPEG and PNG files
            </Typography>
          </Box>
        )}
      </Paper>
      
      {selectedImage && (
        <Box sx={{ textAlign: 'center', mb: 2 }}>
          {/* Gallery option */}
          <input
            accept="image/*"
            style={{ display: 'none' }}
            id="bill-image-change-gallery"
            type="file"
            onChange={handleImageChange}
          />
          <label htmlFor="bill-image-change-gallery">
            <Button
              variant="text"
              component="span"
              startIcon={<PhotoLibraryIcon />}
              sx={{ mr: 2 }}
            >
              Choose Another
            </Button>
          </label>
          
          {/* Camera option */}
          <input
            accept="image/*"
            capture="environment"
            style={{ display: 'none' }}
            id="bill-image-change-camera"
            type="file"
            onChange={handleImageChange}
          />
          <label htmlFor="bill-image-change-camera">
            <Button
              variant="text"
              component="span"
              startIcon={<PhotoCameraIcon />}
            >
              Take New Photo
            </Button>
          </label>
        </Box>
      )}
      
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
        <Button 
          variant="outlined" 
          onClick={onBack}
        >
          Back
        </Button>
        <Button
          variant="contained"
          color="primary"
          onClick={onProcessBill}
          disabled={isProcessing || !selectedImage || !apiKey}
          startIcon={isProcessing ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {isProcessing ? 'Processing...' : 'Process Bill'}
        </Button>
      </Box>
    </Box>
  );
};

export default BillUploader;