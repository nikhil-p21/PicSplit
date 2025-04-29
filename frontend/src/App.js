// src/App.js
import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Button, Grid, CircularProgress, Avatar, Chip } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ItemAllocationCard from './components/ItemAllocationCard';
import PersonSetup from './components/PersonSetup';
import BillUploader from './components/BillUploader';
import BillSummary from './components/BillSummary';
import APIKeyInput from './components/APIKeyInput';
import Emoji from 'react-emoji-render';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

// Create a theme with Japanese-inspired design
const theme = createTheme({
  palette: {
    primary: {
      main: '#e91e63',
    },
    secondary: {
      main: '#03a9f4',
    },
    background: {
      default: '#f8f9fa',
    },
  },
  typography: {
    fontFamily: '"Nunito", "Roboto", "Helvetica", "Arial", sans-serif',
    h4: {
      fontWeight: 700,
    },
    h6: {
      fontWeight: 600,
    },
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

function App() {
  const [apiKey, setApiKey] = useState('REMOVED');
  const [persons, setPersons] = useState([
    { id: 1, name: '', avatarColor: getRandomColor(), emoji: getRandomEmoji() },
    { id: 2, name: '', avatarColor: getRandomColor(), emoji: getRandomEmoji() }
  ]);
  const [billImage, setBillImage] = useState(null);
  const [billData, setBillData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allocations, setAllocations] = useState({});
  const [currentStep, setCurrentStep] = useState(1);
  const [splitResults, setSplitResults] = useState(null);
  
  // Initialize allocations when bill data changes
  useEffect(() => {
    if (billData && billData.items) {
      const initialAllocations = {};
      billData.items.forEach(item => {
        const itemName = item.normalized_name;
        initialAllocations[itemName] = {
          totalQuantity: 1,
          shares: persons.reduce((acc, person) => {
            acc[person.id] = "0";
            return acc;
          }, {})
        };
      });
      setAllocations(initialAllocations);
    }
  }, [billData, persons]);

  function getRandomColor() {
    const colors = [
      '#FF6B6B', '#FF9E7D', '#FFB86F', '#FFD97D', 
      '#C4E177', '#7ECE92', '#6FC2D0', '#7AA2E3', 
      '#9A91E9', '#B78BE8', '#D187C5', '#E37792', 
      '#A56C5D', '#6E7C74', '#4A90A4'
    ];    
    return colors[Math.floor(Math.random() * colors.length)];
  }

  function getRandomEmoji() {
    const emojis = ['🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🦁', '🐯', '🐨', '🐸', '🐵', '🐷'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }

  const addPerson = () => {
    setPersons([
      ...persons,
      { 
        id: persons.length > 0 ? Math.max(...persons.map(p => p.id)) + 1 : 1, 
        name: '', 
        avatarColor: getRandomColor(),
        emoji: getRandomEmoji()
      }
    ]);
  };

  const removePerson = (id) => {
    if (persons.length > 1) {
      setPersons(persons.filter(person => person.id !== id));
    } else {
      toast.error("You need at least one person!");
    }
  };

  const updatePerson = (id, name) => {
    setPersons(persons.map(person => 
      person.id === id ? { ...person, name } : person
    ));
  };

  const handleImageUpload = (file) => {
    setBillImage(file);
  };

  const processBill = async () => {
    if (!apiKey) {
      toast.error("Please enter your Gemini API key");
      return;
    }

    if (!billImage) {
      toast.error("Please upload a bill image");
      return;
    }

    // Validate that all persons have names
    const emptyNames = persons.filter(p => !p.name.trim());
    if (emptyNames.length > 0) {
      toast.error("Please provide names for all persons");
      return;
    }

    setIsProcessing(true);
    
    const formData = new FormData();
    formData.append('image', billImage);
    formData.append('api_key', apiKey);
    
    try {
      const response = await fetch('/api/process-bill', {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setBillData(data);
      setCurrentStep(3);
      toast.success("Bill processed successfully!");
    } catch (error) {
      toast.error(`Failed to process bill: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const shareItemEqually = (itemName) => {
    const equalShare = "1/" + persons.length;
    
    setAllocations(prev => {
      const newAllocations = { ...prev };
      const itemAllocation = { ...newAllocations[itemName] };
      
      itemAllocation.shares = persons.reduce((acc, person) => {
        acc[person.id] = equalShare;
        return acc;
      }, {});
      
      newAllocations[itemName] = itemAllocation;
      return newAllocations;
    });
  };

  const updateItemShare = (itemName, personId, shareValue) => {
    setAllocations(prev => {
      const newAllocations = { ...prev };
      const itemAllocation = { ...newAllocations[itemName] };
      
      itemAllocation.shares = {
        ...itemAllocation.shares,
        [personId]: shareValue
      };
      
      newAllocations[itemName] = itemAllocation;
      return newAllocations;
    });
  };

  const updateItemQuantity = (itemName, quantity) => {
    setAllocations(prev => {
      const newAllocations = { ...prev };
      newAllocations[itemName] = {
        ...newAllocations[itemName],
        totalQuantity: quantity
      };
      return newAllocations;
    });
  };

  const parseItemEmoji = (itemName) => {
    // Map common grocery items to emojis
    const emojiMap = {
      'bread': '🍞',
      'milk': '🥛',
      'cheese': '🧀',
      'egg': '🥚',
      'eggs': '🥚',
      'tamago': '🥚',
      'yogurt': '🥣',
      'apple': '🍎',
      'banana': '🍌',
      'orange': '🍊',
      'vegetable': '🥬',
      'vegetables': '🥬',
      'fruit': '🍎',
      'fruits': '🍎',
      'meat': '🥩',
      'chicken': '🍗',
      'fish': '🐟',
      'rice': '🍚',
      'noodle': '🍜',
      'noodles': '🍜',
      'pasta': '🍝',
      'water': '💧',
      'juice': '🧃',
      'beer': '🍺',
      'wine': '🍷',
      'coffee': '☕',
      'tea': '🍵',
      'chocolate': '🍫',
      'cookie': '🍪',
      'cookies': '🍪',
      'cake': '🍰',
      'icecream': '🍦',
      'ice cream': '🍦',
      'candy': '🍬',
      'snack': '🍿',
      'snacks': '🍿',
      'chip': '🍪',
      'chips': '🍪',
      'plastic bag': '🛍️',
      'bag': '🛍️',
      'tissue': '🧻',
      'paper': '📄',
      'tofu': '🧊',
      'sauce': '🧂',
      'oil': '🫗',
      'spice': '🌶️',
      'spices': '🌶️',
      'seafood': '🦐',
      'shrimp': '🦐',
      'crab': '🦀',
      'onion': '🧅',
      'garlic': '🧄',
      'tomato': '🍅',
      'potato': '🥔',
      'carrot': '🥕',
      'cucumber': '🥒',
      'avocado': '🥑',
      'corn': '🌽',
      'mushroom': '🍄',
      'mushrooms': '🍄',
      'lemon': '🍋',
      'strawberry': '🍓',
      'strawberries': '🍓',
      'pineapple': '🍍',
      'watermelon': '🍉'
    };
    
    const lowerName = itemName.toLowerCase();
    
    // Check if the name directly matches a key
    if (emojiMap[lowerName]) {
      return emojiMap[lowerName];
    }
    
    // Check if any key is contained in the item name
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (lowerName.includes(key)) {
        return emoji;
      }
    }
    
    // Default emoji for items that don't match
    return '🛒';
  };

  const calculateSplit = () => {
    // Validate allocations first
    let isValid = true;
    const allocationErrors = [];

    for (const [itemName, allocation] of Object.entries(allocations)) {
      let total = 0;
      
      for (const share of Object.values(allocation.shares)) {
        // Parse fractions like "1/3" or decimals like "0.5"
        let value = 0;
        if (share.includes('/')) {
          const [numerator, denominator] = share.split('/');
          value = parseFloat(numerator) / parseFloat(denominator);
        } else {
          value = parseFloat(share) || 0;
        }
        total += value;
      }
      
      if (Math.abs(total - allocation.totalQuantity) > 0.001) {
        isValid = false;
        allocationErrors.push(`${itemName}: Total allocated (${total.toFixed(2)}) should equal ${allocation.totalQuantity}`);
      }
    }

    if (!isValid) {
      toast.error(allocationErrors.join('\n'));
      return;
    }

    // Calculate the split
    const personTotals = {};
    
    persons.forEach(person => {
      personTotals[person.id] = {
        name: person.name,
        avatarColor: person.avatarColor,
        emoji: person.emoji,
        total: 0,
        items: []
      };
    });

    billData.items.forEach(item => {
      const itemName = item.normalized_name;
      const allocation = allocations[itemName];
      
      if (!allocation) return;
      
      const priceBeforeTax = item.price_before_tax;
      const discount = item.discount_amount;
      
      // Determine tax rate based on item name
      const taxRate = (itemName.toLowerCase().includes('plastic') && 
                        itemName.toLowerCase().includes('bag')) ? 0.10 : 0.08;
      
      const effectivePrice = (priceBeforeTax * (1 + taxRate)) - discount;
      const unitCost = effectivePrice / allocation.totalQuantity;
      
      Object.entries(allocation.shares).forEach(([personId, share]) => {
        let shareValue = 0;
        if (share.includes('/')) {
          const [numerator, denominator] = share.split('/');
          shareValue = parseFloat(numerator) / parseFloat(denominator);
        } else {
          shareValue = parseFloat(share) || 0;
        }
        
        const personCost = shareValue * unitCost;
        
        if (personCost > 0) {
          personTotals[personId].total += personCost;
          personTotals[personId].items.push({
            name: itemName,
            emoji: parseItemEmoji(itemName),
            share: shareValue,
            cost: personCost
          });
        }
      });
    });

    setSplitResults(personTotals);
    setCurrentStep(4);
  };

  const navigateToStep = (step) => {
    if (step < currentStep) {
      setCurrentStep(step);
    } else if (step === 2 && currentStep === 1) {
      // Validate before proceeding to step 2
      const emptyNames = persons.filter(p => !p.name.trim());
      if (emptyNames.length > 0) {
        toast.error("Please provide names for all persons");
        return;
      }
      setCurrentStep(step);
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <PersonSetup 
            persons={persons} 
            onAddPerson={addPerson} 
            onRemovePerson={removePerson}
            onUpdatePerson={updatePerson}
            onNext={() => navigateToStep(2)}
          />
        );
      case 2:
        return (
          <BillUploader
            apiKey={apiKey}
            onApiKeyChange={setApiKey}
            onImageUpload={handleImageUpload}
            selectedImage={billImage}
            onProcessBill={processBill}
            isProcessing={isProcessing}
            onBack={() => navigateToStep(1)}
          />
        );
      case 3:
        return (
          <Box>
            <Typography variant="h4" sx={{ mb: 3 }}>
              Allocate Items
            </Typography>
            
            <Box sx={{ mb: 3, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {persons.map(person => (
                <Chip
                  key={person.id}
                  avatar={
                    <Avatar sx={{ bgcolor: person.avatarColor }}>
                      <Emoji text={person.emoji} />
                    </Avatar>
                  }
                  label={person.name}
                  variant="outlined"
                />
              ))}
            </Box>
            
            <Grid container spacing={3}>
              {billData && billData.items.map((item, index) => (
                <Grid item xs={12} md={6} key={index}>
                  <ItemAllocationCard
                    item={item}
                    persons={persons}
                    allocation={allocations[item.normalized_name] || { totalQuantity: 1, shares: {} }}
                    onShareEqually={() => shareItemEqually(item.normalized_name)}
                    onUpdateShare={(personId, value) => updateItemShare(item.normalized_name, personId, value)}
                    onUpdateQuantity={(qty) => updateItemQuantity(item.normalized_name, qty)}
                    itemEmoji={parseItemEmoji(item.normalized_name)}
                  />
                </Grid>
              ))}
            </Grid>
            
            <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
              <Button 
                variant="outlined" 
                onClick={() => navigateToStep(2)}
              >
                Back
              </Button>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={calculateSplit}
              >
                Calculate Split
              </Button>
            </Box>
          </Box>
        );
      case 4:
        return (
          <BillSummary 
            splitResults={splitResults} 
            persons={persons}
            billTotal={billData ? billData.total_bill : 0}
            onBack={() => navigateToStep(3)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <ToastContainer position="top-right" />
      <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            <span role="img" aria-label="receipt">🧾</span> PicSplit
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Split Japanese bills easily with AI translation
          </Typography>
        </Box>
        
        <Box sx={{ mb: 4 }}>
          <ul className="steps">
            {['Add People', 'Upload Bill', 'Allocate Items', 'View Split'].map((step, index) => (
              <li 
                key={index} 
                className={`step ${currentStep > index + 1 ? 'step-primary step-complete' : ''} ${currentStep === index + 1 ? 'step-primary' : ''}`}
                onClick={() => navigateToStep(index + 1)}
                style={{ cursor: currentStep > index + 1 ? 'pointer' : 'default' }}
              >
                {step}
              </li>
            ))}
          </ul>
        </Box>
        
        <Box sx={{ mt: 3 }}>
          {renderStepContent()}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;