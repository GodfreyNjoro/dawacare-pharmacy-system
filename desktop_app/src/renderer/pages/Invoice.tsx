import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Printer,
  Building2,
  Phone,
  Mail,
  MapPin,
  CheckCircle,
  RefreshCw,
  XCircle,
} from 'lucide-react';
import { Button, Card, CardContent, Badge } from '../components/ui';
import { useNavigate, useParams } from 'react-router-dom';

interface SaleItem {
  id: string;
  medicineName: string;
  batchNumber: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod: string;
  paymentStatus: string;
  soldBy: string | null;
  notes: string | null;
  createdAt: string;
  items: SaleItem[];
}

export default function Invoice() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchSale = async () => {
      if (!id) return;
      try {
        const result = await window.electronAPI.getSaleById(id);
        if (result.success) {
          setSale(result.sale);
        }
      } catch (error) {
        console.error('Error fetching sale:', error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchSale();
  }, [id]);

  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '', 'height=600,width=800');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Invoice ${sale?.invoiceNumber}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            .invoice-header { text-align: center; margin-bottom: 30px; }
            .invoice-header h1 { color: #059669; margin: 0; }
            .invoice-details { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .invoice-details div { text-align: left; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f3f4f6; }
            .totals { text-align: right; }
            .totals p { margin: 5px 0; }
            .total-row { font-size: 18px; font-weight: bold; }
            .footer { text-align: center; margin-top: 30px; color: #666; }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-KE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <RefreshCw className="w-12 h-12 text-emerald-600 animate-spin" />
      </div>
    );
  }

  if (!sale) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Invoice not found</p>
          <Button onClick={() => navigate('/sales')}>
            Back to Sales
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Actions */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="outline" onClick={() => navigate('/sales')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Sales
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>
        </div>

        {/* Invoice */}
        <Card className="shadow-lg">
          <CardContent className="p-8" ref={printRef}>
            {/* Header */}
            <div className="invoice-header text-center mb-8">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Building2 className="w-8 h-8 text-emerald-600" />
                <h1 className="text-2xl font-bold text-emerald-700">
                  DawaCare Pharmacy
                </h1>
              </div>
              <p className="text-gray-600">Your Trusted Healthcare Partner</p>
              <div className="flex items-center justify-center gap-4 mt-2 text-sm text-gray-500">
                <span className="flex items-center gap-1">
                  <Phone className="w-3 h-3" /> +254 700 000 000
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3 h-3" /> info@dawacare.com
                </span>
              </div>
              <p className="text-sm text-gray-500 flex items-center justify-center gap-1 mt-1">
                <MapPin className="w-3 h-3" /> Nairobi, Kenya
              </p>
            </div>

            {/* Invoice Details */}
            <div className="invoice-details grid grid-cols-2 gap-8 mb-8 border-t border-b py-4">
              <div>
                <p className="text-sm text-gray-500">Invoice Number</p>
                <p className="font-mono font-bold text-lg text-emerald-700">
                  {sale.invoiceNumber}
                </p>
                <p className="text-sm text-gray-500 mt-2">Date</p>
                <p className="font-medium">{formatDate(sale.createdAt)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">Customer</p>
                <p className="font-medium">
                  {sale.customerName || 'Walk-in Customer'}
                </p>
                {sale.customerPhone && (
                  <p className="text-sm text-gray-600">{sale.customerPhone}</p>
                )}
                <p className="text-sm text-gray-500 mt-2">Payment</p>
                <div className="flex items-center justify-end gap-2">
                  <p className="font-medium">{sale.paymentMethod}</p>
                  <Badge
                    variant={
                      sale.paymentStatus === 'PAID'
                        ? 'success'
                        : sale.paymentStatus === 'VOIDED'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {sale.paymentStatus}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Items Table */}
            <table className="w-full mb-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">
                    Item
                  </th>
                  <th className="py-3 px-4 text-left text-sm font-semibold text-gray-700">
                    Batch
                  </th>
                  <th className="py-3 px-4 text-center text-sm font-semibold text-gray-700">
                    Qty
                  </th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">
                    Price
                  </th>
                  <th className="py-3 px-4 text-right text-sm font-semibold text-gray-700">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {sale.items.map((item) => (
                  <tr key={item.id} className="border-b">
                    <td className="py-3 px-4">{item.medicineName}</td>
                    <td className="py-3 px-4 text-sm text-gray-500">
                      {item.batchNumber}
                    </td>
                    <td className="py-3 px-4 text-center">{item.quantity}</td>
                    <td className="py-3 px-4 text-right">
                      KES {item.unitPrice.toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right font-medium">
                      KES {item.total.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Totals */}
            <div className="totals text-right space-y-2">
              <div className="flex justify-end gap-8">
                <span className="text-gray-600">Subtotal:</span>
                <span className="w-32">KES {sale.subtotal.toFixed(2)}</span>
              </div>
              {sale.discount > 0 && (
                <div className="flex justify-end gap-8 text-red-600">
                  <span>Discount:</span>
                  <span className="w-32">- KES {sale.discount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-end gap-8 text-xl font-bold border-t pt-2">
                <span>Total:</span>
                <span className="w-32 text-emerald-700">
                  KES {sale.total.toFixed(2)}
                </span>
              </div>
            </div>

            {/* Payment Status */}
            <div className="mt-6 flex items-center justify-center gap-2">
              {sale.paymentStatus === 'PAID' ? (
                <>
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  <span className="font-medium text-emerald-600">Payment Received - Thank You!</span>
                </>
              ) : sale.paymentStatus === 'VOIDED' ? (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  <span className="font-medium text-red-600">This sale has been voided</span>
                </>
              ) : (
                <span className="font-medium text-amber-600">Payment Pending</span>
              )}
            </div>

            {/* Notes */}
            {sale.notes && (
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Notes:</p>
                <p className="text-sm">{sale.notes}</p>
              </div>
            )}

            {/* Footer */}
            <div className="footer mt-8 text-center text-sm text-gray-500 border-t pt-4">
              <p>Thank you for choosing DawaCare Pharmacy!</p>
              <p className="text-xs mt-1">
                Served by: {sale.soldBy || 'Staff'}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
