'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Receipt,
  Download,
  RefreshCw,
  Calendar,
  Building2,
  TrendingUp,
  FileText,
  AlertTriangle,
  CheckCircle,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import Link from 'next/link';

interface TaxSettings {
  vatEnabled: boolean;
  standardVatRate: number;
  companyKraPin: string;
  companyName: string;
  companyAddress: string;
}

interface TaxSummary {
  totalSales: number;
  taxableSales: number;
  exemptSales: number;
  totalVat: number;
  salesCount: number;
}

interface SaleWithTax {
  id: string;
  invoiceNumber: string;
  createdAt: string;
  total: number;
  vatAmount: number;
  isExempt: boolean;
  customerName: string;
  paymentMethod: string;
}

export default function TaxReport() {
  const [isLoading, setIsLoading] = useState(true);
  const [taxSettings, setTaxSettings] = useState<TaxSettings | null>(null);
  const [taxSummary, setTaxSummary] = useState<TaxSummary | null>(null);
  const [salesWithTax, setSalesWithTax] = useState<SaleWithTax[]>([]);
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setDate(1); // First of current month
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [period, setPeriod] = useState('month');

  const fetchTaxSettings = useCallback(async () => {
    try {
      const response = await fetch('/api/tax-settings');
      if (response.ok) {
        const data = await response.json();
        setTaxSettings(data);
      }
    } catch (error) {
      console.error('Error fetching tax settings:', error);
    }
  }, []);

  const fetchTaxReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `/api/reports/tax?from=${dateFrom}&to=${dateTo}`
      );
      if (response.ok) {
        const data = await response.json();
        setTaxSummary(data.summary);
        setSalesWithTax(data.sales || []);
      }
    } catch (error) {
      console.error('Error fetching tax report:', error);
      toast.error('Failed to load tax report');
    } finally {
      setIsLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    fetchTaxSettings();
  }, [fetchTaxSettings]);

  useEffect(() => {
    fetchTaxReport();
  }, [fetchTaxReport]);

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod);
    const now = new Date();
    let from = new Date();

    switch (newPeriod) {
      case 'week':
        from.setDate(now.getDate() - 7);
        break;
      case 'month':
        from.setDate(1);
        break;
      case 'quarter':
        const quarter = Math.floor(now.getMonth() / 3);
        from = new Date(now.getFullYear(), quarter * 3, 1);
        break;
      case 'year':
        from = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        from.setDate(1);
    }

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(now.toISOString().split('T')[0]);
  };

  const handleExport = () => {
    // Generate CSV export
    const headers = ['Invoice #', 'Date', 'Customer', 'Total (KES)', 'VAT (KES)', 'Tax Status', 'Payment Method'];
    const rows = salesWithTax.map(sale => [
      sale.invoiceNumber,
      new Date(sale.createdAt).toLocaleDateString(),
      sale.customerName || 'Walk-in',
      sale.total.toFixed(2),
      sale.vatAmount.toFixed(2),
      sale.isExempt ? 'Exempt' : 'Taxable',
      sale.paymentMethod
    ]);

    const csvContent = [
      `Tax Report - ${dateFrom} to ${dateTo}`,
      `Company: ${taxSettings?.companyName || 'N/A'}`,
      `KRA PIN: ${taxSettings?.companyKraPin || 'N/A'}`,
      '',
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tax-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tax report exported successfully');
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-KE', {
      style: 'currency',
      currency: 'KES',
    }).format(amount);
  };

  // Check if tax is properly configured
  const isTaxConfigured = taxSettings?.companyKraPin && taxSettings?.companyName;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Configuration Warning */}
      {!isTaxConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <p className="text-amber-800 font-medium">Tax Configuration Incomplete</p>
                <p className="text-sm text-amber-700">
                  Please configure your company details and KRA PIN for valid tax reporting.
                </p>
              </div>
              <Link href="/settings/tax">
                <Button variant="outline" size="sm">
                  Configure Tax Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Company Info Header */}
      {taxSettings?.companyName && (
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <Building2 className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{taxSettings.companyName}</h3>
                  <p className="text-sm text-gray-500">{taxSettings.companyAddress}</p>
                  <p className="text-sm text-gray-500">KRA PIN: {taxSettings.companyKraPin || 'Not Set'}</p>
                </div>
              </div>
              <div className="text-right">
                <Badge variant={taxSettings.vatEnabled ? 'default' : 'secondary'}>
                  VAT {taxSettings.vatEnabled ? `Enabled (${taxSettings.standardVatRate}%)` : 'Disabled'}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label htmlFor="period">Period</Label>
              <Select value={period} onValueChange={handlePeriodChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">Last 7 Days</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="quarter">This Quarter</SelectItem>
                  <SelectItem value="year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[150px]">
              <Label htmlFor="dateFrom">From</Label>
              <Input
                id="dateFrom"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPeriod('custom');
                }}
              />
            </div>
            <div className="min-w-[150px]">
              <Label htmlFor="dateTo">To</Label>
              <Input
                id="dateTo"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPeriod('custom');
                }}
              />
            </div>
            <Button variant="outline" onClick={fetchTaxReport} disabled={isLoading}>
              {isLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
            <Button onClick={handleExport} disabled={isLoading || !taxSummary}>
              <Download className="w-4 h-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Total Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(taxSummary?.totalSales || 0)}
                </p>
                <p className="text-sm text-gray-500">{taxSummary?.salesCount || 0} transactions</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Taxable Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-blue-600">
                  {formatCurrency(taxSummary?.taxableSales || 0)}
                </p>
                <p className="text-sm text-gray-500">Subject to VAT</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-gray-500">Exempt Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-gray-600">
                  {formatCurrency(taxSummary?.exemptSales || 0)}
                </p>
                <p className="text-sm text-gray-500">VAT Exempt</p>
              </CardContent>
            </Card>

            <Card className="border-emerald-200 bg-emerald-50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-emerald-700">Total VAT Collected</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(taxSummary?.totalVat || 0)}
                </p>
                <p className="text-sm text-emerald-600">@ {taxSettings?.standardVatRate || 16}%</p>
              </CardContent>
            </Card>
          </div>

          {/* Sales List */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Sales Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              {salesWithTax.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Receipt className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No sales found for the selected period</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-gray-50">
                        <th className="text-left p-3 text-sm font-medium text-gray-600">Invoice #</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600">Date</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600">Customer</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">Total</th>
                        <th className="text-right p-3 text-sm font-medium text-gray-600">VAT</th>
                        <th className="text-center p-3 text-sm font-medium text-gray-600">Tax Status</th>
                        <th className="text-left p-3 text-sm font-medium text-gray-600">Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salesWithTax.slice(0, 50).map((sale) => (
                        <tr key={sale.id} className="border-b hover:bg-gray-50">
                          <td className="p-3 font-mono text-sm">{sale.invoiceNumber}</td>
                          <td className="p-3 text-sm text-gray-600">
                            {new Date(sale.createdAt).toLocaleDateString()}
                          </td>
                          <td className="p-3 text-sm">{sale.customerName || 'Walk-in'}</td>
                          <td className="p-3 text-sm text-right font-medium">
                            {formatCurrency(sale.total)}
                          </td>
                          <td className="p-3 text-sm text-right">
                            {sale.vatAmount > 0 ? formatCurrency(sale.vatAmount) : '-'}
                          </td>
                          <td className="p-3 text-center">
                            <Badge variant={sale.isExempt ? 'secondary' : 'default'} className="text-xs">
                              {sale.isExempt ? 'Exempt' : 'Taxable'}
                            </Badge>
                          </td>
                          <td className="p-3 text-sm text-gray-600 capitalize">
                            {sale.paymentMethod?.replace('_', ' ').toLowerCase()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {salesWithTax.length > 50 && (
                    <p className="text-center py-4 text-sm text-gray-500">
                      Showing 50 of {salesWithTax.length} transactions. Export to CSV for full list.
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </motion.div>
  );
}
