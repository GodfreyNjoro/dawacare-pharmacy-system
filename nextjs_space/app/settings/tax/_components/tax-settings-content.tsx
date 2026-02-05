'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Save,
  RefreshCw,
  Receipt,
  Building2,
  Info,
  CheckCircle,
  AlertTriangle,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import Link from 'next/link';

interface TaxSettings {
  vatEnabled: boolean;
  standardVatRate: number;
  companyKraPin: string;
  companyName: string;
  companyAddress: string;
  companyPhone: string;
  companyEmail: string;
  defaultTaxExempt: boolean;
}

const defaultSettings: TaxSettings = {
  vatEnabled: true,
  standardVatRate: 16,
  companyKraPin: '',
  companyName: '',
  companyAddress: '',
  companyPhone: '',
  companyEmail: '',
  defaultTaxExempt: true,
};

export default function TaxSettingsContent() {
  const { data: session } = useSession() || {};
  const router = useRouter();
  const [settings, setSettings] = useState<TaxSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalSettings, setOriginalSettings] = useState<TaxSettings>(defaultSettings);

  const userRole = (session?.user as { role?: string })?.role;
  const canManageTax = userRole === 'ADMIN' || userRole === 'PHARMACIST';

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    // Check if settings have changed
    const changed = JSON.stringify(settings) !== JSON.stringify(originalSettings);
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const fetchSettings = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tax-settings');
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setOriginalSettings(data);
      }
    } catch (error) {
      console.error('Error fetching tax settings:', error);
      toast.error('Failed to load tax settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!canManageTax) {
      toast.error('You do not have permission to modify tax settings');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch('/api/tax-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Tax settings saved successfully');
        setOriginalSettings(settings);
        setHasChanges(false);
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to save tax settings');
      }
    } catch (error) {
      console.error('Error saving tax settings:', error);
      toast.error('Failed to save tax settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 rounded-lg">
              <Receipt className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Tax Configuration</h1>
              <p className="text-gray-500">Configure VAT settings for KRA compliance</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/reports?tab=tax">
            <Button variant="outline">
              <FileText className="w-4 h-4 mr-2" />
              View Tax Report
            </Button>
          </Link>
          {hasChanges && (
            <Button variant="outline" onClick={handleReset}>
              <RefreshCw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          )}
          <Button
            onClick={handleSave}
            disabled={!hasChanges || isSaving || !canManageTax}
          >
            {isSaving ? (
              <><RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="w-4 h-4 mr-2" /> Save Changes</>
            )}
          </Button>
        </div>
      </div>

      {/* Permission Warning */}
      {!canManageTax && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <p className="text-amber-800">
            You do not have permission to modify tax settings. Only Admins and Pharmacists can make changes.
          </p>
        </div>
      )}

      {/* Info Banner */}
      <Card className="border-emerald-200 bg-emerald-50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm text-emerald-800">
                Configure VAT settings for Kenya Revenue Authority (KRA) compliance. Most pharmaceutical products
                are VAT-exempt in Kenya under the VAT Act (2013). Standard VAT rate is 16%.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* VAT Configuration Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="w-5 h-5 text-emerald-600" />
              VAT Configuration
            </CardTitle>
            <CardDescription>Configure Value Added Tax settings</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* VAT Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base font-medium">Enable VAT Calculation</Label>
                <p className="text-sm text-gray-500">Include VAT in sales calculations</p>
              </div>
              <Switch
                checked={settings.vatEnabled}
                onCheckedChange={(checked) => setSettings({ ...settings, vatEnabled: checked })}
                disabled={!canManageTax}
              />
            </div>

            {/* VAT Rate */}
            <div className="space-y-2">
              <Label htmlFor="vatRate">Standard VAT Rate (%)</Label>
              <Input
                id="vatRate"
                type="number"
                value={settings.standardVatRate}
                onChange={(e) => setSettings({ ...settings, standardVatRate: parseFloat(e.target.value) || 0 })}
                min={0}
                max={100}
                disabled={!settings.vatEnabled || !canManageTax}
              />
              <p className="text-xs text-gray-500">Kenya standard VAT is 16%</p>
            </div>

            {/* Default Tax Exempt */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base font-medium">Default Tax Exempt</Label>
                <p className="text-sm text-gray-500">New medicines are VAT-exempt by default</p>
              </div>
              <Switch
                checked={settings.defaultTaxExempt}
                onCheckedChange={(checked) => setSettings({ ...settings, defaultTaxExempt: checked })}
                disabled={!settings.vatEnabled || !canManageTax}
              />
            </div>
          </CardContent>
        </Card>

        {/* Company Information Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              Company Information
            </CardTitle>
            <CardDescription>Details for tax invoices and compliance documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={settings.companyName}
                onChange={(e) => setSettings({ ...settings, companyName: e.target.value })}
                placeholder="e.g., DawaCare Pharmacy Ltd"
                disabled={!canManageTax}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="kraPin">KRA PIN</Label>
              <Input
                id="kraPin"
                value={settings.companyKraPin}
                onChange={(e) => setSettings({ ...settings, companyKraPin: e.target.value.toUpperCase() })}
                placeholder="e.g., P051234567X"
                disabled={!canManageTax}
              />
              <p className="text-xs text-gray-500">Required for valid tax invoices</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="companyAddress">Business Address</Label>
              <Input
                id="companyAddress"
                value={settings.companyAddress}
                onChange={(e) => setSettings({ ...settings, companyAddress: e.target.value })}
                placeholder="e.g., Kimathi Street, Nairobi"
                disabled={!canManageTax}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="companyPhone">Phone Number</Label>
                <Input
                  id="companyPhone"
                  value={settings.companyPhone}
                  onChange={(e) => setSettings({ ...settings, companyPhone: e.target.value })}
                  placeholder="e.g., +254 700 000000"
                  disabled={!canManageTax}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="companyEmail">Email Address</Label>
                <Input
                  id="companyEmail"
                  type="email"
                  value={settings.companyEmail}
                  onChange={(e) => setSettings({ ...settings, companyEmail: e.target.value })}
                  placeholder="e.g., info@pharmacy.co.ke"
                  disabled={!canManageTax}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Indicators */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Configuration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              {settings.vatEnabled ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">VAT Calculation</p>
                <p className="text-sm text-gray-500">
                  {settings.vatEnabled ? `Enabled at ${settings.standardVatRate}%` : 'Disabled'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              {settings.companyKraPin ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">KRA PIN</p>
                <p className="text-sm text-gray-500">
                  {settings.companyKraPin || 'Not configured'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
              {settings.companyName ? (
                <CheckCircle className="w-5 h-5 text-emerald-600" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              )}
              <div>
                <p className="font-medium">Company Info</p>
                <p className="text-sm text-gray-500">
                  {settings.companyName || 'Not configured'}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
