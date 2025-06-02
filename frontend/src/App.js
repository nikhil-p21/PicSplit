// src/App.js
import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Button, Grid, CircularProgress, Avatar, Chip } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ItemAllocationCard from './components/ItemAllocationCard';
import PersonSetup from './components/PersonSetup';
import BillUploader from './components/BillUploader';
import BillSummary from './components/BillSummary';
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
  // --- REMOVED API Key State ---
  // const [apiKey, setApiKey] = useState(null);
  // const [loadingKey, setLoadingKey] = useState(true);
  // --- End Removed API Key State ---

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
  const [calculatedBillTotal, setCalculatedBillTotal] = useState(0);

  // --- REMOVED useEffect for fetching API Key ---
  // useEffect(() => {
  //   fetch("/get-key")
  //     .then(res => res.json())
  //     .then(data => setApiKey(data.key))
  //     .catch(err => console.error("could not load api key", err))
  //     .finally(() => setLoadingKey(false));
  // }, []);
  // --- End Removed useEffect ---

  // Initialize allocations when bill data changes
  useEffect(() => {
    if (billData && billData.items) {
      const initialAllocations = {};
      let newCalculatedBillTotal = 0;

      billData.items.forEach(item => {
        const itemName = item.normalized_name;
        initialAllocations[itemName] = {
          totalQuantity: 1, // Default quantity to 1
          shares: persons.reduce((acc, person) => {
            acc[person.id] = "0"; // Default share to 0
            return acc;
          }, {})
        };

        // Calculate effective price for each item
        const priceBeforeTax = item.price_before_tax;
        const discount = item.discount_amount;
        const taxRate = (itemName.toLowerCase().includes('plastic') &&
                         itemName.toLowerCase().includes('bag')) ? 0.10 : 0.08;
        const effectivePrice = (priceBeforeTax * (1 + taxRate)) - discount;
        newCalculatedBillTotal += effectivePrice;
      });

      setAllocations(initialAllocations);
      setCalculatedBillTotal(newCalculatedBillTotal);

    }
    // Ensure allocations are cleared or reset if billData becomes null
    else if (!billData) {
        setAllocations({});
        setCalculatedBillTotal(0); // Reset calculated total as well
    }
  }, [billData, persons]); // Rerun when billData or persons change

  const deleteItem = (itemName) => {
    if (!billData || !billData.items) return;

    const newItemsArray = billData.items.filter(item => item.normalized_name !== itemName);
    setBillData(prevBillData => ({
      ...prevBillData,
      items: newItemsArray
    }));

    setAllocations(prevAllocations => {
      const newAllocations = { ...prevAllocations };
      delete newAllocations[itemName];
      return newAllocations;
    });

    // The useEffect hook depending on [billData, persons] will automatically
    // recalculate calculatedBillTotal and reconstruct allocations for the remaining items.
    // A toast message for successful deletion
    toast.info(`Item "${itemName}" deleted.`);
  };

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
      // Also update allocations to remove the person's share
      setAllocations(prevAllocations => {
          const newAllocations = { ...prevAllocations };
          Object.keys(newAllocations).forEach(itemName => {
              delete newAllocations[itemName].shares[id];
          });
          return newAllocations;
      });
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
    // --- REMOVED API Key Checks ---
    // if (loadingKey) { ... } // Removed
    // if (!apiKey) { ... } // Removed
    // --- End Removed API Key Checks ---

    // Validate that all persons have names
    const emptyNames = persons.filter(p => !p.name.trim());
    if (emptyNames.length > 0) {
      toast.error("Please provide names for all persons");
      return;
    }

    // Validate that an image has been selected
    if (!billImage) {
        toast.error("Please upload a bill image first.");
        return;
    }

    setIsProcessing(true);

    const formData = new FormData();
    formData.append('image', billImage);
    // --- REMOVED Appending API Key ---
    // formData.append('api_key', apiKey); // Removed
    // --- End Removed Appending API Key ---

    try {
      const response = await fetch('/api/process-bill', {
        method: 'POST',
        body: formData,
        // No API key needed in request
      });

      // Try to parse the JSON response body, helpful for backend errors too
      const data = await response.json();

      if (!response.ok) {
        // Use the error message from the backend JSON if available, otherwise use status text
        const errorMessage = data?.error || `Error ${response.status}: ${response.statusText}`;
        throw new Error(errorMessage);
      }

      // If response is ok, data should contain the bill details
      setBillData(data);
      setCurrentStep(3);
      toast.success("Bill processed successfully!");

    } catch (error) {
      console.error("Failed to process bill:", error); // Log the detailed error
      // Show a user-friendly message from the caught error
      toast.error(`Failed to process bill: ${error.message}`);
      // Optionally reset bill data if processing fails
      // setBillData(null);
    } finally {
      setIsProcessing(false);
    }
  };

  const shareItemEqually = (itemName) => {
    if (persons.length === 0) return; // Avoid division by zero

    const equalShare = `1/${persons.length}`;

    setAllocations(prev => {
      const newAllocations = { ...prev };
      // Ensure the item exists in allocations
      if (!newAllocations[itemName]) {
          console.warn(`Item ${itemName} not found in allocations during shareEqually.`);
          // Optionally initialize it here if needed based on billData
          return prev; // Or handle initialization
      }
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
      // Ensure the item exists in allocations
       if (!newAllocations[itemName]) {
          console.warn(`Item ${itemName} not found in allocations during updateItemShare.`);
          return prev;
      }
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
    // Ensure quantity is a positive number, default to 1 if invalid
    const validQuantity = Math.max(1, Number(quantity) || 1);

    setAllocations(prev => {
      const newAllocations = { ...prev };
       // Ensure the item exists in allocations
       if (!newAllocations[itemName]) {
          console.warn(`Item ${itemName} not found in allocations during updateItemQuantity.`);
          return prev;
      }
      newAllocations[itemName] = {
        ...newAllocations[itemName],
        totalQuantity: validQuantity
      };
      return newAllocations;
    });
  };

  const parseItemEmoji = (itemName) => {
    // Keep your existing emoji logic
    const emojiMap = {
      'bread': '🍞', 'milk': '🥛', 'cheese': '🧀', 'egg': '🥚', 'eggs': '🥚', 'tamago': '🥚',
      'yogurt': '🥣', 'apple': '🍎', 'banana': '🍌', 'orange': '🍊', 'vegetable': '🥬',
      'vegetables': '🥬', 'fruit': '🍎', 'fruits': '🍎', 'meat': '🥩', 'chicken': '🍗',
      'fish': '🐟', 'rice': '🍚', 'noodle': '🍜', 'noodles': '🍜', 'pasta': '🍝',
      'water': '💧', 'juice': '🧃', 'beer': '🍺', 'wine': '🍷', 'coffee': '☕', 'tea': '🍵',
      'chocolate': '🍫', 'cookie': '🍪', 'cookies': '🍪', 'cake': '🍰', 'icecream': '🍦',
      'ice cream': '🍦', 'candy': '🍬', 'snack': '🍿', 'snacks': '🍿', 'chip': '🍪',
      'chips': '🍪', 'plastic bag': '🛍️', 'bag': '🛍️', 'tissue': '🧻', 'paper': '📄',
      'tofu': '🧊', 'sauce': '🧂', 'oil': '🫗', 'spice': '🌶️', 'spices': '🌶️',
      'seafood': '🦐', 'shrimp': '🦐', 'crab': '🦀', 'onion': '🧅', 'garlic': '🧄',
      'tomato': '🍅', 'potato': '🥔', 'carrot': '🥕', 'cucumber': '🥒', 'avocado': '🥑',
      'corn': '🌽', 'mushroom': '🍄', 'mushrooms': '🍄', 'lemon': '🍋', 'strawberry': '🍓',
      'strawberries': '🍓', 'pineapple': '🍍', 'watermelon': '🍉'
    };
    const lowerName = itemName.toLowerCase();
    if (emojiMap[lowerName]) return emojiMap[lowerName];
    for (const [key, emoji] of Object.entries(emojiMap)) {
      if (lowerName.includes(key)) return emoji;
    }
    return '🛒'; // Default
  };

  const calculateSplit = () => {
    let isValid = true;
    const allocationErrors = [];

    if (!billData || !billData.items) {
        toast.error("Bill data is missing.");
        return;
    }

    // Validate allocations first
    for (const item of billData.items) {
      const itemName = item.normalized_name;
      const allocation = allocations[itemName];

      if (!allocation) {
        // This might happen if allocations weren't initialized correctly after bill processing
        allocationErrors.push(`${itemName}: Allocation data missing.`);
        isValid = false;
        continue; // Skip further checks for this item
      }

      let totalShareValue = 0;
      let invalidShareFormat = false;

      for (const share of Object.values(allocation.shares)) {
        let value = 0;
        const trimmedShare = String(share).trim(); // Ensure it's a string and trim whitespace

        if (trimmedShare === "") { // Treat empty string as 0
            value = 0;
        } else if (trimmedShare.includes('/')) {
          const parts = trimmedShare.split('/');
          if (parts.length === 2 && !isNaN(parseFloat(parts[0])) && !isNaN(parseFloat(parts[1])) && parseFloat(parts[1]) !== 0) {
            value = parseFloat(parts[0]) / parseFloat(parts[1]);
          } else {
            invalidShareFormat = true; // Invalid fraction format
          }
        } else {
          if (!isNaN(parseFloat(trimmedShare))) {
            value = parseFloat(trimmedShare);
          } else {
              invalidShareFormat = true; // Not a valid number or fraction
          }
        }
        if (value < 0) invalidShareFormat = true; // Shares cannot be negative
        totalShareValue += value;
      }

      if (invalidShareFormat) {
          isValid = false;
          allocationErrors.push(`${itemName}: Invalid share format detected (use numbers like 0.5 or fractions like 1/2). Shares cannot be negative.`);
      } else if (Math.abs(totalShareValue - allocation.totalQuantity) > 0.001) { // Use tolerance for float comparison
        isValid = false;
        allocationErrors.push(`${itemName}: Total allocated share (${totalShareValue.toFixed(2)}) does not match item quantity (${allocation.totalQuantity}).`);
      }
    }


    if (!isValid) {
      toast.error(<div>Validation Errors:<br/>{allocationErrors.join('<br/>')}</div>, { autoClose: 10000 });
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
      const allocation = allocations[itemName]; // Already validated that this exists

      const priceBeforeTax = item.price_before_tax;
      const discount = item.discount_amount;

      // Determine tax rate (same logic as before)
      const taxRate = (itemName.toLowerCase().includes('plastic') &&
                       itemName.toLowerCase().includes('bag')) ? 0.10 : 0.08;

      // Calculate effective price including tax and discount
      const itemTotalCost = (priceBeforeTax * (1 + taxRate)) - discount;

      // Avoid division by zero if quantity is somehow invalid (should be caught by validation)
      const unitCost = allocation.totalQuantity > 0 ? itemTotalCost / allocation.totalQuantity : 0;

      Object.entries(allocation.shares).forEach(([personId, share]) => {
        let shareValue = 0;
        const trimmedShare = String(share).trim();
        if (trimmedShare === "") {
            shareValue = 0;
        } else if (trimmedShare.includes('/')) {
          const [numerator, denominator] = trimmedShare.split('/');
          // We assume valid format here due to prior validation
          shareValue = parseFloat(numerator) / parseFloat(denominator);
        } else {
          // We assume valid format here due to prior validation
          shareValue = parseFloat(trimmedShare);
        }

        const personCostForItem = shareValue * unitCost;

        // Ensure personId exists in personTotals (should always unless person removed mid-calculation)
        if (personTotals[personId] && personCostForItem > 0) {
          personTotals[personId].total += personCostForItem;
          personTotals[personId].items.push({
            name: itemName,
            emoji: parseItemEmoji(itemName), // Use your emoji parser
            share: shareValue, // Store the numeric value of the share
            cost: personCostForItem
          });
        }
      });
    });

    setSplitResults(personTotals);
    setCurrentStep(4);
  };


  const navigateToStep = (step) => {
    // Allow navigating back freely
    if (step < currentStep) {
      // Reset future steps data if needed when going back
       if (step < 4) setSplitResults(null);
       if (step < 3) setBillData(null); // Also clears allocations via useEffect
       if (step < 2) setBillImage(null);
      setCurrentStep(step);
      return;
    }

    // Validate before moving forward
    if (step === 2 && currentStep === 1) {
      const emptyNames = persons.filter(p => !p.name.trim());
      if (emptyNames.length > 0) {
        toast.error("Please provide names for all persons");
        return; // Stay on step 1
      }
    }
    // Add more validation checks for other steps if needed
    // e.g., check if image is uploaded before going from 2 to 3 (though processBill handles this)
    // e.g., check if allocations are valid before going from 3 to 4 (calculateSplit handles this)

    // Only allow moving forward one step at a time unless specific conditions met
    if (step === currentStep + 1) {
       // Conditions to allow moving forward (e.g., step 1 -> 2 needs names)
       if (step === 2 && persons.some(p => !p.name.trim())) {
           toast.error("Please provide names for all persons first.");
           return;
       }
       // Condition: Step 2 -> 3 requires a processed bill
       if (step === 3 && !billData) {
           toast.error("Please upload and process the bill first.");
           return;
       }
       // Condition: Step 3 -> 4 requires valid allocations (checked in calculateSplit)
       if (step === 4 && !splitResults) {
            // calculateSplit will handle toast errors if validation fails
           calculateSplit(); // Trigger calculation which moves to step 4 on success
           return; // Don't set current step directly here
       }

        setCurrentStep(step);
    } else if (step > currentStep + 1 && currentStep < 4) {
        // Prevent jumping multiple steps forward unless already viewed
        toast.info("Please complete the current step first.");
    } else if (step <= currentStep ) {
        // Allow clicking on already completed steps (handled by the first 'if' block)
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
            // apiKey={apiKey} // REMOVED Prop
            onImageUpload={handleImageUpload}
            selectedImage={billImage}
            onProcessBill={processBill} // This function no longer needs apiKey
            isProcessing={isProcessing}
            onBack={() => navigateToStep(1)}
          />
        );
      case 3:
        // Only render if billData is available
        if (!billData) {
            return (
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <Typography variant="h6">Processing bill data...</Typography>
                    <Typography>Please go back and upload/process a bill if needed.</Typography>
                    <Button variant="outlined" onClick={() => navigateToStep(2)} sx={{ mt: 2 }}>
                        Go Back to Upload
                    </Button>
                 </Box>
            );
        }
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
              {billData && billData.items.map((item, index) => {
                const allocationForItem = allocations[item.normalized_name];
                // Provide default allocation structure if somehow missing after init
                const safeAllocation = allocationForItem || { totalQuantity: 1, shares: {} };
                return (
                  <Grid item xs={12} md={6} key={`${item.normalized_name}-${index}`}> {/* Use a more stable key */}
                    <ItemAllocationCard
                      item={item}
                      persons={persons}
                      allocation={safeAllocation} // Use safe allocation
                      onShareEqually={() => shareItemEqually(item.normalized_name)}
                      onUpdateShare={(personId, value) => updateItemShare(item.normalized_name, personId, value)}
                      onUpdateQuantity={(qty) => updateItemQuantity(item.normalized_name, qty)}
                      itemEmoji={parseItemEmoji(item.normalized_name)}
                      onDeleteItem={() => deleteItem(item.normalized_name)} // Pass deleteItem function
                    />
                  </Grid>
                );
               })}
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
                onClick={calculateSplit} // Calculate split handles navigation to step 4
              >
                Calculate Split
              </Button>
            </Box>
          </Box>
        );
      case 4:
         // Only render if splitResults are available
        if (!splitResults) {
             return (
                <Box sx={{ textAlign: 'center', mt: 4 }}>
                    <Typography variant="h6">Calculating split...</Typography>
                    <Typography>Please go back and allocate items if needed.</Typography>
                     <Button variant="outlined" onClick={() => navigateToStep(3)} sx={{ mt: 2 }}>
                        Go Back to Allocation
                    </Button>
                 </Box>
            );
        }
        return (
          <BillSummary
            splitResults={splitResults}
            persons={persons}
            calculatedBillTotal={calculatedBillTotal} // Pass the new calculated total
            onBack={() => navigateToStep(3)}
          />
        );
      default:
        // Fallback or handle invalid step
        setCurrentStep(1); // Reset to step 1 if state is invalid
        return null;
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {/* Ensure ToastContainer is rendered */}
      <ToastContainer position="top-right" autoClose={5000} hideProgressBar={false} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover />
      <Container maxWidth="lg" sx={{ pt: 4, pb: 8 }}>
        <Box sx={{ textAlign: 'center', mb: 4 }}>
          <Typography variant="h3" component="h1" gutterBottom>
            <span role="img" aria-label="receipt">🧾</span> PicSplit
          </Typography>
          <Typography variant="h6" color="text.secondary">
            Split Japanese bills easily with AI translation
          </Typography>
        </Box>

        {/* Step Indicator */}
        <Box sx={{ mb: 4 }}>
          {/* Using a simple indicator, replace with your 'steps' CSS/component if needed */}
           <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 4, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
             {['Add People', 'Upload Bill', 'Allocate Items', 'View Split'].map((step, index) => (
               <Button
                 key={index}
                 variant={currentStep === index + 1 ? 'contained' : 'text'}
                 onClick={() => navigateToStep(index + 1)}
                 disabled={index + 1 > currentStep && !(index + 1 === currentStep + 1 && currentStep < 4)} // Allow clicking current/previous, or next if conditions met
                 sx={{ flexGrow: 1, mx: 0.5 }}
               >
                 {step}
               </Button>
             ))}
           </Box>
        </Box>

        {/* Main Content Area */}
        <Box sx={{ mt: 3 }}>
          {renderStepContent()}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;