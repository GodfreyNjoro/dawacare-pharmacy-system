import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  CreditCard,
  Banknote,
  Smartphone,
  CheckCircle,
  X,
  User,
  UserPlus,
  Star,
  Wallet,
  ArrowLeft,
  Package,
  AlertCircle,
  Cloud,
  CloudOff,
  Printer,
  FileText,
} from 'lucide-react';
import { Button, Input, Card, CardContent, CardHeader, Badge, Modal } from '../components/ui';
import { useAuth } from '../lib/auth-context';
import { useNavigate } from 'react-router-dom';

// Types
interface Medicine {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitPrice: number;
  category: string;
}

interface CartItem {
  medicine: Medicine;
  quantity: number;
}

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  loyaltyPoints: number;
  creditBalance: number;
  creditLimit: number;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  loyaltyPointsEarned: number;
  customerName: string | null;
  customerPhone: string | null;
  paymentMethod: string;
  createdAt: string;
  companyName?: string;
  companyKraPin?: string;
  companyAddress?: string;
  companyPhone?: string;
  vatRate?: number;
  items: Array<{
    medicineName: string;
    batchNumber: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

// Constants
const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash', Icon: Banknote },
  { id: 'CARD', label: 'Card', Icon: CreditCard },
  { id: 'MPESA', label: 'M-Pesa', Icon: Smartphone },
  { id: 'CREDIT', label: 'Credit', Icon: Wallet },
];

const POINTS_RATE = 100;
const POINTS_VALUE = 1;

// Tax settings interface
interface TaxSettings {
  vatEnabled: boolean;
  standardVatRate: number;
  companyName: string;
  companyKraPin: string;
  companyAddress: string;
  companyPhone: string;
  defaultTaxExempt: boolean;
}

export default function POS() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // State
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  
  // Tax settings state
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
    vatEnabled: false,
    standardVatRate: 16,
    companyName: 'DawaCare Pharmacy',
    companyKraPin: '',
    companyAddress: 'Nairobi, Kenya',
    companyPhone: '+254 700 000 000',
    defaultTaxExempt: true,
  });
  
  // Customer state
  const [showCustomerSection, setShowCustomerSection] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [showNewCustomerModal, setShowNewCustomerModal] = useState(false);
  const [newCustomerData, setNewCustomerData] = useState({ name: '', phone: '', email: '' });
  
  // Loyalty points
  const [usePoints, setUsePoints] = useState(false);
  const [pointsToUse, setPointsToUse] = useState(0);
  
  // Walk-in customer
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  
  // Today's stats
  const [todayStats, setTodayStats] = useState({ totalRevenue: 0, salesCount: 0 });
  
  // Sync status indicator
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Online/offline detection
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Fetch medicines
  const fetchMedicines = useCallback(async () => {
    try {
      console.log('[POS] Fetching medicines, search:', searchQuery);
      const result = searchQuery
        ? await window.electronAPI.searchMedicines(searchQuery)
        : await window.electronAPI.getAllMedicines({ limit: 100 });
      
      console.log('[POS] Medicines result:', result);
      if (result.success) {
        // The API already filters by quantity > 0
        setMedicines(result.medicines || []);
      } else {
        console.error('[POS] Failed to fetch medicines:', result.error);
      }
    } catch (error) {
      console.error('[POS] Error fetching medicines:', error);
    }
  }, [searchQuery]);

  // Fetch customers
  const fetchCustomers = useCallback(async () => {
    try {
      const result = await window.electronAPI.getAllCustomers();
      if (result.success) {
        setCustomers(result.customers);
      }
    } catch (error) {
      console.error('Error fetching customers:', error);
    }
  }, []);

  // Fetch today's stats
  const fetchTodayStats = useCallback(async () => {
    try {
      const result = await window.electronAPI.getTodayStats();
      if (result.success) {
        setTodayStats(result.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, []);

  // Fetch tax settings
  const fetchTaxSettings = useCallback(async () => {
    try {
      // @ts-ignore - getTaxSettings exists in preload
      const result = await window.electronAPI.getTaxSettings();
      if (result.success && result.settings) {
        setTaxSettings({
          vatEnabled: result.settings.vatEnabled ?? false,
          standardVatRate: result.settings.standardVatRate ?? 16,
          companyName: result.settings.companyName || 'DawaCare Pharmacy',
          companyKraPin: result.settings.companyKraPin || '',
          companyAddress: result.settings.companyAddress || 'Nairobi, Kenya',
          companyPhone: result.settings.companyPhone || '+254 700 000 000',
          defaultTaxExempt: result.settings.defaultTaxExempt ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching tax settings:', error);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchTodayStats();
    fetchTaxSettings();
  }, [fetchCustomers, fetchTodayStats, fetchTaxSettings]);

  useEffect(() => {
    const debounce = setTimeout(fetchMedicines, 300);
    return () => clearTimeout(debounce);
  }, [fetchMedicines]);

  // Filtered customers
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
      c.phone.includes(customerSearch)
  );

  // Cart operations
  const addToCart = (medicine: Medicine) => {
    const existing = cart.find((item) => item.medicine.id === medicine.id);
    if (existing) {
      if (existing.quantity >= medicine.quantity) {
        alert('Cannot add more than available stock');
        return;
      }
      setCart(
        cart.map((item) =>
          item.medicine.id === medicine.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setCart([...cart, { medicine, quantity: 1 }]);
    }
  };

  const updateQuantity = (medicineId: string, delta: number) => {
    setCart(
      cart
        .map((item) => {
          if (item.medicine.id === medicineId) {
            const newQty = item.quantity + delta;
            if (newQty <= 0) return null;
            if (newQty > item.medicine.quantity) {
              alert('Cannot exceed available stock');
              return item;
            }
            return { ...item, quantity: newQty };
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (medicineId: string) => {
    setCart(cart.filter((item) => item.medicine.id !== medicineId));
  };

  // Calculations
  const subtotal = cart.reduce(
    (sum, item) => sum + item.medicine.unitPrice * item.quantity,
    0
  );
  const pointsDiscount = usePoints ? pointsToUse * POINTS_VALUE : 0;
  const netAmount = Math.max(0, subtotal - discount - pointsDiscount);
  
  // Calculate VAT if enabled (VAT is inclusive in Kenya - calculate from net amount)
  // VAT formula: VAT = Net Amount * (VAT Rate / (100 + VAT Rate))
  const vatAmount = taxSettings.vatEnabled && !taxSettings.defaultTaxExempt
    ? netAmount * (taxSettings.standardVatRate / (100 + taxSettings.standardVatRate))
    : 0;
  const total = netAmount; // Total includes VAT (inclusive pricing)
  
  const pointsToEarn = Math.floor(total / POINTS_RATE);
  const maxPointsToUse = selectedCustomer
    ? Math.min(selectedCustomer.loyaltyPoints, Math.floor(subtotal - discount))
    : 0;

  // Customer operations
  const selectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearch('');
    setShowCustomerDropdown(false);
    setWalkInName('');
    setWalkInPhone('');
    setUsePoints(false);
    setPointsToUse(0);
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setUsePoints(false);
    setPointsToUse(0);
  };

  const createCustomer = async () => {
    if (!newCustomerData.name || !newCustomerData.phone) {
      alert('Name and phone are required');
      return;
    }

    try {
      const result = await window.electronAPI.createCustomer(newCustomerData);
      if (result.success) {
        setShowNewCustomerModal(false);
        setNewCustomerData({ name: '', phone: '', email: '' });
        fetchCustomers();
        selectCustomer(result.customer);
      } else {
        alert(result.error || 'Failed to create customer');
      }
    } catch (error) {
      console.error('Error creating customer:', error);
      alert('Failed to create customer');
    }
  };

  const canUseCredit = () => {
    if (!selectedCustomer) return false;
    const availableCredit = selectedCustomer.creditLimit - selectedCustomer.creditBalance;
    return availableCredit >= total;
  };

  // Print receipt function
  const handlePrintReceipt = (sale: Sale) => {
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString('en-KE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    const printWindow = window.open('', '', 'height=600,width=400');
    if (!printWindow) {
      alert('Please allow popups to print receipts');
      return;
    }

    const receiptHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Receipt - ${sale.invoiceNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { 
              font-family: 'Courier New', monospace; 
              padding: 10px;
              font-size: 12px;
              width: 80mm;
              max-width: 80mm;
            }
            .header { text-align: center; margin-bottom: 15px; border-bottom: 1px dashed #000; padding-bottom: 10px; }
            .header h1 { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
            .header p { font-size: 10px; color: #333; }
            .info { margin-bottom: 10px; }
            .info p { display: flex; justify-content: space-between; margin: 3px 0; }
            .items { border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 10px 0; margin: 10px 0; }
            .item { margin-bottom: 5px; }
            .item-name { font-weight: bold; }
            .item-details { display: flex; justify-content: space-between; font-size: 11px; }
            .totals { margin-bottom: 15px; }
            .totals p { display: flex; justify-content: space-between; margin: 3px 0; }
            .totals .total { font-weight: bold; font-size: 14px; border-top: 1px solid #000; padding-top: 5px; margin-top: 5px; }
            .footer { text-align: center; font-size: 10px; border-top: 1px dashed #000; padding-top: 10px; }
            .footer p { margin: 3px 0; }
            @media print {
              body { width: 80mm; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <div style="text-align: center; margin-bottom: 10px;">
              <img src="data:image/png;base64,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" style="width: 60px; height: 60px;" alt="DawaCare Logo" />
            </div>
            <h1>${sale.companyName || 'DawaCare Pharmacy'}</h1>
            <p>Your Trusted Healthcare Partner</p>
            <p>Tel: ${sale.companyPhone || '+254 700 000 000'}</p>
            <p>${sale.companyAddress || 'Nairobi, Kenya'}</p>
            ${sale.companyKraPin ? `<p style="font-weight: bold;">KRA PIN: ${sale.companyKraPin}</p>` : ''}
          </div>
          
          <div class="info">
            <p><span>Invoice:</span><span>${sale.invoiceNumber}</span></p>
            <p><span>Date:</span><span>${formatDate(sale.createdAt)}</span></p>
            <p><span>Customer:</span><span>${sale.customerName || 'Walk-in'}</span></p>
            ${sale.customerPhone ? `<p><span>Phone:</span><span>${sale.customerPhone}</span></p>` : ''}
            <p><span>Payment:</span><span>${sale.paymentMethod}</span></p>
          </div>
          
          <div class="items">
            ${sale.items.map(item => `
              <div class="item">
                <div class="item-name">${item.medicineName}</div>
                <div class="item-details">
                  <span>${item.quantity} x KES ${item.unitPrice.toFixed(2)}</span>
                  <span>KES ${item.total.toFixed(2)}</span>
                </div>
              </div>
            `).join('')}
          </div>
          
          <div class="totals">
            <p><span>Subtotal:</span><span>KES ${sale.subtotal.toFixed(2)}</span></p>
            ${sale.discount > 0 ? `<p><span>Discount:</span><span>- KES ${sale.discount.toFixed(2)}</span></p>` : ''}
            ${sale.tax > 0 ? `<p><span>VAT (${sale.vatRate || 16}% Incl.):</span><span>KES ${sale.tax.toFixed(2)}</span></p>` : ''}
            <p class="total"><span>TOTAL:</span><span>KES ${sale.total.toFixed(2)}</span></p>
          </div>
          
          ${sale.loyaltyPointsEarned > 0 ? `
            <div style="text-align: center; margin-bottom: 10px; font-size: 11px;">
              ⭐ Earned ${sale.loyaltyPointsEarned} loyalty points!
            </div>
          ` : ''}
          
          <div class="footer">
            <p>Thank you for choosing ${sale.companyName || 'DawaCare'}!</p>
            <p>Get well soon!</p>
            <p style="margin-top: 10px;">Served by: ${user?.name || user?.email || 'Staff'}</p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    
    // Wait for content to load, then print
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  // Process sale
  const processSale = async () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    if (paymentMethod === 'CREDIT' && !selectedCustomer) {
      alert('Please select a customer for credit purchase');
      return;
    }

    if (paymentMethod === 'CREDIT' && !canUseCredit()) {
      alert('Customer has insufficient credit limit');
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electronAPI.createSale({
        items: cart.map((item) => ({
          medicineId: item.medicine.id,
          quantity: item.quantity,
        })),
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name || walkInName || undefined,
        customerPhone: selectedCustomer?.phone || walkInPhone || undefined,
        discount,
        tax: vatAmount, // Include calculated VAT
        loyaltyPointsUsed: usePoints ? pointsToUse : 0,
        paymentMethod,
        notes: notes || undefined,
        soldBy: user?.email,
      });

      if (result.success) {
        const saleData: Sale = {
          id: result.sale.id,
          invoiceNumber: result.sale.invoiceNumber,
          subtotal: result.sale.subtotal,
          discount: result.sale.discount || 0,
          tax: result.sale.taxAmount || vatAmount || 0,
          total: result.sale.total,
          loyaltyPointsEarned: result.sale.loyaltyPointsEarned,
          customerName: result.sale.customerName,
          customerPhone: result.sale.customerPhone,
          paymentMethod: result.sale.paymentMethod,
          createdAt: result.sale.createdAt || new Date().toISOString(),
          // Include company info for receipt
          companyName: taxSettings.companyName,
          companyKraPin: taxSettings.companyKraPin,
          companyAddress: taxSettings.companyAddress,
          companyPhone: taxSettings.companyPhone,
          vatRate: taxSettings.vatEnabled ? taxSettings.standardVatRate : 0,
          items: result.sale.items.map((item: any) => ({
            medicineName: item.medicineName,
            batchNumber: item.batchNumber || '',
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            total: item.total,
          })),
        };
        setLastSale(saleData);
        setShowSuccess(true);
        
        // Auto-print receipt after checkout
        handlePrintReceipt(saleData);
        
        // Reset form
        setCart([]);
        setSelectedCustomer(null);
        setWalkInName('');
        setWalkInPhone('');
        setDiscount(0);
        setNotes('');
        setUsePoints(false);
        setPointsToUse(0);
        
        // Refresh data
        fetchMedicines();
        fetchCustomers();
        fetchTodayStats();
      } else {
        alert(result.error || 'Failed to process sale');
      }
    } catch (error) {
      console.error('Error processing sale:', error);
      alert('Failed to process sale');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Point of Sale</h1>
              <p className="text-sm text-gray-500">DawaCare POS - Offline Mode Ready</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {/* Sync Status */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg ${isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
              {isOnline ? <Cloud className="w-4 h-4" /> : <CloudOff className="w-4 h-4" />}
              <span className="text-sm font-medium">{isOnline ? 'Online' : 'Offline'}</span>
            </div>
            
            {/* Today's Stats */}
            <div className="hidden md:flex items-center gap-4 px-4 py-2 bg-emerald-50 rounded-lg">
              <div>
                <p className="text-xs text-emerald-600">Today's Sales</p>
                <p className="text-lg font-bold text-emerald-700">{todayStats.salesCount}</p>
              </div>
              <div className="w-px h-8 bg-emerald-200" />
              <div>
                <p className="text-xs text-emerald-600">Revenue</p>
                <p className="text-lg font-bold text-emerald-700">KES {todayStats.totalRevenue.toLocaleString()}</p>
              </div>
            </div>
            
            {/* User info */}
            <div className="flex items-center gap-2">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
                <p className="text-xs text-gray-500">{user?.role}</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Success Modal */}
      <Modal
        isOpen={showSuccess}
        onClose={() => setShowSuccess(false)}
        title="Sale Completed!"
      >
        {lastSale && (
          <div className="text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <p className="text-gray-600 mb-4">Invoice: {lastSale.invoiceNumber}</p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
              <div className="space-y-2 text-sm">
                {lastSale.items.map((item, idx) => (
                  <div key={idx} className="flex justify-between">
                    <span>{item.medicineName} x{item.quantity}</span>
                    <span>KES {item.total.toFixed(2)}</span>
                  </div>
                ))}
              </div>
              {lastSale.discount > 0 && (
                <div className="border-t mt-2 pt-2 flex justify-between text-sm text-red-600">
                  <span>Discount</span>
                  <span>- KES {lastSale.discount.toFixed(2)}</span>
                </div>
              )}
              {lastSale.tax > 0 && (
                <div className="flex justify-between text-sm text-blue-600 mt-1">
                  <span>VAT ({lastSale.vatRate || 16}% Incl.)</span>
                  <span>KES {lastSale.tax.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t mt-2 pt-2 font-bold flex justify-between">
                <span>Total</span>
                <span>KES {lastSale.total.toFixed(2)}</span>
              </div>
              {lastSale.loyaltyPointsEarned > 0 && (
                <div className="mt-2 text-sm text-amber-600 flex items-center gap-1">
                  <Star className="w-4 h-4" />
                  Earned {lastSale.loyaltyPointsEarned} loyalty points!
                </div>
              )}
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500 mb-2">
                <Printer className="w-4 h-4 inline mr-1" />
                Receipt sent to printer
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => handlePrintReceipt(lastSale)}
                >
                  <Printer className="w-4 h-4 mr-2" />
                  Reprint
                </Button>
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setShowSuccess(false);
                    navigate(`/invoice/${lastSale.id}`);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  View Invoice
                </Button>
              </div>
              <Button onClick={() => setShowSuccess(false)} className="w-full">
                Continue
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* New Customer Modal */}
      <Modal
        isOpen={showNewCustomerModal}
        onClose={() => setShowNewCustomerModal(false)}
        title="Add New Customer"
      >
        <div className="space-y-4">
          <Input
            label="Name *"
            value={newCustomerData.name}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, name: e.target.value })}
          />
          <Input
            label="Phone *"
            value={newCustomerData.phone}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, phone: e.target.value })}
          />
          <Input
            label="Email (optional)"
            type="email"
            value={newCustomerData.email}
            onChange={(e) => setNewCustomerData({ ...newCustomerData, email: e.target.value })}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowNewCustomerModal(false)}>
              Cancel
            </Button>
            <Button onClick={createCustomer}>
              Create Customer
            </Button>
          </div>
        </div>
      </Modal>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Medicine Search & List */}
          <div className="lg:col-span-2 space-y-4">
            {/* Search Bar */}
            <Card>
              <CardContent>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search medicines by name, generic name, or batch number..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 text-lg"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Medicine Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {medicines.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-gray-500">
                  <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>{searchQuery ? 'No medicines found matching your search' : 'No medicines with stock available. Please sync data from cloud.'}</p>
                </div>
              ) : (
                medicines.map((medicine) => {
                  const isLowStock = medicine.quantity <= 10;
                  const isExpiringSoon = new Date(medicine.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
                  const cartItem = cart.find((item) => item.medicine.id === medicine.id);

                  return (
                    <Card
                      key={medicine.id}
                      className={`cursor-pointer transition-all hover:shadow-md ${
                        cartItem ? 'ring-2 ring-emerald-500 bg-emerald-50' : ''
                      }`}
                    >
                      <CardContent className="p-4" onClick={() => addToCart(medicine)}>
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h3 className="font-semibold text-gray-900">{medicine.name}</h3>
                            {medicine.genericName && (
                              <p className="text-sm text-gray-500">{medicine.genericName}</p>
                            )}
                          </div>
                          <Badge variant="success">KES {medicine.unitPrice.toFixed(2)}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Batch: {medicine.batchNumber}</span>
                          <div className="flex items-center gap-2">
                            {isLowStock && <Badge variant="danger">Low Stock</Badge>}
                            {isExpiringSoon && <Badge variant="warning">Expiring Soon</Badge>}
                            <span className={`font-medium ${isLowStock ? 'text-red-600' : 'text-gray-700'}`}>
                              Stock: {medicine.quantity}
                            </span>
                          </div>
                        </div>
                        {cartItem && (
                          <div className="mt-2 pt-2 border-t flex items-center justify-between">
                            <span className="text-sm text-emerald-700 font-medium">In Cart: {cartItem.quantity}</span>
                            <Plus className="w-4 h-4 text-emerald-600" />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>

          {/* Cart Panel */}
          <div className="lg:col-span-1">
            <Card className="sticky top-20">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    Cart
                  </h2>
                  {cart.length > 0 && (
                    <Badge variant="success">{cart.length} items</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ShoppingCart className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Cart is empty</p>
                    <p className="text-sm">Click on medicines to add them</p>
                  </div>
                ) : (
                  <>
                    {/* Cart Items */}
                    <div className="space-y-3 max-h-48 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.medicine.id} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-sm">{item.medicine.name}</span>
                            <button
                              className="text-gray-400 hover:text-red-500 p-1"
                              onClick={() => removeFromCart(item.medicine.id)}
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateQuantity(item.medicine.id, -1)}
                              >
                                <Minus className="w-3 h-3" />
                              </Button>
                              <span className="w-8 text-center font-medium">{item.quantity}</span>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 w-7 p-0"
                                onClick={() => updateQuantity(item.medicine.id, 1)}
                              >
                                <Plus className="w-3 h-3" />
                              </Button>
                            </div>
                            <span className="font-medium text-emerald-700">
                              KES {(item.medicine.unitPrice * item.quantity).toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Customer Selection Toggle */}
                    <div className="border-t pt-4">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={showCustomerSection}
                          onChange={(e) => {
                            setShowCustomerSection(e.target.checked);
                            if (!e.target.checked) {
                              // Clear customer data when hiding
                              setSelectedCustomer(null);
                              setCustomerSearch('');
                              setWalkInName('');
                              setWalkInPhone('');
                              setUsePoints(false);
                              setPointsToUse(0);
                            }
                          }}
                          className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-gray-700 flex items-center gap-2">
                          <User className="w-4 h-4" />
                          Add Customer Info
                        </span>
                      </label>
                      
                      {/* Customer Details - Only shown when checkbox is checked */}
                      {showCustomerSection && (
                        <div className="mt-3 space-y-3">
                          {selectedCustomer ? (
                            <div className="bg-emerald-50 rounded-lg p-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="font-medium text-gray-900">{selectedCustomer.name}</p>
                                  <p className="text-sm text-gray-600">{selectedCustomer.phone}</p>
                                </div>
                                <button className="text-gray-400 hover:text-gray-600 p-1" onClick={clearCustomer}>
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-sm">
                                <span className="flex items-center gap-1 text-amber-600">
                                  <Star className="w-4 h-4" />
                                  {selectedCustomer.loyaltyPoints} pts
                                </span>
                                {selectedCustomer.creditBalance > 0 && (
                                  <span className="text-blue-600">
                                    Credit: KES {selectedCustomer.creditBalance.toFixed(2)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="relative">
                                <Input
                                  placeholder="Search customer..."
                                  value={customerSearch}
                                  onChange={(e) => {
                                    setCustomerSearch(e.target.value);
                                    setShowCustomerDropdown(true);
                                  }}
                                  onFocus={() => setShowCustomerDropdown(true)}
                                />
                                {showCustomerDropdown && customerSearch && (
                                  <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 max-h-40 overflow-y-auto">
                                    {filteredCustomers.length === 0 ? (
                                      <div className="p-3 text-center text-gray-500 text-sm">No customers found</div>
                                    ) : (
                                      filteredCustomers.map((customer) => (
                                        <button
                                          key={customer.id}
                                          className="w-full text-left px-3 py-2 hover:bg-gray-50 flex justify-between items-center"
                                          onClick={() => selectCustomer(customer)}
                                        >
                                          <div>
                                            <p className="font-medium">{customer.name}</p>
                                            <p className="text-sm text-gray-500">{customer.phone}</p>
                                          </div>
                                          <span className="text-amber-600 text-sm flex items-center gap-1">
                                            <Star className="w-3 h-3" />
                                            {customer.loyaltyPoints}
                                          </span>
                                        </button>
                                      ))
                                    )}
                                  </div>
                                )}
                              </div>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => setShowNewCustomerModal(true)}
                              >
                                <UserPlus className="w-4 h-4 mr-1" />
                                New Customer
                              </Button>
                              <div className="text-xs text-gray-500 text-center">or walk-in customer:</div>
                              <Input
                                placeholder="Name (optional)"
                                value={walkInName}
                                onChange={(e) => setWalkInName(e.target.value)}
                                className="h-8 text-sm"
                              />
                              <Input
                                placeholder="Phone (optional)"
                                value={walkInPhone}
                                onChange={(e) => setWalkInPhone(e.target.value)}
                                className="h-8 text-sm"
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Loyalty Points */}
                    {showCustomerSection && selectedCustomer && selectedCustomer.loyaltyPoints > 0 && (
                      <div className="border-t pt-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                            <input
                              type="checkbox"
                              checked={usePoints}
                              onChange={(e) => {
                                setUsePoints(e.target.checked);
                                if (!e.target.checked) setPointsToUse(0);
                              }}
                              className="rounded"
                            />
                            <Star className="w-4 h-4 text-amber-500" />
                            Use Loyalty Points
                          </label>
                          <span className="text-sm text-amber-600">{selectedCustomer.loyaltyPoints} available</span>
                        </div>
                        {usePoints && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max={maxPointsToUse}
                              value={pointsToUse || ''}
                              onChange={(e) =>
                                setPointsToUse(Math.min(parseInt(e.target.value) || 0, maxPointsToUse))
                              }
                              className="w-24 h-8"
                              placeholder="0"
                            />
                            <span className="text-sm text-gray-600">= KES {(pointsToUse * POINTS_VALUE).toFixed(2)} off</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-xs"
                              onClick={() => setPointsToUse(maxPointsToUse)}
                            >
                              Use Max
                            </Button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Payment Method */}
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium text-gray-700 mb-2">Payment Method</p>
                      <div className="grid grid-cols-4 gap-2">
                        {PAYMENT_METHODS.map((method) => {
                          const isDisabled = method.id === 'CREDIT' && (!selectedCustomer || !canUseCredit());
                          return (
                            <Button
                              key={method.id}
                              variant={paymentMethod === method.id ? 'primary' : 'outline'}
                              className={`flex-col h-auto py-2 ${isDisabled ? 'opacity-50' : ''}`}
                              onClick={() => !isDisabled && setPaymentMethod(method.id)}
                              disabled={isDisabled}
                            >
                              <method.Icon className="w-4 h-4 mb-1" />
                              <span className="text-xs">{method.label}</span>
                            </Button>
                          );
                        })}
                      </div>
                      {paymentMethod === 'CREDIT' && selectedCustomer && (
                        <p className="text-xs text-blue-600 mt-2">
                          Available credit: KES {(selectedCustomer.creditLimit - selectedCustomer.creditBalance).toFixed(2)}
                        </p>
                      )}
                    </div>

                    {/* Discount */}
                    <div className="border-t pt-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">Discount:</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={discount || ''}
                          onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
                          className="w-24 h-8"
                          placeholder="0.00"
                        />
                        <span className="text-sm text-gray-600">KES</span>
                      </div>
                    </div>

                    {/* Notes */}
                    <div>
                      <Input
                        placeholder="Notes (optional)"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                      />
                    </div>

                    {/* Totals */}
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-600">Subtotal</span>
                        <span>KES {subtotal.toFixed(2)}</span>
                      </div>
                      {discount > 0 && (
                        <div className="flex justify-between text-sm text-red-600">
                          <span>Discount</span>
                          <span>- KES {discount.toFixed(2)}</span>
                        </div>
                      )}
                      {pointsDiscount > 0 && (
                        <div className="flex justify-between text-sm text-amber-600">
                          <span>Points Discount ({pointsToUse} pts)</span>
                          <span>- KES {pointsDiscount.toFixed(2)}</span>
                        </div>
                      )}
                      {taxSettings.vatEnabled && vatAmount > 0 && (
                        <div className="flex justify-between text-sm text-blue-600">
                          <span>VAT ({taxSettings.standardVatRate}% Incl.)</span>
                          <span>KES {vatAmount.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span className="text-emerald-700">KES {total.toFixed(2)}</span>
                      </div>
                      {selectedCustomer && pointsToEarn > 0 && (
                        <div className="text-xs text-amber-600 flex items-center gap-1">
                          <Star className="w-3 h-3" />
                          Will earn {pointsToEarn} loyalty points
                        </div>
                      )}
                    </div>

                    {/* Complete Sale Button */}
                    <Button
                      className="w-full h-12 text-lg"
                      onClick={processSale}
                      disabled={isLoading || cart.length === 0}
                    >
                      {isLoading ? (
                        <span className="flex items-center gap-2">
                          <span className="animate-spin">⏳</span>
                          Processing...
                        </span>
                      ) : (
                        <span className="flex items-center gap-2">
                          <CheckCircle className="w-5 h-5" />
                          Complete Sale
                        </span>
                      )}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
