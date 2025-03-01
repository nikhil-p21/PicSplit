import React from 'react';
import { 
  Box, Typography, Button, Paper, Divider, Grid, Avatar, List, 
  ListItem, ListItemAvatar, ListItemText, Card, CardContent 
} from '@mui/material';
import Emoji from 'react-emoji-render';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';

const BillSummary = ({ splitResults, persons, billTotal, onBack }) => {
  if (!splitResults) return null;

  const personArray = Object.values(splitResults);

  // Prepare data for pie chart
  const pieData = personArray.map(person => ({
    name: person.name,
    value: person.total,
    color: person.avatarColor,
  }));

  // Function to render custom labels inside the pie chart
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text 
        x={x} 
        y={y} 
        fill="white" 
        textAnchor={x > cx ? 'start' : 'end'} 
        dominantBaseline="central"
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Bill Summary
      </Typography>
      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Total Bill: ¥{billTotal.toFixed(2)}
              </Typography>
              
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={renderCustomizedLabel}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`¥${value.toFixed(2)}`, null]} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Box sx={{ mb: 3 }}>
            {personArray.map((person) => (
              <Paper key={person.name} sx={{ mb: 2, overflow: 'hidden' }}>
                <Box 
                  sx={{ 
                    bgcolor: person.avatarColor,
                    color: '#fff',
                    p: 2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <Avatar 
                      sx={{ 
                        width: 45, 
                        height: 45, 
                        mr: 2,
                        bgcolor: '#ffffff33',
                        color: '#fff',
                        fontSize: '1.5rem'
                      }}
                    >
                      <Emoji text={person.emoji} />
                    </Avatar>
                    <Typography variant="h6">
                      {person.name}
                    </Typography>
                  </Box>
                  <Typography variant="h6">
                    ¥{person.total.toFixed(2)}
                  </Typography>
                </Box>
                
                <List sx={{ p: 0 }}>
                  {person.items.map((item, idx) => (
                    <React.Fragment key={idx}>
                      <ListItem>
                        <ListItemAvatar>
                          <Avatar sx={{ bgcolor: '#f5f5f5', color: '#000' }}>
                            <Emoji text={item.emoji} />
                          </Avatar>
                        </ListItemAvatar>
                        <ListItemText 
                          primary={item.name}
                          secondary={
                            item.share > 0
                              ? `Share: ${item.share.toFixed(2)} × ¥${(item.cost / item.share).toFixed(2)}`
                              : 'Share: N/A'
                          }
                        />
                        <Typography variant="body2">
                          ¥{item.cost.toFixed(2)}
                        </Typography>
                      </ListItem>
                      {idx < person.items.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              </Paper>
            ))}
          </Box>
        </Grid>
      </Grid>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outlined" onClick={onBack}>
          Back
        </Button>
        <Button variant="contained" color="primary" onClick={() => window.print()}>
          Print / Save PDF
        </Button>
      </Box>
    </Box>
  );
};

export default BillSummary;
