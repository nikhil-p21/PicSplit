import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
} from '@mui/material';

const FALLBACK_CATEGORIES = [
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

const formatCurrency = (value) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(
    Number(value || 0)
  );

const formatDate = (value) => {
  if (!value) return 'Unknown date';
  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) return String(value);
  return dateValue.toLocaleDateString();
};

const ReceiptLibrary = () => {
  const [receipts, setReceipts] = useState([]);
  const [categories, setCategories] = useState(FALLBACK_CATEGORIES);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [error, setError] = useState('');
  const [itemUpdateState, setItemUpdateState] = useState({});

  const selectedReceipt = useMemo(
    () => receipts.find((receipt) => receipt.id === selectedReceiptId) || null,
    [receipts, selectedReceiptId]
  );

  const loadCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      if (response.ok && Array.isArray(data?.categories) && data.categories.length > 0) {
        setCategories(data.categories);
      }
    } catch (loadError) {
      console.error('Failed to load categories', loadError);
    } finally {
      setLoadingCategories(false);
    }
  };

  const loadReceipts = async () => {
    setLoadingReceipts(true);
    setError('');
    try {
      const response = await fetch('/api/receipts?limit=100&offset=0');
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Error ${response.status}`);
      }

      const receiptList = data?.receipts || [];
      setReceipts(receiptList);
      if (!selectedReceiptId && receiptList.length > 0) {
        setSelectedReceiptId(receiptList[0].id);
      } else if (selectedReceiptId && !receiptList.some((receipt) => receipt.id === selectedReceiptId)) {
        setSelectedReceiptId(receiptList[0]?.id || null);
      }
    } catch (loadError) {
      setError(loadError.message || 'Failed to load receipts.');
    } finally {
      setLoadingReceipts(false);
    }
  };

  useEffect(() => {
    loadCategories();
    loadReceipts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateItemCategory = async (receiptId, itemId, categoryName) => {
    setItemUpdateState((prev) => ({ ...prev, [itemId]: true }));
    try {
      const response = await fetch(`/api/receipts/${receiptId}/items/${itemId}/category`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_name: categoryName,
          category_source: 'manual',
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || `Error ${response.status}`);
      }

      setReceipts((prevReceipts) =>
        prevReceipts.map((receipt) =>
          receipt.id === receiptId
            ? {
                ...receipt,
                items: (receipt.items || []).map((item) =>
                  item.id === itemId
                    ? {
                        ...item,
                        category_name: data.category_name || categoryName,
                        category_source: data.category_source || 'manual',
                      }
                    : item
                ),
              }
            : receipt
        )
      );
    } catch (updateError) {
      console.error('Failed to update item category:', updateError);
    } finally {
      setItemUpdateState((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Receipts
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Browse stored receipts, inspect items, and override categories.
          </Typography>
        </Box>
        <Button variant="outlined" onClick={loadReceipts} disabled={loadingReceipts}>
          Refresh
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card sx={{ minHeight: 420 }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Saved Receipts
              </Typography>
              {loadingReceipts ? (
                <Box sx={{ py: 4, textAlign: 'center' }}>
                  <CircularProgress size={24} />
                </Box>
              ) : error ? (
                <Typography color="error">{error}</Typography>
              ) : receipts.length === 0 ? (
                <Typography color="text.secondary">No receipts found yet.</Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {receipts.map((receipt) => (
                    <Button
                      key={receipt.id}
                      variant={selectedReceiptId === receipt.id ? 'contained' : 'outlined'}
                      onClick={() => setSelectedReceiptId(receipt.id)}
                      sx={{ justifyContent: 'space-between', textTransform: 'none' }}
                    >
                      <span>{receipt.merchant_name || `Receipt #${receipt.id}`}</span>
                      <span>{formatCurrency(receipt.total_amount || receipt.extracted_total || 0)}</span>
                    </Button>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={8}>
          <Card sx={{ minHeight: 420 }}>
            <CardContent>
              {selectedReceipt ? (
                <>
                  <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="h6">{selectedReceipt.merchant_name || `Receipt #${selectedReceipt.id}`}</Typography>
                      <Typography color="text.secondary">
                        {formatDate(selectedReceipt.receipt_date)} • {selectedReceipt.currency || 'JPY'}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      <Chip label={selectedReceipt.is_shared ? 'Shared' : 'Personal'} color={selectedReceipt.is_shared ? 'primary' : 'default'} />
                      <Chip label={`Items: ${(selectedReceipt.items || []).length}`} />
                    </Box>
                  </Box>

                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ mb: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      Total
                    </Typography>
                    <Typography variant="h5">
                      {formatCurrency(selectedReceipt.total_amount || selectedReceipt.extracted_total || 0)}
                    </Typography>
                  </Box>

                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, maxHeight: 420, overflowY: 'auto', pr: 1 }}>
                    {(selectedReceipt.items || []).map((item) => (
                      <Card key={item.id || `${item.normalized_name}-${item.original_name}`} variant="outlined">
                        <CardContent sx={{ py: 1.5 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', mb: 1 }}>
                            <Box>
                              <Typography variant="subtitle1">{item.normalized_name}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {item.original_name}
                              </Typography>
                            </Box>
                            <Typography sx={{ fontWeight: 700 }}>{formatCurrency(item.effective_total || item.price_before_tax)}</Typography>
                          </Box>

                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                            <FormControl size="small" sx={{ minWidth: 180 }}>
                              <InputLabel id={`receipt-item-category-${item.id}`}>Category</InputLabel>
                              <Select
                                labelId={`receipt-item-category-${item.id}`}
                                label="Category"
                                value={item.category_name || 'Uncategorized'}
                                onChange={(event) => updateItemCategory(selectedReceipt.id, item.id, event.target.value)}
                                disabled={!item.id || loadingCategories || itemUpdateState[item.id]}
                              >
                                {categories.map((category) => (
                                  <MenuItem key={category} value={category}>
                                    {category}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <Chip size="small" label={`Source: ${item.category_source || 'auto'}`} />
                            {itemUpdateState[item.id] ? <CircularProgress size={16} /> : null}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                  </Box>
                </>
              ) : (
                <Typography color="text.secondary">Select a receipt to view details.</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default ReceiptLibrary;
