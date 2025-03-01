import React, { useState } from 'react';
import { Card, CardContent, Typography, Box, TextField, Button, Divider, Avatar } from '@mui/material';
import Emoji from 'react-emoji-render';

const ItemAllocationCard = ({ 
  item, 
  persons, 
  allocation, 
  onShareEqually, 
  onUpdateShare,
  onUpdateQuantity,
  itemEmoji
}) => {
  // Keep track of which fields are currently being edited
  const [editing, setEditing] = useState({});

  const priceBeforeTax = item.price_before_tax;
  const discount = item.discount_amount;
  const taxRate = (item.normalized_name.toLowerCase().includes('plastic') && 
                  item.normalized_name.toLowerCase().includes('bag')) ? 0.10 : 0.08;
  const effectivePrice = (priceBeforeTax * (1 + taxRate)) - discount;
  
  // Calculate total allocation to check if it equals total quantity
  const getTotalAllocation = () => {
    let total = 0;
    Object.values(allocation.shares).forEach(share => {
      if (share.includes('/')) {
        const [numerator, denominator] = share.split('/');
        total += (parseFloat(numerator) / parseFloat(denominator)) || 0;
      } else {
        total += parseFloat(share) || 0;
      }
    });
    return total;
  };
  
  const isAllocationValid = Math.abs(getTotalAllocation() - allocation.totalQuantity) < 0.001;

  const handleInputChange = (personId, value) => {
    // Special handling for backspace and delete when value is "0"
    if (value === "" && (allocation.shares[personId] === "0" || !allocation.shares[personId])) {
      onUpdateShare(personId, "");
    } else {
      onUpdateShare(personId, value);
    }
  };

  const handleKeyDown = (personId, event) => {
    // Handle backspace key specifically when the value is "0"
    if ((event.key === 'Backspace' || event.key === 'Delete') && 
        (allocation.shares[personId] === "0" || !allocation.shares[personId])) {
      // Prevent default to avoid the cursor moving
      event.preventDefault();
      onUpdateShare(personId, "");
    }
  };

  const handleFocus = (personId) => {
    setEditing({...editing, [personId]: true});
    // If the value is "0", automatically select it all to make it easier to replace
    if (allocation.shares[personId] === "0") {
      // Use setTimeout to ensure the selection happens after focus
      setTimeout(() => {
        const input = document.activeElement;
        if (input && input.tagName === 'INPUT') {
          input.select();
        }
      }, 0);
    }
  };
  
  const handleBlur = (personId) => {
    setEditing({...editing, [personId]: false});
    // If the field is left empty, restore it to "0"
    if (!allocation.shares[personId] || allocation.shares[personId] === "") {
      onUpdateShare(personId, "0");
    }
  };
  
  return (
    <Card>
      <CardContent>
        {/* Header with Avatar and Item Name */}
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
          <Avatar 
            sx={{ 
              width: 40, 
              height: 40, 
              mr: 2,
              bgcolor: '#f0f0f0',
              color: '#000'
            }}
          >
            <Emoji text={itemEmoji} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {item.normalized_name}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
              {item.original_name}
            </Typography>
          </Box>
        </Box>
        
        {/* Pricing Details */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
            <span role="img" aria-label="price">💴</span> ¥{priceBeforeTax.toFixed(2)}
          </Typography>
          <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center' }}>
            <span role="img" aria-label="tax">📊</span> {(taxRate * 100).toFixed(0)}% tax
          </Typography>
          {discount > 0 && (
            <Typography variant="body2" color="error" sx={{ display: 'flex', alignItems: 'center' }}>
              <span role="img" aria-label="discount">🏷️</span> -¥{discount.toFixed(2)}
            </Typography>
          )}
          <Typography variant="body2" fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
            <span role="img" aria-label="total">🧮</span> ¥{effectivePrice.toFixed(2)}
          </Typography>
        </Box>
        
        <Divider sx={{ mb: 2 }} />
        
        {/* Quantity Input */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" gutterBottom>
            Quantity:
          </Typography>
          <TextField
            type="number"
            size="small"
            value={allocation.totalQuantity}
            onChange={(e) => onUpdateQuantity(Math.max(1, parseInt(e.target.value) || 1))}
            InputProps={{
              inputProps: { min: 1 }
            }}
            sx={{ width: 100 }}
          />
        </Box>
        
        {/* Share Equally Button and Allocation Validity Message */}
        <Box sx={{ mb: 2 }}>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={onShareEqually}
            sx={{ mb: 2 }}
          >
            Share Equally
          </Button>
          {!isAllocationValid && (
            <Typography color="error" variant="caption" sx={{ display: 'block', mb: 1 }}>
              Total allocation doesn't match quantity. Please adjust shares.
            </Typography>
          )}
        </Box>
        
        {/* Allocation Shares for Each Person */}
        <Box>
          {persons.map(person => (
            <Box key={person.id} sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
              <Avatar 
                sx={{ 
                  width: 30, 
                  height: 30, 
                  mr: 1,
                  bgcolor: person.avatarColor,
                  fontSize: '0.875rem'
                }}
              >
                <Emoji text={person.emoji} />
              </Avatar>
              <TextField
                size="small"
                placeholder="0"
                value={allocation.shares[person.id] || "0"}
                onChange={(e) => handleInputChange(person.id, e.target.value)}
                onKeyDown={(e) => handleKeyDown(person.id, e)}
                onFocus={() => handleFocus(person.id)}
                onBlur={() => handleBlur(person.id)}
                sx={{ width: '100%' }}
                inputProps={{ 
                  sx: { fontSize: '0.875rem' } 
                }}
                helperText={person.name}
                FormHelperTextProps={{
                  sx: { m: 0, fontSize: '0.75rem' }
                }}
              />
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export default ItemAllocationCard;