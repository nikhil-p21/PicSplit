import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from '@mui/material';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

const CHART_COLORS = [
  '#0088FE',
  '#00C49F',
  '#FFBB28',
  '#FF8042',
  '#AA6FF0',
  '#FF6B6B',
  '#5DADEC',
  '#4CAF50',
  '#FF9800',
  '#795548',
  '#607D8B',
  '#9C27B0',
];

const MONTH_LABELS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const formatCurrency = (value) =>
  new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(
    Number(value || 0)
  );

const ExpenseDashboard = () => {
  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const currentMonth = useMemo(() => new Date().getMonth() + 1, []);
  const [year, setYear] = useState(currentYear);
  const [month, setMonth] = useState(currentMonth);
  const [dashboardData, setDashboardData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const selectableYears = useMemo(
    () => Array.from({ length: 5 }, (_, index) => currentYear - index),
    [currentYear]
  );

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setError('');

      try {
        const response = await fetch(`/api/dashboard/monthly?year=${year}&month=${month}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || `Error ${response.status}`);
        }
        setDashboardData(data);
      } catch (loadError) {
        setDashboardData(null);
        setError(loadError.message || 'Failed to load dashboard.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, [year, month]);

  const categoryData = dashboardData?.category_breakdown || [];

  return (
    <Box>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" gutterBottom>
            Monthly Dashboard
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Track spending trends by category for {MONTH_LABELS[month - 1]} {year}
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', gap: 2 }}>
          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="dashboard-year-label">Year</InputLabel>
            <Select
              labelId="dashboard-year-label"
              value={year}
              label="Year"
              onChange={(event) => setYear(Number(event.target.value))}
            >
              {selectableYears.map((yearOption) => (
                <MenuItem key={yearOption} value={yearOption}>
                  {yearOption}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 140 }}>
            <InputLabel id="dashboard-month-label">Month</InputLabel>
            <Select
              labelId="dashboard-month-label"
              value={month}
              label="Month"
              onChange={(event) => setMonth(Number(event.target.value))}
            >
              {MONTH_LABELS.map((monthLabel, monthIndex) => (
                <MenuItem key={monthLabel} value={monthIndex + 1}>
                  {monthLabel}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>
      </Box>

      {isLoading ? (
        <Box sx={{ py: 8, textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Card>
          <CardContent>
            <Typography color="error">Failed to load dashboard: {error}</Typography>
          </CardContent>
        </Card>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Total Spend
                  </Typography>
                  <Typography variant="h4">{formatCurrency(dashboardData?.total_spend)}</Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Recorded Expenses
                  </Typography>
                  <Typography variant="h4">{dashboardData?.expense_count || 0}</Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Grid container spacing={3}>
            <Grid item xs={12} lg={5}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Category Share
                  </Typography>
                  <Box sx={{ height: 320 }}>
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={categoryData} dataKey="amount" nameKey="category_name" cx="50%" cy="50%" outerRadius={110}>
                            {categoryData.map((entry, index) => (
                              <Cell key={`${entry.category_name}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography color="text.secondary">No expenses recorded for this month.</Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} lg={7}>
              <Card sx={{ height: '100%' }}>
                <CardContent>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    Category Totals
                  </Typography>
                  <Box sx={{ height: 320 }}>
                    {categoryData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryData} margin={{ top: 12, right: 16, left: 0, bottom: 4 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="category_name" />
                          <YAxis />
                          <Tooltip formatter={(value) => formatCurrency(value)} />
                          <Bar dataKey="amount" fill="#03a9f4" radius={[6, 6, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Typography color="text.secondary">No category totals available.</Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
};

export default ExpenseDashboard;
