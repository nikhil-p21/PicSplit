// src/components/PersonSetup.js
import React from 'react';
import { Box, Typography, Button, TextField, IconButton, Avatar, Card, CardContent, Grid } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import Emoji from 'react-emoji-render';

const PersonSetup = ({ persons, onAddPerson, onRemovePerson, onUpdatePerson, onNext }) => {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Who's splitting the bill?
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
        Add the names of everyone who will be splitting the bill
      </Typography>
      
      <Grid container spacing={3}>
        {persons.map(person => (
          <Grid item xs={12} sm={6} md={4} key={person.id}>
            <Card>
              <CardContent sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', p: 3 }}>
                <Avatar 
                  sx={{ 
                    width: 70, 
                    height: 70, 
                    mb: 2, 
                    fontSize: '1.8rem',
                    bgcolor: person.avatarColor 
                  }}
                >
                  <Emoji text={person.emoji} />
                </Avatar>
                
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <TextField
                    fullWidth
                    label="Name"
                    variant="outlined"
                    value={person.name}
                    onChange={(e) => onUpdatePerson(person.id, e.target.value)}
                    sx={{ mr: 1 }}
                  />
                  <IconButton 
                    color="error" 
                    onClick={() => onRemovePerson(person.id)}
                    aria-label="Remove person"
                  >
                    <DeleteIcon />
                  </IconButton>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
        
        <Grid item xs={12} sm={6} md={4}>
          <Card 
            sx={{ 
              height: '100%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              minHeight: 215,
              border: '2px dashed #e0e0e0',
              backgroundColor: 'transparent',
              boxShadow: 'none'
            }}
            onClick={onAddPerson}
          >
            <CardContent sx={{ textAlign: 'center' }}>
              <IconButton
                color="primary"
                sx={{ 
                  width: 60, 
                  height: 60, 
                  mb: 1 
                }}
              >
                <AddIcon sx={{ fontSize: 30 }} />
              </IconButton>
              <Typography>Add Person</Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'flex-end' }}>
        <Button 
          variant="contained" 
          color="primary" 
          size="large"
          onClick={onNext}
          disabled={persons.length === 0}
        >
          Next
        </Button>
      </Box>
    </Box>
  );
};

export default PersonSetup;





