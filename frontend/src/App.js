// src/App.js
import React, { useState, useEffect } from 'react';
import { Container, Box, Typography, Button, Grid, Avatar, Chip, Tabs, Tab, Paper } from '@mui/material';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import ItemAllocationCard from './components/ItemAllocationCard';
import PersonSetup from './components/PersonSetup';
import BillUploader from './components/BillUploader';
import BillSummary from './components/BillSummary';
import ExpenseDashboard from './components/ExpenseDashboard';
import ReceiptLibrary from './components/ReceiptLibrary';
import Emoji from 'react-emoji-render';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { createPerson } from './features/billSplit/personProfile';
import { parseItemEmoji } from './features/billSplit/itemEmoji';
import {
  buildInitialSplitState,
  shareItemEquallyInAllocations,
  updateAllocationShare,
  updateAllocationQuantity,
  validateAllocations,
  calculateSplitResults
} from './features/billSplit/splitEngine';

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

const DEFAULT_CATEGORIES = [
  'Groceries',
  'Dining',
  'Transport',
  'Utilities',
  'Entertainment',
  'Shopping',
  'Healthcare',
  'Travel',
  'Education',
  'Subscriptions',
  'Miscellaneous',
  'Uncategorized'
];

function App() {
  // --- REMOVED API Key State ---
  // const [apiKey, setApiKey] = useState(null);
  // const [loadingKey, setLoadingKey] = useState(true);
  // --- End Removed API Key State ---

  const [persons, setPersons] = useState([createPerson(1), createPerson(2)]);
  const [billImage, setBillImage] = useState(null);
  const [billData, setBillData] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [allocations, setAllocations] = useState({});
  const [activeView, setActiveView] = useState('dashboard');
  const [currentStep, setCurrentStep] = useState(1);
  const [splitResults, setSplitResults] = useState(null);
  const [calculatedBillTotal, setCalculatedBillTotal] = useState(0);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [categoryUpdateByItem, setCategoryUpdateByItem] = useState({});
  const [isSplitEnabled, setIsSplitEnabled] = useState(true);
  const splitFlowSteps = isSplitEnabled
    ? ['Add People', 'Upload Bill', 'Allocate Items', 'View Split']
    : ['Receipt Mode', 'Upload Bill'];
  const maxSplitStep = splitFlowSteps.length;

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
      const { allocations: initialAllocations, calculatedBillTotal: newCalculatedBillTotal } =
        buildInitialSplitState(billData.items, persons);
      setAllocations(initialAllocations);
      setCalculatedBillTotal(newCalculatedBillTotal);

    }
    // Ensure allocations are cleared or reset if billData becomes null
    else if (!billData) {
        setAllocations({});
        setCalculatedBillTotal(0); // Reset calculated total as well
    }
  }, [billData, persons]); // Rerun when billData or persons change

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/categories');
        const data = await response.json();
        if (response.ok && Array.isArray(data?.categories) && data.categories.length > 0) {
          setCategories(data.categories);
        }
      } catch (error) {
        console.error('Failed to load categories:', error);
      }
    };

    loadCategories();
  }, []);

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

  const addPerson = () => {
    const nextId = persons.length > 0 ? Math.max(...persons.map(p => p.id)) + 1 : 1;
    setPersons([
      ...persons,
      createPerson(nextId)
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

    // Validate participant names only when split mode is enabled.
    if (isSplitEnabled) {
      const emptyNames = persons.filter(p => !p.name.trim());
      if (emptyNames.length > 0) {
        toast.error("Please provide names for all persons");
        return;
      }
    }

    // Validate that an image has been selected
    if (!billImage) {
        toast.error("Please upload a bill image first.");
        return;
    }

    setIsProcessing(true);

    const participantPayload = isSplitEnabled
      ? persons
          .filter(person => person.name.trim())
          .map(person => ({
            id: person.id,
            name: person.name.trim(),
            avatarColor: person.avatarColor,
            emoji: person.emoji
          }))
      : [];

    const formData = new FormData();
    formData.append('image', billImage);
    formData.append('persist', 'true');
    formData.append('split_enabled', isSplitEnabled ? 'true' : 'false');
    formData.append('is_shared', isSplitEnabled ? 'true' : 'false');
    formData.append('participants', JSON.stringify(participantPayload));
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
      const normalizedItems = (data.items || []).map(item => ({
        ...item,
        category_name: item.category_name || 'Uncategorized',
        category_source: item.category_source || 'auto'
      }));

      if (isSplitEnabled) {
        setBillData({
          ...data,
          items: normalizedItems
        });
        setActiveView('split');
        setCurrentStep(3);
      } else {
        // Personal receipt mode stores data via backend persistence and exits split flow.
        setBillData(null);
        setBillImage(null);
        setAllocations({});
        setSplitResults(null);
        setCalculatedBillTotal(0);
        setCurrentStep(1);
        setActiveView('receipts');
      }
      if (data.persistence_warning) {
        toast.warn(data.persistence_warning);
      }
      toast.success(isSplitEnabled ? "Bill processed successfully!" : "Receipt processed and saved.");

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

  const updateItemCategory = async (item, categoryName) => {
    if (!billData || !billData.items) return;
    const previousCategory = item.category_name || 'Uncategorized';
    const previousSource = item.category_source || 'auto';
    const itemId = item.id;

    setBillData(prevBillData => ({
      ...prevBillData,
      items: prevBillData.items.map(existingItem =>
        existingItem.normalized_name === item.normalized_name
          ? { ...existingItem, category_name: categoryName, category_source: 'manual' }
          : existingItem
      )
    }));

    if (!billData.receipt_id || !itemId) {
      return;
    }

    setCategoryUpdateByItem(prev => ({ ...prev, [itemId]: true }));
    try {
      const response = await fetch(
        `/api/receipts/${billData.receipt_id}/items/${itemId}/category`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category_name: categoryName,
            category_source: 'manual'
          })
        }
      );

      const responseData = await response.json();
      if (!response.ok) {
        throw new Error(responseData?.error || `Error ${response.status}`);
      }

      setBillData(prevBillData => ({
        ...prevBillData,
        items: prevBillData.items.map(existingItem =>
          existingItem.id === itemId
            ? {
                ...existingItem,
                category_name: responseData.category_name || categoryName,
                category_source: responseData.category_source || 'manual'
              }
            : existingItem
        )
      }));
    } catch (error) {
      console.error('Failed to update category:', error);
      toast.error(`Failed to save category: ${error.message}`);
      setBillData(prevBillData => ({
        ...prevBillData,
        items: prevBillData.items.map(existingItem =>
          existingItem.id === itemId
            ? {
                ...existingItem,
                category_name: previousCategory,
                category_source: previousSource
              }
            : existingItem
        )
      }));
    } finally {
      setCategoryUpdateByItem(prev => ({ ...prev, [itemId]: false }));
    }
  };

  const shareItemEqually = (itemName) => {
    if (persons.length === 0) return; // Avoid division by zero

    setAllocations(prev => {
      if (!prev[itemName]) {
          console.warn(`Item ${itemName} not found in allocations during shareEqually.`);
          return prev; // Or handle initialization
      }
      return shareItemEquallyInAllocations(prev, itemName, persons);
    });
  };

  const updateItemShare = (itemName, personId, shareValue) => {
    setAllocations(prev => {
       if (!prev[itemName]) {
          console.warn(`Item ${itemName} not found in allocations during updateItemShare.`);
          return prev;
      }
      return updateAllocationShare(prev, itemName, personId, shareValue);
    });
  };

  const updateItemQuantity = (itemName, quantity) => {
    setAllocations(prev => {
       if (!prev[itemName]) {
          console.warn(`Item ${itemName} not found in allocations during updateItemQuantity.`);
          return prev;
      }
      return updateAllocationQuantity(prev, itemName, quantity);
    });
  };

  const calculateSplit = () => {
    if (!billData || !billData.items) {
        toast.error("Bill data is missing.");
        return;
    }

    const validation = validateAllocations(billData.items, allocations);
    if (!validation.isValid) {
      const allocationErrors = validation.errors;
      toast.error(<div>Validation Errors:<br/>{allocationErrors.join('<br/>')}</div>, { autoClose: 10000 });
      return;
    }

    const personTotals = calculateSplitResults(billData.items, allocations, persons, parseItemEmoji);
    setSplitResults(personTotals);
    setCurrentStep(4);
  };


  const navigateToStep = (step) => {
    if (step > maxSplitStep) {
      return;
    }

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
    if (isSplitEnabled && step === 2 && currentStep === 1) {
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
       if (isSplitEnabled && step === 2 && persons.some(p => !p.name.trim())) {
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
            splitEnabled={isSplitEnabled}
            onSplitEnabledChange={setIsSplitEnabled}
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
            splitEnabled={isSplitEnabled}
            onSplitEnabledChange={setIsSplitEnabled}
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
                      categories={categories}
                      onUpdateCategory={(categoryName) => updateItemCategory(item, categoryName)}
                      isUpdatingCategory={Boolean(categoryUpdateByItem[item.id])}
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
            Expense tracking with optional bill splitting
          </Typography>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Tabs
              value={activeView}
              onChange={(_event, value) => setActiveView(value)}
              variant="fullWidth"
              textColor="primary"
              indicatorColor="primary"
            >
              <Tab label="Dashboard" value="dashboard" />
              <Tab label="Receipts" value="receipts" />
              <Tab label="Split Bill" value="split" />
            </Tabs>
          </Paper>
        </Box>

        {/* Main Content Area */}
        <Box sx={{ mt: 3 }}>
          {activeView === 'dashboard' ? (
            <ExpenseDashboard />
          ) : null}

          {activeView === 'receipts' ? (
            <ReceiptLibrary />
          ) : null}

          {activeView === 'split' ? (
            <Box>
              {/* Step Indicator */}
              <Box sx={{ mb: 4 }}>
                 <Box sx={{ display: 'flex', justifyContent: 'space-around', mb: 4, p: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                   {splitFlowSteps.map((step, index) => (
                     <Button
                       key={index}
                       variant={currentStep === index + 1 ? 'contained' : 'text'}
                       onClick={() => navigateToStep(index + 1)}
                       disabled={index + 1 > currentStep && !(index + 1 === currentStep + 1 && currentStep < maxSplitStep)}
                       sx={{ flexGrow: 1, mx: 0.5 }}
                     >
                       {step}
                     </Button>
                   ))}
                 </Box>
              </Box>

              {renderStepContent()}
            </Box>
          ) : null}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
