// POS Types for Desktop App

export interface Medicine {
  id: string;
  name: string;
  genericName: string | null;
  manufacturer: string | null;
  batchNumber: string;
  expiryDate: Date | string;
  quantity: number;
  reorderLevel: number;
  unitPrice: number;
  category: string;
  branchId: string | null;
  syncStatus: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  loyaltyPoints: number;
  creditBalance: number;
  creditLimit: number;
  status: string;
}

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export interface SaleItem {
  id: string;
  saleId: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: number;
  discount: number;
  loyaltyPointsUsed: number;
  loyaltyPointsEarned: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  notes: string | null;
  soldBy: string | null;
  syncStatus: string;
  createdAt: Date | string;
  items: SaleItem[];
  customer?: Customer | null;
}

export interface CreateSaleRequest {
  items: Array<{
    medicineId: string;
    quantity: number;
  }>;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  discount?: number;
  loyaltyPointsUsed?: number;
  paymentMethod: string;
  notes?: string;
  soldBy?: string;
}

export interface TodayStats {
  totalRevenue: number;
  salesCount: number;
}

export type PaymentMethod = 'CASH' | 'CARD' | 'MPESA' | 'CREDIT';

export const PAYMENT_METHODS = [
  { id: 'CASH', label: 'Cash', icon: 'Banknote' },
  { id: 'CARD', label: 'Card', icon: 'CreditCard' },
  { id: 'MPESA', label: 'M-Pesa', icon: 'Smartphone' },
  { id: 'CREDIT', label: 'Credit', icon: 'Wallet' },
] as const;

// Loyalty points: 1 point per 100 KES spent
export const POINTS_RATE = 100;
// Redemption: 1 point = 1 KES discount
export const POINTS_VALUE = 1;
